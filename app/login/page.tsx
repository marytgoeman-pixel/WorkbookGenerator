'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bgReady, setBgReady] = useState(false); // becomes true if /login-bg.jpg loads

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Login failed.');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-gradient-to-br from-[#1B5E7C] via-[#16384b] to-[#0d1b26]">
      {/* Optional photo background — appears automatically if public/login-bg.jpg exists.
          Drop the plant image there to feature it; the brand scrim keeps text readable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-bg.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setBgReady(true)}
        onError={() => setBgReady(false)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${bgReady ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Brand scrim — tints the botanical pattern teal/navy (never white) while keeping the card legible */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1B5E7C]/55 via-[#1d4458]/64 to-[#0d1b26]/80" />
      {/* Soft glow accent */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F8BC24]/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl ring-1 ring-black/5 p-8">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/the-learning-creative-logo.png"
            alt="The Learning Creative"
            className="mx-auto mb-3 w-full max-w-[220px] h-auto"
          />
          <h1 className="text-lg font-bold text-gray-900">Workbook PDF Generator</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to your branded workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E7C]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E7C]"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1B5E7C] text-white rounded-lg font-medium hover:bg-[#164d66] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
