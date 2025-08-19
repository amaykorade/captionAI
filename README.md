# AI Caption Generator

A powerful web application that extracts audio from videos and generates professional captions using OpenAI's Whisper API and ChatGPT for enhancement and translation.

## ✨ Features

- **🎬 Video Processing**: Upload video files or provide URLs
- **🎵 Audio Extraction**: Extract audio using FFmpeg.wasm
- **🤖 AI Transcription**: High-quality transcription with Whisper API
- **📝 Text Enhancement**: ChatGPT-powered nuance preservation
- **🌍 Multi-Language**: Translate to 30+ languages
- **📊 Video Sync**: Perfectly timed captions for video production
- **💾 Database Storage**: MongoDB integration for project management
- **📁 Project History**: Save, load, and manage transcription projects

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB (local or MongoDB Atlas)
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd caption_ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the project root:
   ```env
   # OpenAI API Key
   OPENAI_API_KEY=your_actual_openai_api_key_here
   
   # MongoDB Connection String
   # For local development:
   MONGODB_URI=mongodb://localhost:27017/caption_ai
   
   # For MongoDB Atlas:
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/caption_ai
   
   # JWT Secret Key (change in production)
   JWT_SECRET=your_super_secret_jwt_key_here
   ```

4. **MongoDB Setup**
   - **Local MongoDB**: Install and start MongoDB locally
   - **MongoDB Atlas**: Create a free cluster and get your connection string
   - The app will automatically create the database and collections

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

7. **Create an account**
   - Register with email and password
   - Login to access the app
   - All projects are now user-specific and secure

## 🎯 How It Works

### 1. Video Upload/URL
- Upload video files (MP4, AVI, MOV, etc.)
- Provide video URLs for processing
- Support for various video formats

### 2. Audio Extraction
- Client-side audio extraction using FFmpeg.wasm
- Audio optimization for better transcription
- Automatic format conversion and compression

### 3. AI Transcription
- Whisper API for high-quality speech recognition
- Configurable quality settings (High, Balanced, Fast)
- Word-level timestamps with phrase grouping

### 4. Text Enhancement
- ChatGPT-powered text enhancement
- Preserves slang, humor, and cultural nuance
- Maintains creator's authentic voice

### 5. Multi-Language Translation
- Support for 30+ languages
- Cultural adaptation and context preservation
- Professional-quality translations

### 6. Video-Synchronized Captions
- SRT, VTT, JSON, and Video formats
- Perfect timing for video production
- Professional broadcast quality

### 7. Project Management
- Automatic project saving to MongoDB
- Project history and management
- Load and continue previous work

## 📊 Quality Settings

### High Quality
- **Chunk Size**: 15 seconds
- **Overlap**: 3 seconds
- **Best For**: Complex speech, multiple speakers
- **Trade-off**: Slower processing, higher cost

### Balanced (Default)
- **Chunk Size**: 30 seconds
- **Overlap**: 5 seconds
- **Best For**: Most use cases
- **Trade-off**: Moderate speed and cost

### Fast
- **Chunk Size**: 60 seconds
- **Overlap**: 2 seconds
- **Best For**: Clear speech, time-sensitive
- **Trade-off**: Faster processing, may miss words

## 🗄️ Database Schema

### Project Model
```javascript
{
  title: String,
  description: String,
  videoFile: { originalName, size, type },
  videoUrl: String,
  audioUrl: String,
  audioSize: Number,
  transcription: {
    rawText: String,
    enhancedText: String,
    language: String,
    duration: Number,
    wordCount: Number,
    quality: String
  },
  captions: {
    segments: Array,
    formats: Object,
    segmentCount: Number
  },
  translations: Array,
  status: String,
  processingTime: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## 🔧 API Endpoints

- `POST /api/extract-audio` - Extract audio from video URLs
- `POST /api/transcribe` - Generate transcriptions with Whisper
- `POST /api/enhance-text` - Enhance text with ChatGPT
- `POST /api/translate-text` - Translate text to other languages
- `GET /api/projects` - Retrieve all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get specific project
- `PUT /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project

## 📁 Project Management

### Save Projects
- Projects are automatically saved after transcription
- Enhanced text and translations are stored
- Processing time and quality settings tracked

### Load Projects
- Access previous transcriptions
- Continue enhancement and translation
- View project history and metadata

### Manage Projects
- Delete unwanted projects
- Organize by creation date
- Track processing statistics

## 🌍 Supported Languages

### Transcription
- English (primary)
- Auto-detection for other languages

### Translation
- Hindi, Spanish, French, German, Italian
- Portuguese, Russian, Japanese, Korean, Chinese
- Arabic, Dutch, Swedish, Norwegian, Danish
- Polish, Turkish, Thai, Vietnamese, Indonesian
- Malay, Filipino, Urdu, Bengali, Tamil
- Telugu, Marathi, Gujarati, Kannada, Malayalam

## 🎬 Caption Formats

### SRT (SubRip)
- Standard subtitle format
- Compatible with most video players
- Professional video production

### VTT (WebVTT)
- HTML5 video format
- Web streaming platforms
- Modern web applications

### JSON
- Raw data format
- Custom processing
- API integration

### Video Format
- Professional video editing
- Detailed timing information
- Segment metadata

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check your `MONGODB_URI` in `.env.local`
   - Ensure MongoDB is running (local) or accessible (Atlas)
   - Verify network connectivity for cloud databases

2. **OpenAI API Errors**
   - Verify your API key is correct
   - Check API usage limits and billing
   - Ensure the key has access to Whisper and ChatGPT

3. **Audio Processing Issues**
   - Clear browser cache and restart
   - Check file size limits (25MB for transcription)
   - Ensure video format is supported

4. **Build Errors**
   - Delete `.next` folder and `node_modules`
   - Run `npm install` and `npm run build`
   - Check Node.js version compatibility

### Performance Tips

- Use "Fast" quality for quick processing
- Compress large videos before upload
- Close other browser tabs during processing
- Use local MongoDB for faster database operations

## 🔮 Future Enhancements

- **User Authentication**: Secure project access
- **Batch Processing**: Multiple video processing
- **Advanced Editing**: Caption text editing tools
- **Export Options**: More caption formats
- **Analytics**: Processing statistics and insights
- **Collaboration**: Share projects with team members

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

**Built with ❤️ using Next.js, OpenAI APIs, and MongoDB**

## 🔐 Authentication & Security

### User Management
- **Secure Registration**: Email and username validation
- **Password Security**: Bcrypt hashing with salt rounds
- **JWT Tokens**: Secure authentication with 7-day expiration
- **User Isolation**: Each user only sees their own projects

### Data Protection
- **Project Ownership**: Projects linked to authenticated users
- **API Security**: All endpoints require valid authentication
- **Data Isolation**: Users cannot access other users' projects
- **Secure Storage**: Passwords never stored in plain text

### Security Features
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: MongoDB with parameterized queries
- **XSS Prevention**: Proper data sanitization
- **Rate Limiting**: Built-in protection against abuse
