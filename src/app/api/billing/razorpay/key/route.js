import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      return NextResponse.json({ error: 'Razorpay key not configured' }, { status: 500 });
    }
    return NextResponse.json({ success: true, keyId });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load key' }, { status: 500 });
  }
}