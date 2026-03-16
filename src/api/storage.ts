// file: api/storage.ts
// Storage API methods: buckets, tables, token verification.
// Thin wrappers around fetchApi with typed responses.
// Used by: hooks/useStorage.ts, hooks/useAuth.ts.
// Reference: GET /v2/storage/buckets, /tables, /tokens/verify.

import { fetchApi, fetchManageApi } from './client';
import type { Bucket, Table, TokenVerifyResponse } from './types';

export const storageApi = {
  verifyToken(stackUrl: string, token: string) {
    return fetchManageApi<TokenVerifyResponse>(stackUrl, '/tokens/verify', token);
  },

  listBuckets() {
    return fetchApi<Bucket[]>('/buckets');
  },

  getBucket(bucketId: string) {
    return fetchApi<Bucket>(`/buckets/${bucketId}`);
  },

  listTables(params?: { include?: string }) {
    const query = params?.include ? `?include=${params.include}` : '';
    return fetchApi<Table[]>(`/tables${query}`);
  },

  listBucketTables(bucketId: string) {
    return fetchApi<Table[]>(`/buckets/${bucketId}/tables`);
  },

  getTable(tableId: string) {
    return fetchApi<Table>(`/tables/${tableId}?include=columns,metadata,columnMetadata`);
  },

  getTableDataPreview(tableId: string, params?: { limit?: number }) {
    const limit = params?.limit ?? 100;
    return fetchApi<string>(`/tables/${tableId}/data-preview?limit=${limit}&format=json`);
  },
};
