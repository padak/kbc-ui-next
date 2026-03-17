// file: components/ConfigEditor.tsx
// Configuration editor with Form/JSON toggle views.
// Form view uses SchemaForm, JSON view shows raw editable textarea.
// Used by: ConfigurationDetailPage, ConfigurationRowPage.
// Handles save action via onSave callback.

import { useState, useEffect } from 'react';
import { SchemaForm } from './SchemaForm';

type ConfigEditorProps = {
  schema: Record<string, unknown> | null;
  values: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
};

type ViewTab = 'form' | 'json';

export function ConfigEditor({ schema, values, onSave, isSaving }: ConfigEditorProps) {
  const hasSchema = schema !== null && schema !== undefined && Object.keys(schema).length > 0;
  const [activeTab, setActiveTab] = useState<ViewTab>(hasSchema ? 'form' : 'json');
  const [formValues, setFormValues] = useState<Record<string, unknown>>(values);
  const [jsonText, setJsonText] = useState(JSON.stringify(values, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset state when external values change (e.g. after save + refetch).
  useEffect(() => {
    setFormValues(values);
    setJsonText(JSON.stringify(values, null, 2));
  }, [values]);

  // Sync between form and JSON views when switching tabs.
  function handleTabChange(tab: ViewTab) {
    if (tab === 'json' && activeTab === 'form') {
      // Switching from form to JSON: serialize current form values
      setJsonText(JSON.stringify(formValues, null, 2));
      setJsonError(null);
    } else if (tab === 'form' && activeTab === 'json') {
      // Switching from JSON to form: parse JSON text
      try {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        setFormValues(parsed);
        setJsonError(null);
      } catch {
        // Don't switch if JSON is invalid
        setJsonError('Invalid JSON. Fix errors before switching to Form view.');
        return;
      }
    }
    setActiveTab(tab);
  }

  // Determine if values have changed from the initial values.
  function hasChanges(): boolean {
    const currentJson = activeTab === 'form'
      ? JSON.stringify(formValues)
      : jsonText;
    const originalJson = activeTab === 'form'
      ? JSON.stringify(values)
      : JSON.stringify(values, null, 2);
    return currentJson !== originalJson;
  }

  async function handleSave() {
    setSaveError(null);
    try {
      let valuesToSave: Record<string, unknown>;
      if (activeTab === 'json') {
        try {
          valuesToSave = JSON.parse(jsonText) as Record<string, unknown>;
        } catch {
          setJsonError('Invalid JSON. Please fix errors before saving.');
          return;
        }
      } else {
        valuesToSave = formValues;
      }
      await onSave(valuesToSave);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  const tabs: { key: ViewTab; label: string; enabled: boolean }[] = [
    { key: 'form', label: 'Form', enabled: hasSchema },
    { key: 'json', label: 'JSON', enabled: true },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-4 flex items-center justify-between border-b border-gray-200">
        <div className="flex">
          {tabs
            .filter((tab) => tab.enabled)
            .map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges() || isSaving}
          className="mb-1 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Error messages */}
      {jsonError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{jsonError}</div>
      )}
      {saveError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
      )}

      {/* Form view */}
      {activeTab === 'form' && hasSchema && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <SchemaForm
            schema={schema}
            values={formValues}
            onChange={setFormValues}
          />
        </div>
      )}

      {/* JSON view */}
      {activeTab === 'json' && (
        <textarea
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setJsonError(null);
          }}
          spellCheck={false}
          rows={20}
          className="block w-full rounded-lg border border-gray-200 bg-gray-900 p-4 font-mono text-sm text-green-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      )}
    </div>
  );
}
