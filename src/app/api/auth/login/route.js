import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request) {
  try {
    await connectDB();
    
    const { email, password } = await request.json();
    
    // Validation
    if (!email || !password) {
      return NextResponse.json({ 
        error: 'Email and password are required' 
      }, { status: 400 });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Invalid email or password' 
      }, { status: 401 });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json({ 
        error: 'Account is deactivated' 
      }, { status: 401 });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return NextResponse.json({ 
        error: 'Invalid email or password' 
      }, { status: 401 });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('User logged in successfully:', user.email);
    
    const res = NextResponse.json({
      success: true,
      message: 'Login successful',
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
    console.error('Error in user login:', error);
    
    return NextResponse.json({ 
      error: 'Failed to login: ' + error.message 
    }, { status: 500 });
  }
} 