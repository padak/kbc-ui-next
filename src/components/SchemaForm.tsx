// file: components/SchemaForm.tsx
// Recursive JSON Schema -> React form renderer.
// Handles string, number, boolean, object, array types with format hints.
// Used by: ConfigEditor for config and row editing.
// Supports: password fields, nested objects, checkboxes, enums, required validation.

import { useState } from 'react';

type SchemaFormProps = {
  schema: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  path?: string;
};

type PropertySchema = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  format?: string;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Record<string, unknown>>;
  items?: Record<string, unknown>;
  propertyOrder?: number;
  minLength?: number;
};

// Get sorted property entries from a schema, respecting propertyOrder.
function getSortedProperties(schema: Record<string, unknown>): [string, PropertySchema][] {
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const entries = Object.entries(properties) as [string, PropertySchema][];

  return entries.sort((a, b) => {
    const orderA = a[1].propertyOrder ?? 999;
    const orderB = b[1].propertyOrder ?? 999;
    return (orderA as number) - (orderB as number);
  });
}

// Check if a field is required based on the parent schema's required array.
function isRequired(schema: Record<string, unknown>, fieldName: string): boolean {
  const required = schema.required as string[] | undefined;
  return required?.includes(fieldName) ?? false;
}

// Determine the input type based on schema type and format.
function getInputType(propSchema: PropertySchema, fieldName: string): string {
  if (propSchema.format === 'password' || fieldName.startsWith('#')) return 'password';
  if (propSchema.format === 'url') return 'url';
  if (propSchema.type === 'number' || propSchema.type === 'integer') return 'number';
  return 'text';
}

// Get a value from the values object, falling back to undefined.
function getValue(values: Record<string, unknown>, key: string): unknown {
  return values[key];
}

// Set a value in the values object immutably.
function setValue(values: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  return { ...values, [key]: value };
}

function FormField({
  fieldName,
  propSchema,
  value,
  onChange,
  required,
}: {
  fieldName: string;
  propSchema: PropertySchema;
  value: unknown;
  onChange: (value: unknown) => void;
  required: boolean;
}) {
  const label = propSchema.title ?? fieldName;
  const description = propSchema.description;
  const placeholder = propSchema.default !== undefined ? String(propSchema.default) : undefined;

  // Boolean / checkbox
  if (propSchema.type === 'boolean' || propSchema.format === 'checkbox') {
    const checked = typeof value === 'boolean' ? value : (propSchema.default === true);
    return (
      <div className="flex items-start gap-3 py-1">
        <input
          type="checkbox"
          id={fieldName}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <label htmlFor={fieldName} className="text-sm font-medium text-gray-700">
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      </div>
    );
  }

  // Enum -> select dropdown
  if (propSchema.enum && Array.isArray(propSchema.enum)) {
    return (
      <div>
        <label htmlFor={fieldName} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <select
          id={fieldName}
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">-- Select --</option>
          {propSchema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
        {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      </div>
    );
  }

  // Array of strings -> textarea (one item per line)
  if (propSchema.type === 'array') {
    const arrayValue = Array.isArray(value) ? value : [];
    const textValue = arrayValue.join('\n');
    return (
      <div>
        <label htmlFor={fieldName} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <textarea
          id={fieldName}
          value={textValue}
          onChange={(e) => {
            const lines = e.target.value.split('\n').filter((line) => line.trim() !== '');
            onChange(lines);
          }}
          placeholder={placeholder ?? 'One item per line'}
          rows={3}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      </div>
    );
  }

  // String / number / integer -> text input
  const inputType = getInputType(propSchema, fieldName);
  const inputValue = value !== undefined && value !== null ? String(value) : '';

  return (
    <div>
      <label htmlFor={fieldName} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type={inputType}
        id={fieldName}
        value={inputValue}
        onChange={(e) => {
          if (propSchema.type === 'number' || propSchema.type === 'integer') {
            const num = e.target.value === '' ? undefined : Number(e.target.value);
            onChange(num);
          } else {
            onChange(e.target.value);
          }
        }}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
    </div>
  );
}

function ObjectSection({
  fieldName,
  propSchema,
  value,
  onChange,
  parentPath,
}: {
  fieldName: string;
  propSchema: PropertySchema;
  value: unknown;
  onChange: (value: unknown) => void;
  parentPath: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const label = propSchema.title ?? fieldName;
  const objectValue = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const nestedPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/50">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold text-gray-800 hover:bg-gray-100"
      >
        <span>{label}</span>
        <span className="text-gray-400">{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>
      {isOpen && (
        <div className="border-t border-gray-200 px-4 py-3">
          {propSchema.description && (
            <p className="mb-3 text-xs text-gray-500">{propSchema.description}</p>
          )}
          <SchemaForm
            schema={propSchema as Record<string, unknown>}
            values={objectValue}
            onChange={(newValues) => onChange(newValues)}
            path={nestedPath}
          />
        </div>
      )}
    </div>
  );
}

export function SchemaForm({ schema, values, onChange, path = '' }: SchemaFormProps) {
  const sortedProperties = getSortedProperties(schema);

  if (sortedProperties.length === 0) {
    return <p className="text-sm text-gray-400">No properties defined in schema.</p>;
  }

  return (
    <div className="space-y-4">
      {sortedProperties.map(([fieldName, propSchema]) => {
        const fieldValue = getValue(values, fieldName);
        const required = isRequired(schema, fieldName);

        // Nested object -> collapsible section
        if (propSchema.type === 'object' && propSchema.properties) {
          return (
            <ObjectSection
              key={fieldName}
              fieldName={fieldName}
              propSchema={propSchema}
              value={fieldValue}
              onChange={(newValue) => onChange(setValue(values, fieldName, newValue))}
              parentPath={path}
            />
          );
        }

        // All other types -> form field
        return (
          <FormField
            key={fieldName}
            fieldName={path ? `${path}.${fieldName}` : fieldName}
            propSchema={propSchema}
            value={fieldValue}
            onChange={(newValue) => onChange(setValue(values, fieldName, newValue))}
            required={required}
          />
        );
      })}
    </div>
  );
}
