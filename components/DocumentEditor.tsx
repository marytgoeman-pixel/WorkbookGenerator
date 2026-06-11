'use client';
import { useState } from 'react';
import {
  DocumentModel, Section, FormField, FieldType, HeadingStyle, TextCase, Spacing, ContentItem,
} from '@/types/document';

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
              <input autoFocus className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={section.title} onChange={(e) => updateSection(section.id, { title: e.target.value })} onBlur={() => setEditingId(null)} />
            ) : (
              <button className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 truncate" onClick={() => setEditingId(section.id)}>
                {section.title} ✏️
              </button>
            )}
            <button onClick={() => updateSection(section.id, { level: section.level === 1 ? 2 : 1 })}
              className="text-[10px] text-gray-400 hover:text-blue-600 border border-gray-200 rounded px-1" title="Toggle H1/H2">
              {section.level === 1 ? '→H2' : '→H1'}
            </button>
            <button onClick={() => deleteSection(section.id)} className="text-gray-300 hover:text-red-600 text-sm" title="Delete section">🗑</button>
          </div>

          {/* Style controls */}
          <div className="border-t bg-gray-50 px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <label className="flex items-center gap-1 text-gray-500">Style
              <select value={section.headingStyle ?? (section.level === 1 ? 'title' : 'brand')}
                onChange={(e) => updateSection(section.id, { headingStyle: e.target.value as HeadingStyle })}
                className="border rounded px-1.5 py-0.5 bg-white">
                <option value="title">Brand (no bullet)</option><option value="brand">Blue (no bullet)</option><option value="accent">Accent + bullet</option><option value="plain">Plain</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-gray-500">Case
              <select value={section.headingCase ?? 'none'} onChange={(e) => updateSection(section.id, { headingCase: e.target.value as TextCase })}
                className="border rounded px-1.5 py-0.5 bg-white">
                <option value="none">As typed</option><option value="upper">UPPERCASE</option>
                <option value="sentence">Sentence</option><option value="title">Title Case</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-gray-500 cursor-pointer">
              <input type="checkbox" checked={!!section.callout} onChange={(e) => updateSection(section.id, { callout: e.target.checked })} /> Callout
            </label>
            <label className="flex items-center gap-1 text-gray-500 cursor-pointer">
              <input type="checkbox" checked={!!section.pageBreakBefore} onChange={(e) => updateSection(section.id, { pageBreakBefore: e.target.checked })} /> New page
            </label>
            <label className="flex items-center gap-1.5 text-gray-500 w-full" title="Drag to tighten or loosen this section's spacing — useful to pull content back from the next page">
              <span className="shrink-0">Spacing</span>
              <input
                type="range" min="0.3" max="2" step="0.1"
                value={section.spacing ?? 1}
                onChange={(e) => updateSection(section.id, { spacing: parseFloat(e.target.value) })}
                className="flex-1 accent-blue-500"
              />
              <span className="shrink-0 w-7 text-right tabular-nums">{(section.spacing ?? 1).toFixed(1)}×</span>
            </label>
          </div>

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
                    <input className="flex-1 text-xs border-b border-dashed border-gray-200 bg-transparent focus:outline-none focus:border-blue-400 py-0.5"
                      value={item.text} placeholder="Text…" onChange={(e) => updateItem(section.id, item.id, { text: e.target.value })} />
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
