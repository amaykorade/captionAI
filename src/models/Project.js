import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
  // User reference for authentication
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Basic project info
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Video information
  videoFile: {
    originalName: String,
    size: Number,
    type: String
  },
  videoUrl: String,
  
  // Audio information
  audioUrl: String,
  audioSize: Number,
  
  // Transcription data
  transcription: {
    rawText: String,
    enhancedText: String,
    language: String,
    duration: Number,
    wordCount: Number,
    quality: {
      type: String,
      enum: ['high', 'balanced', 'fast'],
      default: 'balanced'
    }
  },
  
  // Captions data
  captions: {
    segments: [{
      start: Number,
      end: Number,
      text: String,
      wordCount: Number
    }],
    formats: {
      srt: String,
      vtt: String,
      json: String,
      video: String
    },
    segmentCount: Number
  },
  
  // Translations
  translations: [{
    targetLanguage: String,
    translatedText: String,
    originalLength: Number,
    translatedLength: Number,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  processingTime: Number, // in seconds
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
ProjectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create indexes for better query performance
ProjectSchema.index({ userId: 1, createdAt: -1 });
ProjectSchema.index({ userId: 1, status: 1 });
ProjectSchema.index({ userId: 1, 'transcription.language': 1 });

const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

export default Project; 