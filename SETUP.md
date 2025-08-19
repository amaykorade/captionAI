# Video to Captions App - Setup Guide

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up OpenAI API Key

To use the Whisper transcription feature, you need an OpenAI API key:

1. **Get your API key** from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Create a `.env.local` file** in your project root:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   ```
3. **Replace** `your_actual_api_key_here` with your real API key

### 3. Start Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 🎯 Features

- **Video Upload**: Support for MP4, AVI, MOV, and other formats
- **Audio Extraction**: High-quality MP3 output (192kbps)
- **AI Transcription**: OpenAI Whisper integration for accurate captions
- **Multiple Formats**: Download captions in SRT, VTT, and JSON
- **Word-level Timestamps**: Professional-grade caption timing

## 🔧 Troubleshooting

### Runtime Errors
If you see Turbopack-related errors, the app now uses standard webpack bundler.

### API Key Issues
- Ensure your `.env.local` file is in the project root
- Restart the development server after adding the API key
- Check that the API key is valid and has credits

### Video Processing Issues
- Keep video files under 100MB for best performance
- Use standard video formats (MP4, AVI, MOV)
- Ensure good audio quality for better transcription

## 📱 Usage

1. **Upload Video**: Drag & drop or click to select a video file
2. **Extract Audio**: Wait for audio extraction to complete
3. **Generate Captions**: Click "Generate Captions" to use Whisper
4. **Download**: Choose your preferred caption format (SRT, VTT, JSON)

## 🎵 Supported Audio Formats

- **Input**: Any video format with audio
- **Output**: MP3 (192kbps, 44.1kHz)
- **Transcription**: OpenAI Whisper API

## 🔑 API Requirements

- **OpenAI Account**: Required for Whisper transcription
- **API Credits**: Each transcription uses API credits
- **Rate Limits**: Be aware of OpenAI's rate limits 