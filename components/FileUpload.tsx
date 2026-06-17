'use client';
import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { DocumentModel } from '@/types/document';
import { parseWorkbook, parseWorkbookHtml } from '@/lib/parseWorkbook';

// Convert a Word doc to HTML so heading styles, lists, and bold structure survive
async function docxToHtml(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }
  );
  return result.value;
}

// Extract selectable text from a PDF (outline) using pdf.js, preserving line breaks
async function pdfToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore - legacy build path has no bundled type declarations
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as typeof import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    for (const item of content.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const it = item as any;
      if (typeof it.str !== 'string') continue;
      line += it.str;
      if (it.hasEOL) { text += line.trimEnd() + '\n'; line = ''; }
    }
    if (line.trim()) text += line.trimEnd() + '\n';
    text += '\n'; // blank line between pages
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

type AiResult = { document: DocumentModel } | { reason: string };

// Ask the AI endpoint to structure the document; returns a reason string on failure
async function aiStructure(html: string): Promise<AiResult> {
  try {
    const res = await fetch('/api/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    });
    if (res.status === 503) return { reason: 'AI is not configured on the server (missing ANTHROPIC_API_KEY).' };
    if (res.status === 401) return { reason: 'Your session expired — please sign in again.' };
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { reason: data.error || `AI request failed (${res.status}).` };
    }
    const data = await res.json();
    return data.document ? { document: data.document } : { reason: 'AI returned no document.' };
  } catch {
    return { reason: 'Could not reach the AI service.' };
  }
}

interface Props {
  onParsed: (doc: DocumentModel) => void;
  aiLocked?: boolean;       // self-serve trial: AI auto-format + builder unlock after subscribing
  onUpgrade?: () => void;   // open the subscribe modal when a locked AI feature is clicked
}

export default function FileUpload({ onParsed, aiLocked, onUpgrade }: Props) {
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [loading, setLoading] = useState(false);
  // When AI fails we DON'T auto-advance — we hold the basic-parsed doc here and
  // show a visible explanation, so the fallback is never silent.
  const [fallback, setFallback] = useState<{ doc: DocumentModel; name: string; reason: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // CRAFT "build with AI" panel — for people who don't have an outline to upload.
  const [buildMode, setBuildMode] = useState(false);
  const [building, setBuilding] = useState(false);
  const [bTopic, setBTopic] = useState('');
  const [bType, setBType] = useState('Course companion');
  const [bAudience, setBAudience] = useState('General audience');
  const [bGoal, setBGoal] = useState('');
  const [bLength, setBLength] = useState('Standard (5–7 sections)');
  const [bSourceText, setBSourceText] = useState('');
  const [bSourceName, setBSourceName] = useState('');
  const buildFileRef = useRef<HTMLInputElement>(null);

  function deliver(doc: DocumentModel, name: string) {
    setFileName(name);
    setError('');
    setFallback(null);
    onParsed(doc);
  }

  // Pull text from an optional source file (PDF / Word / text) to ground the AI build.
  async function loadBuildSource(file: File) {
    setError('');
    try {
      let text = '';
      if (/\.docx$/i.test(file.name)) text = (await docxToHtml(file)).replace(/<[^>]+>/g, ' ');
      else if (/\.pdf$/i.test(file.name)) text = await pdfToText(file);
      else if (/\.(txt|md)$/i.test(file.name)) text = await file.text();
      else { setError('For source material use a PDF, Word doc, or text file. (Export a PowerPoint to PDF first.)'); return; }
      setBSourceText(text.slice(0, 200000));
      setBSourceName(file.name);
    } catch {
      setError('Could not read that file. Try a PDF, Word doc, or text file.');
    }
  }

  async function buildWithAi() {
    if (!bTopic.trim() && !bSourceText.trim()) { setError('Tell us what the workbook is about, or add some source material.'); return; }
    setBuilding(true);
    setError('');
    try {
      const res = await fetch('/api/build', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: bTopic, type: bType, audience: bAudience, goal: bGoal, length: bLength, sourceText: bSourceText }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.document) { deliver(data.document, bTopic.trim().slice(0, 60) || 'AI-built workbook'); return; }
      setError(data.error || 'Could not build the workbook. Please try again.');
    } catch {
      setError('Could not reach the AI service. Please try again.');
    } finally {
      setBuilding(false);
    }
  }

  // Run AI formatting (with local fallback), given source HTML and the local parse result
  async function formatAndDeliver(html: string, localDoc: DocumentModel, name: string) {
    if (!useAI || aiLocked) { // AI off, or locked on a self-serve trial → basic parse
      deliver(localDoc, name);
      return;
    }
    setLoading(true);
    setError('');
    setFallback(null);
    try {
      const result = await aiStructure(html);
      if ('document' in result) {
        deliver(result.document, name);
      } else {
        // Stay on this screen and explain — do not silently use the worse output
        setFallback({ doc: localDoc, name, reason: result.reason });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File) {
    if (!file.name.match(/\.(txt|md|docx|pdf)$/i)) {
      setError('Please upload a .txt, .md, .docx, or .pdf file.');
      return;
    }
    if (file.name.match(/\.docx$/i)) {
      docxToHtml(file)
        .then((html) => formatAndDeliver(html, parseWorkbookHtml(html), file.name))
        .catch(() => setError('Failed to read Word document. Please check the file and try again.'));
    } else if (file.name.match(/\.pdf$/i)) {
      setError('');
      setLoading(true);
      pdfToText(file)
        .then((text) => {
          if (!text || text.length < 20) {
            setError('Couldn’t read text from this PDF — it may be scanned/image-based. Try a Word doc, or paste the outline text.');
            return;
          }
          return formatAndDeliver(text, parseWorkbook(text), file.name);
        })
        .catch(() => setError('Failed to read the PDF. Please try a Word doc or paste the text.'))
        .finally(() => setLoading(false));
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) ?? '';
        // Feed plain text to the AI as-is; local fallback uses the text parser
        formatAndDeliver(text, parseWorkbook(text), file.name);
      };
      reader.readAsText(file);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onPasteSubmit() {
    if (pasteText.trim()) formatAndDeliver(pasteText, parseWorkbook(pasteText), 'pasted-text.txt');
  }

  return (
    <div className="space-y-4">
      {/* AI toggle (or a locked note on a self-serve trial) */}
      {!buildMode && (aiLocked ? (
        <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <span>🔒</span>
          <span><strong>AI auto-format &amp; the workbook builder</strong> unlock when you subscribe. For now, upload or paste your outline and we&apos;ll structure it.</span>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
          <span><strong>✨ Auto-format with AI</strong> — structures headings, checkboxes, answer boxes &amp; rating dropdowns</span>
        </label>
      ))}

      {buildMode ? (
        <div className="space-y-3 border-2 border-dashed border-blue-200 rounded-xl p-4 bg-blue-50/30">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-800 text-sm">✨ Build my workbook with AI</p>
            <button onClick={() => { setBuildMode(false); setError(''); }} className="text-xs text-blue-600 hover:underline">← Back</button>
          </div>
          <p className="text-xs text-gray-500 -mt-1">Answer a few questions (the CRAFT framework) and AI drafts a fillable workbook you can edit.</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">What&apos;s it about? <span className="text-gray-400">(topic &amp; key ideas)</span></label>
            <textarea value={bTopic} onChange={(e) => setBTopic(e.target.value)} rows={3}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. A 30-day system for real estate agents to nurture past clients and earn referrals." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={bType} onChange={(e) => setBType(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                <option>Course companion</option><option>Coaching / program workbook</option><option>Lead magnet</option><option>Onboarding guide</option><option>Self-assessment</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Audience</label>
              <select value={bAudience} onChange={(e) => setBAudience(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                <option>General audience</option><option>Beginners</option><option>Professionals</option><option>Executives / leaders</option><option>Students</option><option>Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">What should they be able to do after? <span className="text-gray-400">(goal)</span></label>
            <textarea value={bGoal} onChange={(e) => setBGoal(e.target.value)} rows={2}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Build a repeatable weekly outreach habit and a 90-day referral plan." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Length</label>
            <select value={bLength} onChange={(e) => setBLength(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
              <option>Short (3–4 sections)</option><option>Standard (5–7 sections)</option><option>In-depth (8–10 sections)</option>
            </select>
          </div>

          <div>
            <button type="button" onClick={() => buildFileRef.current?.click()} className="text-sm text-blue-600 hover:underline">
              {bSourceName ? `✓ ${bSourceName} (change)` : '+ Optional: add course material (PDF, Word, or text) to base it on'}
            </button>
            <input ref={buildFileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadBuildSource(f); }} />
          </div>

          <button onClick={buildWithAi} disabled={building}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {building ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Building your workbook…</>) : '✨ Build my workbook'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">Uses AI · you can edit everything afterward</p>
        </div>
      ) : !pasteMode ? (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          } ${loading ? 'pointer-events-none opacity-60' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !loading && inputRef.current?.click()}
        >
          <div className="text-4xl mb-3">📄</div>
          <p className="font-medium text-gray-700">Drop a Word doc, PDF, or text file here</p>
          <p className="text-sm text-gray-400 mt-1">.docx · .pdf · .txt · .md — or click to browse</p>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,.docx,.pdf"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            className="w-full h-48 border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={'# My Workbook\n## Section 1\nBody text here.\n[field] Your answer\n[checkbox] Complete'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button
            onClick={onPasteSubmit}
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Formatting…' : 'Parse Text'}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          AI is formatting your workbook… (this can take up to a minute)
        </div>
      )}

      {fallback && !loading && (
        <div className="text-sm bg-red-50 border border-red-300 rounded-lg px-3 py-3 space-y-2">
          <p className="font-semibold text-red-700">⚠️ AI formatting didn&apos;t run</p>
          <p className="text-red-700">{fallback.reason}</p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setFallback(null)}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:border-blue-400"
            >
              Dismiss &amp; re-upload
            </button>
            <button
              onClick={() => deliver(fallback.doc, fallback.name)}
              className="px-3 py-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
            >
              Continue with basic formatting →
            </button>
          </div>
        </div>
      )}

      {!buildMode && (
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={() => setPasteMode(!pasteMode)} className="text-sm text-blue-600 hover:underline">
            {pasteMode ? '← Back to file upload' : 'Or paste text directly'}
          </button>
          {!pasteMode && (
            <button onClick={() => { if (aiLocked) { onUpgrade?.(); } else { setBuildMode(true); setError(''); } }} className="text-sm font-medium text-blue-600 hover:underline">
              {aiLocked ? '✨ Build one with AI 🔒 (subscribe to unlock)' : '✨ No outline? Build one with AI'}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">{error}</p>
      )}

      {fileName && !loading && (
        <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          ✓ Loaded: <strong>{fileName}</strong>
        </div>
      )}
    </div>
  );
}
