// file: api/storage.ts
// Storage API methods: buckets, tables, token verification.
// All responses validated through Zod schemas before reaching UI.
// Used by: hooks/useStorage.ts, hooks/useAuth.ts.
// Reference: GET /v2/storage/buckets, /tables, /tokens/verify.

import { z } from 'zod';
import { fetchApi, fetchManageApi } from './client';
import { BucketSchema, TableSchema, TokenVerifySchema } from './schemas';

export const storageApi = {
  verifyToken(stackUrl: string, token: string) {
    return fetchManageApi(stackUrl, '/tokens/verify', token, TokenVerifySchema);
  },

  listBuckets() {
    return fetchApi('/buckets', z.array(BucketSchema));
  },

  getBucket(bucketId: string) {
    return fetchApi(`/buckets/${bucketId}`, BucketSchema);
  },

  listTables(params?: { include?: string }) {
    const query = params?.include ? `?include=${params.include}` : '';
    return fetchApi(`/tables${query}`, z.array(TableSchema));
  },

  listBucketTables(bucketId: string) {
    return fetchApi(`/buckets/${bucketId}/tables`, z.array(TableSchema));
  },

  getTable(tableId: string) {
    return fetchApi(
      `/tables/${tableId}?include=columns,metadata,columnMetadata`,
      TableSchema,
    );
  },

  getTableDataPreview(tableId: string, params?: { limit?: number }) {
    const limit = params?.limit ?? 100;
    return fetchApi(
      `/tables/${tableId}/data-preview?limit=${limit}&format=json`,
      z.unknown(),
    );
  },
};
