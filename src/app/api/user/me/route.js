import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const auth = await authenticateUser(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false });
    }
    const user = auth.user;
    return NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.username || user.email),
        email: user.email,
      }
    });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 200 });
  }
}