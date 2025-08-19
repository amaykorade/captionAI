"use client";
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nextPath = search.get('next') || '/';

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
      router.replace(nextPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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