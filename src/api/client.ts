// file: api/client.ts
// Core HTTP client for all Keboola API communication.
// Reads connection params from the connection Zustand store.
// All API modules (storage, components, jobs) import fetchApi from here.
// Auth: X-StorageApi-Token header on every request.

import { useConnectionStore } from '@/stores/connection';
import { HTTP_HEADERS } from '@/lib/constants';

export type ApiError = {
  message: string;
  code: string;
  status: number;
};

export class KeboolaApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'KeboolaApiError';
    this.status = status;
    this.code = code;
  }
}

function getConnectionOrThrow() {
  const { stackUrl, token } = useConnectionStore.getState();
  if (!stackUrl || !token) {
    throw new KeboolaApiError('Not connected. Please provide stack URL and token.', 401, 'NOT_CONNECTED');
  }
  return { stackUrl, token };
}

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { stackUrl, token } = getConnectionOrThrow();
  const url = `${stackUrl}/v2/storage${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      [HTTP_HEADERS.STORAGE_API_TOKEN]: token,
      [HTTP_HEADERS.CONTENT_TYPE]: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let body: { message?: string; code?: string } = {};
    try {
      body = await response.json();
    } catch {
      // Response is not JSON
    }
    throw new KeboolaApiError(
      body.message ?? `API error: ${response.status} ${response.statusText}`,
      response.status,
      body.code ?? 'UNKNOWN',
    );
  }

  if (response.status === 204) return null as T;

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as T;
}

export async function fetchManageApi<T>(
  stackUrl: string,
  path: string,
  token: string,
): Promise<T> {
  const url = `${stackUrl}/v2/storage${path}`;

  const response = await fetch(url, {
    headers: {
      [HTTP_HEADERS.STORAGE_API_TOKEN]: token,
      [HTTP_HEADERS.CONTENT_TYPE]: 'application/json',
    },
  });

  if (!response.ok) {
    let body: { message?: string; code?: string } = {};
    try {
      body = await response.json();
    } catch {
      // Response is not JSON
    }
    throw new KeboolaApiError(
      body.message ?? `API error: ${response.status}`,
      response.status,
      body.code ?? 'UNKNOWN',
    );
  }

  return response.json() as Promise<T>;
}
