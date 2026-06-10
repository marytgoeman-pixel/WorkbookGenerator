'use client';
import { TemplateId } from '@/types/document';

const TEMPLATES: { id: TemplateId; name: string; description: string; icon: string }[] = [
  { id: 'classic', name: 'Classic', description: 'Single column, generous margins. Clean & corporate.', icon: '🏛️' },
  { id: 'modern', name: 'Modern', description: 'Bold color-bar section headers. Contemporary.', icon: '⚡' },
  { id: 'workbook', name: 'Workbook', description: 'Two-column with side notes area. Education & coaching.', icon: '📓' },
];

interface Props {
  selected: TemplateId;
  onChange: (id: TemplateId) => void;
}

export default function TemplateSelector({ selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-xl border-2 p-4 text-left transition-all ${
            selected === t.id
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="text-2xl mb-2">{t.icon}</div>
          <div className="font-semibold text-sm text-gray-800">{t.name}</div>
          <div className="text-xs text-gray-500 mt-1 leading-snug">{t.description}</div>
        </button>
      ))}
    </div>
  );
}
