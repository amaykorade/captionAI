"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Menu, X } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const dropdownRef = useRef(null);

  const isUserAuthenticated = isInitialized && (!!user || !!session);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/user/me', { credentials: 'include', cache: 'no-store' });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.success) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    }
  };

  const checkManualAuth = async () => {
    try {
      const res = await fetch('/api/user/me', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          setIsInitialized(true);
        } else {
          setUser(null);
          setIsInitialized(true);
        }
      } else {
        setUser(null);
        setIsInitialized(true);
      }
    } catch (error) {
      setUser(null);
      setIsInitialized(true);
    }
  };

  // Initialize auth state when session changes
  useEffect(() => {
    if (status === 'loading') return;
    
    if (session?.user?.email) {
      refreshUser();
      setIsInitialized(true);
    } else {
      // Check if user has manual auth token
      checkManualAuth();
    }
  }, [session, status]);

  // Refetch on route change
  useEffect(() => {
    if (!isInitialized) return;
    refreshUser();
  }, [pathname, isInitialized]);

  // Listen for custom auth change and tab visibility
  useEffect(() => {
    const handler = () => refreshUser();
    const visHandler = () => { if (document.visibilityState === 'visible') refreshUser(); };
    window.addEventListener('auth:changed', handler);
    document.addEventListener('visibilitychange', visHandler);
    return () => {
      window.removeEventListener('auth:changed', handler);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen]);

  const handleLogout = async () => {
    try {
      // Sign out from NextAuth
      await signOut({ redirect: false });
      // Also call our custom logout to clear any custom cookies
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' });
    } catch {}
    setUser(null);
    setProfileOpen(false);
    setMobileOpen(false);
    window.dispatchEvent(new Event('auth:changed'));
    router.push('/auth/login');
  };

  const NavLinks = () => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 gap-3 sm:gap-0">
      <Link href="/landing" className="text-gray-300 hover:text-white text-sm font-medium transition-colors">
        Home
      </Link>
      <Link href="/pricing" className="text-gray-300 hover:text-white text-sm font-medium transition-colors">
        Pricing
      </Link>
      {isUserAuthenticated ? (
        <>
          <Link href="/" className="text-gray-300 hover:text-white text-sm font-medium transition-colors">
            Transcribe Audio
          </Link>
        </>
      ) : null}
    </div>
  );

  return (
    <nav className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-6">
            <Link href="/landing" className="flex items-center space-x-2">
              <span className="text-lg font-bold text-white">SubtitleAI</span>
            </Link>
            <div className="hidden sm:block ml-4">
              <NavLinks />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="sm:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-300 hover:text-white hover:bg-slate-800 focus:outline-none"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {isUserAuthenticated ? (
              <div className="ml-1 relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex items-center space-x-2 px-2 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 focus:outline-none border border-slate-700"
                >
                  <User className="h-5 w-5 text-gray-300" />
                  <ChevronDown className="h-4 w-4 text-gray-300" />
                </button>
                {profileOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg py-1 bg-slate-900 ring-1 ring-black ring-opacity-5 z-50 border border-slate-700">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                      <p className="text-sm text-gray-300 truncate">{user?.email || ''}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Plan: {((user?.subscriptionPlan || 'free').charAt(0).toUpperCase() + (user?.subscriptionPlan || 'free').slice(1))}
                        {user?.role === 'admin' && <span className="ml-2 inline-block px-2 py-0.5 text-[10px] rounded bg-purple-600 text-white">Admin</span>}
                      </p>
                      {(user?.subscriptionPlan === 'free' || user?.subscriptionPlan === undefined) && user?.role !== 'admin' && (
                        <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs">
                          <p className="text-yellow-300 font-medium">Free Plan Usage</p>
                          <p className="text-yellow-400">
                            {user?.usage?.freeTierVideosProcessed || 0}/1 videos used
                          </p>
                          <p className="text-yellow-400">
                            {Math.round((user?.usage?.freeTierTotalDuration || 0) / 60)}/10 minutes used
                          </p>
                        </div>
                      )}
                    </div>
                    <Link
                      href="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                      onClick={() => setProfileOpen(false)}
                    >
                      Settings
                    </Link>
                    <Link
                      href="/settings/billing"
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                      onClick={() => setProfileOpen(false)}
                    >
                      Billing
                    </Link>
                    {(user?.subscriptionPlan === 'free' || user?.subscriptionPlan === undefined) && user?.role !== 'admin' && (
                      <Link
                        href="/pricing"
                        className="flex items-center px-4 py-2 text-sm text-blue-400 hover:bg-slate-700 hover:text-blue-300"
                        onClick={() => setProfileOpen(false)}
                      >
                        Upgrade Plan
                      </Link>
                    )}
                    <div className="border-t border-slate-700 my-1"></div>
                    <button
                      className="flex w-full items-center px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300"
                      onClick={handleLogout}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                {isInitialized && (
                  <>
                    <button
                      onClick={() => { window.dispatchEvent(new Event('auth:changed')); window.location.href = '/auth/login'; }}
                      className="px-3 py-1.5 border border-slate-700 rounded-lg text-gray-200 hover:bg-slate-800 text-sm"
                      type="button"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => { window.dispatchEvent(new Event('auth:changed')); window.location.href = '/auth/register'; }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
                      type="button"
                    >
                      Get Started for Free
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {mobileOpen && (
          <div className="sm:hidden border-t border-slate-800 py-3">
            <div className="flex flex-col gap-3">
              <NavLinks />
              {isUserAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <div className="px-3 py-2 border border-slate-700 rounded-lg">
                    <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                    <p className="text-sm text-gray-300">{user?.email || ''}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Plan: {((user?.subscriptionPlan || 'free').charAt(0).toUpperCase() + (user?.subscriptionPlan || 'free').slice(1))}
                    </p>
                    {(user?.subscriptionPlan === 'free' || user?.subscriptionPlan === undefined) && (
                      <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs">
                        <p className="text-yellow-300 font-medium">Free Plan Usage</p>
                        <p className="text-yellow-400">
                          {user?.usage?.freeTierVideosProcessed || 0}/1 videos used
                        </p>
                        <p className="text-yellow-400">
                          {Math.round((user?.usage?.freeTierTotalDuration || 0) / 60)}/10 minutes used
                        </p>
                      </div>
                    )}
                  </div>
                  <Link
                    href="/settings"
                    className="px-3 py-2 text-sm text-gray-300 hover:bg-slate-800 rounded-lg text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    href="/settings/billing"
                    className="px-3 py-2 text-sm text-gray-300 hover:bg-slate-800 rounded-lg text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    Billing
                  </Link>
                  {(user?.subscriptionPlan === 'free' || user?.subscriptionPlan === undefined) && (
                    <Link
                      href="/pricing"
                      className="px-3 py-2 text-sm text-blue-400 hover:bg-slate-800 rounded-lg text-center"
                      onClick={() => setMobileOpen(false)}
                    >
                      Upgrade Plan
                    </Link>
                  )}
                  <button
                    className="px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg text-center"
                    onClick={() => { setMobileOpen(false); handleLogout(); }}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {isInitialized && (
                    <>
                      <button
                        onClick={() => { setMobileOpen(false); window.dispatchEvent(new Event('auth:changed')); window.location.href = '/auth/login'; }}
                        className="flex-1 px-3 py-1.5 border border-slate-700 rounded-lg text-center text-gray-200 hover:bg-slate-800 text-sm"
                        type="button"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => { setMobileOpen(false); window.dispatchEvent(new Event('auth:changed')); window.location.href = '/auth/register'; }}
                        className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-center text-white text-sm"
                        type="button"
                      >
                        Get Started
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}