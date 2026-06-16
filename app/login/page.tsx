'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { APP_VERSION } from '@/lib/version';

const NAVY = '#163446', GREEN = '#009346', LIME = '#8DC63D';

const FEATURES = [
  { icon: '✏️', title: 'Truly fillable PDFs', body: 'Recipients type right into the PDF in any reader, offline. Not a flat printout, and not an online-only link.' },
  { icon: '🎨', title: 'On-brand, every time', body: 'Your logo, colors, and fonts are baked in. Every workbook comes out consistent, no design drift.' },
  { icon: '⚡', title: 'Outline in, workbook out', body: 'Upload a Word or PDF outline and it’s auto-formatted into a fillable workbook in minutes.' },
  { icon: '🧩', title: 'Add what you need', body: 'Calendars, SWOT, 90-day plans, notes pages, checklists and rating scales, drop them in and download.' },
];

const TIERS = [
  { name: 'Starter', price: '$99', annual: '$1,089 / yr', highlight: false, custom: false,
    features: ['1 brand', '1 workbook download / month', 'Core builder (no add-on elements)', 'Unlimited learners'] },
  { name: 'Pro', price: '$180', annual: '$1,980 / yr', highlight: true, custom: false,
    features: ['1 brand', 'Up to 2 workbook downloads / month', 'Core builder (no add-on elements)', 'Unlimited learners'] },
  { name: 'Agency', price: '$499', annual: '$5,489 / yr', highlight: false, custom: false,
    features: ['1 brand', 'Unlimited workbook downloads', 'All elements (calendars, SWOT, grids, notes)', 'Request custom elements anytime', 'Unlimited learners'] },
  { name: 'Enterprise', price: 'Call', annual: 'for pricing', highlight: false, custom: true,
    features: ['2+ brands', 'Unlimited workbook downloads', 'All elements', 'Request custom elements anytime', 'Unlimited learners'] },
];

export default function LandingPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Inquiry form
  const [iName, setIName] = useState('');
  const [iEmail, setIEmail] = useState('');
  const [iCompany, setICompany] = useState('');
  const [iPlan, setIPlan] = useState('Pro');
  const [iMessage, setIMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentDraft, setSentDraft] = useState(false); // true when we fell back to the mail app

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

  async function sendInquiry(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: iName, email: iEmail, company: iCompany, plan: iPlan, message: iMessage }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.sent) { setSent(true); setSending(false); return; } // delivered server-side
      }
    } catch { /* fall through to the mail-app fallback */ }
    // Email service not configured (or failed) → open the visitor's mail app instead
    const subject = `Workbook access request from ${iName || 'a prospect'}`;
    const body =
      `Name: ${iName}\n` +
      `Email: ${iEmail}\n` +
      `Company / brand: ${iCompany}\n` +
      `Plan interested in: ${iPlan}\n\n` +
      `Message:\n${iMessage}\n`;
    window.location.href = `mailto:mary@thelearningcreative.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSentDraft(true);
    setSent(true);
    setSending(false);
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009346]';

  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      {/* NAV */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logonew.png" alt="The Learning Creative" className="h-9 w-auto" />
          <nav className="flex items-center gap-5 text-sm">
            <a href="#features" className="hidden sm:inline text-gray-600 hover:text-[#163446]">Features</a>
            <a href="#pricing" className="hidden sm:inline text-gray-600 hover:text-[#163446]">Pricing</a>
            <a href="#inquiry" className="hidden sm:inline text-gray-600 hover:text-[#163446]">Contact</a>
            <a href="#signin" className="px-4 py-2 rounded-lg text-white font-medium transition-colors" style={{ backgroundColor: NAVY }}>Sign in</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/login-bg.jpg')" }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${NAVY}ee, ${NAVY}d9 55%, #0d1b26ee)` }} />
        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="text-white">
            <span className="inline-block font-semibold text-sm tracking-wide uppercase mb-3" style={{ color: LIME }}>Custom Learning Experiences</span>
            <h1 className="text-3xl md:text-[2.6rem] font-bold leading-tight">Branded, fillable workbooks, without the busywork.</h1>
            <p className="mt-4 text-white/80 text-lg">Turn an outline into a beautifully branded, genuinely fillable PDF your clients type right into, then download it as a real file, not an online-only link.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="/try" className="px-5 py-3 rounded-xl font-semibold transition" style={{ backgroundColor: LIME, color: '#10241a' }}>Try it free</a>
              <a href="#pricing" className="px-5 py-3 rounded-xl font-semibold text-white ring-1 ring-white/30 bg-white/10 hover:bg-white/20 transition">See pricing</a>
              <a href="#inquiry" className="px-5 py-3 rounded-xl font-semibold text-white ring-1 ring-white/30 bg-white/10 hover:bg-white/20 transition">Request access</a>
            </div>
            <p className="mt-5 text-white/60 text-sm">No per-learner fees · download &amp; distribute to unlimited learners.</p>
          </div>

          {/* Sign-in card (existing clients) */}
          <div id="signin" className="w-full max-w-sm justify-self-center md:justify-self-end bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 p-7">
            <h2 className="text-lg font-bold text-gray-900">Client sign in</h2>
            <p className="text-sm text-gray-400 mt-0.5 mb-5">Already set up? Log in to your branded workspace.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                <input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} pr-10`} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} title={showPw ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700">
                    {showPw ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50" style={{ backgroundColor: NAVY }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: NAVY }}>Everything a course creator needs, in one tool</h2>
          <p className="text-gray-500 mt-3">Design tools make flat PDFs. Online tools lock workbooks behind a login. This does the thing neither does: a downloadable, truly fillable, on-brand workbook.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold" style={{ color: NAVY }}>{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-y border-gray-100" style={{ backgroundColor: '#F4FAEC' }}>
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: NAVY }}>Simple pricing</h2>
            <p className="text-gray-500 mt-3">Each plan is your own branded workspace. Annual billing is about one month free. <span className="font-semibold" style={{ color: GREEN }}>No per-learner fees</span>, distribute to unlimited learners.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mt-10 items-stretch">
            {TIERS.map((t) => (
              <div key={t.name} className={`relative rounded-2xl bg-white p-6 flex flex-col ${t.highlight ? 'shadow-lg' : 'border border-gray-100 shadow-sm'}`} style={t.highlight ? { boxShadow: `0 10px 30px ${NAVY}1a`, border: `2px solid ${GREEN}` } : undefined}>
                {t.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white px-3 py-1 rounded-full" style={{ backgroundColor: GREEN }}>Most popular</span>}
                <h3 className="font-bold text-lg" style={{ color: NAVY }}>{t.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold" style={{ color: NAVY }}>{t.price}</span>
                  {!t.custom && <span className="text-gray-400 text-sm"> / mo</span>}
                  {t.custom && <span className="text-gray-400 text-sm"> {t.annual}</span>}
                </div>
                {!t.custom && <div className="text-xs text-gray-400 mt-0.5">{t.annual}</div>}
                <ul className="mt-5 space-y-2 text-sm text-gray-600 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2"><span style={{ color: GREEN }}>✓</span><span>{f}</span></li>
                  ))}
                </ul>
                <a href="#inquiry" className="mt-6 block text-center px-4 py-2.5 rounded-xl font-semibold transition" style={t.highlight ? { backgroundColor: GREEN, color: '#ffffff' } : { color: NAVY, border: `1px solid ${NAVY}` }}>
                  {t.custom ? 'Contact us' : 'Request access'}
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-8">
            <span className="font-semibold" style={{ color: NAVY }}>One-time setup &amp; brand build: $499</span>, I configure your branded workspace (logo, colors, fonts) and your first template.
          </p>
        </div>
      </section>

      {/* INQUIRY */}
      <section id="inquiry" className="max-w-3xl mx-auto px-5 py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: NAVY }}>Request access</h2>
          <p className="text-gray-500 mt-3">Tell me a bit about your brand and I’ll get you set up. I’ll reply to the email you provide, or reach me directly at <a href="mailto:mary@thelearningcreative.com" className="underline" style={{ color: GREEN }}>mary@thelearningcreative.com</a>.</p>
        </div>
        {sent ? (
          <div className="mt-8 rounded-2xl border p-6 text-center" style={{ borderColor: GREEN, backgroundColor: '#F0F7E6' }}>
            {sentDraft ? (
              <>
                <p className="font-semibold" style={{ color: NAVY }}>Thanks! Your email draft is ready to send.</p>
                <p className="text-sm text-gray-600 mt-1">If your mail app didn’t open, email me directly at <a href="mailto:mary@thelearningcreative.com" className="underline" style={{ color: GREEN }}>mary@thelearningcreative.com</a>.</p>
              </>
            ) : (
              <>
                <p className="font-semibold" style={{ color: NAVY }}>Thanks! Your request has been sent.</p>
                <p className="text-sm text-gray-600 mt-1">I’ll be in touch shortly at the email you provided.</p>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={sendInquiry} className="mt-8 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Your name</label>
              <input className={input} value={iName} onChange={(e) => setIName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input type="email" className={input} value={iEmail} onChange={(e) => setIEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Company / brand</label>
              <input className={input} value={iCompany} onChange={(e) => setICompany(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Plan you’re interested in</label>
              <select className={input} value={iPlan} onChange={(e) => setIPlan(e.target.value)}>
                <option>Starter</option><option>Pro</option><option>Agency</option><option>Enterprise</option><option>Not sure yet</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">What would you use it for?</label>
              <textarea className={`${input} h-28 resize-y`} value={iMessage} onChange={(e) => setIMessage(e.target.value)} placeholder="A sentence or two about your courses, audience, and the workbooks you want to brand…" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={sending} className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-60" style={{ backgroundColor: NAVY }}>{sending ? 'Sending…' : 'Send my request'}</button>
            </div>
          </form>
        )}
      </section>

      {/* FOOTER */}
      <footer className="text-white" style={{ backgroundColor: NAVY }}>
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="font-bold text-lg">The Learning Creative</div>
            <div className="text-white/60 text-sm">Custom Learning Experiences · <a href="mailto:mary@thelearningcreative.com" className="underline">mary@thelearningcreative.com</a></div>
          </div>
          <div className="text-white/40 text-xs font-mono">{APP_VERSION}</div>
        </div>
      </footer>
    </div>
  );
}
