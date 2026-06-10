'use client';
import { useState } from 'react';
import { DocumentModel, Section, FormField, FieldType, HeadingStyle, TextCase } from '@/types/document';

interface Props {
  doc: DocumentModel;
  onChange: (doc: DocumentModel) => void;
}

function makeId() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function DocumentEditor({ doc, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState(false);

  function updateSection(id: string, patch: Partial<Section>) {
    onChange({
      ...doc,
      sections: doc.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }

  function addField(sectionId: string, type: FieldType) {
    const section = doc.sections.find((s) => s.id === sectionId)!;
    const newField: FormField = { id: makeId(), label: `Field ${section.fields.length + 1}`, type, required: false };
    updateSection(sectionId, { fields: [...section.fields, newField] });
  }

  function removeField(sectionId: string, fieldId: string) {
    const section = doc.sections.find((s) => s.id === sectionId)!;
    updateSection(sectionId, { fields: section.fields.filter((f) => f.id !== fieldId) });
  }

  function updateFieldLabel(sectionId: string, fieldId: string, label: string) {
    const section = doc.sections.find((s) => s.id === sectionId)!;
    updateSection(sectionId, {
      fields: section.fields.map((f) => (f.id === fieldId ? { ...f, label } : f)),
    });
  }

  function updateBodyLine(sectionId: string, idx: number, value: string) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    const bodyLines = s.bodyLines.map((l, i) => (i === idx ? value : l));
    updateSection(sectionId, { bodyLines });
  }
  function removeBodyLine(sectionId: string, idx: number) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    updateSection(sectionId, { bodyLines: s.bodyLines.filter((_, i) => i !== idx) });
  }
  function addBodyLine(sectionId: string) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    updateSection(sectionId, { bodyLines: [...s.bodyLines, ''] });
  }

  function updateBullet(sectionId: string, idx: number, value: string) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    const bullets = s.bullets.map((l, i) => (i === idx ? value : l));
    updateSection(sectionId, { bullets });
  }
  function removeBullet(sectionId: string, idx: number) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    updateSection(sectionId, { bullets: s.bullets.filter((_, i) => i !== idx) });
  }
  function addBullet(sectionId: string) {
    const s = doc.sections.find((x) => x.id === sectionId)!;
    updateSection(sectionId, { bullets: [...s.bullets, ''] });
  }

  function moveSection(index: number, dir: -1 | 1) {
    const sections = [...doc.sections];
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    onChange({ ...doc, sections });
  }

  const fieldTypeIcon: Record<FieldType, string> = { text: '—', textarea: '≡', checkbox: '☐' };
  const fieldTypeLabel: Record<FieldType, string> = { text: 'Text field', textarea: 'Text area', checkbox: 'Checkbox' };

  return (
    <div className="space-y-4">
      {/* Title & Author */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 w-14">Title</span>
          {editingTitle ? (
            <input
              autoFocus
              className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={doc.title}
              onChange={(e) => onChange({ ...doc, title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
            />
          ) : (
            <button
              className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 truncate"
              onClick={() => setEditingTitle(true)}
            >
              {doc.title || 'Untitled'} ✏️
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 w-14">Author</span>
          {editingAuthor ? (
            <input
              autoFocus
              className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={doc.author}
              onChange={(e) => onChange({ ...doc, author: e.target.value })}
              onBlur={() => setEditingAuthor(false)}
            />
          ) : (
            <button
              className="flex-1 text-left text-sm text-gray-500 hover:text-blue-600"
              onClick={() => setEditingAuthor(true)}
            >
              {doc.author || 'Add author…'} ✏️
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 w-14">Title case</span>
          <select
            value={doc.titleCase ?? 'upper'}
            onChange={(e) => onChange({ ...doc, titleCase: e.target.value as TextCase })}
            className="text-xs border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="none">As typed</option>
            <option value="upper">UPPERCASE</option>
            <option value="sentence">Sentence case</option>
            <option value="title">Capitalize Each Word</option>
          </select>
        </div>
      </div>

      {/* Sections */}
      {doc.sections.map((section, idx) => (
        <div key={section.id} className="border rounded-xl overflow-hidden">
          <div className="bg-white px-4 py-3 flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▲</button>
              <button onClick={() => moveSection(idx, 1)} disabled={idx === doc.sections.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▼</button>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded ${section.level === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {section.level === 1 ? 'H1' : 'H2'}
            </span>

            {editingId === section.id ? (
              <input
                autoFocus
                className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={section.title}
                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                onBlur={() => setEditingId(null)}
              />
            ) : (
              <button
                className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 truncate"
                onClick={() => setEditingId(section.id)}
              >
                {section.title} ✏️
              </button>
            )}

            <span className="text-xs text-gray-400 shrink-0">
              {section.fields.length} field{section.fields.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Heading style controls */}
          <div className="border-t bg-gray-50 px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <label className="flex items-center gap-1 text-gray-500">
              Style
              <select
                value={section.headingStyle ?? 'accent'}
                onChange={(e) => updateSection(section.id, { headingStyle: e.target.value as HeadingStyle })}
                className="border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="accent">Accent + bullet</option>
                <option value="brand">Brand blue</option>
                <option value="plain">Plain</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-gray-500">
              Case
              <select
                value={section.headingCase ?? 'none'}
                onChange={(e) => updateSection(section.id, { headingCase: e.target.value as TextCase })}
                className="border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="none">As typed</option>
                <option value="upper">UPPERCASE</option>
                <option value="sentence">Sentence case</option>
                <option value="title">Capitalize Each Word</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-gray-500 cursor-pointer" title="Render this section's text inside a stylized brand box">
              <input
                type="checkbox"
                checked={!!section.callout}
                onChange={(e) => updateSection(section.id, { callout: e.target.checked })}
              />
              Stylize text as callout
            </label>
            <label className="flex items-center gap-1 text-gray-500 cursor-pointer" title="Start this section on a new page">
              <input
                type="checkbox"
                checked={!!section.pageBreakBefore}
                onChange={(e) => updateSection(section.id, { pageBreakBefore: e.target.checked })}
              />
              Start on new page
            </label>
          </div>

          {/* Content: body lines + bullets, editable */}
          <div className="border-t bg-white px-4 py-2 space-y-1.5">
            {section.bodyLines.map((line, i) => (
              <div key={`b${i}`} className="flex items-center gap-2">
                <span className="text-gray-300 text-xs w-4" title="Text line">¶</span>
                <input
                  className="flex-1 text-xs border-b border-dashed border-gray-200 bg-transparent focus:outline-none focus:border-blue-400 py-0.5"
                  value={line}
                  placeholder="Text line…"
                  onChange={(e) => updateBodyLine(section.id, i, e.target.value)}
                />
                <button onClick={() => removeBodyLine(section.id, i)} className="text-red-400 hover:text-red-600 text-xs" title="Remove line">✕</button>
              </div>
            ))}
            {section.bullets.map((line, i) => (
              <div key={`l${i}`} className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-4" title="Bullet">•</span>
                <input
                  className="flex-1 text-xs border-b border-dashed border-gray-200 bg-transparent focus:outline-none focus:border-blue-400 py-0.5"
                  value={line}
                  placeholder="Bullet…"
                  onChange={(e) => updateBullet(section.id, i, e.target.value)}
                />
                <button onClick={() => removeBullet(section.id, i)} className="text-red-400 hover:text-red-600 text-xs" title="Remove bullet">✕</button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => addBodyLine(section.id)} className="text-xs px-2 py-0.5 rounded bg-gray-50 border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-colors">+ text line</button>
              <button onClick={() => addBullet(section.id)} className="text-xs px-2 py-0.5 rounded bg-gray-50 border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-colors">+ bullet</button>
            </div>
          </div>

          {/* Fields list */}
          {section.fields.length > 0 && (
            <div className="border-t divide-y bg-gray-50">
              {section.fields.map((field) => (
                <div key={field.id} className="flex items-center gap-2 px-4 py-2">
                  <span className="text-gray-400 text-xs w-4">{fieldTypeIcon[field.type]}</span>
                  <input
                    className="flex-1 text-xs border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-400 py-0.5"
                    value={field.label}
                    onChange={(e) => updateFieldLabel(section.id, field.id, e.target.value)}
                  />
                  <span className="text-xs text-gray-400">{fieldTypeLabel[field.type]}</span>
                  <button
                    onClick={() => removeField(section.id, field.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                    title="Remove field"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add field buttons */}
          <div className="border-t bg-gray-50 px-4 py-2 flex gap-2">
            <span className="text-xs text-gray-400 mr-1">Add:</span>
            {(['text', 'textarea', 'checkbox'] as FieldType[]).map((type) => (
              <button
                key={type}
                onClick={() => addField(section.id, type)}
                className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                {fieldTypeIcon[type]} {type}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
