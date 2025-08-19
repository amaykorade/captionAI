import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { authenticateUser } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';

export async function POST(request) {
  const startTime = Date.now();
  
  try {
    // Authenticate user
    const authResult = await authenticateUser(request);
    
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please check your environment variables.' 
      }, { status: 500 });
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

    console.log('Processing audio transcription, size:', Math.round(audioSize / 1024 / 1024), 'MB');
    console.log('Quality setting:', quality);
    console.log('OpenAI API key available:', !!process.env.OPENAI_API_KEY);

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

    // Save project to database
    let savedProject = null;
    try {
      await connectDB();
      
      const projectData = {
        userId: authResult.userId, // Link project to authenticated user
        title: `Transcription - ${new Date().toLocaleDateString()}`,
        description: `Audio transcription with ${captions.length} caption segments`,
        audioUrl: 'processed_audio', // Placeholder since we don't store actual audio
        audioSize: audioBuffer.length,
        transcription: {
          rawText: transcription.text,
          enhancedText: '', // Will be filled when enhanced
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
      savedProject = await project.save();
      
      console.log('Project saved to database:', savedProject._id);
      
    } catch (dbError) {
      console.error('Failed to save project to database:', dbError);
      // Don't fail the transcription if database save fails
    }

    return NextResponse.json({
      success: true,
      transcription: transcription.text,
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