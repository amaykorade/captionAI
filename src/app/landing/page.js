/* eslint-disable react/no-unescaped-entities */
'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Subtitles That Speak Your Audience's Language — Literally.
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
            Stop losing global viewers to awkward auto-captions. Our AI subtitles preserve slang, humor, and cultural nuance in 15+ languages — so your content connects everywhere.
          </p>
          <Link 
            href="/auth/register" 
            className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            👉 Try Free for First Video
          </Link>
          
          {/* Background idea: Split-screen concept */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-red-50 p-6 rounded-lg border-2 border-red-200">
              <h3 className="text-lg font-semibold text-red-800 mb-3">❌ Robotic, Wrong Translation</h3>
              <p className="text-red-600 text-sm">"Hello friends" → "Greetings, acquaintances"</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg border-2 border-green-200">
              <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Perfect Natural Subtitles</h3>
              <p className="text-green-600 text-sm">"Hello friends" → "¡Hola amigos!"</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">
            Why Most Auto-Captions Fail
          </h2>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Creators spend hours fixing bad subtitles — or worse, leave them as-is. The result?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-gray-700">Slang gets mistranslated.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-gray-700">Jokes fall flat.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-gray-700">Cultural references make no sense.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-gray-700">International viewers drop off.</p>
            </div>
          </div>
          <p className="text-xl text-gray-600 mt-8 font-medium">
            If your audience doesn't feel understood, they scroll away.
          </p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Subtitles That Capture the Real You
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Our AI doesn't just translate — it understands context. Whether it's street slang, technical jargon, or cultural references, your subtitles stay true to your voice.
            </p>
          </div>
          
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-4 text-lg text-gray-700 bg-blue-50 px-6 py-3 rounded-full">
              <span>Upload your video</span>
              <span className="text-blue-500">→</span>
              <span>Get perfect, multilingual subtitles in seconds</span>
              <span className="text-blue-500">→</span>
              <span>Reach audiences worldwide</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-gray-700 font-medium">15+ languages supported</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-gray-700 font-medium">Preserves humor & tone</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-gray-700 font-medium">Agency-ready speed (bulk upload)</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-gray-700 font-medium">Boosts accessibility & compliance</p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">
            Who It's For
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">YouTube Creators</h3>
              <p className="text-gray-600">
                Expand beyond your native language market. Connect with global audiences while keeping your authentic voice.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Businesses</h3>
              <p className="text-gray-600">
                Stay compliant with accessibility laws while reaching global customers with professional, localized content.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Agencies</h3>
              <p className="text-gray-600">
                Handle multiple clients' videos with bulk processing. Scale your localization services efficiently.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">
            Fair Pricing. Unlimited Growth.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-sm border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Free Trial</h3>
              <div className="text-4xl font-bold text-green-600 mb-2">$0</div>
              <p className="text-gray-600 mb-6">Perfect for testing before you commit</p>
              <ul className="text-left text-gray-600 space-y-3 mb-6">
                <li className="flex items-start">
                  <span className="mr-3">🎬</span>
                  <span>Upload 1 video (up to 10 minutes)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3">📝</span>
                  <span>Get subtitles in 15 languages</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3">⏱</span>
                  <span>No credit card required</span>
                </li>
              </ul>
              <Link 
                href="/auth/register" 
                className="w-full inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                Try Free for First Video
              </Link>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Creator Plan</h3>
              <div className="text-4xl font-bold text-blue-600 mb-2">$15<span className="text-lg text-gray-500">/month</span></div>
              <p className="text-gray-600 mb-6">Perfect for YouTubers, Instagram creators, educators, startups</p>
              <ul className="text-left text-gray-600 space-y-3 mb-6">
                <li className="flex items-start">
                  <span className="mr-3">🎬</span>
                  <span>10 videos per month (up to 10 mins each)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3">🌍</span>
                  <span>Subtitles + translations in multiple languages</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3">📝</span>
                  <span>Natural, human-like captions (not robotic)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3">🚀</span>
                  <span>Fast turnaround (seconds, not hours)</span>
                </li>
              </ul>
              <Link 
                href="/auth/register" 
                className="w-full inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
              >
                Get Started
              </Link>
            </div>
          </div>
          <p className="text-gray-600 mb-8">No hidden fees. Cancel anytime.</p>
          <Link 
            href="/auth/register" 
            className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            👉 Try Free for First Video
          </Link>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-12">
            Loved by Creators Worldwide
          </h2>
          <div className="bg-white p-8 rounded-lg shadow-sm max-w-3xl mx-auto">
            <blockquote className="text-xl text-gray-700 italic mb-6">
              "Finally, subtitles that don't sound like Google Translate. My Spanish audience doubled in 3 weeks."
            </blockquote>
            <div className="text-gray-600">
              <span className="font-semibold">YouTube Creator, 120K Subs</span>
            </div>
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">
            From Subtitles → Full Localization
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            This is just the start. Soon, you'll get:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🎭</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Emotion-matched AI dubbing</h3>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Creator-to-creator translation marketplace</h3>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🏛️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Cultural adaptation for new regions</h3>
            </div>
          </div>
          <p className="text-xl text-gray-700 font-medium">
            We don't just translate. We globalize your content.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Stop Losing Viewers to Bad Subtitles.
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Your audience deserves subtitles that sound human. Start free today and unlock global growth.
          </p>
          <Link 
            href="/auth/register" 
            className="inline-flex items-center px-10 py-5 text-xl font-semibold text-blue-600 bg-white hover:bg-gray-100 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            👉 Try Free for First Video
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-2xl font-bold text-white mb-4">Caption AI</div>
          <p className="text-gray-400 mb-6">
            Making your content accessible to the world, one subtitle at a time.
          </p>
          <div className="text-gray-500 text-sm">
            © 2024 Caption AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}