// file: api/schemas.ts
// Zod schemas for all Keboola API responses. Single source of truth.
// TypeScript types are derived from these schemas via z.infer.
// Used by: api/storage.ts, api/components.ts, api/jobs.ts.
// If API response doesn't match schema, a debug-friendly error is thrown.

import { z } from 'zod';

// -- Shared --

export const MetadataItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  provider: z.string(),
  timestamp: z.string(),
});

// -- Storage --

export const BucketSchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.string(), // 'in' | 'out' | 'sys' and potentially others
  description: z.string().default(''),
  created: z.string(),
  lastChangeDate: z.string().nullable(),
  isReadOnly: z.boolean().default(false),
  dataSizeBytes: z.number().nullable().default(0),
  rowsCount: z.number().nullable().default(0),
  tables: z.array(z.string()).default([]),
  metadata: z.array(MetadataItemSchema).default([]),
  displayName: z.string().default(''),
});

export const TableSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().default(''),
  primaryKey: z.array(z.string()).default([]),
  created: z.string(),
  lastChangeDate: z.string().nullable(),
  lastImportDate: z.string().nullable(),
  rowsCount: z.number().nullable(),
  dataSizeBytes: z.number().nullable(),
  columns: z.array(z.string()).default([]),
  bucket: z.object({
    id: z.string(),
    name: z.string(),
    stage: z.string(),
  }).optional(),
  metadata: z.array(MetadataItemSchema).default([]),
  columnMetadata: z.record(z.string(), z.array(MetadataItemSchema)).default({}),
  isTyped: z.boolean().default(false),
  isAlias: z.boolean().default(false),
});

// -- Token --

export const TokenVerifySchema = z.object({
  id: z.string(),
  description: z.string(),
  isMasterToken: z.boolean(),
  canManageBuckets: z.boolean(),
  canManageTokens: z.boolean(),
  canReadAllFileUploads: z.boolean(),
  canPurgeTrash: z.boolean(),
  created: z.string(),
  refreshed: z.string(),
  expires: z.string().nullable(),
  isExpired: z.boolean(),
  isDisabled: z.boolean(),
  owner: z.object({
    id: z.number(),
    name: z.string(),
    features: z.array(z.string()).default([]),
  }),
  admin: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }).optional(),
  bucketPermissions: z.record(z.string(), z.string()).default({}),
  componentAccess: z.array(z.string()).default([]),
});

// -- Components --

export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().default('other'), // extractor | writer | application | transformation | other
  description: z.string().default(''),
  longDescription: z.string().nullable().default(null),
  categories: z.array(z.string()).default([]),
  version: z.number().default(0),
  ico32: z.string().default(''),
  ico64: z.string().default(''),
  ico128: z.string().default(''),
  data: z.record(z.string(), z.unknown()).default({}),
  flags: z.array(z.string()).default([]),
  configurationSchema: z.record(z.string(), z.unknown()).nullable().default(null),
  configurationRowSchema: z.record(z.string(), z.unknown()).nullable().default(null),
  emptyConfiguration: z.record(z.string(), z.unknown()).nullable().default(null),
  emptyConfigurationRow: z.record(z.string(), z.unknown()).nullable().default(null),
  uiOptions: z.array(z.string()).default([]),
  documentationUrl: z.string().nullable().default(null),
});

export const ConfigurationRowSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  description: z.string().default(''),
  isDisabled: z.boolean().default(false),
  configuration: z.record(z.string(), z.unknown()).default({}),
  state: z.record(z.string(), z.unknown()).default({}),
});

export const ConfigurationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  created: z.string(),
  version: z.number(),
  isDisabled: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  configuration: z.record(z.string(), z.unknown()).default({}),
  rows: z.array(ConfigurationRowSchema).default([]),
  state: z.record(z.string(), z.unknown()).default({}),
  currentVersion: z.object({
    created: z.string(),
    creatorToken: z.object({
      id: z.number(),
      description: z.string(),
    }),
    changeDescription: z.string().default(''),
  }),
});

// -- Jobs (Queue API) --

export const JobSchema = z.object({
  id: z.string(),
  runId: z.string().default(''),
  parentRunId: z.string().nullable().default(null),
  status: z.enum(['created', 'waiting', 'processing', 'success', 'error', 'warning', 'terminating', 'terminated', 'cancelled']),
  component: z.string(),
  config: z.string().default(''),
  configRowIds: z.array(z.string()).default([]),
  mode: z.string().default('run'),
  createdTime: z.string(),
  startTime: z.string().nullable().default(null),
  endTime: z.string().nullable().default(null),
  durationSeconds: z.number().nullable().default(null),
  result: z.record(z.string(), z.unknown()).default({}),
  token: z.object({
    id: z.string(),
    description: z.string(),
  }).default({ id: '', description: '' }),
  project: z.object({
    id: z.string(),
  }).default({ id: '' }),
});

// -- Derived TypeScript types (use these instead of api/types.ts) --

export type Bucket = z.infer<typeof BucketSchema>;
export type Table = z.infer<typeof TableSchema>;
export type TokenVerifyResponse = z.infer<typeof TokenVerifySchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type Configuration = z.infer<typeof ConfigurationSchema>;
export type ConfigurationRow = z.infer<typeof ConfigurationRowSchema>;
export type Job = z.infer<typeof JobSchema>;
export type MetadataItem = z.infer<typeof MetadataItemSchema>;
