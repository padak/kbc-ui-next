// file: api/types.ts
// TypeScript types for Keboola API responses.
// Derived from actual API responses, not from legacy code.
// Used by: all API modules and TanStack Query hooks.
// Add types here as new API endpoints are integrated.

export type TokenVerifyResponse = {
  id: string;
  description: string;
  isMasterToken: boolean;
  canManageBuckets: boolean;
  canManageTokens: boolean;
  canReadAllFileUploads: boolean;
  canPurgeTrash: boolean;
  created: string;
  refreshed: string;
  expires: string | null;
  isExpired: boolean;
  isDisabled: boolean;
  owner: {
    id: number;
    name: string;
    features: string[];
  };
  admin?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  bucketPermissions: Record<string, string>;
  componentAccess: string[];
};

export type Bucket = {
  id: string;
  name: string;
  stage: 'in' | 'out';
  description: string;
  created: string;
  lastChangeDate: string | null;
  isReadOnly: boolean;
  dataSizeBytes: number;
  rowsCount: number;
  tables: string[];
  metadata: MetadataItem[];
  displayName: string;
};

export type Table = {
  id: string;
  name: string;
  displayName: string;
  primaryKey: string[];
  created: string;
  lastChangeDate: string | null;
  lastImportDate: string | null;
  rowsCount: number;
  dataSizeBytes: number;
  columns: string[];
  bucket: {
    id: string;
    name: string;
    stage: string;
  };
  metadata: MetadataItem[];
  columnMetadata: Record<string, MetadataItem[]>;
  isTyped: boolean;
};

export type MetadataItem = {
  id: string;
  key: string;
  value: string;
  provider: string;
  timestamp: string;
};

export type Component = {
  id: string;
  name: string;
  type: 'extractor' | 'writer' | 'application' | 'transformation' | 'other';
  description: string;
  longDescription: string | null;
  categories: string[];
  version: number;
  ico32: string;
  ico64: string;
  ico128: string;
  data: {
    definition?: {
      type: string;
      uri: string;
    };
    vendor?: {
      name: string;
      address: string;
      email: string;
    };
    configuration_schema?: Record<string, unknown>;
    configuration_row_schema?: Record<string, unknown>;
  };
  flags: string[];
  configurationSchema: Record<string, unknown> | null;
  configurationRowSchema: Record<string, unknown> | null;
  emptyConfiguration: Record<string, unknown> | null;
  emptyConfigurationRow: Record<string, unknown> | null;
  uiOptions: string[];
  documentationUrl: string | null;
};

export type Configuration = {
  id: string;
  name: string;
  description: string;
  created: string;
  version: number;
  isDisabled: boolean;
  isDeleted: boolean;
  configuration: Record<string, unknown>;
  rows: ConfigurationRow[];
  state: Record<string, unknown>;
  currentVersion: {
    created: string;
    creatorToken: {
      id: number;
      description: string;
    };
    changeDescription: string;
  };
};

export type ConfigurationRow = {
  id: string;
  name: string;
  description: string;
  isDisabled: boolean;
  configuration: Record<string, unknown>;
  state: Record<string, unknown>;
};

export type Job = {
  id: number;
  status: 'created' | 'waiting' | 'processing' | 'success' | 'error' | 'warning' | 'terminating' | 'terminated' | 'cancelled';
  component: string;
  config: string;
  configRow: string | null;
  mode: string;
  createdTime: string;
  startTime: string | null;
  endTime: string | null;
  durationSeconds: number | null;
  result: Record<string, unknown>;
  metrics: {
    storage: {
      inputTablesBytesSum: number;
      outputTablesBytesSum: number;
    };
  };
};

export type StackInfo = {
  services: Array<{
    id: string;
    url: string;
  }>;
  features: string[];
  components: Component[];
};
