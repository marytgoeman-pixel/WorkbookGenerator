'use client';
import { useState, useEffect } from 'react';
import {
  DocumentModel, Section, FormField, FieldType, HeadingStyle, TextCase, Spacing, ContentItem, CoverSettings, ClientBranding,
} from '@/types/document';
import { coverImagesFor } from '@/lib/covers';
import { ELEMENTS, calendarElement } from '@/lib/elements';

interface Props {
  doc: DocumentModel;
  onChange: (doc: DocumentModel) => void;
  branding?: ClientBranding;
  focus?: { id: string; n: number } | null; // scroll to + highlight this section (from preview clicks)
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// Clear, friendly names: a single-line write-in vs a multi-line box
const fieldTypeLabel: Record<FieldType, string> = { text: 'Short answer', textarea: 'Paragraph', checkbox: 'Checkbox', dropdown: 'Dropdown' };

export default function DocumentEditor({ doc, onChange, branding, focus, onUndo, onRedo, canUndo, canRedo }: Props) {
  const isJo = branding?.id === 'jomangum';
  const isSellit = branding?.id === 'sellit';
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Answer-box preview colors mirror the actual PDF field styling for this client
  const fieldBg = branding?.colors.grayBox ?? '#eef2ff';
  const fieldBorder = branding?.colors.accent ?? '#9ca3af';
  const addBtn = 'text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors';
  const elBtn = 'text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium';

  // When the preview is clicked, scroll the matching section into view and flash a highlight.
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`wb-sec-${focus.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightId(focus.id);
        setTimeout(() => setHighlightId((cur) => (cur === focus.id ? null : cur)), 1800);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [focus]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState(false);
  const [openStyles, setOpenStyles] = useState<Record<string, boolean>>({});
  // Add-element palette state (calendar month/year picker)
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [yearOptions] = useState(() => { const b = new Date().getFullYear(); return [b - 1, b, b + 1, b + 2, b + 3]; });
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function toggleStyle(id: string) {
    setOpenStyles((m) => ({ ...m, [id]: !m[id] }));
  }

  const cover: CoverSettings = doc.cover ?? { enabled: false };
  function setCover(patch: Partial<CoverSettings>) {
    onChange({ ...doc, cover: { ...cover, ...patch } });
  }

  function updateSection(id: string, patch: Partial<Section>) {
    onChange({ ...doc, sections: doc.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  function setContent(sectionId: string, content: ContentItem[]) {
    updateSection(sectionId, { content });
  }

  function updateItem(sectionId: string, itemId: string, patch: Partial<ContentItem>) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    setContent(sectionId, s.content.map((it) => (it.id === itemId ? ({ ...it, ...patch } as ContentItem) : it)));
  }

  function updateFieldLabel(sectionId: string, itemId: string, label: string) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    setContent(sectionId, s.content.map((it) =>
      it.id === itemId && it.kind === 'field' ? { ...it, field: { ...it.field, label } } : it
    ));
  }

  function updateFieldProp(sectionId: string, itemId: string, patch: Partial<FormField>) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    setContent(sectionId, s.content.map((it) =>
      it.id === itemId && it.kind === 'field' ? { ...it, field: { ...it.field, ...patch } } : it
    ));
  }

  function removeItem(sectionId: string, itemId: string) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    setContent(sectionId, s.content.filter((it) => it.id !== itemId));
  }

  function moveItem(sectionId: string, index: number, dir: -1 | 1) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    const arr = [...s.content];
    const t = index + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[index], arr[t]] = [arr[t], arr[index]];
    setContent(sectionId, arr);
  }

  function addItem(sectionId: string, item: ContentItem) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    setContent(sectionId, [...s.content, item]);
  }

  function addField(sectionId: string, type: FieldType) {
    const f: FormField = { id: uid('field'), label: '', type, required: false };
    addItem(sectionId, { id: uid('c'), kind: 'field', field: f });
  }

  // Convert a text item into a field of the given type, keeping its text as the label
  function textToField(sectionId: string, itemId: string, type: FieldType) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    setContent(sectionId, s.content.map((it) =>
      it.id === itemId && it.kind === 'text'
        ? { id: it.id, kind: 'field', field: { id: uid('field'), label: type === 'checkbox' ? it.text : it.text, type, required: false } }
        : it
    ));
  }

  function moveSection(index: number, dir: -1 | 1) {
    const sections = [...doc.sections];
    const t = index + dir;
    if (t < 0 || t >= sections.length) return;
    [sections[index], sections[t]] = [sections[t], sections[index]];
    onChange({ ...doc, sections });
  }
  function deleteSection(id: string) {
    onChange({ ...doc, sections: doc.sections.filter((s) => s.id !== id) });
  }
  function insertSection(afterIndex: number) {
    const sections = [...doc.sections];
    const ns: Section = { id: uid('s'), level: 1, title: 'New Section', content: [] };
    sections.splice(afterIndex + 1, 0, ns);
    onChange({ ...doc, sections });
    setEditingId(ns.id);
  }
  // Append a ready-made element (calendar, notes page, SWOT, etc.) to the document.
  function addElement(secs: Section[]) {
    onChange({ ...doc, sections: [...doc.sections, ...secs] });
  }

  return (
    <div className="space-y-4">
      {/* Undo / Redo */}
      {(onUndo || onRedo) && (
        <div className="flex items-center gap-2">
          <button onClick={onUndo} disabled={!canUndo}
            className="flex items-center gap-1.5 text-xs font-medium rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Undo">↶ Undo</button>
          <button onClick={onRedo} disabled={!canRedo}
            className="flex items-center gap-1.5 text-xs font-medium rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Redo">↷ Redo</button>
        </div>
      )}

      {/* Title & Author */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <Row label="Title">
          {editingTitle ? (
            <input autoFocus className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={doc.title} onChange={(e) => onChange({ ...doc, title: e.target.value })} onBlur={() => setEditingTitle(false)} />
          ) : (
            <button className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 truncate" onClick={() => setEditingTitle(true)}>
              {doc.title || 'Untitled'} ✏️
            </button>
          )}
        </Row>
        <Row label="Author">
          {editingAuthor ? (
            <input autoFocus className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={doc.author} onChange={(e) => onChange({ ...doc, author: e.target.value })} onBlur={() => setEditingAuthor(false)} />
          ) : (
            <button className="flex-1 text-left text-sm text-gray-500 hover:text-blue-600" onClick={() => setEditingAuthor(true)}>
              {doc.author || 'Add author…'} ✏️
            </button>
          )}
        </Row>
        <Row label="Title case">
          <select value={doc.titleCase ?? 'upper'} onChange={(e) => onChange({ ...doc, titleCase: e.target.value as TextCase })}
            className="text-xs border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="none">As typed</option><option value="upper">UPPERCASE</option>
            <option value="sentence">Sentence case</option><option value="title">Capitalize Each Word</option>
          </select>
        </Row>
        <Row label="Spacing">
          <select value={doc.bodySpacing ?? 'normal'} onChange={(e) => onChange({ ...doc, bodySpacing: e.target.value as Spacing })}
            className="text-xs border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="compact">Compact</option><option value="normal">Normal</option><option value="relaxed">Relaxed</option>
          </select>
        </Row>
        {isSellit && (
          <Row label="Top header">
            <input
              className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="THE GROWTH ACCELERATOR"
              value={cover.header ?? ''}
              onChange={(e) => setCover({ header: e.target.value })}
            />
          </Row>
        )}
      </div>

      {/* Cover page */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <label className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white cursor-pointer">
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="text-base">🖼️</span> Cover page
          </span>
          <span className="relative inline-flex items-center">
            <input type="checkbox" className="peer sr-only" checked={cover.enabled}
              onChange={(e) => setCover({ enabled: e.target.checked })} />
            <span className="w-9 h-5 rounded-full bg-gray-300 peer-checked:bg-blue-500 transition-colors" />
            <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </span>
        </label>

        {cover.enabled && (
          <div className="px-4 py-3 space-y-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-500">Pick a background image for the cover. The title, author, and tagline sit in a branded band over it.</p>
            <div className="grid grid-cols-5 gap-2">
              {coverImagesFor(branding?.id).map((img) => {
                const selected = cover.imageId === img.id;
                return (
                  <button key={img.id} type="button" title={img.label}
                    onClick={() => setCover({ imageId: selected ? undefined : img.id })}
                    className={`relative aspect-[3/2] rounded-lg overflow-hidden border-2 transition-all ${
                      selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
                    }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumb} alt={img.label} className="w-full h-full object-cover" />
                    {selected && (
                      <span className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <span className="bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">✓</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {cover.imageId && (
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-gray-500">Image focus (which part stays in frame)</label>
                <div className="flex flex-wrap gap-3">
                  <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                    {(['left', 'center', 'right'] as const).map((a) => {
                      const active = (cover.imageAlign ?? 'center') === a;
                      return (
                        <button key={a} type="button" onClick={() => setCover({ imageAlign: a })}
                          className={`px-3 py-1.5 text-xs transition-colors ${
                            active ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                          } ${a !== 'left' ? 'border-l border-gray-200' : ''}`}>
                          {a === 'left' ? '⬅ Left' : a === 'right' ? 'Right ➡' : '⬌ Center'}
                        </button>
                      );
                    })}
                  </div>
                  <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                    {(['top', 'center', 'bottom'] as const).map((a) => {
                      const active = (cover.imageAlignV ?? 'center') === a;
                      return (
                        <button key={a} type="button" onClick={() => setCover({ imageAlignV: a })}
                          className={`px-3 py-1.5 text-xs transition-colors ${
                            active ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                          } ${a !== 'top' ? 'border-l border-gray-200' : ''}`}>
                          {a === 'top' ? '⬆ Top' : a === 'bottom' ? '⬇ Bottom' : '⬍ Center'}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-gray-500" title="Zoom the cover photo in (crop tighter) or out (show more)">
                  <span className="shrink-0 w-12 text-[11px] font-medium">Zoom</span>
                  <input type="range" min="0.5" max="3" step="0.1" value={cover.imageZoom ?? 1}
                    onChange={(e) => setCover({ imageZoom: parseFloat(e.target.value) })} className="flex-1 accent-blue-500" />
                  <span className="shrink-0 w-9 text-right tabular-nums text-[11px]">{(cover.imageZoom ?? 1).toFixed(1)}×</span>
                </label>
              </div>
            )}
            {isSellit && (
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Word after the title (inline)</label>
                <input
                  className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Workbook"
                  value={cover.workbookLabel ?? ''}
                  onChange={(e) => setCover({ workbookLabel: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">{isSellit ? 'Session line (blue)' : 'Cover subtitle (optional)'}</label>
              <input
                className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder={isSellit ? 'e.g. Session 1 - June 11, 1PM ET' : 'e.g. A workbook for real estate professionals'}
                value={cover.subtitle ?? ''}
                onChange={(e) => setCover({ subtitle: e.target.value })}
              />
            </div>
            {isSellit && (
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Description line (gray, optional)</label>
                <input
                  className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g. Turning conversations into appointments"
                  value={cover.descriptor ?? ''}
                  onChange={(e) => setCover({ descriptor: e.target.value })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* End pages (Jo only): About + Legal, appended at the end */}
      {isJo && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-base">📑</span> End pages
          </div>
          <div className="px-4 py-2 border-t border-gray-100 divide-y divide-gray-100">
            <label className="flex items-center justify-between py-2 cursor-pointer">
              <span className="text-sm text-gray-700">Add an <b>About Jo</b> page</span>
              <span className="relative inline-flex items-center">
                <input type="checkbox" className="peer sr-only" checked={!!doc.aboutPage}
                  onChange={(e) => onChange({ ...doc, aboutPage: e.target.checked })} />
                <span className="w-9 h-5 rounded-full bg-gray-300 peer-checked:bg-blue-500 transition-colors" />
                <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>
            <label className="flex items-center justify-between py-2 cursor-pointer">
              <span className="text-sm text-gray-700">Add a <b>Legal</b> page</span>
              <span className="relative inline-flex items-center">
                <input type="checkbox" className="peer sr-only" checked={!!doc.legalPage}
                  onChange={(e) => onChange({ ...doc, legalPage: e.target.checked })} />
                <span className="w-9 h-5 rounded-full bg-gray-300 peer-checked:bg-blue-500 transition-colors" />
                <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Sections */}
      {doc.sections.map((section, idx) => (
        <div key={section.id} id={`wb-sec-${section.id}`}
          className={`border rounded-xl overflow-hidden transition-all ${highlightId === section.id ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
          {/* Header row */}
          <div className="bg-white px-4 py-3 flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▲</button>
              <button onClick={() => moveSection(idx, 1)} disabled={idx === doc.sections.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▼</button>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded ${section.level === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {section.level === 1 ? 'H1' : 'H2'}
            </span>
            {editingId === section.id ? (
              <textarea autoFocus rows={Math.max(1, section.title.split('\n').length)}
                className="flex-1 border rounded px-2 py-1 text-sm leading-snug resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={section.title} onChange={(e) => updateSection(section.id, { title: e.target.value })} onBlur={() => setEditingId(null)} />
            ) : (
              <button className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 whitespace-pre-line" onClick={() => setEditingId(section.id)}>
                {section.title} ✏️
              </button>
            )}
            <button onClick={() => updateSection(section.id, { level: section.level === 1 ? 2 : 1 })}
              className="text-[10px] text-gray-400 hover:text-blue-600 border border-gray-200 rounded px-1" title="Toggle H1/H2">
              {section.level === 1 ? '→H2' : '→H1'}
            </button>
            <button onClick={() => toggleStyle(section.id)}
              className={`flex items-center gap-1 text-[11px] rounded-full px-2 py-1 border transition-colors ${
                openStyles[section.id]
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
              }`} title="Style options for this block">
              <span>Style</span>
              <span className={`transition-transform ${openStyles[section.id] ? 'rotate-180' : ''}`}>▾</span>
            </button>
            <button onClick={() => deleteSection(section.id)} className="text-gray-300 hover:text-red-600 text-sm" title="Delete section">🗑</button>
          </div>

          {editingId === section.id && (
            <div className="bg-blue-50 px-4 py-1 text-[10px] text-blue-700 border-t border-blue-100">
              💡 Press <b>Enter</b> for a line break in the heading. Click away when done.
            </div>
          )}

          {/* Style controls — collapsible per block */}
          {openStyles[section.id] && (
            <div className="border-t border-gray-100 bg-slate-50 px-4 py-3 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Heading style</label>
                  <select value={section.headingStyle ?? (section.level === 1 ? 'title' : 'brand')}
                    onChange={(e) => updateSection(section.id, { headingStyle: e.target.value as HeadingStyle })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="title">Brand (no bullet)</option><option value="brand">Blue (no bullet)</option><option value="accent">Accent + bullet</option><option value="plain">Plain</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Capitalization</label>
                  <select value={section.headingCase ?? 'none'} onChange={(e) => updateSection(section.id, { headingCase: e.target.value as TextCase })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="none">As typed</option><option value="upper">UPPERCASE</option>
                    <option value="sentence">Sentence</option><option value="title">Title Case</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => updateSection(section.id, { callout: !section.callout })}
                  className={`rounded-full px-3 py-1 border transition-colors ${section.callout ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {section.callout ? '✓ ' : ''}Callout box
                </button>
                <button type="button" onClick={() => updateSection(section.id, { pageBreakBefore: !section.pageBreakBefore })}
                  className={`rounded-full px-3 py-1 border transition-colors ${section.pageBreakBefore ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {section.pageBreakBefore ? '✓ ' : ''}Start on new page
                </button>
              </div>

              <label className="flex items-center gap-2 text-gray-500" title="Tighten or loosen the gaps between blocks — useful to pull content back from the next page">
                <span className="shrink-0 w-14 font-medium text-[11px]">Spacing</span>
                <input type="range" min="0.3" max="2" step="0.1" value={section.spacing ?? 1}
                  onChange={(e) => updateSection(section.id, { spacing: parseFloat(e.target.value) })} className="flex-1 accent-blue-500" />
                <span className="shrink-0 w-8 text-right tabular-nums">{(section.spacing ?? 1).toFixed(1)}×</span>
              </label>
              <label className="flex items-center gap-2 text-gray-500" title="Tighten or loosen the lines within text and callouts">
                <span className="shrink-0 w-14 font-medium text-[11px]">Lines</span>
                <input type="range" min="0.7" max="1.6" step="0.05" value={section.lineSpacing ?? 1}
                  onChange={(e) => updateSection(section.id, { lineSpacing: parseFloat(e.target.value) })} className="flex-1 accent-blue-500" />
                <span className="shrink-0 w-8 text-right tabular-nums">{(section.lineSpacing ?? 1).toFixed(2)}×</span>
              </label>
            </div>
          )}

          {/* Ordered content */}
          <div className="border-t bg-white divide-y divide-gray-100">
            {section.content.map((item, i) => {
              const reorder = (
                <div className="flex flex-col pt-1 text-gray-300 shrink-0">
                  <button onClick={() => moveItem(section.id, i, -1)} disabled={i === 0} className="hover:text-gray-700 disabled:opacity-20 text-[10px] leading-none">▲</button>
                  <button onClick={() => moveItem(section.id, i, 1)} disabled={i === section.content.length - 1} className="hover:text-gray-700 disabled:opacity-20 text-[10px] leading-none">▼</button>
                </div>
              );
              return (
                <div key={item.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-gray-50/60">
                  {reorder}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {item.kind === 'text' && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">Text</span>
                          <textarea rows={Math.max(1, item.text.split('\n').length)}
                            className="flex-1 min-w-0 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-1 resize-y leading-snug"
                            value={item.text} placeholder="Reading text… (Enter = line break)" onChange={(e) => updateItem(section.id, item.id, { text: e.target.value })} />
                        </div>
                        <div className="flex gap-1.5 pl-1">
                          <button onClick={() => textToField(section.id, item.id, 'textarea')} className="text-[10px] text-gray-500 rounded px-1.5 py-0.5 border border-gray-200 hover:border-blue-400 hover:text-blue-600">→ make a write-in box</button>
                          <button onClick={() => textToField(section.id, item.id, 'checkbox')} className="text-[10px] text-gray-500 rounded px-1.5 py-0.5 border border-gray-200 hover:border-blue-400 hover:text-blue-600">→ make a checkbox</button>
                        </div>
                      </>
                    )}

                    {item.kind === 'bullet' && (
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">Bullet</span>
                        <input className="flex-1 min-w-0 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-1"
                          value={item.text} placeholder="Bullet point…" onChange={(e) => updateItem(section.id, item.id, { text: e.target.value })} />
                      </div>
                    )}

                    {item.kind === 'field' && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">{fieldTypeLabel[item.field.type]}</span>
                          <input className="flex-1 min-w-0 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 px-2 py-1"
                            value={item.field.label} placeholder="Question / prompt…" onChange={(e) => updateFieldLabel(section.id, item.id, e.target.value)} />
                        </div>
                        {/* Live answer-box preview (short line vs tall box, brand color) + size stepper beside it */}
                        {(item.field.type === 'text' || item.field.type === 'textarea') && (
                          <div className="flex items-start gap-2 ml-1">
                            <div className="flex-1 min-w-0 rounded border" style={{ height: item.field.type === 'text' ? 16 : Math.min(130, Math.round(34 * (item.field.heightScale ?? 1)) + 8), backgroundColor: fieldBg, borderColor: fieldBorder }} />
                            <span className="flex items-center gap-0.5 shrink-0" title="Make THIS answer box taller or shorter">
                              <button onClick={() => updateFieldProp(section.id, item.id, { heightScale: Math.max(0.5, Math.round(((item.field.heightScale ?? 1) - 0.25) * 100) / 100) })}
                                className="w-5 h-5 leading-none rounded border border-orange-300 text-orange-600 hover:bg-orange-50 text-[13px]">−</button>
                              <span className="text-[10px] tabular-nums w-9 text-center text-orange-600 font-semibold">{(item.field.heightScale ?? 1).toFixed(2)}×</span>
                              <button onClick={() => updateFieldProp(section.id, item.id, { heightScale: Math.min(5, Math.round(((item.field.heightScale ?? 1) + 0.25) * 100) / 100) })}
                                className="w-5 h-5 leading-none rounded border border-orange-300 text-orange-600 hover:bg-orange-50 text-[13px]">+</button>
                            </span>
                          </div>
                        )}
                        {item.field.type === 'checkbox' && (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 ml-1"><span className="inline-block w-3.5 h-3.5 border rounded-sm" style={{ borderColor: fieldBorder, backgroundColor: fieldBg }} /> tick box</div>
                        )}
                        {item.field.type === 'dropdown' && item.field.options && (
                          <div className="text-[11px] text-gray-400 ml-1">Choices: {item.field.options[0]}–{item.field.options[item.field.options.length - 1]}</div>
                        )}
                      </>
                    )}

                    {item.kind === 'table' && (
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{item.table.fullPage ? 'Grid' : 'Table'}</span>
                        <span className="flex-1 text-xs text-gray-600">{item.table.headers.length || item.table.rows[0]?.length || 0} cols × {item.table.rows.length} rows</span>
                      </div>
                    )}

                    {item.kind === 'lines' && (
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-teal-700 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">Lines</span>
                        <span className="flex-1 text-xs text-gray-600">Ruled notes area {item.rows ? `(${item.rows} lines)` : '(fills the page)'}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeItem(section.id, item.id)} className="text-gray-300 hover:text-red-600 text-sm shrink-0 mt-1" title="Remove">✕</button>
                </div>
              );
            })}
          </div>

          {/* Add controls */}
          <div className="border-t bg-gray-50 px-4 py-2.5 space-y-1.5">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-gray-400 w-12 shrink-0">Content</span>
              <button onClick={() => addItem(section.id, { id: uid('c'), kind: 'text', text: '' })} className={addBtn}>¶ Text</button>
              <button onClick={() => addItem(section.id, { id: uid('c'), kind: 'bullet', text: '' })} className={addBtn}>• Bullet</button>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-gray-400 w-12 shrink-0">Fill-in</span>
              <button onClick={() => addField(section.id, 'text')} className={addBtn} title="One-line write-in">— Short answer</button>
              <button onClick={() => addField(section.id, 'textarea')} className={addBtn} title="Multi-line write-in box">≡ Paragraph</button>
              <button onClick={() => addField(section.id, 'checkbox')} className={addBtn}>☐ Checkbox</button>
            </div>
          </div>

          {/* Insert section */}
          <div className="border-t bg-white px-4 py-1.5 text-center">
            <button onClick={() => insertSection(idx)} className="text-xs text-gray-400 hover:text-blue-600" title="Insert a new header/section here">
              + Insert section below
            </button>
          </div>
        </div>
      ))}

      {/* Add an element — ready-made pages & grids */}
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2"><span>✨</span> Add an element</div>
        <p className="text-[11px] text-gray-400 -mt-1.5">Drop in a ready-made page or grid — it&apos;s added at the end, then drag it up with ▲.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={calMonth} onChange={(e) => setCalMonth(+e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={calYear} onChange={(e) => setCalYear(+e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => addElement(calendarElement(calYear, calMonth))} className={elBtn}>📅 Add calendar</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ELEMENTS.filter((e) => e.key !== 'calendar').map((e) => (
            <button key={e.key} onClick={() => addElement(e.make())} className={elBtn}>{e.icon} {e.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500 w-16">{label}</span>
      {children}
    </div>
  );
}
