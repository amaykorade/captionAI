"use client";
import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const nextPath = search.get('next') || '/';

  // Redirect if already authenticated
  useEffect(() => {
    const handleRedirect = async () => {
      if (status === 'authenticated' && session?.user?.email) {
        try {
          await router.replace(nextPath);
        } catch (redirectError) {
          console.error('Router redirect failed:', redirectError);
        }
      }
    };
    
    handleRedirect();
  }, [status, session, router, nextPath]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      // Trigger navbar refresh for manual auth
      window.dispatchEvent(new Event('auth:changed'));
      
      router.replace(nextPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      // Let NextAuth handle the redirect
      await signIn('google', { 
        callbackUrl: nextPath,
        redirect: true
      });
    } catch (err) {
      setError('Google login failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  // Don't render login form if already authenticated
  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (status === 'authenticated') {
    return <div className="min-h-screen flex items-center justify-center">Redirecting...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="hidden md:flex flex-col justify-center p-10 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
          <h2 className="text-3xl font-bold mb-3">Caption AI</h2>
          <p className="text-blue-100 text-sm">Generate, enhance, translate, and export perfectly synced captions for your videos.</p>
          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-white"></span> Whisper-powered transcription</div>
            <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-white"></span> GPT nuance preservation</div>
            <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-white"></span> Multi-language translation</div>
            <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-white"></span> SRT/VTT export with perfect sync</div>
          </div>
        </div>
        <div className="p-8 md:p-10">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 text-sm">Log in to continue to your projects</p>
          </div>
          {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
          
          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full mb-4 bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {googleLoading ? (
              'Signing in...'
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg px-3 py-2 outline-none transition" />
            </div>
            <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition disabled:opacity-50">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className="text-sm text-gray-600 mt-5">
            No account? <a href="/auth/register" className="text-blue-600 hover:underline">Create one</a>
          </p>
          <p className="text-xs text-gray-400 mt-2">By continuing you agree to our Terms and Privacy Policy.</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}