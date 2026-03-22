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

    // In production, show only the endpoint — no cURL/token details in error message
    const message = import.meta.env.DEV
      ? `API response validation failed for ${endpoint}\n\nFields with issues:\n${fieldErrors}\n\nDebug with:\n${curlCommand}\n`
      : `API response validation failed for ${endpoint}`;

    super(message);

    this.name = 'KeboolaValidationError';
    this.endpoint = endpoint;
    this.zodErrors = zodErrors;
    // In production, omit raw data and cURL command to prevent token/data leakage (M4)
    this.rawData = import.meta.env.DEV ? rawData : undefined;
    this.curlCommand = import.meta.env.DEV ? curlCommand : '';
  }
}

// -- cURL generator --

function buildCurlCommand(url: string, _token: string): string {
  const maskedToken = _token.length > 4
    ? `****${_token.substring(_token.length - 4)}`
    : '****';
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

// -- URL derivation helper --

function deriveServiceUrl(stackUrl: string, serviceName: string): string {
  const parsed = new URL(stackUrl);
  if (!parsed.hostname.startsWith('connection.')) {
    throw new KeboolaApiError(
      `Invalid stack URL: hostname must start with "connection." (got "${parsed.hostname}")`,
      400,
      'INVALID_STACK_URL',
    );
  }
  parsed.hostname = parsed.hostname.replace('connection.', `${serviceName}.`);
  return parsed.origin;
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
    if (import.meta.env.DEV) {
      console.error('[Keboola] Validation failed for', path, result.error.issues);
      console.error('[Keboola] Debug:', curl);
    }
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
    if (import.meta.env.DEV) {
      console.error('[Keboola] Validation failed for', path, result.error.issues);
    }
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
  const serviceBase = deriveServiceUrl(stackUrl, 'queue');
  const url = `${serviceBase}${path}`;
  const data = await rawFetch(url, token, options);

  const result = schema.safeParse(data);
  if (!result.success) {
    const curl = buildCurlCommand(url, token);
    if (import.meta.env.DEV) {
      console.error('[Keboola] Validation failed for', path, result.error.issues);
    }
    throw new KeboolaValidationError(path, result.error, data, curl);
  }

  return result.data;
}

// -- Explicit-project credentials type --

export type ProjectCredentials = { stackUrl: string; token: string };

// -- Validated fetch for explicit project (Storage API) --

export async function fetchApiForProject<T>(
  creds: ProjectCredentials,
  path: string,
  schema: z.ZodSchema<T>,
  options: RequestInit = {},
): Promise<T> {
  const url = `${creds.stackUrl}/v2/storage${path}`;
  const data = await rawFetch(url, creds.token, options);
  const result = schema.safeParse(data);
  if (!result.success) {
    const curl = buildCurlCommand(url, creds.token);
    if (import.meta.env.DEV) {
      console.error('[Keboola] Validation failed for', path, result.error.issues);
    }
    throw new KeboolaValidationError(path, result.error, data, curl);
  }
  return result.data;
}

// -- Validated fetch for explicit project (Queue API) --

export async function fetchQueueApiForProject<T>(
  creds: ProjectCredentials,
  path: string,
  schema: z.ZodSchema<T>,
  options?: RequestInit,
): Promise<T> {
  const serviceBase = deriveServiceUrl(creds.stackUrl, 'queue');
  const url = `${serviceBase}${path}`;
  const data = await rawFetch(url, creds.token, options);
  const result = schema.safeParse(data);
  if (!result.success) {
    const curl = buildCurlCommand(url, creds.token);
    if (import.meta.env.DEV) {
      console.error('[Keboola] Validation failed for', path, result.error.issues);
    }
    throw new KeboolaValidationError(path, result.error, data, curl);
  }
  return result.data;
}

// -- Validated fetch for service APIs (scheduler, etc.) --

export async function fetchServiceApi<T>(
  serviceName: string,
  path: string,
  schema: z.ZodSchema<T>,
  options?: RequestInit,
): Promise<T> {
  const { stackUrl, token } = getConnectionOrThrow();
  const serviceBase = deriveServiceUrl(stackUrl, serviceName);
  const url = `${serviceBase}${path}`;
  const data = await rawFetch(url, token, options);

  const result = schema.safeParse(data);
  if (!result.success) {
    const curl = buildCurlCommand(url, token);
    if (import.meta.env.DEV) {
      console.error('[Keboola] Validation failed for', path, result.error.issues);
    }
    throw new KeboolaValidationError(path, result.error, data, curl);
  }

  return result.data;
}
