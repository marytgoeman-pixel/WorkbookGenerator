'use client';
import { useState, useEffect } from 'react';

const NAVY = '#163446', GREEN = '#009346';

export default function ResetPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setDone(true); return; }
      setError(d.error || 'Could not reset your password.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009346]';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Set a new password</h1>
        {done ? (
          <>
            <p className="text-sm text-gray-500 mt-2">✅ Your password has been updated. You can sign in now.</p>
            <a href="/login" className="inline-block mt-5 px-5 py-2.5 rounded-xl font-semibold text-white" style={{ backgroundColor: GREEN }}>Go to sign in →</a>
          </>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <div className="relative">
              <input type={show ? 'text' : 'password'} required className={`${input} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">{show ? 'Hide' : 'Show'}</button>
            </div>
            {error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading || !token} className="w-full py-2.5 rounded-lg font-semibold text-white disabled:opacity-60" style={{ backgroundColor: NAVY }}>
              {loading ? 'Saving…' : 'Update password'}
            </button>
            {!token && <p className="text-xs text-amber-700">This link is missing its token — request a new one from <a href="/forgot" className="underline">Reset your password</a>.</p>}
          </form>
        )}
      </div>
    </div>
  );
}
