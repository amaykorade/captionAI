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
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

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

    // Check audio data size more accurately
    // Base64 encoding increases size by ~33%, so we need to account for this
    const base64Size = audioData.length;
    const estimatedOriginalSize = Math.ceil(base64Size * 0.75); // More accurate estimation
    
    // Set reasonable limits for chunked processing
    const maxBase64Size = 2 * 1024 * 1024 * 1024; // 2GB base64 data
    const maxOriginalSize = 1.5 * 1024 * 1024 * 1024; // 1.5GB original file
    
    console.log('=== CHUNKED TRANSCRIPTION START ===');
    console.log('User:', user.email);
    console.log('Received base64 data length:', base64Size);
    console.log('Estimated original file size:', Math.round(estimatedOriginalSize / 1024 / 1024 * 100) / 100, 'MB');
    console.log('Memory usage before processing:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, 'MB');
    
    if (base64Size > maxBase64Size) {
      console.log('File too large - base64 size exceeds limit');
      return NextResponse.json({ 
        error: `Audio file too large (${Math.round(base64Size / 1024 / 1024 / 1024 * 100) / 100}GB base64). Maximum allowed size is 2GB base64 data.` 
      }, { status: 413 });
    }

    if (estimatedOriginalSize > maxOriginalSize) {
      console.log('File too large - estimated original size exceeds limit');
      return NextResponse.json({ 
        error: `Audio file too large (${Math.round(estimatedOriginalSize / 1024 / 1024 / 1024 * 100) / 100}GB). Maximum allowed size is 1.5GB.` 
      }, { status: 413 });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create temporary files
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
    const outputDir = path.join(tempDir, `chunks_${Date.now()}`);
    
    try {
      // Create output directory
      fs.mkdirSync(outputDir, { recursive: true });
      
      // Write input file in chunks to avoid memory issues
      console.log('Writing input file to disk...');
      await writeBase64ToFile(audioData, inputPath);
      console.log('Input file written:', inputPath);
      console.log('Memory usage after writing file:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, 'MB');
      
      // Get audio duration using ffprobe
      console.log('Getting audio duration with ffprobe...');
      const { stdout: durationOutput } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`);
      const duration = parseFloat(durationOutput.trim()) || 300;
      
      console.log('Audio duration:', duration, 'seconds');
      
      // Calculate optimal chunk size based on file size
      // For very large files, use smaller chunks to avoid memory issues
      let chunkDuration;
      if (estimatedOriginalSize > 500 * 1024 * 1024) { // > 500MB
        chunkDuration = 300; // 5 minute chunks for very large files
      } else if (estimatedOriginalSize > 100 * 1024 * 1024) { // > 100MB
        chunkDuration = 600; // 10 minute chunks for large files
      } else {
        chunkDuration = 900; // 15 minute chunks for smaller files
      }
      
      const numChunks = Math.ceil(duration / chunkDuration);
      
      console.log(`Splitting into ${numChunks} chunks of ~${chunkDuration}s each`);
      
      // Split audio into chunks
      const chunks = [];
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration;
        const endTime = Math.min((i + 1) * chunkDuration, duration);
        const chunkPath = path.join(outputDir, `chunk_${i}.mp3`);
        
        console.log(`Processing chunk ${i + 1}/${numChunks}: ${startTime}s to ${endTime}s`);
        
        // Extract chunk using ffmpeg with optimized settings
        await execAsync(`ffmpeg -i "${inputPath}" -ss ${startTime} -t ${endTime - startTime} -ac 1 -ar 16000 -ab 128k -acodec mp3 -y "${chunkPath}"`);
        
        // Get chunk file size
        const chunkStats = fs.statSync(chunkPath);
        chunks.push({
          index: i,
          startTime,
          endTime,
          path: chunkPath,
          size: chunkStats.size
        });
        
        console.log(`Chunk ${i + 1} created: ${Math.round(chunkStats.size / 1024 / 1024 * 100) / 100}MB`);
      }
      
      console.log('Audio splitting completed');
      console.log('Memory usage after splitting:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, 'MB');
      
      // Process each chunk with Whisper
      const results = [];
      let totalWords = 0;
      let totalDuration = 0;
      let allCaptions = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Transcribing chunk ${i + 1}/${chunks.length} (${Math.round(chunk.size / 1024 / 1024 * 100) / 100}MB)`);
        
        try {
          // Read chunk file
          const chunkBuffer = fs.readFileSync(chunk.path);
          
          // Create file stream for OpenAI
          const chunkBlob = new Blob([chunkBuffer], { type: 'audio/mp3' });
          const chunkFile = new File([chunkBlob], `chunk_${i}.mp3`, { type: 'audio/mp3' });
          
          // Transcribe chunk with Whisper
          console.log(`Sending chunk ${i + 1} to OpenAI Whisper...`);
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
          
          // Free memory by clearing chunk buffer and blob
          chunkBuffer = null;
          chunkBlob = null;
          chunkFile = null;
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          
          console.log(`Memory usage after chunk ${i + 1}:`, Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, 'MB');
          
        } catch (chunkError) {
          console.error(`Error processing chunk ${i + 1}:`, chunkError);
          
          // Continue with other chunks if one fails
          results.push({
            transcription: `[Error processing chunk ${i + 1}: ${chunkError.message}]`,
            captions: [],
            wordCount: 0,
            duration: 0,
            language: 'en'
          });
        }
      }
      
      console.log('All chunks processed successfully');
      console.log('Memory usage after processing all chunks:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, 'MB');
      
      // Combine all results
      const combinedTranscription = results.map(r => r.transcription).join('\n\n');
      
      // Generate caption formats
      console.log('Generating caption formats...');
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
          audioSize: estimatedOriginalSize,
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
      
      console.log('=== CHUNKED TRANSCRIPTION COMPLETED ===');
      console.log('Total processing time:', Math.round((Date.now() - startTime) / 1000), 'seconds');
      console.log('Final memory usage:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, 'MB');
      
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
          chunksProcessed: chunks.length,
          originalFileSize: Math.round(estimatedOriginalSize / 1024 / 1024 * 100) / 100 + 'MB'
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
    console.error('=== CHUNKED TRANSCRIPTION ERROR ===');
    console.error('Error in chunked transcription API:', error);
    console.error('Error stack:', error.stack);
    console.error('Memory usage at error:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, 'MB');
    
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
    
    // Check for specific memory-related errors
    if (error.message && error.message.includes('ENOMEM')) {
      return NextResponse.json({ 
        error: 'Server ran out of memory processing this file. Please try with a smaller file or contact support.' 
      }, { status: 500 });
    }
    
    if (error.message && error.message.includes('timeout')) {
      return NextResponse.json({ 
        error: 'Processing timeout. The file is too large to process within the time limit. Please try with a smaller file.' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to transcribe audio: ' + error.message 
    }, { status: 500 });
  }
}

// Helper function to write base64 data to file in chunks to avoid memory issues
async function writeBase64ToFile(base64Data, filePath) {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(base64Data, 'base64');
    const writeStream = fs.createWriteStream(filePath);
    
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    
    // Write buffer to stream
    writeStream.write(buffer);
    writeStream.end();
  });
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