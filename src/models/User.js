import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  // Basic user information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password not required if Google OAuth
    },
    validate: {
      validator: function(value) {
        // If user has googleId, password is not required
        if (this.googleId) return true;
        // If no googleId, password must exist and be at least 6 chars
        return value && value.length >= 6;
      },
      message: 'Password must be at least 6 characters long'
    }
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  
  // Profile information
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Usage tracking
  transcriptionCount: {
    type: Number,
    default: 0
  },
  totalProcessingTime: {
    type: Number,
    default: 0
  },
  
  // Subscription and billing
  subscriptionPlan: {
    type: String,
    enum: ['free', 'creator', 'pro', 'enterprise'],
    default: 'free'
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'expired'],
    default: 'active'
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  subscriptionProvider: {
    type: String,
    default: 'manual'
  },
  subscriptionAmountCents: {
    type: Number,
    default: 0
  },
  subscriptionCurrency: {
    type: String,
    default: 'USD'
  },
  subscriptionRenewsAt: {
    type: Date,
    default: null
  },
  lastPaymentAt: {
    type: Date,
    default: null
  },
  
  // Free tier usage limits
  freeTierVideosProcessed: {
    type: Number,
    default: 0
  },
  freeTierTotalDuration: {
    type: Number, // in seconds
    default: 0
  },

  // Monthly usage for paid plans
  monthlyVideosProcessed: {
    type: Number,
    default: 0
  },
  monthlyTotalDuration: {
    type: Number, // seconds in current period
    default: 0
  },
  monthlyPeriodStart: {
    type: Date,
    default: null
  },
  monthlyPeriodEnd: {
    type: Date,
    default: null
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving (only if password exists and is modified)
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get user profile (without password)
UserSchema.methods.getProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Method to check if user can process a video
UserSchema.methods.canProcessVideo = function(videoDurationSeconds) {
  // Paid subscribers can process unlimited videos
  if (this.subscriptionPlan !== 'free' && this.subscriptionStatus === 'active') {
    return { canProcess: true, reason: null };
  }
  
  // Free tier restrictions
  if (this.freeTierVideosProcessed >= 1) {
    return { 
      canProcess: false, 
      reason: 'Free tier limit reached. Please upgrade to process more videos.' 
    };
  }
  
  if (videoDurationSeconds > 600) { // 10 minutes = 600 seconds
    return { 
      canProcess: false, 
      reason: 'Video exceeds 10 minute limit for free tier. Please upgrade or use a shorter video.' 
    };
  }
  
  if (this.freeTierTotalDuration + videoDurationSeconds > 600) {
    return { 
      canProcess: false, 
      reason: 'Total duration limit exceeded for free tier. Please upgrade to process longer videos.' 
    };
  }
  
  return { canProcess: true, reason: null };
};

// Method to increment usage after processing
UserSchema.methods.incrementUsage = function(videoDurationSeconds) {
  if (this.subscriptionPlan === 'free') {
    this.freeTierVideosProcessed += 1;
    this.freeTierTotalDuration += videoDurationSeconds;
  }
  this.transcriptionCount += 1;
  this.totalProcessingTime += videoDurationSeconds;
  return this.save();
};

// Create indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ createdAt: -1 });

// In dev/hot-reload, ensure schema updates (like new fields) take effect
if (process.env.NODE_ENV !== 'production' && mongoose.models.User) {
  try {
    mongoose.deleteModel('User');
  } catch (e) {}
}

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User; 