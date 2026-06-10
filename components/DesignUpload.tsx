'use client';
import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { ColorTheme } from '@/types/document';
import { extractPDFDesign } from '@/lib/extractPDFDesign';

interface Props {
  onExtracted: (theme: ColorTheme) => void;
}

export default function DesignUpload({ onExtracted }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.match(/\.pdf$/i)) {
      setError('Please upload a PDF file.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await extractPDFDesign(file);
      setPreviewUrl(result.previewUrl);
      onExtracted(result.theme);
    } catch (e) {
      setError('Could not read that PDF. Make sure it is not password-protected.');
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500">Extracting brand colors…</span>
          </div>
        ) : previewUrl ? (
          <div className="flex items-center gap-3">
            <img src={previewUrl} alt="PDF preview" className="h-16 rounded shadow-sm border border-gray-200 object-cover" />
            <div className="text-left">
              <p className="text-xs font-medium text-green-700">✓ Colors extracted</p>
              <p className="text-xs text-gray-400 mt-0.5">Click or drop another PDF to replace</p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-2xl mb-1">🎨</div>
            <p className="text-sm font-medium text-gray-600">Drop company PDF here</p>
            <p className="text-xs text-gray-400 mt-0.5">Brand colors will be extracted automatically</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
