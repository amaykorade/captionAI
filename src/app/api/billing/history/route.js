import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { authenticateUser } from '@/lib/auth';
import Payment from '@/models/Payment';

export async function GET(request) {
  try {
    await connectDB();
    const auth = await authenticateUser(request);
    if (!auth.isAuthenticated) return NextResponse.json({ success: false }, { status: 401 });

    const payments = await Payment.find({ userId: auth.userId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, payments });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}