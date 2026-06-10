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
}

export default function FileUpload({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function deliver(doc: DocumentModel, name: string) {
    setFileName(name);
    setError('');
    onParsed(doc);
  }

  // Run AI formatting (with local fallback), given source HTML and the local parse result
  async function formatAndDeliver(html: string, localDoc: DocumentModel, name: string) {
    if (!useAI) {
      deliver(localDoc, name);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await aiStructure(html);
      if ('document' in result) {
        deliver(result.document, name);
      } else {
        deliver(localDoc, name);
        setError(`⚠️ AI formatting did not run — ${result.reason} Used the basic formatter instead.`);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File) {
    if (!file.name.match(/\.(txt|md|docx)$/i)) {
      setError('Please upload a .txt, .md, or .docx file.');
      return;
    }
    if (file.name.match(/\.docx$/i)) {
      docxToHtml(file)
        .then((html) => formatAndDeliver(html, parseWorkbookHtml(html), file.name))
        .catch(() => setError('Failed to read Word document. Please check the file and try again.'));
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
      {/* AI toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 cursor-pointer">
        <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
        <span><strong>✨ Auto-format with AI</strong> — structures headings, checkboxes, answer boxes & rating dropdowns</span>
      </label>

      {!pasteMode ? (
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
          <p className="font-medium text-gray-700">Drop your .txt, .md, or .docx file here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,.docx"
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
          AI is formatting your workbook…
        </div>
      )}

      <button onClick={() => setPasteMode(!pasteMode)} className="text-sm text-blue-600 hover:underline">
        {pasteMode ? '← Back to file upload' : 'Or paste text directly'}
      </button>

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
