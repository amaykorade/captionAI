import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const res = NextResponse.json({ success: true });
  
  // Clear cookie using Next.js cookies() function
  const cookieStore = cookies();
  cookieStore.delete('auth_token');
  
  return res;
}