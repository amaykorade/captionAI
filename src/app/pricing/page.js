'use client';

import Link from 'next/link';
import { useEffect } from 'react';

function loadRazorpay(retry = 0) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);

    // Reuse existing script tag if present
    const existing = document.getElementById('razorpay-checkout-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', (e) => {
        console.error('Razorpay SDK existing script error:', e);
        resolve(false);
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = `https://checkout.razorpay.com/v1/checkout.js${retry ? `?v=${Date.now()}` : ''}`;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = (e) => {
      console.error('Razorpay SDK load error:', e);
      if (retry < 1) {
        // Retry once with cache-busting
        document.body.removeChild(script);
        loadRazorpay(retry + 1).then(resolve);
      } else {
        resolve(false);
      }
    };
    document.body.appendChild(script);
  });
}

export default function PricingPage() {
  useEffect(() => {
    loadRazorpay();
  }, []);

  const startCheckout = async (plan) => {
    const ok = await loadRazorpay();
    if (!ok) {
      alert('Failed to load Razorpay. Please disable ad/tracker blockers for checkout.');
      return;
    }

    try {
      const orderRes = await fetch('/api/billing/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      });
      const { success, order, error } = await orderRes.json();
      if (!success) throw new Error(error || 'Failed to create order');

      // Fetch public key from server
      const keyRes = await fetch('/api/billing/razorpay/key');
      const keyJson = await keyRes.json();
      if (!keyRes.ok || !keyJson.success) throw new Error(keyJson.error || 'Failed to load payment key');

      const options = {
        key: keyJson.keyId,
        amount: order.amount,
        currency: 'USD',
        name: 'Caption AI',
        description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - Monthly`,
        order_id: order.id,
        handler: async function (response) {
          try {
            const verifyRes = await fetch('/api/billing/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan,
              }),
            });
            const verifyJson = await verifyRes.json();
            if (!verifyRes.ok || !verifyJson.success) throw new Error(verifyJson.error || 'Verification failed');
            window.dispatchEvent(new Event('auth:changed'));
            alert('Payment successful! Your subscription is now active.');
          } catch (e) {
            alert('Payment verification failed. Please contact support.');
          }
        },
        prefill: {},
        notes: { plan },
        theme: { color: '#2563eb' },
      };

      const rz = new window.Razorpay(options);
      rz.open();
    } catch (e) {
      alert(e.message || 'Checkout failed.');
    }
  };

  return (
    <div className="min-h-screen bg-white py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Fair Pricing. Unlimited Growth.
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
          {/* Free Trial */}
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

          {/* Creator Plan */}
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-blue-500 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
              Most Popular
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Creator Plan</h3>
            <div className="text-4xl font-bold text-blue-600 mb-2">$15<span className="text-lg text-gray-500">/month</span></div>
            <p className="text-gray-600 mb-6">10 videos per month, each up to 10 minutes</p>
            <ul className="text-left text-gray-600 space-y-3 mb-6">
              <li className="flex items-start">
                <span className="mr-3">🎬</span>
                <span>10 videos per month</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3">⏱</span>
                <span>Each video up to 10 minutes</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3">🚀</span>
                <span>Priority processing</span>
              </li>
            </ul>
            <button 
              onClick={() => startCheckout('creator')}
              className="w-full inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
            >
              Upgrade with Razorpay
            </button>
          </div>
        </div>

        <p className="text-gray-600 mb-8">No hidden fees. Cancel anytime.</p>
        <button 
          onClick={() => startCheckout('creator')}
          className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          👉 Try Creator — Razorpay Checkout
        </button>
      </div>
    </div>
  );
} 