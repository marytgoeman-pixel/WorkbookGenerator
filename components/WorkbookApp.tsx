'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentModel, ColorTheme, ClientBranding } from '@/types/document';
import FileUpload from '@/components/FileUpload';
import DocumentEditor from '@/components/DocumentEditor';
import PDFPreview from '@/components/PDFPreview';
import DownloadButton from '@/components/DownloadButton';
import { APP_VERSION } from '@/lib/version';

interface Props {
  branding: ClientBranding;
}

type Step = 1 | 2 | 3;

const STEPS = [
  { num: 1 as Step, label: 'Upload' },
  { num: 2 as Step, label: 'Review' },
  { num: 3 as Step, label: 'Download' },
];

export default function WorkbookApp({ branding }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [doc, setDoc] = useState<DocumentModel | null>(null);
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState('');
  const [refineOk, setRefineOk] = useState(false);

  async function refine() {
    if (!doc || !refineText.trim() || refining) return;
    setRefining(true);
    setRefineError('');
    setRefineOk(false);
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: doc, instruction: refineText.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setRefineError(
          res.status === 404
            ? 'The AI refine endpoint is not on this deployment yet — push the latest code and redeploy.'
            : d.error || `Refine failed (${res.status}).`
        );
        return;
      }
      const d = await res.json();
      if (d.document) {
        setDoc(d.document);
        setRefineText('');
        setRefineOk(true);
        setTimeout(() => setRefineOk(false), 6000);
      } else {
        setRefineError('The AI returned no changes. Try rephrasing the instruction.');
      }
    } catch {
      setRefineError('Could not reach the AI service (the endpoint may not be deployed yet).');
    } finally {
      setRefining(false);
    }
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
    setStep(2);
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
          <div className="flex items-center gap-4">
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
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-6 py-6 flex gap-6">
        {/* Left panel */}
        <div className="w-[420px] shrink-0 space-y-4 overflow-y-auto min-h-0 pr-1">

          {/* Brand banner */}
          <div className="rounded-2xl p-4 text-white text-sm shadow-sm" style={{ backgroundColor: branding.colors.header }}>
            <div className="font-semibold">Your template is ready</div>
            <div className="text-white/70 text-xs mt-0.5">{branding.tagline}</div>
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
              <div className="p-5">
                <FileUpload onParsed={handleParsed} />
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
                  {/* Refine with AI — reprompt to add to or restructure the workbook */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                    <div className="text-xs font-semibold text-blue-800">✨ Refine with AI</div>
                    <p className="text-[11px] text-blue-700/80 leading-snug">
                      Tell the AI what to change or add — e.g. “Turn the monthly touches into a fillable calendar table,”
                      or “Add a goals section with 3 write-in lines.”
                    </p>
                    <textarea
                      className="w-full h-16 text-xs border rounded-lg p-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                      placeholder="Describe a change or addition…"
                      value={refineText}
                      disabled={refining}
                      onChange={(e) => setRefineText(e.target.value)}
                    />
                    <button
                      onClick={refine}
                      disabled={refining || !refineText.trim()}
                      className="w-full py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ backgroundColor: branding.colors.subtitle }}
                    >
                      {refining ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Revising… (up to a minute)</>
                      ) : 'Apply with AI'}
                    </button>
                    {refineError && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                        ⚠️ {refineError}
                      </p>
                    )}
                    {refineOk && (
                      <p className="text-xs text-green-800 bg-green-50 border border-green-300 rounded-lg px-2 py-1.5 font-medium">
                        ✓ Applied — check the preview on the right.
                      </p>
                    )}
                  </div>

                  <DocumentEditor doc={doc} onChange={setDoc} />
                  <button
                    onClick={() => setStep(3)}
                    className="w-full py-2.5 text-white rounded-xl font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: branding.colors.title }}
                  >
                    Continue to Download →
                  </button>
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
              <div className="p-5">
                <DownloadButton doc={doc} templateId={templateId} colorTheme={colorTheme} branding={branding} />
              </div>
            </section>
          )}
        </div>

        {/* Right panel: Preview */}
        <div className="flex-1 min-h-0 min-w-0">
          <PDFPreview doc={doc} templateId={templateId} colorTheme={colorTheme} branding={branding} />
        </div>
      </div>
    </div>
  );
}
