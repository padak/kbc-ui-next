// file: components/SchemaForm.test.tsx
// Tests for the SchemaForm recursive JSON Schema renderer.
// Covers string, number, boolean, object, array, enum, password, and required fields.
// Run with: npm test
// Uses @testing-library/react for DOM assertions.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchemaForm } from './SchemaForm';

describe('SchemaForm', () => {
  it('renders string input with label and description', () => {
    const schema = {
      type: 'object',
      properties: {
        baseUrl: {
          type: 'string',
          title: 'Base URL',
          description: 'Common prefix for all resources',
        },
      },
    };

    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);

    expect(screen.getByLabelText('Base URL')).toBeInTheDocument();
    expect(screen.getByText('Common prefix for all resources')).toBeInTheDocument();
  });

  it('renders required fields with asterisk', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', title: 'Name' },
        optional: { type: 'string', title: 'Optional Field' },
      },
    };

    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);

    const nameLabel = screen.getByText('Name');
    expect(nameLabel.parentElement?.querySelector('.text-red-500')).not.toBeNull();

    const optionalLabel = screen.getByText('Optional Field');
    expect(optionalLabel.parentElement?.querySelector('.text-red-500')).toBeNull();
  });

  it('renders checkbox for boolean type', () => {
    const schema = {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', title: 'Enabled' },
      },
    };

    render(<SchemaForm schema={schema} values={{ enabled: true }} onChange={() => {}} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('renders number input for integer type', () => {
    const schema = {
      type: 'object',
      properties: {
        port: { type: 'integer', title: 'Port' },
      },
    };

    render(<SchemaForm schema={schema} values={{ port: 3306 }} onChange={() => {}} />);

    const input = screen.getByLabelText('Port') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.value).toBe('3306');
  });

  it('renders select for enum values', () => {
    const schema = {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          title: 'Mode',
          enum: ['full', 'incremental'],
        },
      },
    };

    render(<SchemaForm schema={schema} values={{ mode: 'full' }} onChange={() => {}} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('full')).toBeInTheDocument();
    expect(screen.getByText('incremental')).toBeInTheDocument();
  });

  it('renders password input for format: password', () => {
    const schema = {
      type: 'object',
      properties: {
        token: { type: 'string', title: 'Token', format: 'password' },
      },
    };

    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);

    const input = screen.getByLabelText('Token') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('renders password input for keys starting with #', () => {
    const schema = {
      type: 'object',
      properties: {
        '#private_app_token': { type: 'string', title: 'Private App Token' },
      },
    };

    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);

    const input = screen.getByLabelText('Private App Token') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('renders url input for format: url', () => {
    const schema = {
      type: 'object',
      properties: {
        endpoint: { type: 'string', title: 'Endpoint', format: 'url' },
      },
    };

    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);

    const input = screen.getByLabelText('Endpoint') as HTMLInputElement;
    expect(input.type).toBe('url');
  });

  it('sorts properties by propertyOrder', () => {
    const schema = {
      type: 'object',
      properties: {
        second: { type: 'string', title: 'Second', propertyOrder: 2 },
        first: { type: 'string', title: 'First', propertyOrder: 1 },
        third: { type: 'string', title: 'Third', propertyOrder: 3 },
      },
    };

    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveAttribute('id', 'first');
    expect(inputs[1]).toHaveAttribute('id', 'second');
    expect(inputs[2]).toHaveAttribute('id', 'third');
  });

  it('calls onChange when input value changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name' },
      },
    };

    render(<SchemaForm schema={schema} values={{ name: '' }} onChange={onChange} />);

    const input = screen.getByLabelText('Name');
    await user.type(input, 'test');

    // onChange is called for each keystroke
    expect(onChange).toHaveBeenCalled();
    // Last call should contain the most recent partial value
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1] as unknown[];
    expect(lastCall[0]).toHaveProperty('name');
  });

  it('renders nested object as collapsible section', () => {
    const schema = {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database',
          properties: {
            host: { type: 'string', title: 'Host' },
            port: { type: 'integer', title: 'Port' },
          },
        },
      },
    };

    render(<SchemaForm schema={schema} values={{ db: { host: 'localhost', port: 3306 } }} onChange={() => {}} />);

    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByLabelText('Host')).toBeInTheDocument();
    expect(screen.getByLabelText('Port')).toBeInTheDocument();
  });

  it('renders textarea for array type', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', title: 'Tags', items: { type: 'string' } },
      },
    };

    render(<SchemaForm schema={schema} values={{ tags: ['a', 'b'] }} onChange={() => {}} />);

    const textarea = screen.getByLabelText('Tags') as HTMLTextAreaElement;
    expect(textarea.value).toBe('a\nb');
  });

  it('shows empty message when schema has no properties', () => {
    render(<SchemaForm schema={{ type: 'object' }} values={{}} onChange={() => {}} />);

    expect(screen.getByText('No properties defined in schema.')).toBeInTheDocument();
  });

  it('renders checkbox for format: checkbox (boolean alias)', () => {
    const schema = {
      type: 'object',
      properties: {
        call: {
          type: 'boolean',
          title: 'Call',
          format: 'checkbox',
          default: true,
        },
      },
    };

    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);

    const checkbox = screen.getByRole('checkbox');
    // Default value should be used when no value is provided
    expect(checkbox).toBeChecked();
  });

  it('shows default value as placeholder for string inputs', () => {
    const schema = {
      type: 'object',
      properties: {
        baseUrl: {
          type: 'string',
          title: 'Base URL',
          default: 'https://example.com',
        },
      },
    };

    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);

    const input = screen.getByLabelText('Base URL') as HTMLInputElement;
    expect(input.placeholder).toBe('https://example.com');
  });
});
