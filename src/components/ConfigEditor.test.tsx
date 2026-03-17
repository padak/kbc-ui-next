// file: components/ConfigEditor.test.tsx
// Tests for the ConfigEditor Form/JSON toggle component.
// Covers tab switching, JSON editing, save button state, and form rendering.
// Run with: npm test
// Uses @testing-library/react for DOM assertions.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigEditor } from './ConfigEditor';

const testSchema = {
  type: 'object',
  properties: {
    baseUrl: { type: 'string', title: 'Base URL' },
  },
};

const testValues = { baseUrl: 'https://example.com' };

describe('ConfigEditor', () => {
  it('renders Form and JSON tabs when schema is provided', () => {
    render(<ConfigEditor schema={testSchema} values={testValues} onSave={vi.fn()} isSaving={false} />);

    expect(screen.getByText('Form')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('renders only JSON tab when schema is null', () => {
    render(<ConfigEditor schema={null} values={testValues} onSave={vi.fn()} isSaving={false} />);

    expect(screen.queryByText('Form')).not.toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('shows form view by default when schema exists', () => {
    render(<ConfigEditor schema={testSchema} values={testValues} onSave={vi.fn()} isSaving={false} />);

    expect(screen.getByLabelText('Base URL')).toBeInTheDocument();
  });

  it('switches to JSON view when JSON tab is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfigEditor schema={testSchema} values={testValues} onSave={vi.fn()} isSaving={false} />);

    await user.click(screen.getByText('JSON'));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('https://example.com');
  });

  it('disables Save button when no changes', () => {
    render(<ConfigEditor schema={testSchema} values={testValues} onSave={vi.fn()} isSaving={false} />);

    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).toBeDisabled();
  });

  it('shows Saving... when isSaving is true', () => {
    render(<ConfigEditor schema={testSchema} values={testValues} onSave={vi.fn()} isSaving={true} />);

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows JSON textarea when no schema', () => {
    render(<ConfigEditor schema={null} values={testValues} onSave={vi.fn()} isSaving={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('baseUrl');
  });

  it('enables Save button after editing JSON', async () => {
    const user = userEvent.setup();
    render(<ConfigEditor schema={null} values={testValues} onSave={vi.fn()} isSaving={false} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, ' ');

    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).not.toBeDisabled();
  });

  it('calls onSave with parsed JSON values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ConfigEditor schema={null} values={{}} onSave={onSave} isSaving={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    // Replace content by selecting all and pasting new value
    await user.clear(textarea);
    // userEvent.type treats { and [ as special chars, so use paste instead
    await user.click(textarea);
    await user.paste('{"foo":"bar"}');

    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledWith({ foo: 'bar' });
  });
});
