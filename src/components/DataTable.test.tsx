// file: components/DataTable.test.tsx
// Smoke tests for the generic DataTable component.
// Tests rendering, search filtering, and empty state.
// Run with: npm test
// Uses @testing-library/react for DOM assertions.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';

type TestRow = { id: string; name: string; value: number };

const columns = [
  { key: 'name', label: 'Name', render: (r: TestRow) => r.name, sortValue: (r: TestRow) => r.name },
  { key: 'value', label: 'Value', render: (r: TestRow) => r.value, sortValue: (r: TestRow) => r.value },
];

const testData: TestRow[] = [
  { id: '1', name: 'Alpha', value: 10 },
  { id: '2', name: 'Beta', value: 20 },
  { id: '3', name: 'Charlie', value: 30 },
];

describe('DataTable', () => {
  it('renders rows', () => {
    render(<DataTable columns={columns} data={testData} keyFn={(r) => r.id} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(<DataTable columns={columns} data={[]} keyFn={(r) => r.id} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<DataTable columns={columns} data={[]} keyFn={(r) => r.id} isLoading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('filters rows via search', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={testData}
        keyFn={(r) => r.id}
        searchFn={(r, q) => r.name.toLowerCase().includes(q)}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'alpha');

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
  });
});
