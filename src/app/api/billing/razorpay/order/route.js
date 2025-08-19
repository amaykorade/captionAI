import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request) {
  try {
    await connectDB();

    const auth = request.headers.get('cookie') || '';
    // In a production app, reuse authenticateUser. For brevity, we assume middleware already gated signed-in users.

    const { plan } = await request.json();
    if (!plan) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 });
    }

    const pricing = {
      creator: { amountCents: 1500, description: 'Creator Plan - Monthly' }, // $15.00 USD
    };

    const planInfo = pricing[plan];
    if (!planInfo) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const razor = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razor.orders.create({
      amount: planInfo.amountCents, // cents (smallest unit)
      currency: 'USD',
      receipt: `rcpt_${Date.now()}`,
      notes: { plan },
    });

    return NextResponse.json({ success: true, order });
  } catch (e) {
    console.error('Razorpay order error:', e);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}