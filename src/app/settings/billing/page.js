'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BillingPage() {
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, histRes] = await Promise.all([
          fetch('/api/user/me', { credentials: 'include' }),
          fetch('/api/billing/history', { credentials: 'include' }),
        ]);
        const meJson = await meRes.json();
        const histJson = await histRes.json();
        if (meJson.success) setUser(meJson.user);
        if (histJson.success) setPayments(histJson.payments || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const plan = (user?.subscriptionPlan || 'free');
  const status = user?.subscriptionStatus || 'inactive';
  const isPaid = plan !== 'free' && status === 'active';
  const renewsAt = user?.subscriptionRenewsAt ? new Date(user.subscriptionRenewsAt) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Billing</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">Current Plan</h2>
          <p className="text-gray-700">Plan: <span className="font-medium capitalize">{plan}</span></p>
          <p className="text-gray-700">Status: <span className="font-medium">{status}</span></p>
          {isPaid && renewsAt && (
            <p className="text-gray-700">Renews on: <span className="font-medium">{renewsAt.toDateString()}</span></p>
          )}
          <div className="mt-4">
            <Link href="/pricing" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              {isPaid ? 'Manage/Renew Plan' : 'Upgrade Plan'}
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">Usage</h2>
          {plan === 'free' ? (
            <>
              <p className="text-gray-700">Free videos used: <span className="font-medium">{user?.usage?.freeTierVideosProcessed || 0}/1</span></p>
              <p className="text-gray-700">Free minutes used: <span className="font-medium">{Math.round((user?.usage?.freeTierTotalDuration || 0)/60)}/10</span></p>
            </>
          ) : (
            <>
              <p className="text-gray-700">Videos this month: <span className="font-medium">{user?.monthly?.videosProcessed || 0}/10</span></p>
              <p className="text-gray-700">Per‑video limit: <span className="font-medium">10 minutes</span></p>
              {user?.monthly?.periodEnd && (
                <p className="text-gray-700">Period ends: <span className="font-medium">{new Date(user.monthly.periodEnd).toDateString()}</span></p>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Payment History</h2>
          {payments.length === 0 ? (
            <p className="text-gray-600">No payments yet.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p._id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <p className="font-medium capitalize">{p.plan} plan</p>
                    <p className="text-sm text-gray-600">{new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{p.currency} ${(p.amountCents/100).toFixed(2)}</p>
                    <p className="text-sm text-gray-600">{p.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}