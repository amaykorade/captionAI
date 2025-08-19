import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caption_ai';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Modern TLS/SSL options for MongoDB Atlas
      tls: true,
      tlsAllowInvalidCertificates: true, // For development/testing
      // Connection options
      retryWrites: true,
      w: 'majority',
      // Connection timeout
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    // If using local MongoDB, remove TLS options
    if (MONGODB_URI.includes('localhost') || MONGODB_URI.includes('127.0.0.1')) {
      delete opts.tls;
      delete opts.tlsAllowInvalidCertificates;
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB connection error:', e);
    throw e;
  }

  return cached.conn;
}

export default connectDB; 