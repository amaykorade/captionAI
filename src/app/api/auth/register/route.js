import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request) {
  try {
    await connectDB();
    
    const { username, email, password, firstName, lastName } = await request.json();
    
    // Validation
    if (!username || !email || !password) {
      return NextResponse.json({ 
        error: 'Username, email, and password are required' 
      }, { status: 400 });
    }
    
    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json({ 
          error: 'Email already registered' 
        }, { status: 409 });
      }
      if (existingUser.username === username) {
        return NextResponse.json({ 
          error: 'Username already taken' 
        }, { status: 409 });
      }
    }
    
    // Create new user (ensure role is set)
    const user = new User({
      username,
      email,
      password,
      firstName: firstName || '',
      lastName: lastName || '',
      role: 'user'
    });
    
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('User registered successfully:', user.email);
    
    const res = NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: user.getProfile()
    });
    
    // Set httpOnly cookie using Next.js cookies() function
    const cookieStore = cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });
    
    return res;
    
  } catch (error) {
    console.error('Error in user registration:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationErrors 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to register user: ' + error.message 
    }, { status: 500 });
  }
} 