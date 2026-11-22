import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let cachedSql: NeonQueryFunction<false, false> | null = null;
let cachedUrl: string | null = null;

export function getNeonConnectionString(): string {
  const url = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  ).trim();

  if (!url) {
    throw new Error(
      'Variabel DATABASE_URL (atau POSTGRES_URL) belum diatur. Hubungkan database Neon PostgreSQL di Vercel atau isi di .env.local.'
    );
  }
  return url;
}

/**
 * Lazy initialization of Neon serverless SQL client.
 * Never invoked at module top-level so `next build` succeeds safely even before env vars exist.
 */
export function getNeonSql(): NeonQueryFunction<false, false> {
  const url = getNeonConnectionString();
  if (!cachedSql || cachedUrl !== url) {
    cachedSql = neon(url);
    cachedUrl = url;
  }
  return cachedSql;
}

/**
 * Executes a parameterized SQL statement ($1, $2, ...) and returns normalized row objects.
 */
export async function execNeonQuery(
  queryText: string,
  params: unknown[] = []
): Promise<Record<string, unknown>[]> {
  const sql = getNeonSql();
  const result = (await sql.query(queryText, params)) as unknown;
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (
    result &&
    typeof result === 'object' &&
    'rows' in result &&
    Array.isArray((result as { rows: unknown[] }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}
