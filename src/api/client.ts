// file: api/client.ts
// Core HTTP client for all Keboola API communication.
// Validates responses with Zod schemas - throws debug-friendly errors.
// All API modules (storage, components, jobs) import fetchApi from here.
// Auth: X-StorageApi-Token header on every request.

import { z } from 'zod';
import { useConnectionStore } from '@/stores/connection';
import { HTTP_HEADERS } from '@/lib/constants';

// -- Error types --

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

export class KeboolaValidationError extends Error {
  endpoint: string;
  zodErrors: z.ZodError;
  rawData: unknown;
  curlCommand: string;

  constructor(endpoint: string, zodErrors: z.ZodError, rawData: unknown, curlCommand: string) {
    const fieldErrors = zodErrors.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message} (got ${JSON.stringify((rawData as Record<string, unknown>)?.[String(i.path[0])])})`)
      .join('\n');

    super(
      `API response validation failed for ${endpoint}\n\n` +
      `Fields with issues:\n${fieldErrors}\n\n` +
      `Debug with:\n${curlCommand}\n`,
    );

    this.name = 'KeboolaValidationError';
    this.endpoint = endpoint;
    this.zodErrors = zodErrors;
    this.rawData = rawData;
    this.curlCommand = curlCommand;
  }
}

// -- cURL generator --

function buildCurlCommand(url: string, token: string): string {
  const maskedToken = token.length > 10
    ? `${token.substring(0, 6)}...${token.substring(token.length - 4)}`
    : '***';
  return `curl -s -H "X-StorageApi-Token: ${maskedToken}" "${url}" | python3 -m json.tool`;
}

// -- Connection helper --

function getConnectionOrThrow() {
  const { stackUrl, token } = useConnectionStore.getState();
  if (!stackUrl || !token) {
    throw new KeboolaApiError('Not connected. Please provide stack URL and token.', 401, 'NOT_CONNECTED');
  }
  return { stackUrl, token };
}

// -- Core fetch (unvalidated) --

async function rawFetch(url: string, token: string, options: RequestInit = {}): Promise<unknown> {
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

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

// -- Validated fetch for Storage API --

export async function fetchApi<T>(
  path: string,
  schema: z.ZodSchema<T>,
  options: RequestInit = {},
): Promise<T> {
  const { stackUrl, token } = getConnectionOrThrow();
  const url = `${stackUrl}/v2/storage${path}`;
  const data = await rawFetch(url, token, options);

  const result = schema.safeParse(data);
  if (!result.success) {
    const curl = buildCurlCommand(url, token);
    console.error('[Keboola] Validation failed for', path, result.error.issues);
    console.error('[Keboola] Debug:', curl);
    throw new KeboolaValidationError(path, result.error, data, curl);
  }

  return result.data;
}

// -- Unvalidated fetch (for token verify before connection is stored) --

export async function fetchManageApi<T>(
  stackUrl: string,
  path: string,
  token: string,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const url = `${stackUrl}/v2/storage${path}`;
  const data = await rawFetch(url, token);

  const result = schema.safeParse(data);
  if (!result.success) {
    const curl = buildCurlCommand(url, token);
    console.error('[Keboola] Validation failed for', path, result.error.issues);
    throw new KeboolaValidationError(path, result.error, data, curl);
  }

  return result.data;
}

// -- Validated fetch for Queue API --

export async function fetchQueueApi<T>(
  path: string,
  schema: z.ZodSchema<T>,
  options?: RequestInit,
): Promise<T> {
  const { stackUrl, token } = getConnectionOrThrow();
  const queueUrl = stackUrl.replace('connection.', 'queue.');
  const url = `${queueUrl}${path}`;
  const data = await rawFetch(url, token, options);

  const result = schema.safeParse(data);
  if (!result.success) {
    const curl = buildCurlCommand(url, token);
    console.error('[Keboola] Validation failed for', path, result.error.issues);
    throw new KeboolaValidationError(path, result.error, data, curl);
  }

  return result.data;
}
