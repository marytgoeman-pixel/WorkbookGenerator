'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentModel, ColorTheme, ClientBranding } from '@/types/document';
import FileUpload from '@/components/FileUpload';
import DocumentEditor from '@/components/DocumentEditor';
import PDFPreview from '@/components/PDFPreview';
import DownloadButton from '@/components/DownloadButton';
import SavedWorkbooks from '@/components/SavedWorkbooks';
import { saveWorkbook, listSaved, SavedWorkbook } from '@/lib/savedWorkbooks';
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
  const [view, setView] = useState<'work' | 'saved'>('work');
  const [savedId, setSavedId] = useState<string | null>(null);   // the saved-workbook this doc maps to
  const [savedRefresh, setSavedRefresh] = useState(0);           // bump to re-read the saved list / count
  // Which section to scroll to in the editor (set by clicking the preview). `n` bumps each
  // click so re-clicking the same section re-triggers the scroll.
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    let active = true;
    listSaved(branding.id).then((r) => { if (active) setSavedCount(r.items.length); });
    return () => { active = false; };
  }, [branding.id, savedRefresh, view]);

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
            <button
              onClick={() => setView((v) => (v === 'saved' ? 'work' : 'saved'))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${view === 'saved' ? 'text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={view === 'saved' ? { backgroundColor: branding.colors.title } : undefined}
            >
              📁 Saved{savedCount > 0 ? ` (${savedCount})` : ''}
            </button>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Saved Workbooks view */}
      {view === 'saved' && (
        <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-6 py-6 overflow-y-auto">
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
                  <DocumentEditor doc={doc} onChange={setDoc} branding={branding} focus={focus} />
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
              <div className="p-5">
                <DownloadButton doc={doc} templateId={templateId} colorTheme={colorTheme} branding={branding} onDownloaded={saveCurrent} />
              </div>
            </section>
          )}
        </div>

        {/* Right panel: Preview */}
        <div className="flex-1 min-h-0 min-w-0">
          <PDFPreview doc={doc} templateId={templateId} colorTheme={colorTheme} branding={branding} onSelectSection={selectSection} />
        </div>
      </div>
      )}
    </div>
  );
}
