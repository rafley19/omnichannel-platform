import type {
  BaseEntity,
  DatabaseHealth,
  PaginatedResult,
  QueryFilter,
  TableEntityMap,
  TableName,
} from '../types';

export interface IRepository<T extends BaseEntity> {
  create(record: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(filter?: QueryFilter<T>): Promise<PaginatedResult<T>>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(filter?: QueryFilter<T>): Promise<number>;
}

export interface IDatabaseAdapter {
  readonly providerName: 'neon' | 'sheets' | 'local' | 'supabase';
  readonly supportsTransactions: boolean;

  repo<K extends TableName>(table: K): IRepository<TableEntityMap[K]>;

  /**
   * Acquires an exclusive lock for a resource key (e.g., inventory item)
   * to prevent overselling during concurrent requests.
   */
  withLock<R>(key: string, fn: () => Promise<R>): Promise<R>;

  /**
   * Executes a logical unit of work.
   * Uses ACID transactions on PostgreSQL/Supabase, or serialized locking on Sheets/Local.
   */
  withTransaction<R>(lockKey: string, fn: () => Promise<R>): Promise<R>;

  /**
   * Safe idempotent schema initializer (creates missing sheets/headers without touching user data).
   */
  initializeSchema(): Promise<{ created: TableName[]; verified: TableName[] }>;

  healthCheck(): Promise<DatabaseHealth>;
}

/**
 * Shared filter, sort, and pagination helper for adapters without native SQL engines.
 */
export function applyQueryFilter<T extends BaseEntity>(
  rows: T[],
  filter?: QueryFilter<T>
): PaginatedResult<T> {
  let filtered = rows;

  if (filter?.where) {
    const entries = Object.entries(filter.where) as Array<[keyof T, unknown]>;
    filtered = filtered.filter((item) =>
      entries.every(([k, v]) => v === undefined || item[k] === v)
    );
  }

  if (filter?.predicate) {
    filtered = filtered.filter(filter.predicate);
  }

  if (filter?.sortBy) {
    const key = filter.sortBy;
    const dir = filter.sortDir === 'asc' ? 1 : -1;
    filtered = [...filtered].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (va === vb) return 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
    });
  }

  const total = filtered.length;
  const page = Math.max(1, filter?.page ?? 1);
  const limit = Math.max(1, Math.min(500, filter?.limit ?? 100));
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return { items, total, page, limit };
}
