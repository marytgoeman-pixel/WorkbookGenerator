'use client';
import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { DocumentModel } from '@/types/document';
import { parseWorkbook } from '@/lib/parseWorkbook';

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
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
  const inputRef = useRef<HTMLInputElement>(null);

  function processText(text: string, name: string) {
    try {
      const doc = parseWorkbook(text);
      setFileName(name);
      setError('');
      onParsed(doc);
    } catch {
      setError('Failed to parse file. Please check the format.');
    }
  }

  function handleFile(file: File) {
    if (!file.name.match(/\.(txt|md|docx)$/i)) {
      setError('Please upload a .txt, .md, or .docx file.');
      return;
    }
    if (file.name.match(/\.docx$/i)) {
      extractTextFromDocx(file)
        .then((text) => processText(text, file.name))
        .catch(() => setError('Failed to read Word document. Please check the file and try again.'));
    } else {
      const reader = new FileReader();
      reader.onload = (e) => processText(e.target?.result as string, file.name);
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
    if (pasteText.trim()) processText(pasteText, 'pasted-text.txt');
  }

  return (
    <div className="space-y-4">
      {!pasteMode ? (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
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
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Parse Text
          </button>
        </div>
      )}

      <button
        onClick={() => setPasteMode(!pasteMode)}
        className="text-sm text-blue-600 hover:underline"
      >
        {pasteMode ? '← Back to file upload' : 'Or paste text directly'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {fileName && (
        <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          ✓ Loaded: <strong>{fileName}</strong>
        </div>
      )}
    </div>
  );
}
