/* eslint-disable react/no-unescaped-entities */
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function Home() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [inputType, setInputType] = useState('file'); // 'file' or 'url'
  const [videoUrl, setVideoUrl] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcriptionStatus, setTranscriptionStatus] = useState('');
  const [captions, setCaptions] = useState(null);
  const [enhancedText, setEnhancedText] = useState('');
  const [enhancingText, setEnhancingText] = useState(false);
  const [enhancementProgress, setEnhancementProgress] = useState(0);
  const [transcriptionQuality, setTranscriptionQuality] = useState('high'); // 'high', 'balanced', 'fast'
  const [translatedText, setTranslatedText] = useState('');
  const [translatingText, setTranslatingText] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [targetLanguage, setTargetLanguage] = useState('hindi');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showProjects, setShowProjects] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isEditingCaptions, setIsEditingCaptions] = useState(false);
  const [editedSegments, setEditedSegments] = useState([]);
  const [savingEdits, setSavingEdits] = useState(false);
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [editedRawText, setEditedRawText] = useState('');
  const [savingRaw, setSavingRaw] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const fileInputRef = useRef(null);
  const ffmpegRef = useRef(null);
  
  // Chunked processing state
  const [isChunkedProcessing, setIsChunkedProcessing] = useState(false);
  const [chunkProgress, setChunkProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [chunkedTranscription, setChunkedTranscription] = useState('');
  const [chunkedCaptions, setChunkedCaptions] = useState([]);
  const [chunkedMetadata, setChunkedMetadata] = useState({});

  // Use NextAuth session
  const { data: session, status } = useSession();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Fetch user data when session changes
  useEffect(() => {
    const fetchUser = async () => {
      if (!session?.user?.email) {
        setUser(null);
        setUserLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/user/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setUserLoading(false);
      }
    };
    
    if (status === 'loading') return;
    fetchUser();
  }, [session, status]);

  const initFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    
    try {
      const ffmpeg = new FFmpeg();
      
      // Load FFmpeg with better error handling
      await ffmpeg.load({
        coreURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      ffmpegRef.current = ffmpeg;
      return ffmpeg;
    } catch (error) {
      console.error('Failed to initialize FFmpeg:', error);
      throw new Error('Failed to load audio processing engine. Please refresh the page and try again.');
    }
  };

  // Split large audio into chunks for processing
  const splitAudioIntoChunks = async (audioBlob, maxChunkSize = 75 * 1024 * 1024) => {
    const ffmpeg = await initFFmpeg();
    const chunks = [];
    
    // Write original audio to FFmpeg
    await ffmpeg.writeFile('input.mp3', await fetchFile(audioBlob));
    
    // Get audio duration
    const duration = await getAudioDuration(ffmpeg, 'input.mp3');
    const chunkDuration = Math.ceil(duration / Math.ceil(audioBlob.size / maxChunkSize));
    
    console.log(`Splitting ${Math.round(audioBlob.size / 1024 / 1024 * 100) / 100}MB audio into chunks of ~${chunkDuration}s`);
    
    // Split audio into chunks
    for (let i = 0; i < Math.ceil(duration / chunkDuration); i++) {
      const startTime = i * chunkDuration;
      const endTime = Math.min((i + 1) * chunkDuration, duration);
      const chunkName = `chunk_${i}.mp3`;
      
      await ffmpeg.exec([
        '-i', 'input.mp3',
        '-ss', startTime.toString(),
        '-t', (endTime - startTime).toString(),
        '-ac', '1',
        '-ar', '16000',
        '-ab', '128k',
        '-acodec', 'mp3',
        chunkName
      ]);
      
      const chunkData = await ffmpeg.readFile(chunkName);
      const chunkBlob = new Blob([chunkData], { type: 'audio/mp3' });
      
      chunks.push({
        index: i,
        startTime,
        endTime,
        blob: chunkBlob,
        name: chunkName
      });
      
      // Clean up chunk file
      await ffmpeg.deleteFile(chunkName);
    }
    
    // Clean up input file
    await ffmpeg.deleteFile('input.mp3');
    
    return chunks;
  };

  // Get audio duration using FFmpeg
  const getAudioDuration = async (ffmpeg, fileName) => {
    try {
      const result = await ffmpeg.exec([
        '-i', fileName,
        '-f', 'null',
        '-'
      ]);
      
      // Parse duration from FFmpeg output (this is a simplified approach)
      // In practice, you might want to use a more robust method
      return 300; // Default to 5 minutes if we can't determine duration
    } catch (error) {
      console.log('Could not determine audio duration, using default');
      return 300;
    }
  };

  // Process audio chunk by chunk
  const processAudioChunks = async (chunks) => {
    setIsChunkedProcessing(true);
    setTotalChunks(chunks.length);
    setCurrentChunk(0);
    setChunkProgress(0);
    setChunkedTranscription('');
    setChunkedCaptions([]);
    setChunkedMetadata({});
    
    const results = [];
    let totalWords = 0;
    let totalDuration = 0;
    let allCaptions = [];
    
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setCurrentChunk(i + 1);
        
        console.log(`Processing chunk ${i + 1}/${chunks.length} (${Math.round(chunk.blob.size / 1024 / 1024 * 100) / 100}MB)`);
        
        // Process this chunk
        const chunkResult = await processSingleChunk(chunk, i);
        results.push(chunkResult);
        
        // Update progress
        const progress = ((i + 1) / chunks.length) * 100;
        setChunkProgress(progress);
        
        // Accumulate metadata
        totalWords += chunkResult.wordCount || 0;
        totalDuration += chunkResult.duration || 0;
        allCaptions.push(...chunkResult.captions);
        
        // Update UI with partial results
        setChunkedTranscription(prev => prev + (prev ? '\n\n' : '') + chunkResult.transcription);
        setChunkedCaptions(prev => [...prev, ...chunkResult.captions]);
      }
      
      // Combine all results
      const combinedResult = {
        transcription: results.map(r => r.transcription).join('\n\n'),
        captions: results.map(r => r.captions).flat(),
        metadata: {
          wordCount: totalWords,
          duration: totalDuration,
          language: results[0]?.language || 'english',
          captionSegments: allCaptions.length
        }
      };
      
      setCaptions(combinedResult);
      setChunkedMetadata(combinedResult.metadata);
      
      console.log('Chunked processing completed:', combinedResult.metadata);
      
    } catch (error) {
      console.error('Error in chunked processing:', error);
      setTranscriptionError(`Chunked processing failed: ${error.message}`);
    } finally {
      setIsChunkedProcessing(false);
      setChunkProgress(0);
      setCurrentChunk(0);
      setTotalChunks(0);
    }
  };

  // Process a single audio chunk
  const processSingleChunk = async (chunk, chunkIndex) => {
    // Convert chunk to base64
    const arrayBuffer = await chunk.blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binary);
    
    // Call transcription API for this chunk
    const apiResponse = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        audioData: base64Audio,
        audioFormat: 'mp3',
        quality: transcriptionQuality,
        chunkIndex,
        isChunk: true
      }),
    });
    
    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(`Chunk ${chunkIndex + 1} failed: ${errorData.error || 'Unknown error'}`);
    }
    
    const data = await apiResponse.json();
    
    // Adjust timestamps for chunk position
    const adjustedCaptions = data.captions.map(caption => ({
      ...caption,
      start: caption.start + chunk.startTime,
      end: caption.end + chunk.startTime
    }));
    
    return {
      transcription: data.transcription,
      captions: adjustedCaptions,
      wordCount: data.metadata?.wordCount || 0,
      duration: data.metadata?.duration || 0,
      language: data.metadata?.language || 'english'
    };
  };

  const extractAudio = async (input) => {
    try {
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      setAudioUrl(null);

      console.log('Starting audio extraction for:', inputType === 'file' ? 'file upload' : 'URL');
      console.log('Input details:', input);

      if (inputType === 'file') {
        // Client-side processing for file uploads
        setProgress(10);
        console.log('Initializing FFmpeg...');
        
        const ffmpeg = await initFFmpeg();
        setProgress(20);
        console.log('FFmpeg initialized successfully');
        
        const inputFileName = 'input.mp4';
        console.log('Writing file to FFmpeg...');
        await ffmpeg.writeFile(inputFileName, await fetchFile(input));
        setProgress(30);
        console.log('File written successfully');

        // Extract audio using FFmpeg
        setProgress(40);
        console.log('Starting audio extraction...');
        await ffmpeg.exec([
          '-i', inputFileName,
          '-vn', // No video
          '-acodec', 'mp3', // MP3 audio codec
          '-ab', '192k', // Audio bitrate
          '-ar', '44100', // Sample rate
          'output.mp3'
        ]);
        setProgress(70);
        console.log('Audio extraction completed');

        // Read the output file
        setProgress(80);
        console.log('Reading output file...');
        const data = await ffmpeg.readFile('output.mp3');
        setProgress(90);
        console.log('Output file read successfully, size:', data.length);
        
        const blob = new Blob([data], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        
        setAudioUrl(url);
        setProgress(100);
        console.log('Audio extraction completed successfully');
        
        // Clean up
        await ffmpeg.deleteFile(inputFileName);
        await ffmpeg.deleteFile('output.mp3');
      } else {
        // Server-side processing for URLs
        setProgress(25);
        
        const response = await fetch('/api/extract-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoUrl: input
          }),
        });

        setProgress(75);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to extract audio from URL');
        }

        const result = await response.json();
        
        if (result.success) {
          // Convert base64 to blob
          const binaryString = atob(result.audioData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const blob = new Blob([bytes], { type: result.mimeType });
          const url = URL.createObjectURL(blob);
          
          setAudioUrl(url);
          setProgress(100);
        } else {
          throw new Error(result.error || 'Failed to extract audio');
        }
      }
      
    } catch (err) {
      console.error('Error extracting audio:', err);
      console.error('Error stack:', err.stack);
      setError(err.message || 'Failed to extract audio. Please check your input and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper flags for free-tier limit (admin users bypass all restrictions)
  const isAdmin = !!user && user.role === 'admin';
  const isFreePlanUser = !!user && !isAdmin && (user.subscriptionPlan === 'free' || user.subscriptionPlan === undefined);
  const freeVideosUsed = user?.usage?.freeTierVideosProcessed || 0;
  const freeDurationUsed = user?.usage?.freeTierTotalDuration || 0;
  const freeLimitReached = isFreePlanUser && (freeVideosUsed >= 1 || freeDurationUsed >= 600);

  // Debug logging
  useEffect(() => {
    if (user) {
      console.log('User state updated:', {
        subscriptionPlan: user.subscriptionPlan,
        freeVideosUsed,
        freeDurationUsed,
        freeLimitReached,
        usage: user.usage
      });
    }
  }, [user, freeVideosUsed, freeDurationUsed, freeLimitReached]);

  const handleFileUpload = (event) => {
    // Block if free tier limit reached
    if (isFreePlanUser && freeLimitReached) {
      setError('Free tier limit reached. Please upgrade your plan to process more videos.');
      return;
    }
    const file = event.target.files[0];
    if (!file) {
      setError('Please select a file.');
      return;
    }
    
    // Check file size (now supports much larger files with chunked processing)
    const maxSize = 500 * 1024 * 1024; // 500MB (will be processed in chunks)
    if (file.size > maxSize) {
      setError('File size too large. Please use a video file smaller than 500MB.');
      return;
    }
    
    console.log('Processing video file:', file.name, 'Size:', file.size, 'Type:', file.type);
    extractAudio(file);
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    // Block if free tier limit reached
    if (isFreePlanUser && freeLimitReached) {
      setError('Free tier limit reached. Please upgrade your plan to process more videos.');
      return;
    }
    if (videoUrl.trim()) {
      extractAudio(videoUrl.trim());
    } else {
      setError('Please enter a valid video URL.');
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'extracted_audio.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const resetForm = () => {
    setVideoFile(null);
    setVideoUrl('');
    setAudioUrl('');
    setCaptions(null);
    setEnhancedText('');
    setTranslatedText('');
    setTranscriptionError(null);
    setTranscriptionProgress(0);
    setTranscriptionStatus('');
    setEnhancingText(false);
    setEnhancementProgress(0);
    setTranslatingText(false);
    setTranslationProgress(0);
    setInputType('file');
  };

  const cancelTranscription = () => {
    if (abortController) {
      abortController.abort();
      setIsTranscribing(false);
      setTranscriptionProgress(0);
      setTranscriptionError('Transcription cancelled by user.');
    }
  };

  const transcribeAudio = async (audioUrl) => {
    try {
      // Check usage limits before starting transcription (admin users bypass all restrictions)
      if (user && !isAdmin && user.subscriptionPlan === 'free') {
        if (user.usage?.freeTierVideosProcessed >= 1) {
          setTranscriptionError('Free tier limit reached. Please upgrade your plan to process more videos.');
          return;
        }
        
        // Estimate video duration (rough approximation based on file size)
        const response = await fetch(audioUrl);
        const audioBlob = await response.blob();
        const estimatedDurationSeconds = Math.ceil(audioBlob.size / (1024 * 1024) * 60); // 1MB ≈ 1 minute
        
        if (estimatedDurationSeconds > 600) { // 10 minutes = 600 seconds
          setTranscriptionError('Video exceeds 10 minute limit for free tier. Please upgrade or use a shorter video.');
          return;
        }
        
        if ((user.usage?.freeTierTotalDuration || 0) + estimatedDurationSeconds > 600) {
          setTranscriptionError('Total duration limit exceeded for free tier. Please upgrade to process longer videos.');
          return;
        }
      }

      setIsTranscribing(true);
      setTranscriptionProgress(0);
      setTranscriptionError(null);
      setCaptions(null);

      // Create abort controller for cancellation
      const controller = new AbortController();
      setAbortController(controller);

      console.log('Starting transcription for audio URL:', audioUrl);

      // Convert audio URL to blob
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch audio data');
      }
      
      const audioBlob = await response.blob();
      console.log('Original audio blob size:', audioBlob.size, 'bytes');
      
      // Check file size and decide on processing method
      const maxSize = 75 * 1024 * 1024; // 75MB limit for single processing
      if (audioBlob.size > maxSize) {
        console.log(`Large file detected (${Math.round(audioBlob.size / 1024 / 1024)}MB), using chunked processing...`);
        
        // Use chunked processing for large files
        const chunks = await splitAudioIntoChunks(audioBlob);
        console.log(`Split into ${chunks.length} chunks for processing`);
        
        // Process chunks
        await processAudioChunks(chunks);
        return;
      }
      
      setTranscriptionProgress(10);

      // OPTIMIZATION: Compress audio using FFmpeg for faster processing
      console.log('Optimizing audio for better transcription quality...');
      const ffmpeg = await initFFmpeg();
      
      // Write original audio to FFmpeg
      await ffmpeg.writeFile('input.mp3', await fetchFile(audioBlob));
      setTranscriptionProgress(15);
      
      // Better audio optimization: maintain quality while optimizing for Whisper
      await ffmpeg.exec([
        '-i', 'input.mp3',
        '-ac', '1',           // Mono audio (better for speech recognition)
        '-ar', '16000',       // 16kHz sample rate (Whisper optimal)
        '-ab', '128k',        // Higher bitrate for better quality (was 64k)
        '-acodec', 'mp3',     // MP3 codec
        '-af', 'highpass=f=200,lowpass=f=8000', // Filter frequencies for speech
        'optimized.mp3'
      ]);
      setTranscriptionProgress(20);
      
      // Read optimized audio
      const optimizedData = await ffmpeg.readFile('optimized.mp3');
      const optimizedBlob = new Blob([optimizedData], { type: 'audio/mp3' });
      
      console.log('Optimized audio size:', optimizedBlob.size, 'bytes');
      console.log('Size reduction:', Math.round((1 - optimizedBlob.size / audioBlob.size) * 100), '%');
      
      // Clean up FFmpeg files
      await ffmpeg.deleteFile('input.mp3');
      await ffmpeg.deleteFile('optimized.mp3');
      
      setTranscriptionProgress(25);

      // Convert optimized audio blob to base64 more efficiently
      const arrayBuffer = await optimizedBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Use a more efficient base64 conversion
      let binary = '';
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Audio = btoa(binary);
      
      console.log('Base64 conversion completed, length:', base64Audio.length);
      console.log('Base64 size in MB:', Math.round(base64Audio.length / 1024 / 1024 * 100) / 100);
      console.log('Size increase from base64 encoding:', Math.round((base64Audio.length / audioBlob.size - 1) * 100), '%');
      setTranscriptionProgress(30);

      // Add timeout for the API call (reduced from 5 minutes to 2 minutes)
      const timeoutDuration = 120000; // 2 minutes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Transcription timeout. Please try again with a shorter audio file.')), timeoutDuration);
      });

      // Call transcription API with timeout and abort controller
      const apiResponse = await Promise.race([
        fetch('/api/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            audioData: base64Audio,
            audioFormat: 'mp3',
            quality: transcriptionQuality
          }),
          signal: controller.signal,
        }),
        timeoutPromise
      ]);

      if (apiResponse.status === 401) {
        window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      if (!apiResponse.ok) {
        let errorData;
        try {
          errorData = await apiResponse.json();
        } catch (parseError) {
          // Handle cases where response is not JSON
          if (apiResponse.status === 413) {
            setTranscriptionError('File too large for processing. Please use a smaller video file (under 100MB) or compress your video.');
            return;
          }
          errorData = { error: 'Unknown error occurred' };
        }
        
        // Handle specific error types
        if (apiResponse.status === 413) {
          setTranscriptionError('File too large for processing. Please use a smaller video file (under 100MB) or compress your video.');
          return;
        }
        
        // Handle usage limit errors specifically
        if (apiResponse.status === 403 && errorData.requiresUpgrade) {
          setTranscriptionError(`${errorData.error} Please upgrade your plan to continue.`);
          // Refresh user data to show updated usage
          const userRes = await fetch('/api/user/me', { credentials: 'include' });
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.success) {
              setUser(userData.user);
            }
          }
          return;
        }
        
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const data = await apiResponse.json();
      
      setCaptions({
        transcription: data.transcription,
        captions: data.captions,
        formats: data.formats,
        metadata: data.metadata
      });
      
      // Save project ID for database integration
      if (data.projectId) {
        setCurrentProjectId(data.projectId);
        console.log('Project saved with ID:', data.projectId);
      }
      
      setTranscriptionProgress(100);
      setTranscriptionStatus('Transcription completed successfully!');
      
      // Refresh user usage after a successful transcription so UI disables further uploads on free tier
      try {
        const userRes = await fetch('/api/user/me', { credentials: 'include' });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.success) {
            setUser(userData.user);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('auth:changed'));
            }
          }
        }
      } catch {}
      
      console.log('Transcription completed:', {
        wordCount: data.metadata.wordCount,
        duration: data.metadata.duration,
        language: data.metadata.language,
        captionSegments: data.metadata.captionSegments
      });
      
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Transcription was cancelled');
        return;
      }
      console.error('Error transcribing audio:', err);
      setTranscriptionError(err.message || 'Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
      setAbortController(null);
    }
  };

  const handleDownloadCaptions = (format) => {
    if (!captions) return;
    
    let content, filename, mimeType;
    
    switch (format) {
      case 'srt':
        content = captions.formats.srt;
        filename = 'captions.srt';
        mimeType = 'text/plain';
        break;
      case 'vtt':
        content = captions.formats.vtt;
        filename = 'captions.vtt';
        mimeType = 'text/plain';
        break;
      case 'json':
        content = captions.formats.json;
        filename = 'captions.json';
        mimeType = 'application/json';
        break;
      default:
        return;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const enhanceText = async () => {
    if (!captions?.transcription) {
      setTranscriptionError('No transcription available to enhance');
      return;
    }

    setEnhancingText(true);
    setEnhancementProgress(0);
    setEnhancedText('');

    try {
      setEnhancementProgress(10);
      
      const response = await fetch('/api/enhance-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentProjectId && { 'x-project-id': currentProjectId })
        },
        body: JSON.stringify({
          rawText: captions.transcription,
          language: captions.metadata?.language || 'english'
        }),
      });

      setEnhancementProgress(50);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enhance text');
      }

      const data = await response.json();
      setEnhancedText(data.enhancedText);
      setEnhancementProgress(100);

      console.log('Text enhancement completed:', {
        originalLength: data.metadata.originalLength,
        enhancedLength: data.metadata.enhancedLength,
        model: data.metadata.model
      });

    } catch (error) {
      console.error('Error enhancing text:', error);
      setTranscriptionError(`Failed to enhance text: ${error.message}`);
    } finally {
      setEnhancingText(false);
      setEnhancementProgress(0);
    }
  };

  const translateText = async () => {
    if (!enhancedText) {
      setTranscriptionError('No enhanced text available to translate');
      return;
    }

    setTranslatingText(true);
    setTranslationProgress(0);
    setTranslatedText('');

    try {
      setTranslationProgress(10);
      
      const response = await fetch('/api/translate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: enhancedText,
          targetLanguage: targetLanguage,
          sourceLanguage: captions.metadata?.language || 'english'
        }),
      });

      setTranslationProgress(50);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to translate text');
      }

      const data = await response.json();
      setTranslatedText(data.translatedText);
      setTranslationProgress(100);

      console.log('Text translation completed:', {
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        originalLength: data.metadata.originalLength,
        translatedLength: data.metadata.translatedLength,
        model: data.metadata.model
      });

    } catch (error) {
      console.error('Error translating text:', error);
      setTranscriptionError(`Failed to translate text: ${error.message}`);
    } finally {
      setTranslatingText(false);
      setTranslationProgress(0);
    }
  };

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProject = async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        const project = data.project;
        
        // Load project data into the UI
        setCaptions({
          transcription: project.transcription.rawText,
          captions: project.captions.segments,
          formats: project.captions.formats,
          metadata: {
            wordCount: project.transcription.wordCount,
            duration: project.transcription.duration,
            language: project.transcription.language,
            captionSegments: project.captions.segmentCount
          }
        });
        
        if (project.transcription.enhancedText) {
          setEnhancedText(project.transcription.enhancedText);
        }
        
        setCurrentProjectId(projectId);
        setShowProjects(false);
        
        console.log('Project loaded:', project.title);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const deleteProject = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setProjects(projects.filter(p => p._id !== projectId));
        if (currentProjectId === projectId) {
          setCurrentProjectId(null);
        }
        console.log('Project deleted:', projectId);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };



  const audioBufferToBlob = async (audioBuffer) => {
    // Convert AudioBuffer to Blob
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    
    // Create WAV file
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const generateSRTFromSegments = (segments) => {
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
      const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
      return `${hours}:${minutes}:${secs},${ms}`;
    };
    let srt = '';
    let index = 1;
    for (const seg of segments) {
      srt += `${index}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n\n`;
      index++;
    }
    return srt;
  };

  const generateVTTFromSegments = (segments) => {
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
      const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
      return `${hours}:${minutes}:${secs}.${ms}`;
    };
    let vtt = 'WEBVTT\n\n';
    for (const seg of segments) {
      vtt += `${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n\n`;
    }
    return vtt;
  };

  const mapFullTextToSegments = (fullText, baseSegments) => {
    if (!fullText || !baseSegments?.length) return baseSegments || [];
    const words = fullText.trim().split(/\s+/);
    const totalTarget = words.length;
    const counts = baseSegments.map(s => Math.max(1, s.wordCount || (s.text ? s.text.trim().split(/\s+/).length : 1)));
    const sumCounts = counts.reduce((a,b)=>a+b,0);
    const mapped = [];
    let cursor = 0;
    for (let i=0;i<baseSegments.length;i++) {
      const base = baseSegments[i];
      const sliceLen = i === baseSegments.length - 1 ? (totalTarget - cursor) : Math.max(1, Math.round((counts[i]/sumCounts)*totalTarget));
      const slice = words.slice(cursor, cursor + sliceLen);
      cursor += sliceLen;
      mapped.push({ ...base, text: slice.join(' ') });
    }
    // In case rounding left extras or deficit, adjust last segment
    if (cursor < totalTarget && mapped.length) {
      mapped[mapped.length-1].text += ' ' + words.slice(cursor).join(' ');
    }
    return mapped;
  };

  const applyCaptionEdits = async () => {
    if (!captions) return;
    setSavingEdits(true);
    try {
      const newSrt = generateSRTFromSegments(editedSegments);
      const newVtt = generateVTTFromSegments(editedSegments);
      const newJson = JSON.stringify(editedSegments, null, 2);

      const updated = {
        transcription: captions.transcription,
        captions: editedSegments,
        formats: {
          ...captions.formats,
          srt: newSrt,
          vtt: newVtt,
          json: newJson
        },
        metadata: {
          ...captions.metadata,
          captionSegments: editedSegments.length,
          wordCount: editedSegments.reduce((a, s) => a + (s.wordCount || 0), 0)
        }
      };

      setCaptions(updated);
      setIsEditingCaptions(false);

      if (currentProjectId) {
        await fetch(`/api/projects/${currentProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            captions: {
              segments: editedSegments,
              formats: updated.formats,
              segmentCount: editedSegments.length
            },
            transcription: {
              rawText: captions.transcription,
              enhancedText: enhancedText || '',
              language: captions.metadata?.language,
              duration: captions.metadata?.duration,
              wordCount: updated.metadata.wordCount
            }
          })
        });
      }
    } catch (e) {
      console.error('Failed to save edits', e);
      setTranscriptionError('Failed to save caption edits');
    } finally {
      setSavingEdits(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Subtitle Generator
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Extract audio from videos and generate professional subtitles with AI
          </p>
          
          {/* Plan and Usage */}
          {!userLoading && user && !isAdmin && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                    Plan: {((user.subscriptionPlan || 'free').charAt(0).toUpperCase() + (user.subscriptionPlan || 'free').slice(1))}
                  </h3>
                  {(user.subscriptionPlan === 'free' || user.subscriptionPlan === undefined) ? (
                    <>
                      <p className="text-yellow-700 text-sm">
                        You've used {user.usage?.freeTierVideosProcessed || 0}/1 videos 
                        ({Math.round((user.usage?.freeTierTotalDuration || 0) / 60)}/10 minutes)
                      </p>
                      {user.usage?.freeTierVideosProcessed >= 1 && (
                        <p className="text-red-600 text-sm font-medium mt-1">
                          ⚠️ Free tier limit reached. Upgrade to process more videos.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-yellow-700 text-sm">
                      Your subscription is active. Enjoy higher limits and faster processing.
                    </p>
                  )}
                </div>
                <Link
                  href="/pricing"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  {user.subscriptionPlan === 'free' ? 'Upgrade Plan' : 'Manage Plan'}
                </Link>
              </div>
            </div>
          )}

          {/* Admin Status Display */}
          {!userLoading && user && isAdmin && (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-purple-800 mb-2">
                    🛡️ Admin Access - Unlimited Usage
                  </h3>
                  <p className="text-purple-700 text-sm">
                    You have full administrative access with no usage restrictions.
                  </p>
                </div>
                <div className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">
                  Admin
                </div>
              </div>
            </div>
          )}
          
          {/* Projects Button */}
          <div className="mb-6">
            <button
              onClick={() => {
                setShowProjects(true);
                loadProjects();
              }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
            >
              📁 My Projects
            </button>
          </div>
        </div>

        {/* Input Type Toggle */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setInputType('file')}
                className={`px-4 py-2 rounded-md transition-all ${
                  inputType === 'file'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Upload Video File
              </button>
              <button
                onClick={() => setInputType('url')}
                className={`px-4 py-2 rounded-md transition-all ${
                  inputType === 'url'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Video URL
              </button>
            </div>
          </div>

          {/* File Upload Section */}
          {inputType === 'file' && (
            <div className="text-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessing || freeLimitReached}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || freeLimitReached}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Processing...' : (freeLimitReached ? 'Limit Reached' : 'Choose Video File')}
                </button>
                {freeLimitReached && (
                  <div className="mt-3 text-sm">
                    <span className="text-red-600 mr-2">Free tier limit reached.</span>
                    <Link href="/pricing" className="text-blue-600 hover:underline">Upgrade to continue →</Link>
                  </div>
                )}
                <p className="text-gray-500 mt-2">
                  Supports MP4, AVI, MOV, and other video formats
                </p>
        </div>
            </div>
          )}

          {/* URL Input Section */}
          {inputType === 'url' && (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Enter video URL (direct video links work best)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isProcessing || freeLimitReached}
                />
              </div>
              <button
                type="submit"
                disabled={isProcessing || !videoUrl.trim() || freeLimitReached}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : (freeLimitReached ? 'Limit Reached' : 'Extract Audio')}
              </button>
              {freeLimitReached && (
                <div className="text-sm">
                  <span className="text-red-600 mr-2">Free tier limit reached.</span>
                  <Link href="/pricing" className="text-blue-600 hover:underline">Upgrade to continue →</Link>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">URL Processing Guide:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>✅ <strong>Direct video links:</strong> MP4, AVI, MOV files hosted online</li>
                  <li>⚠️ <strong>YouTube/Vimeo:</strong> Not directly supported due to platform restrictions</li>
                  <li>💡 <strong>Alternative:</strong> Download video first, then upload the file</li>
                </ul>
              </div>
            </form>
          )}
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>Extracting audio...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 mb-2">{error}</p>
            {error.includes('YouTube') && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h4 className="font-semibold text-yellow-800 mb-2">YouTube Video Processing:</h4>
                <p className="text-yellow-700 text-sm mb-2">
                  YouTube videos cannot be processed directly due to platform restrictions. Here are your options:
                </p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>1. <strong>Download the video first</strong> using a YouTube downloader service</li>
                  <li>2. <strong>Upload the downloaded video file</strong> using the file upload option</li>
                  <li>3. <strong>Use direct video links</strong> from other sources</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Audio Player and Download */}
        {audioUrl && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Extracted Audio
            </h3>
            <div className="space-y-4">
              <audio controls className="w-full" src={audioUrl}>
                Your browser does not support the audio element.
              </audio>
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Download MP3
                </button>
                {/* Generate Captions Button */}
                <div className="mt-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transcription Quality
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="quality"
                          value="high"
                          checked={transcriptionQuality === 'high'}
                          onChange={(e) => setTranscriptionQuality(e.target.value)}
                          className="mr-2 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">High Quality (Slower)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="quality"
                          value="balanced"
                          checked={transcriptionQuality === 'balanced'}
                          onChange={(e) => setTranscriptionQuality(e.target.value)}
                          className="mr-2 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">Balanced</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="quality"
                          value="fast"
                          checked={transcriptionQuality === 'fast'}
                          onChange={(e) => setTranscriptionQuality(e.target.value)}
                          className="mr-2 text-blue-600"
                        />
                        <span className="text-sm text-blue-600">Fast (Lower Quality)</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      High Quality: Better accuracy, slower processing. Fast: Quicker processing, may miss some words.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => transcribeAudio(audioUrl)}
                    disabled={!audioUrl || isTranscribing}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
                  >
                    {isTranscribing ? 'Generating Subtitles...' : 'Generate Subtitles'}
                  </button>
                  
                  <div className="mt-3 flex gap-3">
                    <button
                      onClick={resetForm}
                      className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transcription Progress */}
        {isTranscribing && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>Generating subtitles with Whisper...</span>
              <span>{transcriptionProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${transcriptionProgress}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Audio Processing:</span>
                <span>{transcriptionProgress >= 10 ? '✅' : '⏳'}</span>
              </div>
              <div className="flex justify-between">
                <span>Audio Optimization:</span>
                <span>{transcriptionProgress >= 20 ? '✅' : '⏳'}</span>
              </div>
              <div className="flex justify-between">
                <span>Base64 Conversion:</span>
                <span>{transcriptionProgress >= 30 ? '✅' : '⏳'}</span>
              </div>
              <div className="flex justify-between">
                <span>API Request:</span>
                <span>{transcriptionProgress >= 50 ? '✅' : '⏳'}</span>
              </div>
              <div className="flex justify-between">
                <span>Whisper Processing:</span>
                <span>{transcriptionProgress >= 80 ? '✅' : '⏳'}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtitle Generation:</span>
                <span>{transcriptionProgress >= 100 ? '✅' : '⏳'}</span>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              <p><strong>Note:</strong> Transcription time depends on audio length and quality. Longer audio files may take several minutes to process.</p>
              <div className="mt-2 text-xs">
                <p><strong>Typical processing times (with optimization):</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>1 minute audio: ~15-20 seconds</li>
                  <li>5 minutes audio: ~1-2 minutes</li>
                  <li>10+ minutes audio: ~3-5 minutes</li>
                </ul>
                <p className="mt-2"><strong>Optimizations applied:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>Mono audio conversion (faster processing)</li>
                  <li>16kHz sample rate (Whisper optimal)</li>
                  <li>64kbps bitrate (smaller file size)</li>
                </ul>
                <p className="mt-2"><strong>Tip:</strong> For fastest results, use shorter video clips.</p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <button
                onClick={cancelTranscription}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Cancel Transcription
              </button>
            </div>
          </div>
        )}

        {/* Chunked Processing Progress */}
        {isChunkedProcessing && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>Processing large file in chunks...</span>
              <span>{Math.round(chunkProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${chunkProgress}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Current Chunk:</span>
                <span>{currentChunk} / {totalChunks}</span>
              </div>
              <div className="flex justify-between">
                <span>Overall Progress:</span>
                <span>{Math.round(chunkProgress)}%</span>
              </div>
            </div>
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              <p><strong>Large File Processing:</strong> Your file is being processed in chunks for optimal performance.</p>
              <div className="mt-2 text-xs">
                <p><strong>What's happening:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>File split into {totalChunks} manageable chunks</li>
                  <li>Each chunk processed individually for accuracy</li>
                  <li>Results automatically combined for seamless output</li>
                  <li>Timestamps properly synchronized across chunks</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 text-center">
              <button
                onClick={cancelTranscription}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Cancel Processing
              </button>
            </div>
          </div>
        )}

        {/* Transcription Error */}
        {transcriptionError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 mb-2">{transcriptionError}</p>
            {transcriptionError.includes('API key') && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                <strong>Note:</strong> You need to set your OpenAI API key in the environment variables.
              </div>
            )}
          </div>
        )}

        {/* Captions Display */}
        {captions && (
          <div className="mt-8 p-6 bg-white rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Generated Subtitles
            </h3>
            
            {/* Metadata */}
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Words:</span> {captions.metadata?.wordCount || 0}
                </div>
                <div>
                  <span className="font-medium">Duration:</span> {captions.metadata?.duration || 0}s
                </div>
                <div>
                  <span className="font-medium">Language:</span> {captions.metadata?.language || 'Unknown'}
                </div>
                <div>
                  <span className="font-medium">Subtitle Segments:</span> {captions.metadata?.captionSegments || 0}
                </div>
              </div>
            </div>

            {/* Caption Segments Preview */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-medium text-gray-700">Subtitle Segments (Video Sync)</h4>
                {!isEditingCaptions ? (
                  <button
                    onClick={() => {
                      setEditedSegments(captions.captions || []);
                      setIsEditingCaptions(true);
                    }}
                    className="px-3 py-1 text-sm bg-gray-800 hover:bg-black text-white rounded-md"
                  >
                                          Edit Subtitles
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={applyCaptionEdits}
                      disabled={savingEdits}
                      className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
                    >
                      {savingEdits ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingCaptions(false);
                        setEditedSegments([]);
                      }}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {!isEditingCaptions ? (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {captions.captions?.slice(0, 10).map((caption, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-md border-l-4 border-blue-500">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          Segment {index + 1}
                        </span>
                        <span className="text-xs text-gray-500">
                          {caption.start.toFixed(2)}s → {caption.end.toFixed(2)}s
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{caption.text}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {caption.wordCount} words • {(caption.end - caption.start).toFixed(1)}s duration
                      </div>
                    </div>
                  ))}
                  {captions.captions?.length > 10 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      +{captions.captions.length - 10} more segments...
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {editedSegments.map((seg, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-md border">
                      <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
                        <span>Segment {idx + 1}</span>
                        <span>{seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s</span>
                      </div>
                      <textarea
                        value={seg.text}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditedSegments(prev => prev.map((s, i) => i === idx ? { ...s, text: v } : s));
                        }}
                        className="w-full border rounded p-2 text-sm"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Raw Transcription */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-medium text-gray-700">Raw Transcription</h4>
                {!isEditingRaw ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => navigator.clipboard.writeText(captions.transcription)}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                    >
                      Copy Text
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([captions.transcription || ''], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'transcript_raw.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors"
                    >
                      Download .txt
                    </button>
                    {/* New: Per-section SRT/VTT downloads for Raw using original timestamps */}
                    {captions?.captions && (
                      <>
                        <button
                          onClick={() => {
                            // Prefer prebuilt format if available, else regenerate
                            const srt = captions.formats?.srt || generateSRTFromSegments(captions.captions);
                            const blob = new Blob([srt], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = 'transcript_raw.srt';
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                        >
                          Download SRT (Original)
                        </button>
                        <button
                          onClick={() => {
                            const vtt = captions.formats?.vtt || generateVTTFromSegments(captions.captions);
                            const blob = new Blob([vtt], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = 'transcript_raw.vtt';
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                        >
                          Download VTT (Original)
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setEditedRawText(captions.transcription || ''); setIsEditingRaw(true); }}
                      className="px-3 py-1 text-sm bg-gray-800 hover:bg-black text-white rounded-md transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setSavingRaw(true);
                        try {
                          // Update UI state
                          setCaptions(prev => ({ ...prev, transcription: editedRawText }));
                          // Persist to DB
                          if (currentProjectId) {
                            await fetch(`/api/projects/${currentProjectId}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({
                                transcription: {
                                  rawText: editedRawText,
                                  enhancedText: enhancedText || '',
                                  language: captions.metadata?.language,
                                  duration: captions.metadata?.duration,
                                  wordCount: captions.metadata?.wordCount
                                }
                              })
                            });
                          }
                          setIsEditingRaw(false);
                        } catch (e) {
                          console.error('Failed to save raw text', e);
                          setTranscriptionError('Failed to save raw transcription');
                        } finally {
                          setSavingRaw(false);
                        }
                      }}
                      disabled={savingRaw}
                      className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
                    >
                      {savingRaw ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setIsEditingRaw(false); setEditedRawText(''); }}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              {!isEditingRaw ? (
                <div className="p-4 bg-gray-50 rounded-md max-h-40 overflow-y-auto">
                  <p className="text-gray-800 whitespace-pre-wrap">{captions.transcription}</p>
                </div>
              ) : (
                <div className="p-2 bg-white rounded-md border">
                  <textarea
                    value={editedRawText}
                    onChange={(e)=>setEditedRawText(e.target.value)}
                    rows={6}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Enhanced Text Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-medium text-gray-700">Enhanced Text (Nuance Preserved)</h4>
                {!enhancedText && (
                  <button
                    onClick={enhanceText}
                    disabled={enhancingText}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors flex items-center gap-2"
                  >
                    {enhancingText ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Enhancing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Enhance with ChatGPT
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {enhancingText && (
                <div className="mb-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${enhancementProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Enhancing text with ChatGPT...</p>
                </div>
              )}

              {enhancedText && (
                <div className="p-4 bg-blue-50 rounded-md max-h-40 overflow-y-auto border border-blue-200">
                  <p className="text-gray-800 whitespace-pre-wrap">{enhancedText}</p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => navigator.clipboard.writeText(enhancedText)}
                      className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
                    >
                      Copy Enhanced
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([enhancedText || ''], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'transcript_enhanced.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
                    >
                      Download .txt
                    </button>
                    {/* New: Per-section SRT/VTT downloads for Enhanced */}
                    {captions?.captions && (
                      <>
                        <button
                          onClick={() => {
                            const segs = mapFullTextToSegments(enhancedText, captions.captions);
                            const srt = generateSRTFromSegments(segs);
                            const blob = new Blob([srt], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = 'transcript_enhanced.srt';
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="px-3 py-1 text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md transition-colors"
                        >
                          Download SRT (Enhanced)
                        </button>
                        <button
                          onClick={() => {
                            const segs = mapFullTextToSegments(enhancedText, captions.captions);
                            const vtt = generateVTTFromSegments(segs);
                            const blob = new Blob([vtt], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = 'transcript_enhanced.vtt';
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="px-3 py-1 text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md transition-colors"
                        >
                          Download VTT (Enhanced)
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setEnhancedText('')}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              )}

              {/* Translation Section */}
              {enhancedText && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-md font-medium text-gray-700">Translate to Other Languages</h5>
                    <div className="flex items-center gap-3">
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white"
                      >
                        <option value="hindi">Hindi</option>
                        <option value="spanish">Spanish</option>
                        <option value="french">French</option>
                        <option value="german">German</option>
                        <option value="italian">Italian</option>
                        <option value="portuguese">Portuguese</option>
                        <option value="russian">Russian</option>
                        <option value="japanese">Japanese</option>
                        <option value="korean">Korean</option>
                        <option value="chinese">Chinese</option>
                        <option value="arabic">Arabic</option>
                        <option value="dutch">Dutch</option>
                        <option value="swedish">Swedish</option>
                        <option value="norwegian">Norwegian</option>
                        <option value="danish">Danish</option>
                        <option value="polish">Polish</option>
                        <option value="turkish">Turkish</option>
                        <option value="thai">Thai</option>
                        <option value="vietnamese">Vietnamese</option>
                        <option value="indonesian">Indonesian</option>
                        <option value="malay">Malay</option>
                        <option value="filipino">Filipino</option>
                        <option value="urdu">Urdu</option>
                        <option value="bengali">Bengali</option>
                        <option value="tamil">Tamil</option>
                        <option value="telugu">Telugu</option>
                        <option value="marathi">Marathi</option>
                        <option value="gujarati">Gujarati</option>
                        <option value="kannada">Kannada</option>
                        <option value="malayalam">Malayalam</option>
                      </select>
                      <button
                        onClick={translateText}
                        disabled={translatingText}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md transition-colors flex items-center gap-2"
                      >
                        {translatingText ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Translating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3l7 12 2-9 1.5 4.5L22 12l-9-11z" />
                            </svg>
                            Translate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {translatingText && (
                    <div className="mb-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${translationProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Translating to {targetLanguage}...</p>
                    </div>
                  )}

                  {translatedText && (
                    <div className="p-4 bg-green-50 rounded-md max-h-40 overflow-y-auto border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-800">Translated to {targetLanguage}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setTranslatedText('')}
                            className="text-xs text-green-600 hover:text-green-800"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{translatedText}</p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <button
                          onClick={() => navigator.clipboard.writeText(translatedText)}
                          className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors"
                        >
                          Copy Translation
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([translatedText || ''], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `transcript_${targetLanguage}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors"
                        >
                          Download .txt
                        </button>
                        {/* New: Per-section SRT/VTT downloads for Translated */}
                        {captions?.captions && (
                          <>
                            <button
                              onClick={() => {
                                const segs = mapFullTextToSegments(translatedText, captions.captions);
                                const srt = generateSRTFromSegments(segs);
                                const blob = new Blob([srt], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `transcript_${targetLanguage}.srt`;
                                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              className="px-3 py-1 text-sm bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-md transition-colors"
                            >
                              Download SRT (Translated)
                            </button>
                            <button
                              onClick={() => {
                                const segs = mapFullTextToSegments(translatedText, captions.captions);
                                const vtt = generateVTTFromSegments(segs);
                                const blob = new Blob([vtt], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `transcript_${targetLanguage}.vtt`;
                                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              className="px-3 py-1 text-sm bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-md transition-colors"
                            >
                              Download VTT (Translated)
                            </button>
                          </>
                        )}
                        <button
                          onClick={translateText}
                          className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors"
                        >
                          Retranslate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Download Options */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleDownloadCaptions('srt')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
              >
                Download SRT (Original)
              </button>
              <button
                onClick={() => handleDownloadCaptions('vtt')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Download VTT (Original)
              </button>
              <button
                onClick={() => handleDownloadCaptions('json')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                Download JSON (Original)
              </button>
              {enhancedText && captions?.captions && (
                <>
                  <button
                    onClick={() => {
                      const segs = mapFullTextToSegments(enhancedText, captions.captions);
                      const srt = generateSRTFromSegments(segs);
                      const blob = new Blob([srt], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = 'transcript_enhanced.srt';
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                  >
                    Download SRT (Enhanced)
                  </button>
                  <button
                    onClick={() => {
                      const segs = mapFullTextToSegments(enhancedText, captions.captions);
                      const vtt = generateVTTFromSegments(segs);
                      const blob = new Blob([vtt], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = 'transcript_enhanced.vtt';
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                  >
                    Download VTT (Enhanced)
                  </button>
                </>
              )}
              {translatedText && captions?.captions && (
                <>
                  <button
                    onClick={() => {
                      const segs = mapFullTextToSegments(translatedText, captions.captions);
                      const srt = generateSRTFromSegments(segs);
                      const blob = new Blob([srt], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `transcript_${targetLanguage}.srt`;
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors"
                  >
                    Download SRT (Translated)
                  </button>
                  <button
                    onClick={() => {
                      const segs = mapFullTextToSegments(translatedText, captions.captions);
                      const vtt = generateVTTFromSegments(segs);
                      const blob = new Blob([vtt], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `transcript_${targetLanguage}.vtt`;
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors"
                  >
                    Download VTT (Translated)
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Video Processing</h3>
            <p className="text-gray-600 text-sm">Upload videos and extract high-quality audio</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">AI Transcription</h3>
            <p className="text-gray-600 text-sm">Generate accurate subtitles using OpenAI Whisper</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Multiple Formats</h3>
            <p className="text-gray-600 text-sm">Download subtitles in SRT, VTT, and JSON formats</p>
          </div>
        </div>
      </div>

      {/* Projects Modal */}
      {showProjects && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">My Projects</h2>
              <button
                onClick={() => setShowProjects(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            {loadingProjects ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading projects...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No projects found. Create your first transcription to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 mb-2">{project.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{project.description}</p>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>Language: {project.transcription?.language || 'Unknown'}</span>
                          <span>Duration: {project.transcription?.duration || 0}s</span>
                          <span>Words: {project.transcription?.wordCount || 0}</span>
                          <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => loadProject(project._id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteProject(project._id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
