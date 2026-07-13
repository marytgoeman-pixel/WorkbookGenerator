'use client';
import { useState } from 'react';
import { SIGNUPS_OPEN } from '@/lib/flags';

const NAVY = '#163446', GREEN = '#009346', LIME = '#8DC63D';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [boutique, setBoutique] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { emailed: boolean; boutique: boolean }>(null);

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009346]';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, boutique }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setDone({ emailed: !!data.emailed, boutique: !!data.boutique }); return; }
      setError(data.error || 'Could not create your account.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!SIGNUPS_OPEN) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GREEN }}>The Learning Creative</span>
          <h1 className="text-2xl font-bold mt-1" style={{ color: NAVY }}>Sign-ups are paused</h1>
          <p className="text-sm text-gray-500 mt-3">We&apos;re not accepting new self-serve accounts right now. You can still see it in action — try the live demo (no account needed), or get in touch and we&apos;ll get you set up.</p>
          <div className="mt-6 flex flex-col gap-2">
            <a href="/try" className="py-2.5 rounded-xl font-semibold text-white" style={{ backgroundColor: GREEN }}>Try it free — no sign-up</a>
            <a href="/login#inquiry" className="py-2.5 rounded-xl font-semibold border" style={{ color: NAVY, borderColor: NAVY }}>Contact us</a>
          </div>
          <a href="/login" className="inline-block text-xs text-gray-400 hover:text-gray-700 underline mt-4">Already have an account? Sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GREEN }}>The Learning Creative</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Create your account</h1>
        <p className="text-sm text-gray-500 mt-1">Build your own branded, fillable workbook template, then try it free.</p>

        {done ? (
          <div className="mt-6 rounded-xl border p-5 text-center" style={{ borderColor: GREEN, backgroundColor: '#F0F7E6' }}>
            <div className="text-3xl mb-2">📬</div>
            <p className="font-semibold" style={{ color: NAVY }}>Almost there — confirm your email</p>
            <p className="text-sm text-gray-600 mt-1">
              {done.emailed
                ? `We sent a confirmation link to ${email}. Click it, then sign in.`
                : `Check ${email} for a confirmation link. (If it doesn’t arrive shortly, email mary@thelearningcreative.com.)`}
            </p>
            {done.boutique && <p className="text-sm text-gray-600 mt-2">You asked for the done-for-you setup — Mary will reach out to get you set up.</p>}
            <a href="/login" className="inline-block mt-4 text-sm font-semibold underline" style={{ color: GREEN }}>Go to sign in</a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Brand / business name</label>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bright Path Coaching" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input type="email" autoComplete="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} autoComplete="new-password" required className={input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">{showPw ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={boutique} onChange={(e) => setBoutique(e.target.checked)} />
              <span><strong>Have it set up for me</strong> (boutique, $499). Prefer we configure your brand kit + first template? Check this and we’ll be in touch — you can still explore in the meantime.</span>
            </label>

            {error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-60" style={{ backgroundColor: NAVY }}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
            <p className="text-xs text-center text-gray-400">Already have an account? <a href="/login" className="underline" style={{ color: GREEN }}>Sign in</a></p>
          </form>
        )}
      </div>
    </div>
  );
}
