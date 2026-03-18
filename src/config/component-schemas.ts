// file: src/config/component-schemas.ts
// Fallback JSON Schemas for components that don't provide configurationSchema.
// Reverse-engineered from legacy kbc-ui form definitions.
// Used by: ConfigurationDetailPage — when component.configurationSchema is empty.
// When Keboola adds native schemas to these components, remove the fallback.

// -- Shared schema fragments --

const sshTunnel = {
  type: 'object' as const,
  title: 'SSH Tunnel',
  properties: {
    enabled: { type: 'boolean', title: 'Enable SSH Tunnel', default: false },
    sshHost: { type: 'string', title: 'SSH Host' },
    user: { type: 'string', title: 'SSH Username' },
    sshPort: { type: 'integer', title: 'SSH Port', default: 22 },
  },
};

const sslConfig = {
  type: 'object' as const,
  title: 'SSL',
  properties: {
    enabled: { type: 'boolean', title: 'Enable SSL', default: false },
    ca: { type: 'string', title: 'CA Certificate (PEM)', format: 'textarea' },
    cert: { type: 'string', title: 'Client Certificate (PEM)', format: 'textarea' },
    '#key': { type: 'string', title: 'Client Key (PEM)', format: 'password' },
    verifyServerCert: { type: 'boolean', title: 'Verify Server Certificate', default: true },
  },
};

// -- MySQL Extractor --

const mysqlExtractor = {
  type: 'object',
  title: 'MySQL Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['host', 'port', 'user', '#password'],
          properties: {
            host: { type: 'string', title: 'Hostname', description: 'MySQL server hostname' },
            port: { type: 'integer', title: 'Port', default: 3306 },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Database' },
            ssh: sshTunnel,
            ssl: sslConfig,
          },
          propertyOrder: ['host', 'port', 'database', 'user', '#password', 'ssh', 'ssl'],
        },
      },
    },
  },
};

// -- PostgreSQL Extractor --

const pgsqlExtractor = {
  type: 'object',
  title: 'PostgreSQL Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['host', 'port', 'user', '#password', 'database'],
          properties: {
            host: { type: 'string', title: 'Hostname' },
            port: { type: 'integer', title: 'Port', default: 5432 },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Database' },
            schema: { type: 'string', title: 'Schema', default: 'public' },
            ssh: sshTunnel,
            ssl: sslConfig,
          },
          propertyOrder: ['host', 'port', 'database', 'schema', 'user', '#password', 'ssh', 'ssl'],
        },
      },
    },
  },
};

// -- MSSQL Extractor --

const mssqlExtractor = {
  type: 'object',
  title: 'MS SQL Server Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['host', 'user', '#password', 'database'],
          properties: {
            host: { type: 'string', title: 'Hostname' },
            port: { type: 'integer', title: 'Port', default: 1433 },
            instance: { type: 'string', title: 'Instance Name', description: 'Optional named instance' },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Database' },
            ssh: sshTunnel,
            ssl: {
              type: 'object',
              title: 'SSL',
              properties: {
                enabled: { type: 'boolean', title: 'Enable SSL', default: false },
                ca: { type: 'string', title: 'CA Certificate (PEM)', format: 'textarea' },
                verifyServerCert: { type: 'boolean', title: 'Verify Server Certificate', default: true },
              },
            },
          },
          propertyOrder: ['host', 'port', 'instance', 'database', 'user', '#password', 'ssh', 'ssl'],
        },
      },
    },
  },
};

// -- Snowflake Extractor --

const snowflakeExtractor = {
  type: 'object',
  title: 'Snowflake Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['host', 'port', 'user', 'database'],
          properties: {
            host: { type: 'string', title: 'Hostname', description: 'e.g. xx1234.west-europe.azure.snowflakecomputing.com' },
            port: { type: 'integer', title: 'Port', default: 443 },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Database' },
            schema: { type: 'string', title: 'Schema' },
            warehouse: { type: 'string', title: 'Warehouse' },
          },
          propertyOrder: ['host', 'port', 'database', 'schema', 'warehouse', 'user', '#password'],
        },
      },
    },
  },
};

// -- MySQL Writer --

const mysqlWriter = {
  type: 'object',
  title: 'MySQL Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['host', 'port', 'user', '#password', 'database'],
          properties: {
            host: { type: 'string', title: 'Hostname' },
            port: { type: 'integer', title: 'Port', default: 3306 },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Database' },
            ssh: sshTunnel,
            ssl: sslConfig,
          },
          propertyOrder: ['host', 'port', 'database', 'user', '#password', 'ssh', 'ssl'],
        },
      },
    },
  },
};

// -- PostgreSQL Writer --

const pgsqlWriter = {
  type: 'object',
  title: 'PostgreSQL Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['host', 'port', 'user', '#password', 'database', 'schema'],
          properties: {
            host: { type: 'string', title: 'Hostname' },
            port: { type: 'integer', title: 'Port', default: 5432 },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Database' },
            schema: { type: 'string', title: 'Schema', default: 'public' },
            ssh: sshTunnel,
            ssl: sslConfig,
          },
          propertyOrder: ['host', 'port', 'database', 'schema', 'user', '#password', 'ssh', 'ssl'],
        },
      },
    },
  },
};

// -- Snowflake Writer --

const snowflakeWriter = {
  type: 'object',
  title: 'Snowflake Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['host', 'port', 'user', '#password', 'database', 'schema'],
          properties: {
            host: { type: 'string', title: 'Hostname', description: 'e.g. xx1234.west-europe.azure.snowflakecomputing.com' },
            port: { type: 'integer', title: 'Port', default: 443 },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Database' },
            schema: { type: 'string', title: 'Schema' },
            warehouse: { type: 'string', title: 'Warehouse' },
          },
          propertyOrder: ['host', 'port', 'database', 'schema', 'warehouse', 'user', '#password'],
        },
      },
    },
  },
};

// -- MSSQL Writer --

const mssqlWriter = {
  type: 'object',
  title: 'MS SQL Server Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['host', 'user', '#password', 'database'],
          properties: {
            host: { type: 'string', title: 'Hostname' },
            port: { type: 'integer', title: 'Port', default: 1433 },
            instance: { type: 'string', title: 'Instance Name' },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Database' },
            tdsVersion: { type: 'string', title: 'TDS Version', default: '7.1', enum: ['7.0', '7.1', '7.2', '7.3', '7.4'] },
            ssh: sshTunnel,
          },
          propertyOrder: ['host', 'port', 'instance', 'database', 'user', '#password', 'tdsVersion', 'ssh'],
        },
      },
    },
  },
};

// -- Oracle Extractor --

const oracleExtractor = {
  type: 'object',
  title: 'Oracle Connection',
  properties: {
    parameters: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          title: 'Database Credentials',
          required: ['user', '#password'],
          properties: {
            host: { type: 'string', title: 'Hostname' },
            port: { type: 'integer', title: 'Port', default: 1521 },
            user: { type: 'string', title: 'Username' },
            '#password': { type: 'string', title: 'Password', format: 'password' },
            database: { type: 'string', title: 'Service Name / SID' },
            ssh: sshTunnel,
          },
          propertyOrder: ['host', 'port', 'database', 'user', '#password', 'ssh'],
        },
      },
    },
  },
};

// -- Registry: componentId -> fallback schema --

export const COMPONENT_SCHEMA_REGISTRY: Record<string, Record<string, unknown>> = {
  // Extractors
  'keboola.ex-db-mysql': mysqlExtractor,
  'keboola.ex-db-pgsql': pgsqlExtractor,
  'keboola.ex-db-mssql': mssqlExtractor,
  'keboola.ex-db-snowflake': snowflakeExtractor,
  'keboola.ex-db-oracle': oracleExtractor,
  'keboola.ex-db-redshift': pgsqlExtractor, // same fields as PostgreSQL
  'keboola.ex-db-impala': mysqlExtractor, // similar to MySQL
  'keboola.ex-db-hive': mysqlExtractor,

  // Writers
  'keboola.wr-db-mysql': mysqlWriter,
  'keboola.wr-db-pgsql': pgsqlWriter,
  'keboola.wr-db-mssql': mssqlWriter,
  'keboola.wr-db-mssql-v2': mssqlWriter,
  'keboola.wr-db-snowflake': snowflakeWriter,
  'keboola.wr-db-oracle': oracleExtractor, // similar structure
  'keboola.wr-db-redshift': pgsqlWriter,
  'keboola.wr-db-impala': mysqlWriter,
  'keboola.wr-storage': {},  // no credentials needed
};

// Get schema for a component, preferring API-provided schema over fallback
export function getComponentSchema(
  componentId: string,
  apiSchema: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  // If API provides a non-empty schema, use it
  if (apiSchema && Object.keys(apiSchema).length > 0) {
    return apiSchema;
  }
  // Otherwise, check our fallback registry
  return COMPONENT_SCHEMA_REGISTRY[componentId] ?? null;
}
