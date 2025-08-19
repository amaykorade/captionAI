import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth-config';
import User from '@/models/User';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';

export async function GET(request) {
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
      return NextResponse.json({ success: false, error: 'Not authenticated' });
    }

    // Ensure existing users have the new free tier fields
    if (user.subscriptionPlan === undefined || 
        user.freeTierVideosProcessed === undefined || 
        user.freeTierTotalDuration === undefined) {
      
      // Initialize missing fields for existing users
      const updateData = {};
      if (user.subscriptionPlan === undefined) {
        updateData.subscriptionPlan = 'free';
        updateData.subscriptionStatus = 'active';
      }
      if (user.freeTierVideosProcessed === undefined) {
        updateData.freeTierVideosProcessed = 0;
      }
      if (user.freeTierTotalDuration === undefined) {
        updateData.freeTierTotalDuration = 0;
      }
      
      await User.updateOne(
        { _id: user._id },
        { $set: updateData }
      );
      
      // Refresh user data
      const updatedUser = await User.findById(user._id);
      if (updatedUser) {
        user.subscriptionPlan = updatedUser.subscriptionPlan || 'free';
        user.subscriptionStatus = updatedUser.subscriptionStatus || 'active';
        user.freeTierVideosProcessed = updatedUser.freeTierVideosProcessed || 0;
        user.freeTierTotalDuration = updatedUser.freeTierTotalDuration || 0;
      }
    }

    // Fallback: compute usage from projects for free tier users
    let computedVideos = 0;
    let computedDuration = 0;
    if (!user.subscriptionPlan || user.subscriptionPlan === 'free') {
      const [count, durationAgg] = await Promise.all([
        Project.countDocuments({ userId: user._id, status: 'completed' }),
        Project.aggregate([
          { $match: { userId: user._id, status: 'completed' } },
          { $group: { _id: null, totalDuration: { $sum: { $ifNull: ['$transcription.duration', 0] } } } }
        ])
      ]);
      computedVideos = count;
      computedDuration = durationAgg[0]?.totalDuration || 0;
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.username || user.email),
        email: user.email,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionRenewsAt: user.subscriptionRenewsAt || null,
        role: user.role || 'user',
        monthly: {
          videosProcessed: user.monthlyVideosProcessed || 0,
          totalDuration: user.monthlyTotalDuration || 0,
          periodStart: user.monthlyPeriodStart || null,
          periodEnd: user.monthlyPeriodEnd || null,
        },
        usage: {
          transcriptionCount: user.transcriptionCount,
          totalProcessingTime: user.totalProcessingTime,
          freeTierVideosProcessed: Math.max(user.freeTierVideosProcessed || 0, computedVideos),
          freeTierTotalDuration: Math.max(user.freeTierTotalDuration || 0, computedDuration),
          maxFreeDuration: 600 // 10 minutes in seconds
        }
      }
    });
  } catch (e) {
    console.error('Error in /api/user/me:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}