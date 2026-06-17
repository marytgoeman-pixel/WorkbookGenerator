'use client';
import { useState } from 'react';

const NAVY = '#163446', GREEN = '#009346';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    } catch { /* ignore */ }
    setSent(true);
    setLoading(false);
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009346]';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Reset your password</h1>
        {sent ? (
          <>
            <p className="text-sm text-gray-500 mt-2">If an account exists for <b>{email}</b>, we&apos;ve emailed a reset link (expires in 1 hour). Check your inbox.</p>
            <a href="/login" className="inline-block mt-5 text-sm font-semibold underline" style={{ color: GREEN }}>Back to sign in</a>
          </>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <p className="text-sm text-gray-500">Enter your email (your username) and we&apos;ll send a reset link.</p>
            <input type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg font-semibold text-white disabled:opacity-60" style={{ backgroundColor: NAVY }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Managed/boutique account? Email <a href="mailto:mary@thelearningcreative.com" className="underline" style={{ color: GREEN }}>mary@thelearningcreative.com</a>. <a href="/login" className="underline">Back to sign in</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
