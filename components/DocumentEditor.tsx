'use client';
import { useState } from 'react';
import {
  DocumentModel, Section, FormField, FieldType, HeadingStyle, TextCase, Spacing, ContentItem, CoverSettings,
} from '@/types/document';
import { COVER_IMAGES } from '@/lib/covers';

interface Props {
  doc: DocumentModel;
  onChange: (doc: DocumentModel) => void;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const fieldTypeIcon: Record<FieldType, string> = { text: '—', textarea: '≡', checkbox: '☐', dropdown: '▾' };
const fieldTypeLabel: Record<FieldType, string> = { text: 'Text field', textarea: 'Text area', checkbox: 'Checkbox', dropdown: 'Dropdown' };

export default function DocumentEditor({ doc, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState(false);
  const [openStyles, setOpenStyles] = useState<Record<string, boolean>>({});

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

  return (
    <div className="space-y-4">
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
              {COVER_IMAGES.map((img) => {
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
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Image focus (if the photo is wider than the page)</label>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['left', 'center', 'right'] as const).map((a) => {
                    const active = (cover.imageAlign ?? 'center') === a;
                    return (
                      <button key={a} type="button" onClick={() => setCover({ imageAlign: a })}
                        className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                          active ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                        } ${a !== 'left' ? 'border-l border-gray-200' : ''}`}>
                        {a === 'left' ? '⬅ Left' : a === 'right' ? 'Right ➡' : '⬌ Center'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Cover subtitle (optional)</label>
              <input
                className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="e.g. A workbook for real estate professionals"
                value={cover.subtitle ?? ''}
                onChange={(e) => setCover({ subtitle: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sections */}
      {doc.sections.map((section, idx) => (
        <div key={section.id} className="border rounded-xl overflow-hidden">
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
            {section.content.map((item, i) => (
              <div key={item.id} className="flex items-center gap-1.5 px-3 py-1.5">
                <div className="flex flex-col">
                  <button onClick={() => moveItem(section.id, i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-[9px] leading-none">▲</button>
                  <button onClick={() => moveItem(section.id, i, 1)} disabled={i === section.content.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-[9px] leading-none">▼</button>
                </div>

                {item.kind === 'text' && (
                  <>
                    <span className="text-gray-300 text-xs w-4" title="Text">¶</span>
                    <textarea rows={Math.max(1, item.text.split('\n').length)}
                      className="flex-1 text-xs border border-dashed border-gray-200 rounded bg-transparent focus:outline-none focus:border-blue-400 px-1 py-0.5 resize-y leading-snug"
                      value={item.text} placeholder="Text… (Enter = line break)" onChange={(e) => updateItem(section.id, item.id, { text: e.target.value })} />
                    <button onClick={() => textToField(section.id, item.id, 'textarea')} className="text-[10px] px-1 rounded bg-gray-50 border border-gray-200 hover:border-blue-400 hover:text-blue-600" title="Make a write-in box">→box</button>
                    <button onClick={() => textToField(section.id, item.id, 'checkbox')} className="text-[10px] px-1 rounded bg-gray-50 border border-gray-200 hover:border-blue-400 hover:text-blue-600" title="Make a checkbox">→check</button>
                  </>
                )}

                {item.kind === 'bullet' && (
                  <>
                    <span className="text-gray-400 text-xs w-4" title="Bullet">•</span>
                    <input className="flex-1 text-xs border-b border-dashed border-gray-200 bg-transparent focus:outline-none focus:border-blue-400 py-0.5"
                      value={item.text} placeholder="Bullet…" onChange={(e) => updateItem(section.id, item.id, { text: e.target.value })} />
                  </>
                )}

                {item.kind === 'field' && (
                  <>
                    <span className="text-gray-400 text-xs w-4">{fieldTypeIcon[item.field.type]}</span>
                    <input className="flex-1 text-xs border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-400 py-0.5"
                      value={item.field.label} placeholder={`${fieldTypeLabel[item.field.type]} label…`} onChange={(e) => updateFieldLabel(section.id, item.id, e.target.value)} />
                    <span className="text-[10px] text-gray-400">{fieldTypeLabel[item.field.type]}{item.field.options ? ` (${item.field.options[0]}–${item.field.options[item.field.options.length - 1]})` : ''}</span>
                  </>
                )}

                {item.kind === 'table' && (
                  <>
                    <span className="text-gray-400 text-xs w-4">▦</span>
                    <span className="flex-1 text-xs text-gray-600">Table · {item.table.headers.length} cols × {item.table.rows.length} rows</span>
                  </>
                )}

                <button onClick={() => removeItem(section.id, item.id)} className="text-red-400 hover:text-red-600 text-xs" title="Remove">✕</button>
              </div>
            ))}
          </div>

          {/* Add controls */}
          <div className="border-t bg-gray-50 px-4 py-2 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400 mr-1">Add:</span>
            <button onClick={() => addItem(section.id, { id: uid('c'), kind: 'text', text: '' })} className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600">¶ text</button>
            <button onClick={() => addItem(section.id, { id: uid('c'), kind: 'bullet', text: '' })} className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600">• bullet</button>
            {(['text', 'textarea', 'checkbox'] as FieldType[]).map((type) => (
              <button key={type} onClick={() => addField(section.id, type)} className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600">
                {fieldTypeIcon[type]} {type}
              </button>
            ))}
          </div>

          {/* Insert section */}
          <div className="border-t bg-white px-4 py-1.5 text-center">
            <button onClick={() => insertSection(idx)} className="text-xs text-gray-400 hover:text-blue-600" title="Insert a new header/section here">
              + Insert section below
            </button>
          </div>
        </div>
      ))}
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
