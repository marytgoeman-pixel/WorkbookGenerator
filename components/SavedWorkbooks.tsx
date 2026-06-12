'use client';
import { useEffect, useState } from 'react';
import { ClientBranding } from '@/types/document';
import { SavedWorkbook, listSaved, deleteSaved } from '@/lib/savedWorkbooks';

interface Props {
  branding: ClientBranding;
  onEdit: (saved: SavedWorkbook) => void;
  refreshKey?: number; // bump to re-read after a save
}

export default function SavedWorkbooks({ branding, onEdit, refreshKey }: Props) {
  const [items, setItems] = useState<SavedWorkbook[]>([]);

  useEffect(() => {
    setItems(listSaved(branding.id));
  }, [branding.id, refreshKey]);

  function remove(id: string, title: string) {
    if (!window.confirm(`Delete the saved workbook "${title || 'Untitled'}"? This can't be undone.`)) return;
    deleteSaved(branding.id, id);
    setItems(listSaved(branding.id));
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center text-gray-400">
        <div className="text-4xl mb-3">📁</div>
        <p className="font-medium text-gray-600">No saved workbooks yet</p>
        <p className="text-sm mt-1">Download a workbook (or hit Save) and it&apos;ll show up here so you can edit it later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {items.map((w) => (
        <div key={w.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <div className="min-w-0">
            <div className="font-semibold text-gray-800 truncate">{w.title || 'Untitled'}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {w.doc.sections.length} section{w.doc.sections.length === 1 ? '' : 's'} · saved {new Date(w.savedAt).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onEdit(w)}
              className="text-white text-sm font-medium rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: branding.colors.title }}
            >
              Edit
            </button>
            <button
              onClick={() => remove(w.id, w.title)}
              className="text-gray-400 hover:text-red-600 text-sm border border-gray-200 rounded-lg px-3 py-2"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
