import { NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import { authenticateUser } from '@/lib/auth';

export async function POST(request) {
  try {
    await connectDB();
    const auth = await authenticateUser(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, amount = 1500, currency = 'USD' } = await request.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // Save payment record
    await Payment.create({
      userId: auth.userId,
      provider: 'razorpay',
      plan,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      amountCents: amount,
      currency,
      status: 'captured',
    });

    // Activate subscription (month window)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

    await User.updateOne(
      { _id: auth.userId },
      {
        $set: {
          subscriptionPlan: plan,
          subscriptionStatus: 'active',
          subscriptionProvider: 'razorpay',
          subscriptionCurrency: currency,
          subscriptionAmountCents: amount,
          lastPaymentAt: now,
          subscriptionRenewsAt: nextMonthStart,
          monthlyVideosProcessed: 0,
          monthlyTotalDuration: 0,
          monthlyPeriodStart: monthStart,
          monthlyPeriodEnd: nextMonthStart,
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Razorpay verify error:', e);
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}