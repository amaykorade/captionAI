import { NextResponse } from 'next/server';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Function to extract YouTube video ID from various YouTube URL formats
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Function to check if URL is a YouTube link
function isYouTubeUrl(url) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

export async function POST(request) {
  try {
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
    }

    // Check if it's a YouTube URL
    if (isYouTubeUrl(videoUrl)) {
      const videoId = extractYouTubeVideoId(videoUrl);
      
      if (videoId) {
        return NextResponse.json({
          success: false,
          isYouTube: true,
          videoId: videoId,
          message: 'YouTube videos require special processing. Please use the YouTube download option.',
          alternatives: [
            'Use a YouTube video downloader service first',
            'Download the video file and then upload it',
            'Use the YouTube video ID for alternative processing'
          ]
        });
      } else {
        return NextResponse.json({ 
          error: 'Invalid YouTube URL format' 
        }, { status: 400 });
      }
    }

    // For non-YouTube URLs, try direct processing
    try {
      // Initialize FFmpeg
      const ffmpeg = new FFmpeg();
      
      // Load FFmpeg
      await ffmpeg.load({
        coreURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      // Fetch video from URL
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch video from URL');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const inputFileName = 'input.mp4';
      await ffmpeg.writeFile(inputFileName, new Uint8Array(arrayBuffer));
      
      // Extract audio using FFmpeg
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vn', // No video
        '-acodec', 'mp3', // MP3 audio codec
        '-ab', '192k', // Audio bitrate
        '-ar', '44100', // Sample rate
        'output.mp3'
      ]);
      
      // Read the output file
      const data = await ffmpeg.readFile('output.mp3');
      
      // Clean up
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile('output.mp3');
      
      // Return the audio data as base64
      const base64Audio = Buffer.from(data).toString('base64');
      
      return NextResponse.json({ 
        success: true, 
        audioData: base64Audio,
        mimeType: 'audio/mp3'
      });
      
    } catch (processingError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to process video URL: ' + processingError.message,
        suggestions: [
          'Check if the URL is accessible',
          'Ensure the URL points to a direct video file',
          'Try downloading the video first and then upload the file'
        ]
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in extract-audio API:', error);
    return NextResponse.json({ 
      error: 'Server error: ' + error.message 
    }, { status: 500 });
  }
} 