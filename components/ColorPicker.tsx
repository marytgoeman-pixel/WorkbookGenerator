'use client';
import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { ColorTheme } from '@/types/document';
import { COLOR_PRESETS } from '@/lib/colorPresets';

interface Props {
  theme: ColorTheme;
  onChange: (theme: ColorTheme) => void;
}

type ColorKey = keyof ColorTheme;

export default function ColorPicker({ theme, onChange }: Props) {
  const [activeKey, setActiveKey] = useState<ColorKey | null>(null);

  const colorLabels: { key: ColorKey; label: string }[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'background', label: 'Background' },
  ];

  return (
    <div className="space-y-4">
      {/* Preset swatches */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Presets</p>
        <div className="flex gap-2 flex-wrap">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              title={preset.name}
              onClick={() => onChange(preset.theme)}
              className="flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 hover:border-gray-400 text-xs transition-colors"
            >
              <span
                className="w-3 h-3 rounded-full inline-block border border-gray-300"
                style={{ background: preset.theme.primary }}
              />
              <span
                className="w-3 h-3 rounded-full inline-block border border-gray-300"
                style={{ background: preset.theme.secondary }}
              />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom color controls */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Custom</p>
        <div className="flex gap-3">
          {colorLabels.map(({ key, label }) => (
            <div key={key} className="flex-1">
              <button
                onClick={() => setActiveKey(activeKey === key ? null : key)}
                className={`w-full flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                  activeKey === key ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span
                  className="w-8 h-8 rounded-full border border-gray-300 shadow-sm"
                  style={{ background: theme[key] }}
                />
                <span className="text-xs text-gray-600">{label}</span>
              </button>
            </div>
          ))}
        </div>

        {activeKey && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <HexColorPicker
              color={theme[activeKey]}
              onChange={(color) => onChange({ ...theme, [activeKey]: color })}
              style={{ width: '100%', height: 160 }}
            />
            <input
              type="text"
              value={theme[activeKey]}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange({ ...theme, [activeKey]: v });
              }}
              className="w-28 text-center border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}
