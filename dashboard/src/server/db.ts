import pg from 'pg';

const { Pool } = pg;

const FORBIDDEN_SQL_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|VACUUM|REINDEX|CLUSTER|LOCK|CALL|DO)\b/i;

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const queryCache = new Map<string, CacheEntry<unknown>>();
let poolInstance: pg.Pool | null = null;
let lastConnectionError: string | null = null;

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && url.startsWith('postgres'));
}

export function getLastConnectionError(): string | null {
  return lastConnectionError;
}

function getPool(): pg.Pool {
  if (poolInstance) return poolInstance;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured on the server.');
  }

  poolInstance = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: 6,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Enforce session-level read-only transactions at the PostgreSQL protocol level
    options: '-c default_transaction_read_only=on',
  });

  poolInstance.on('error', (err) => {
    lastConnectionError = err.message;
  });

  return poolInstance;
}

/**
 * Strictly read-only parameterized SQL execution helper.
 * Rejects any statement that does not begin with SELECT or WITH, or contains DDL/DML keywords.
 */
export async function queryReadOnly<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: ReadonlyArray<unknown> = []
): Promise<T[]> {
  const normalized = sql.trim();
  if (!/^(SELECT|WITH)\b/i.test(normalized)) {
    throw new Error('Read-only policy violation: only SELECT/WITH queries are permitted.');
  }
  const withoutStrings = normalized.replace(/'(?:''|[^'])*'/g, "''");
  if (FORBIDDEN_SQL_PATTERN.test(withoutStrings)) {
    throw new Error('Read-only policy violation: write or DDL keyword detected in SQL statement.');
  }

  const pool = getPool();
  const result = await pool.query<T>(normalized, [...params]);
  lastConnectionError = null;
  return result.rows;
}

export async function cachedCompute<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = queryCache.get(cacheKey);
  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  const value = await loader();
  queryCache.set(cacheKey, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });

  // Prevent unbounded cache growth
  if (queryCache.size > 300) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }

  return value;
}
