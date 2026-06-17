'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentModel, ColorTheme, ClientBranding } from '@/types/document';
import FileUpload from '@/components/FileUpload';
import DocumentEditor from '@/components/DocumentEditor';
import PDFPreview from '@/components/PDFPreview';
import DownloadButton from '@/components/DownloadButton';
import SavedWorkbooks from '@/components/SavedWorkbooks';
import { saveWorkbook, listSaved, SavedWorkbook } from '@/lib/savedWorkbooks';
import { buildSampleWorkbook } from '@/lib/sampleWorkbook';
import { useSessionHeartbeat } from '@/components/useSessionHeartbeat';
import { APP_VERSION } from '@/lib/version';

export type TrialInfo = { state: 'active' | 'expired'; daysLeft: number } | null;

interface Props {
  branding: ClientBranding;
  trial?: TrialInfo;
  manageable?: boolean; // true when the client has an active Stripe subscription (manage via portal, not re-checkout)
}

type Step = 1 | 2 | 3;

const STEPS = [
  { num: 1 as Step, label: 'Upload' },
  { num: 2 as Step, label: 'Review' },
  { num: 3 as Step, label: 'Download' },
];

export default function WorkbookApp({ branding, trial, manageable }: Props) {
  const router = useRouter();
  useSessionHeartbeat(); // track session length for the admin dashboard
  const [step, setStep] = useState<Step>(1);
  const [doc, setDoc] = useState<DocumentModel | null>(null);
  const [view, setView] = useState<'work' | 'saved'>('work');
  const [savedId, setSavedId] = useState<string | null>(null);   // the saved-workbook this doc maps to
  const [savedRefresh, setSavedRefresh] = useState(0);           // bump to re-read the saved list / count
  // Which section to scroll to in the editor (set by clicking the preview). `n` bumps each
  // click so re-clicking the same section re-triggers the scroll.
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  // Which section to scroll to in the PREVIEW (set by clicking/editing in the left editor).
  const [previewFocus, setPreviewFocus] = useState<{ id: string; n: number } | null>(null);

  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    let active = true;
    listSaved(branding.id).then((r) => { if (active) setSavedCount(r.items.length); });
    return () => { active = false; };
  }, [branding.id, savedRefresh, view]);

  // Plan + download usage → drives the upgrade prompt.
  const downloadLimit = branding.plan?.downloadsPerMonth ?? null;
  const [usage, setUsage] = useState(0);              // this calendar month (paid plans)
  const [lifetimeUsage, setLifetimeUsage] = useState(0); // all-time (free trial cap)
  const [showUpgrade, setShowUpgrade] = useState(false);
  function refreshUsage() {
    fetch('/api/usage', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.downloads === 'number') setUsage(d.downloads);
        if (d && typeof d.lifetime === 'number') setLifetimeUsage(d.lifetime);
      })
      .catch(() => {});
  }
  useEffect(() => { refreshUsage(); }, [branding.id]);
  // The trial cap is a LIFETIME count (1 download for the whole trial, no monthly reset);
  // paid plans use the calendar-month count.
  const downloadCount = trial ? lifetimeUsage : usage;
  // Downloads are blocked when a trial has expired, or when the plan's download cap is hit.
  const atLimit = trial?.state === 'expired' || (downloadLimit != null && downloadCount >= downloadLimit);

  // Stripe checkout (with graceful email fallback when billing isn't configured)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [justUpgraded, setJustUpgraded] = useState(false);
  const [wipSaved, setWipSaved] = useState(false);
  // Save the in-progress workbook before navigating out to Stripe, so the user's work
  // survives the redirect — they can reopen it from Saved when they come back.
  async function preserveWip() {
    if (!doc) return;
    try {
      await saveCurrent();
      if (typeof window !== 'undefined') sessionStorage.setItem('wb_wip_saved', '1');
    } catch { /* never block the upgrade on a save hiccup */ }
  }
  async function startCheckout(plan: 'starter' | 'pro' | 'agency') {
    setCheckoutBusy(plan);
    await preserveWip();
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval: billingInterval }),
      });
      if (res.ok) { const d = await res.json(); if (d.url) { window.location.href = d.url; return; } }
    } catch { /* fall through to email */ }
    // Stripe not set up (or failed) → email the request instead
    window.location.href = `mailto:mary@thelearningcreative.com?subject=${encodeURIComponent('Upgrade request from ' + branding.displayName)}&body=${encodeURIComponent('Hi Mary, I would like to upgrade to ' + plan + ' (' + billingInterval + '). Account: ' + branding.displayName + '.')}`;
    setCheckoutBusy(null);
  }
  // Existing subscribers change/cancel via the Stripe Customer Portal (no duplicate charge).
  // flow='update' deep-links straight to the plan-picker; no flow opens the portal home.
  async function startPortal(flow?: 'update') {
    setCheckoutBusy('portal');
    await preserveWip();
    try {
      const res = await fetch('/api/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flow ? { flow } : {}),
      });
      if (res.ok) { const d = await res.json(); if (d.url) { window.location.href = d.url; return; } }
    } catch { /* fall through to email */ }
    window.location.href = `mailto:mary@thelearningcreative.com?subject=${encodeURIComponent('Manage subscription — ' + branding.displayName)}&body=${encodeURIComponent('Hi Mary, I would like to change my subscription. Account: ' + branding.displayName + '.')}`;
    setCheckoutBusy(null);
  }
  // The client's current plan id (matches a tier row), so we badge it instead of offering it.
  const currentPlanId = (branding.plan?.name ?? '').toLowerCase();
  // Add-on elements (calendars, SWOT, notes, grids…) are an Agency+ feature —
  // locked on the core-builder plans (Starter and Pro).
  const elementsLocked = currentPlanId === 'starter' || currentPlanId === 'pro';
  // Returning from a successful Stripe Checkout
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('upgraded')) {
      setJustUpgraded(true);
      if (sessionStorage.getItem('wb_wip_saved')) { setWipSaved(true); sessionStorage.removeItem('wb_wip_saved'); }
      refreshUsage();
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Trial users are proactively prompted to choose a plan on login (skip if we're
  // returning from a successful checkout, where the success toast shows instead).
  useEffect(() => {
    if (trial && typeof window !== 'undefined' && !new URLSearchParams(window.location.search).get('upgraded')) {
      setShowUpgrade(true);
    }
  }, []);

  // Undo/redo history for editor changes (rapid keystrokes within 700ms are coalesced)
  const [past, setPast] = useState<DocumentModel[]>([]);
  const [future, setFuture] = useState<DocumentModel[]>([]);
  const lastEditRef = useRef(0);

  function setDocTracked(next: DocumentModel) {
    if (doc) {
      const now = Date.now();
      if (now - lastEditRef.current > 700) { setPast((p) => [...p.slice(-49), doc]); setFuture([]); }
      lastEditRef.current = now;
    }
    setDoc(next);
  }
  function undo() {
    if (!doc || past.length === 0) return;
    setFuture((f) => [doc, ...f]);
    setDoc(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    lastEditRef.current = 0;
  }
  function redo() {
    if (!doc || future.length === 0) return;
    setPast((p) => [...p, doc]);
    setDoc(future[0]);
    setFuture((f) => f.slice(1));
    lastEditRef.current = 0;
  }

  function selectSection(id: string) {
    setView('work');
    setStep(2);
    setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  }

  async function saveCurrent() {
    if (!doc) return;
    const { id } = await saveWorkbook(branding.id, doc, savedId);
    setSavedId(id);
    setSavedRefresh((n) => n + 1);
  }

  function openSaved(w: SavedWorkbook) {
    setDoc(w.doc);
    setSavedId(w.id);
    setPast([]); setFuture([]);
    setStep(2);
    setView('work');
  }

  // Jo's template + colors are fixed by her brand
  const templateId = branding.templateId;
  const colorTheme: ColorTheme = {
    primary: branding.colors.title,
    secondary: branding.colors.subtitle,
    background: '#FFFFFF',
  };

  function handleParsed(parsed: DocumentModel) {
    setDoc(parsed);
    setSavedId(null); // a freshly uploaded doc is a new workbook until saved/downloaded
    setPast([]); setFuture([]);
    setStep(2);
  }

  // Clear the current workbook and return to the upload step, without signing out.
  // Only warn when there's genuinely unsaved work — a workbook already in the Saved
  // folder (savedId set, e.g. after a download) starts fresh without nagging.
  function startNew() {
    const unsaved = !!doc && !savedId;
    if (unsaved && !confirm('Start a new workbook? Your current one hasn’t been saved yet and will be lost.')) return;
    setDoc(null);
    setSavedId(null);
    setPast([]); setFuture([]);
    setFocus(null);
    setStep(1);
    setView('work');
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Welcome {branding.displayName}
              <span className="ml-2 text-xs font-mono text-gray-400 align-middle">{APP_VERSION}</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Upload your Word doc → Review → Download your branded fillable PDF
            </p>
          </div>
          <div className="flex items-center gap-3">
            {view === 'work' && (
              <nav className="flex items-center gap-1">
                {STEPS.map((s, i) => (
                  <div key={s.num} className="flex items-center gap-1">
                    <button
                      onClick={() => (s.num <= step || doc) && setStep(s.num)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        step === s.num
                          ? 'text-white shadow'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={step === s.num ? { backgroundColor: branding.colors.title } : undefined}
                    >
                      <span
                        className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold text-white"
                        style={{
                          backgroundColor: step === s.num ? 'rgba(255,255,255,0.3)' : s.num < step ? '#22c55e' : '#cbd5e1',
                        }}
                      >
                        {s.num < step ? '✓' : s.num}
                      </span>
                      {s.label}
                    </button>
                    {i < STEPS.length - 1 && <span className="text-gray-300 mx-1">›</span>}
                  </div>
                ))}
              </nav>
            )}
            {doc && (
              <button
                onClick={startNew}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                title="Start a new workbook without signing out"
              >
                ＋ New workbook
              </button>
            )}
            <button
              onClick={() => setView((v) => (v === 'saved' ? 'work' : 'saved'))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${view === 'saved' ? 'text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={view === 'saved' ? { backgroundColor: branding.colors.title } : undefined}
            >
              📁 Saved{savedCount > 0 ? ` (${savedCount})` : ''}
            </button>
            {branding.id.startsWith('u_') && (
              <a href="/setup" className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all" title="Edit your branded template">
                🎨 Template
              </a>
            )}
            <button
              onClick={() => setShowUpgrade(true)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: branding.colors.accent }}
              title={manageable ? 'Manage your plan' : 'See plans and upgrade'}
            >
              {manageable ? '⚙ Manage plan' : '⬆ Upgrade'}
            </button>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Trial banner */}
      {trial && (
        <div className={`px-6 py-2 text-sm flex items-center justify-center gap-3 ${trial.state === 'active' ? 'bg-[#F0F7E6] text-[#163446]' : 'bg-amber-50 text-amber-800 border-b border-amber-200'}`}>
          {trial.state === 'active' ? (
            downloadLimit != null && downloadCount >= downloadLimit ? (
              <span>🎁 <b>{trial.daysLeft} day{trial.daysLeft === 1 ? '' : 's'} left</b> · you’ve used your free download — subscribe to download more.</span>
            ) : (
              <span>🎁 <b>{trial.daysLeft} day{trial.daysLeft === 1 ? '' : 's'} left</b> in your free trial{downloadLimit != null ? ` · ${downloadLimit} free download${downloadLimit === 1 ? '' : 's'} included` : ''}.</span>
            )
          ) : (
            <span>⏳ Your free trial has ended. Subscribe to keep downloading. (You can still edit your workbooks.)</span>
          )}
          <button onClick={() => setShowUpgrade(true)} className="shrink-0 px-3 py-1 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: branding.colors.accent }}>
            {trial.state === 'active' ? 'Subscribe' : 'Subscribe now'}
          </button>
        </div>
      )}

      {/* Saved Workbooks view */}
      {view === 'saved' && (
        <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-6 py-6 overflow-y-auto">
          <button onClick={() => setView('work')} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white rounded-lg px-4 py-2 shadow-sm transition-opacity hover:opacity-90" style={{ backgroundColor: branding.colors.title }}>
            ← Back{doc ? ' to workbook' : ' to upload'}
          </button>
          <h2 className="text-lg font-bold text-gray-900">Saved Workbooks</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Reopen a past workbook to keep editing. Workbooks are saved automatically when you download — or hit <b>Save</b> in the Review step.</p>
          <SavedWorkbooks branding={branding} onEdit={openSaved} refreshKey={savedRefresh} />
        </div>
      )}

      {/* Main content */}
      {view === 'work' && (
      <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-6 py-6 flex gap-6">
        {/* Left panel */}
        <div className="w-[420px] shrink-0 space-y-4 overflow-y-auto min-h-0 pr-1">

          {/* Brand banner */}
          <div className="rounded-2xl p-4 text-white text-sm shadow-sm" style={{ backgroundColor: branding.colors.header }}>
            <div className="font-semibold">Your template is ready</div>
            {branding.id !== 'sellit' && <div className="text-white/70 text-xs mt-0.5">{branding.tagline}</div>}
          </div>

          {/* Step 1: Upload */}
          <section className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all ${step !== 1 && doc ? 'opacity-70' : ''}`}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm">Step 1 — Upload Word Doc</h2>
              {doc && step !== 1 && (
                <button onClick={() => setStep(1)} className="text-xs text-blue-600 hover:underline">Change</button>
              )}
            </div>
            {step === 1 ? (
              <div className="p-5 space-y-3">
                <FileUpload onParsed={handleParsed} />
                {/* The interactive demo sample is only for the TLC showcase account. */}
                {branding.id === 'thelearningcreative' && (
                  <>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-300">
                      <span className="flex-1 border-t border-gray-100" />or<span className="flex-1 border-t border-gray-100" />
                    </div>
                    <button
                      onClick={() => handleParsed(buildSampleWorkbook(branding.id))}
                      className="w-full py-2.5 rounded-xl font-medium text-sm border-2 transition-colors hover:bg-gray-50"
                      style={{ borderColor: branding.colors.accent, color: branding.colors.title }}
                      title="Load a ready-made interactive sample (calendar, checkboxes, answer boxes)"
                    >
                      ✨ Load an interactive sample workbook
                    </button>
                  </>
                )}
              </div>
            ) : doc ? (
              <div className="px-5 py-3 text-sm text-gray-600">
                <span className="font-medium text-gray-800">{doc.title}</span>
                <span className="text-gray-400 ml-2">· {doc.sections.length} sections</span>
              </div>
            ) : null}
          </section>

          {/* Step 2: Review/edit document */}
          {(step >= 2 || doc) && doc && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800 text-sm">Step 2 — Review &amp; Edit</h2>
                {step !== 2 && <button onClick={() => setStep(2)} className="text-xs text-blue-600 hover:underline">Edit</button>}
              </div>
              {step === 2 && (
                <div className="p-5 space-y-4">
                  <DocumentEditor doc={doc} onChange={setDocTracked} branding={branding} focus={focus}
                    onUndo={undo} onRedo={redo} canUndo={past.length > 0} canRedo={future.length > 0}
                    lockElements={elementsLocked} onUpgrade={() => setShowUpgrade(true)}
                    onActiveSection={(id) => setPreviewFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))} />
                  <div className="flex gap-2">
                    <button
                      onClick={saveCurrent}
                      className="shrink-0 px-4 py-2.5 rounded-xl font-medium border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors"
                      title="Save this workbook so you can edit it later"
                    >
                      💾 Save
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="flex-1 py-2.5 text-white rounded-xl font-medium transition-opacity hover:opacity-90"
                      style={{ backgroundColor: branding.colors.title }}
                    >
                      Continue to Download →
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Step 3: Download */}
          {step === 3 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800 text-sm">Step 3 — Download</h2>
              </div>
              <div className="p-5 space-y-2">
                <DownloadButton doc={doc} templateId={templateId} colorTheme={colorTheme} branding={branding}
                  atLimit={atLimit}
                  onBlocked={() => setShowUpgrade(true)}
                  onDownloaded={(counts) => {
                    saveCurrent();
                    setUsage((u) => (typeof counts?.monthly === 'number' ? counts.monthly : u + 1));
                    setLifetimeUsage((l) => (typeof counts?.lifetime === 'number' ? counts.lifetime : l + 1));
                  }} />
                {downloadLimit != null && (
                  <p className="text-xs text-center text-gray-400">
                    {downloadCount}/{downloadLimit} {trial ? `free download${downloadLimit === 1 ? '' : 's'} used in your trial` : `downloads used this month on the ${branding.plan?.name} plan`}
                    {atLimit && <> · <button onClick={() => setShowUpgrade(true)} className="underline" style={{ color: branding.colors.accent }}>upgrade for more</button></>}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right panel: Preview */}
        <div className="flex-1 min-h-0 min-w-0">
          <PDFPreview doc={doc} templateId={templateId} colorTheme={colorTheme} branding={branding} onSelectSection={selectSection} scrollTo={previewFocus} />
        </div>
      </div>
      )}

      {justUpgraded && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-xl shadow-lg px-4 py-2.5 text-sm flex items-center gap-2 max-w-md" style={{ borderColor: branding.colors.accent }}>
          <span style={{ color: branding.colors.accent }}>✓</span>
          <span>
            You’re on the {branding.plan?.name} plan now.
            {wipSaved && <> The workbook you were editing is saved in <button onClick={() => { setView('saved'); setJustUpgraded(false); }} className="font-semibold underline" style={{ color: branding.colors.title }}>📁 Saved</button>.</>}
          </span>
          <button onClick={() => setJustUpgraded(false)} className="text-gray-400 hover:text-gray-700 ml-1 shrink-0">×</button>
        </div>
      )}

      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowUpgrade(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold" style={{ color: branding.colors.title }}>{manageable ? 'Manage your plan' : trial ? 'Choose a plan' : 'Upgrade your plan'}</h2>
              <button onClick={() => setShowUpgrade(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              You’re on the <b>{branding.plan?.name ?? 'current'}</b> plan{downloadLimit != null ? (trial ? ` (${downloadLimit} free download, ${downloadCount} used)` : ` (${downloadLimit} downloads/month, ${usage} used)`) : ''}.
            </p>

            <div className="mt-4 inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(['monthly', 'annual'] as const).map((iv) => (
                <button key={iv} onClick={() => setBillingInterval(iv)}
                  className={`px-3 py-1.5 ${billingInterval === iv ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  style={billingInterval === iv ? { backgroundColor: branding.colors.title } : undefined}>
                  {iv === 'monthly' ? 'Monthly' : 'Annual (~1 mo free)'}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {([
                { id: 'starter' as const, name: 'Starter', blurb: '1 download/mo · core builder', monthly: '$99/mo', annual: '$1,089/yr' },
                { id: 'pro' as const, name: 'Pro', blurb: '2 downloads/mo · core builder', monthly: '$180/mo', annual: '$1,980/yr' },
                { id: 'agency' as const, name: 'Agency', blurb: 'Unlimited downloads · all elements', monthly: '$499/mo', annual: '$5,489/yr' },
              ]).map((t) => (
                <div key={t.id} className={`flex items-center justify-between gap-3 border rounded-xl p-3 ${t.id === currentPlanId ? 'border-gray-300 bg-gray-50' : 'border-gray-100'}`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800">{t.name} <span className="text-gray-400 font-normal">· {billingInterval === 'monthly' ? t.monthly : t.annual}</span></div>
                    <div className="text-xs text-gray-500">{t.blurb}</div>
                  </div>
                  {t.id === currentPlanId ? (
                    <span className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold text-gray-500 bg-gray-100">Current plan</span>
                  ) : manageable ? (
                    <button onClick={() => startPortal('update')} disabled={checkoutBusy === 'portal'}
                      className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold border disabled:opacity-60"
                      style={{ color: branding.colors.title, borderColor: branding.colors.title }}>
                      {checkoutBusy === 'portal' ? '…' : 'Change'}
                    </button>
                  ) : (
                    <button onClick={() => startCheckout(t.id)} disabled={checkoutBusy === t.id}
                      className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: branding.colors.accent }}>
                      {checkoutBusy === t.id ? '…' : 'Upgrade'}
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl p-3">
                <div><div className="font-semibold text-gray-800">Enterprise <span className="text-gray-400 font-normal">· 2+ brands</span></div><div className="text-xs text-gray-500">Custom pricing</div></div>
                <a href={`mailto:mary@thelearningcreative.com?subject=${encodeURIComponent('Enterprise inquiry from ' + branding.displayName)}`} className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold border" style={{ color: branding.colors.title, borderColor: branding.colors.title }}>Contact</a>
              </div>
            </div>
            {manageable && (
              <button onClick={() => startPortal()} disabled={checkoutBusy === 'portal'}
                className="mt-4 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: branding.colors.title }}>
                {checkoutBusy === 'portal' ? '…' : 'Manage subscription'}
              </button>
            )}
            <p className="text-[11px] text-center text-gray-400 mt-3">
              {manageable
                ? 'Change or cancel your plan in the Stripe billing portal · no duplicate charge.'
                : 'Secure checkout via Stripe · your plan updates automatically after payment.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
