// file: components/StackUrlPicker.tsx
// Stack URL selector with Keboola preset stacks + custom URLs.
// Custom URLs are persisted in localStorage for future sessions.
// Used by: ConnectPage.tsx, SetupPage.tsx (AddOrgForm).
// Shows clickable chips for presets, input for custom URLs.

import { useState, useEffect } from 'react';
import { KEBOOLA_STACKS, CUSTOM_STACKS_KEY } from '@/lib/constants';

type StackUrlPickerProps = {
  value: string;
  onChange: (url: string) => void;
};

function loadCustomStacks(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STACKS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function getShortLabel(url: string): string {
  try {
    return new URL(url).hostname.replace('connection.', '').replace('.keboola.com', '');
  } catch {
    return url;
  }
}

function saveCustomStack(url: string) {
  if (!isValidUrl(url)) return;
  const existing = loadCustomStacks();
  if (!existing.includes(url) && !KEBOOLA_STACKS.some((s) => s.url === url)) {
    localStorage.setItem(CUSTOM_STACKS_KEY, JSON.stringify([...existing, url]));
  }
}

export function StackUrlPicker({ value, onChange }: StackUrlPickerProps) {
  const [customStacks, setCustomStacks] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  useEffect(() => {
    setCustomStacks(loadCustomStacks());
  }, []);

  const isSelected = !!value;

  function handleSelectPreset(url: string) {
    onChange(url);
    setShowCustomInput(false);
  }

  function handleAddCustom() {
    const normalized = customUrl.trim().replace(/\/+$/, '');
    if (!normalized || !isValidUrl(normalized)) return;
    saveCustomStack(normalized);
    setCustomStacks(loadCustomStacks());
    onChange(normalized);
    setCustomUrl('');
    setShowCustomInput(false);
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600">Stack</label>
      <div className="flex flex-wrap gap-1.5">
        {KEBOOLA_STACKS.map((stack) => (
          <button
            key={stack.url}
            type="button"
            onClick={() => handleSelectPreset(stack.url)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              value === stack.url
                ? 'border-blue-300 bg-blue-50 font-medium text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {stack.label}
          </button>
        ))}
        {customStacks.filter(isValidUrl).map((url) => {
          const shortLabel = getShortLabel(url);
          return (
            <button
              key={url}
              type="button"
              onClick={() => handleSelectPreset(url)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                value === url
                  ? 'border-blue-300 bg-blue-50 font-medium text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {shortLabel}
            </button>
          );
        })}
        {!showCustomInput && (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
          >
            + Custom
          </button>
        )}
      </div>

      {showCustomInput && (
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://connection.custom.keboola.com"
            autoFocus
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustom(); } }}
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="rounded-md px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      )}

      {isSelected && (
        <p className="mt-1.5 truncate font-mono text-[10px] text-gray-400">{value}</p>
      )}
    </div>
  );
}
