import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth-config';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import User from '@/models/User';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configure route for large file processing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 10 minutes for large files

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

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ 
        error: 'Invalid request format. Please ensure the request contains valid JSON.' 
      }, { status: 400 });
    }
    
    const { audioData, audioFormat = 'mp3', quality = 'balanced' } = requestBody;
    
    if (!audioData) {
      return NextResponse.json({ error: 'Audio data is required' }, { status: 400 });
    }

    // Check audio data size (base64 data is larger than original file)
    const audioSize = Math.ceil(audioData.length * 0.75); // Approximate size in bytes
    const maxSize = 1000 * 1024 * 1024; // 1GB limit for chunked processing
    
    console.log('Received base64 data length:', audioData.length);
    console.log('Estimated original file size:', Math.round(audioSize / 1024 / 1024 * 100) / 100, 'MB');
    
    if (audioSize > maxSize) {
      return NextResponse.json({ 
        error: `Audio file too large (${Math.round(audioSize / 1024 / 1024)}MB). Maximum allowed size is 1GB.` 
      }, { status: 413 });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Create temporary files
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
    const outputDir = path.join(tempDir, `chunks_${Date.now()}`);
    
    try {
      // Create output directory
      fs.mkdirSync(outputDir, { recursive: true });
      
      // Write input file
      fs.writeFileSync(inputPath, audioBuffer);
      console.log('Input file written:', inputPath);
      
      // Get audio duration using ffprobe
      const { stdout: durationOutput } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`);
      const duration = parseFloat(durationOutput.trim()) || 300;
      
      console.log('Audio duration:', duration, 'seconds');
      
      // Calculate chunk size (aim for ~10 minute chunks)
      const chunkDuration = 600; // 10 minutes
      const numChunks = Math.ceil(duration / chunkDuration);
      
      console.log(`Splitting into ${numChunks} chunks of ~${chunkDuration}s each`);
      
      // Split audio into chunks
      const chunks = [];
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration;
        const endTime = Math.min((i + 1) * chunkDuration, duration);
        const chunkPath = path.join(outputDir, `chunk_${i}.mp3`);
        
        console.log(`Processing chunk ${i + 1}/${numChunks}: ${startTime}s to ${endTime}s`);
        
        // Extract chunk using ffmpeg
        await execAsync(`ffmpeg -i "${inputPath}" -ss ${startTime} -t ${endTime - startTime} -ac 1 -ar 16000 -ab 128k -acodec mp3 -y "${chunkPath}"`);
        
        // Read chunk file
        const chunkBuffer = fs.readFileSync(chunkPath);
        chunks.push({
          index: i,
          startTime,
          endTime,
          buffer: chunkBuffer,
          path: chunkPath
        });
      }
      
      console.log('Audio splitting completed');
      
      // Process each chunk with Whisper
      const results = [];
      let totalWords = 0;
      let totalDuration = 0;
      let allCaptions = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Transcribing chunk ${i + 1}/${chunks.length}`);
        
        // Create file stream for OpenAI
        const chunkBlob = new Blob([chunk.buffer], { type: 'audio/mp3' });
        const chunkFile = new File([chunkBlob], `chunk_${i}.mp3`, { type: 'audio/mp3' });
        
        // Transcribe chunk with Whisper
        const transcription = await openai.audio.transcriptions.create({
          file: chunkFile,
          model: "whisper-1",
          response_format: "verbose_json",
          timestamp_granularities: ["word"],
          temperature: 0.0,
          language: "en",
          prompt: "This is a natural conversation with casual speech, slang, and cultural references. Please transcribe accurately including all words, filler words, and informal language.",
          word_timestamps: true
        });
        
        // Adjust timestamps for chunk position
        const adjustedCaptions = transcription.words.map(word => ({
          ...word,
          start: word.start + chunk.startTime,
          end: word.end + chunk.startTime
        }));
        
        results.push({
          transcription: transcription.text,
          captions: adjustedCaptions,
          wordCount: transcription.words.length,
          duration: transcription.duration,
          language: transcription.language
        });
        
        // Accumulate metadata
        totalWords += transcription.words.length;
        totalDuration += transcription.duration;
        allCaptions.push(...adjustedCaptions);
        
        console.log(`Chunk ${i + 1} completed: ${transcription.words.length} words`);
      }
      
      // Combine all results
      const combinedTranscription = results.map(r => r.transcription).join('\n\n');
      
      // Generate caption formats
      const srtFormat = generateSRT(allCaptions);
      const vttFormat = generateVTT(allCaptions);
      const jsonFormat = JSON.stringify(allCaptions, null, 2);
      const videoFormat = generateVideoOptimizedCaptions(allCaptions);
      
      // Save project to database
      let savedProject = null;
      try {
        await connectDB();
        
        const projectData = {
          userId: user._id,
          title: `Chunked Transcription - ${new Date().toLocaleDateString()}`,
          description: `Large file transcription with ${allCaptions.length} caption segments`,
          audioUrl: 'chunked_audio',
          audioSize: audioBuffer.length,
          transcription: {
            rawText: combinedTranscription,
            enhancedText: combinedTranscription, // Will be enhanced separately if needed
            language: results[0]?.language || 'english',
            duration: totalDuration,
            wordCount: totalWords,
            quality: quality
          },
          captions: {
            segments: allCaptions,
            formats: {
              srt: srtFormat,
              vtt: vttFormat,
              json: jsonFormat,
              video: videoFormat
            },
            segmentCount: allCaptions.length
          },
          status: 'completed',
          processingTime: Math.round((Date.now() - startTime) / 1000)
        };
        
        const project = new Project(projectData);
        savedProject = await project.save();
        console.log('Project saved with ID:', savedProject._id);
        
      } catch (dbError) {
        console.error('Failed to save project to database:', dbError);
      }
      
      // Update user usage
      try {
        const update = {
          $inc: {
            transcriptionCount: 1,
            totalProcessingTime: totalDuration
          }
        };
        
        if (user.subscriptionPlan && user.subscriptionPlan !== 'free' && user.subscriptionStatus === 'active') {
          update.$inc.monthlyVideosProcessed = 1;
          update.$inc.monthlyTotalDuration = totalDuration;
        } else {
          update.$inc.freeTierVideosProcessed = 1;
          update.$inc.freeTierTotalDuration = totalDuration;
        }
        
        await User.updateOne({ _id: user._id }, update);
        console.log('User usage updated successfully');
        
      } catch (usageError) {
        console.error('Failed to update user usage:', usageError);
      }
      
      return NextResponse.json({
        success: true,
        transcription: combinedTranscription,
        captions: allCaptions,
        formats: {
          srt: srtFormat,
          vtt: vttFormat,
          json: jsonFormat,
          video: videoFormat
        },
        metadata: {
          language: results[0]?.language || 'english',
          duration: totalDuration,
          wordCount: totalWords,
          captionSegments: allCaptions.length,
          chunksProcessed: chunks.length
        },
        projectId: savedProject?._id || null
      });
      
    } finally {
      // Clean up temporary files
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputDir)) {
          fs.readdirSync(outputDir).forEach(file => {
            fs.unlinkSync(path.join(outputDir, file));
          });
          fs.rmdirSync(outputDir);
        }
        console.log('Temporary files cleaned up');
      } catch (cleanupError) {
        console.error('Error cleaning up temporary files:', cleanupError);
      }
    }
    
  } catch (error) {
    console.error('Error in chunked transcription API:', error);
    
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

// Helper functions for caption generation
function generateSRT(captions) {
  let srt = '';
  let index = 1;
  
  captions.forEach(caption => {
    const startTime = formatTime(caption.start);
    const endTime = formatTime(caption.end);
    srt += `${index}\n${startTime} --> ${endTime}\n${caption.word}\n\n`;
    index++;
  });
  
  return srt;
}

function generateVTT(captions) {
  let vtt = 'WEBVTT\n\n';
  
  captions.forEach(caption => {
    const startTime = formatTime(caption.start);
    const endTime = formatTime(caption.end);
    vtt += `${startTime} --> ${endTime}\n${caption.word}\n\n`;
  });
  
  return vtt;
}

function generateVideoOptimizedCaptions(captions) {
  return captions.map(caption => ({
    start: caption.start,
    end: caption.end,
    text: caption.word
  }));
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
} 