import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth-config';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import User from '@/models/User';
import mongoose from 'mongoose';

export async function POST(request) {
  const startTime = Date.now();
  
  try {
    let user = null;
    
    // Try NextAuth session first
    const session = await getServerSession(authOptions);
    
    if (session?.user?.email) {
      // NextAuth session found
      await connectDB();
      user = await User.findOne({ email: session.user.email });
    } else {
      // Try manual JWT auth
      const authHeader = request.headers.get('cookie');
      if (authHeader) {
        const authToken = authHeader.split('auth_token=')[1]?.split(';')[0];
        if (authToken) {
          try {
            const jwt = await import('jsonwebtoken');
            const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            
            await connectDB();
            user = await User.findById(decoded.userId);
          } catch (jwtError) {
            // JWT verification failed
          }
        }
      }
    }
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    // Connect to database to check user limits
    await connectDB();
    if (!user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    const { audioData, audioFormat = 'mp3', quality = 'balanced' } = await request.json();
    
    if (!audioData) {
      return NextResponse.json({ error: 'Audio data is required' }, { status: 400 });
    }

    // Check audio data size
    const audioSize = Math.ceil(audioData.length * 0.75); // Approximate size in bytes
    const maxSize = 25 * 1024 * 1024; // 25MB limit
    
    if (audioSize > maxSize) {
      return NextResponse.json({ 
        error: `Audio file too large (${Math.round(audioSize / 1024 / 1024)}MB). Please use a smaller file.` 
      }, { status: 400 });
    }

    // Estimate duration for current request (rough) - define once for all branches
    const estimatedDurationSeconds = Math.ceil(audioSize / (1024 * 1024) * 60);

    // Define variables in main scope for later use
    let isPaidActive = false;
    let reservedFreeUsage = false;

    // Admin bypass
    if (user.role === 'admin') {
      console.log('Admin user detected. Bypassing plan limits.');
      // proceed without any checks
    } else {

      // Enforce tier limits with expiry check
      const now = new Date();
      const isExpired = user.subscriptionRenewsAt && now >= new Date(user.subscriptionRenewsAt);
      if (isExpired && user.subscriptionStatus === 'active' && user.subscriptionPlan && user.subscriptionPlan !== 'free') {
        // Mark as expired lazily
        await User.updateOne({ _id: user._id }, { $set: { subscriptionStatus: 'expired' } });
        user.subscriptionStatus = 'expired';
      }

      isPaidActive = (user.subscriptionPlan && user.subscriptionPlan !== 'free') && user.subscriptionStatus === 'active' && (!user.subscriptionRenewsAt || now < new Date(user.subscriptionRenewsAt));

      // keep defined for later reconciliation

      // Helper: ensure monthly window for paid users (calendar month based on UTC)
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

      if (isPaidActive) {
        // Reset monthly counters if period changed
        if (!user.monthlyPeriodStart || !user.monthlyPeriodEnd || new Date(user.monthlyPeriodStart).getTime() !== monthStart.getTime()) {
          await User.updateOne({ _id: user._id }, {
            $set: {
              monthlyVideosProcessed: 0,
              monthlyTotalDuration: 0,
              monthlyPeriodStart: monthStart,
              monthlyPeriodEnd: nextMonthStart
            }
          });
          user.monthlyVideosProcessed = 0;
          user.monthlyTotalDuration = 0;
          user.monthlyPeriodStart = monthStart;
          user.monthlyPeriodEnd = nextMonthStart;
        }

        // Enforce paid plan monthly limits
        const planLimits = {
          creator: { videos: 10, perVideoMaxDuration: 600 },
          pro: { videos: 1000, perVideoMaxDuration: 3600 },
          enterprise: { videos: 1000000, perVideoMaxDuration: 24 * 3600 }
        };
        const limits = planLimits[user.subscriptionPlan] || planLimits.creator;

        if ((user.monthlyVideosProcessed || 0) >= limits.videos) {
          return NextResponse.json({
            error: 'Monthly video limit reached for your plan (10 videos). Please renew or upgrade.',
            requiresUpgrade: true,
            currentPlan: user.subscriptionPlan,
            usage: {
              videosProcessed: user.monthlyVideosProcessed || 0,
              totalDuration: user.monthlyTotalDuration || 0,
              periodEnd: user.monthlyPeriodEnd
            }
          }, { status: 403 });
        }

        // Per-video cap enforcement (<= 10 minutes)
        if (estimatedDurationSeconds > limits.perVideoMaxDuration) {
          return NextResponse.json({
            error: 'This video exceeds your per-video limit of 10 minutes. Please upload a shorter video or upgrade.',
            requiresUpgrade: true,
            currentPlan: user.subscriptionPlan,
            usage: {
              videosProcessed: user.monthlyVideosProcessed || 0,
              totalDuration: user.monthlyTotalDuration || 0,
              periodEnd: user.monthlyPeriodEnd
            }
          }, { status: 403 });
        }
      } else {
        // If previously paid but expired, instruct to renew
        if (user.subscriptionPlan && user.subscriptionPlan !== 'free' && user.subscriptionStatus !== 'active') {
          return NextResponse.json({
            error: 'Your subscription has expired. Please renew to continue using paid features.',
            requiresUpgrade: true,
            currentPlan: user.subscriptionPlan,
          }, { status: 403 });
        }

        // Free plan enforcement using projects as source of truth
        const [projectCount, durationAgg] = await Promise.all([
          Project.countDocuments({ userId: user._id, status: 'completed' }),
          Project.aggregate([
            { $match: { userId: user._id, status: 'completed' } },
            { $group: { _id: null, totalDuration: { $sum: { $ifNull: ['$transcription.duration', 0] } } } }
          ])
        ]);
        const usedDuration = (durationAgg[0]?.totalDuration) || 0;

        if (projectCount >= 1) {
          return NextResponse.json({
            error: 'Free tier limit reached. You have already processed your free video. Please upgrade to continue.',
            requiresUpgrade: true,
            currentPlan: user.subscriptionPlan || 'free',
            usage: { videosProcessed: projectCount, totalDuration: usedDuration, maxDuration: 600 }
          }, { status: 403 });
        }

        if (estimatedDurationSeconds > 600 || usedDuration + estimatedDurationSeconds > 600) {
          return NextResponse.json({
            error: 'Video exceeds 10 minute limit for the free tier. Please upgrade or use a shorter video.',
            requiresUpgrade: true,
            currentPlan: user.subscriptionPlan || 'free',
            usage: { videosProcessed: projectCount, totalDuration: usedDuration, maxDuration: 600 }
          }, { status: 403 });
        }
      }
    }

    // Note: We keep the previous atomic reservation as an additional guard but not required now

    console.log('Processing audio transcription, size:', Math.round(audioSize / 1024 / 1024), 'MB');
    console.log('Estimated duration:', estimatedDurationSeconds, 'seconds');
    console.log('Quality setting:', quality);
    console.log('OpenAI API key available:', !!process.env.OPENAI_API_KEY);

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please check your environment variables.' 
      }, { status: 500 });
    }

    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    console.log('Sending to Whisper API...');
    console.log('Audio buffer size:', audioBuffer.length, 'bytes');
    
    // Create a temporary file that the OpenAI SDK can handle
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Create a temporary file path
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio_${Date.now()}.mp3`);
    
    // Declare transcription variable outside try block
    let transcription;
    
    try {
      // Write the audio buffer to the temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);
      console.log('Temporary file created:', tempFilePath);
      console.log('File size on disk:', fs.statSync(tempFilePath).size, 'bytes');
      
      // Verify the file is readable
      if (!fs.existsSync(tempFilePath)) {
        throw new Error('Temporary file was not created');
      }
      
      // Create a file stream that the OpenAI SDK can read
      const fileStream = fs.createReadStream(tempFilePath);
      
      // Add error handling for the file stream
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        throw new Error(`File stream error: ${error.message}`);
      });
      
      // Add timeout to prevent hanging requests (increased to 5 minutes)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.log('Timeout reached, cleaning up...');
          reject(new Error('Whisper API request timeout after 5 minutes'));
        }, 300000); // 5 minutes
      });
      
      // Configure Whisper parameters based on quality setting
      let whisperParams = {
        file: fileStream,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
        temperature: 0.0, // Lower temperature for more accurate transcription
        language: "en", // Specify English for better accuracy
        prompt: "This is a natural conversation with casual speech, slang, and cultural references. Please transcribe accurately including all words, filler words, and informal language.",
        word_timestamps: true
      };

      // Adjust parameters based on quality setting
      if (quality === 'high') {
        whisperParams.chunk_length_s = 15; // Smaller chunks for better accuracy
        whisperParams.chunk_overlap_s = 3;  // More overlap
        console.log('Using high quality settings: 15s chunks, 3s overlap');
      } else if (quality === 'balanced') {
        whisperParams.chunk_length_s = 30; // Standard chunks
        whisperParams.chunk_overlap_s = 5;  // Standard overlap
        console.log('Using balanced quality settings: 30s chunks, 5s overlap');
      } else if (quality === 'fast') {
        whisperParams.chunk_length_s = 60; // Larger chunks for speed
        whisperParams.chunk_overlap_s = 2;  // Less overlap
        console.log('Using fast quality settings: 60s chunks, 2s overlap');
      }

      console.log('Starting Whisper API call with quality:', quality);
      
      // Use the OpenAI SDK with the file stream
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Transcribe audio using Whisper with timeout
      transcription = await Promise.race([
        openai.audio.transcriptions.create(whisperParams),
        timeoutPromise
      ]);
      
      console.log('Whisper API response received, processing...');
      console.log('Transcription result:', {
        text: transcription.text?.substring(0, 100) + '...',
        words: transcription.words?.length || 0,
        language: transcription.language,
        duration: transcription.duration
      });
      
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log('Temporary file cleaned up');
      }
    }

    // Format the response with timestamps
    // Group words into meaningful phrases for better video sync
    const captions = groupWordsIntoPhrases(transcription.words);

    // Generate different caption formats
    const srtFormat = generateSRT(captions);
    const vttFormat = generateVTT(captions);
    const jsonFormat = JSON.stringify(captions, null, 2);
    const videoFormat = generateVideoOptimizedCaptions(captions);

    console.log('Caption generation completed');
    console.log('Generated', captions.length, 'caption segments for video sync');

    // Enhance text with ChatGPT if OpenAI API key is available
    let enhancedText = '';
    if (process.env.OPENAI_API_KEY && transcription.text) {
      try {
        console.log('Enhancing text with ChatGPT...');
        
        // Use the existing OpenAI client to enhance text directly
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a transcription enhancement expert. Your job is to rewrite transcripts while preserving all nuance, slang, cultural references, humor, and tone. Make the text more readable and natural while keeping the creator's authentic voice."
            },
            {
              role: "user",
              content: `Rewrite this transcript preserving slang, cultural nuance, humor, tone, and meaning. Do not make it formal unless needed.

Raw Transcript:
${transcription.text}

Instructions:
- Keep the original meaning and context
- Preserve slang, informal language, and cultural references
- Maintain humor and tone
- Keep it natural and conversational
- Only make it formal if the original content requires it
- Ensure readability while maintaining authenticity

Enhanced Transcript:`
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        });
        
        enhancedText = completion.choices[0].message.content.trim();
        console.log('Text enhancement completed');
      } catch (enhanceError) {
        console.log('Text enhancement error, using original text:', enhanceError.message);
        enhancedText = transcription.text;
      }
    } else {
      enhancedText = transcription.text;
    }

    // Save project to database
    let savedProject = null;
    try {
      console.log('Attempting to save project to database...');
      console.log('User ID:', user._id);
      
      // Ensure database is connected before saving
      await connectDB();
      
      const projectData = {
        userId: user._id, // Link project to authenticated user
        title: `Transcription - ${new Date().toLocaleDateString()}`,
        description: `Audio transcription with ${captions.length} caption segments`,
        audioUrl: 'processed_audio', // Placeholder since we don't store actual audio
        audioSize: audioBuffer.length,
        transcription: {
          rawText: transcription.text,
          enhancedText: enhancedText, // Now populated with enhanced text
          language: transcription.language,
          duration: transcription.duration,
          wordCount: transcription.words.length,
          quality: quality
        },
        captions: {
          segments: captions,
          formats: {
            srt: srtFormat,
            vtt: vttFormat,
            json: jsonFormat,
            video: videoFormat
          },
          segmentCount: captions.length
        },
        status: 'completed',
        processingTime: Math.round((Date.now() - startTime) / 1000)
      };
      
      const project = new Project(projectData);
      
      // Validate the project before saving
      const validationError = project.validateSync();
      if (validationError) {
        throw validationError;
      }
      
      savedProject = await project.save();
       
    } catch (dbError) {
      console.error('Failed to save project to database:', dbError);
      // Don't fail the transcription if database save fails
    }

    // Ensure user usage is updated after successful transcription (even if project save failed)
    try {
      const actualDuration = transcription.duration || estimatedDurationSeconds;
      const update = {
        $inc: {
          transcriptionCount: 1,
          totalProcessingTime: actualDuration
        }
      };
      if (isPaidActive) {
        // Increment monthly counters within the current period
        update.$inc.monthlyVideosProcessed = 1;
        update.$inc.monthlyTotalDuration = actualDuration;
        update.$set = {
          monthlyPeriodStart: user.monthlyPeriodStart,
          monthlyPeriodEnd: user.monthlyPeriodEnd
        };
      } else {
        // Free plan reconciliation
        if (reservedFreeUsage) {
          const durationDelta = actualDuration - estimatedDurationSeconds;
          if (durationDelta !== 0) {
            update.$inc.freeTierTotalDuration = durationDelta;
          }
        } else {
          update.$inc.freeTierVideosProcessed = 1;
          update.$inc.freeTierTotalDuration = actualDuration;
        }
      }
      await User.updateOne({ _id: user._id }, update);
      console.log('User usage updated successfully');
    } catch (usageError) {
      console.error('Failed to update user usage:', usageError);
      // Don't fail the transcription if usage update fails
    }

    return NextResponse.json({
      success: true,
      transcription: transcription.text,
      enhancedText: enhancedText,
      captions: captions,
      formats: {
        srt: srtFormat,
        vtt: vttFormat,
        json: jsonFormat,
        video: videoFormat
      },
      metadata: {
        language: transcription.language,
        duration: transcription.duration,
        wordCount: captions.length,
        captionSegments: captions.length
      },
      projectId: savedProject?._id || null
    });

  } catch (error) {
    console.error('Error in transcription API:', error);
    
    if (error.status === 401) {
      return NextResponse.json({ 
        error: 'Invalid API key. Please check your OpenAI API key.' 
      }, { status: 401 });
    }
    
    if (error.status === 429) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      }, { status: 429 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to transcribe audio: ' + error.message 
    }, { status: 500 });
  }
}

// Generate SRT format captions
function generateSRT(captions) {
  let srt = '';
  let index = 1;
  
  captions.forEach(caption => {
    const startTime = formatTime(caption.start);
    const endTime = formatTime(caption.end);
    srt += `${index}\n${startTime} --> ${endTime}\n${caption.text}\n\n`;
    index++;
  });
  
  return srt;
}

// Group words into meaningful phrases for better video synchronization
function groupWordsIntoPhrases(words) {
  if (!words || words.length === 0) return [];
  
  const phrases = [];
  let currentPhrase = {
    start: words[0].start,
    end: words[0].end,
    text: words[0].word,
    words: [words[0]]
  };
  
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const prevWord = words[i - 1];
    
    // Check if we should start a new phrase
    const shouldStartNewPhrase = (
      // Time gap is too large (more than 1 second)
      word.start - prevWord.end > 1.0 ||
      // Word is a sentence starter (capitalized after punctuation)
      (word.word.match(/^[A-Z]/) && prevWord.word.match(/[.!?]$/)) ||
      // Phrase is getting too long (more than 3 seconds or 15 words)
      (word.start - currentPhrase.start > 3.0) ||
      (currentPhrase.words.length >= 15) ||
      // Natural pause indicators
      word.word.match(/^[.!?]$/) ||
      prevWord.word.match(/[.!?]$/)
    );
    
    if (shouldStartNewPhrase) {
      // Finalize current phrase
      currentPhrase.end = prevWord.end;
      currentPhrase.text = currentPhrase.words.map(w => w.word).join(' ');
      phrases.push({ ...currentPhrase });
      
      // Start new phrase
      currentPhrase = {
        start: word.start,
        end: word.end,
        text: word.word,
        words: [word]
      };
    } else {
      // Add word to current phrase
      currentPhrase.words.push(word);
      currentPhrase.end = word.end;
    }
  }
  
  // Add the last phrase
  if (currentPhrase.words.length > 0) {
    currentPhrase.text = currentPhrase.words.map(w => w.word).join(' ');
    phrases.push(currentPhrase);
  }
  
  // Ensure minimum duration for each caption (at least 0.5 seconds)
  return phrases.map(phrase => {
    const duration = phrase.end - phrase.start;
    if (duration < 0.5) {
      phrase.end = phrase.start + 0.5;
    }
    return {
      start: phrase.start,
      end: phrase.end,
      text: phrase.text,
      wordCount: phrase.words.length
    };
  });
}

// Generate VTT format captions
function generateVTT(captions) {
  let vtt = 'WEBVTT\n\n';
  
  captions.forEach(caption => {
    const startTime = formatTimeVTT(caption.start);
    const endTime = formatTimeVTT(caption.end);
    vtt += `${startTime} --> ${endTime}\n${caption.text}\n\n`;
  });
  
  return vtt;
}

// Generate video-optimized captions for professional video editing
function generateVideoOptimizedCaptions(captions) {
  let videoCaptions = '';
  
  captions.forEach((caption, index) => {
    const startTime = formatTime(caption.start);
    const endTime = formatTime(caption.end);
    const duration = caption.end - caption.start;
    
    // Add timing information for video editors
    videoCaptions += `[${index + 1}] ${startTime} --> ${endTime} (${duration.toFixed(2)}s)\n`;
    videoCaptions += `Text: ${caption.text}\n`;
    videoCaptions += `Words: ${caption.wordCount}\n`;
    videoCaptions += `---\n\n`;
  });
  
  return videoCaptions;
}

// Format time for SRT (HH:MM:SS,mmm)
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Format time for VTT (HH:MM:SS.mmm)
function formatTimeVTT(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
} 