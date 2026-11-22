import type {
  IDatabaseAdapter,
  IRepository,
} from '../../interfaces/repository';
import type {
  DatabaseHealth,
  TableEntityMap,
  TableName,
} from '../../types';

/**
 * Placeholder Adapter for Stage 4 (Migrasi Database ke Supabase PostgreSQL).
 * Implements the exact same IDatabaseAdapter contract so migrating from
 * Google Sheets to Supabase requires zero changes to Frontend or Domain Services.
 */
export class SupabasePostgresAdapter implements IDatabaseAdapter {
  readonly providerName = 'supabase' as const;
  readonly supportsTransactions = true;

  repo<K extends TableName>(_table: K): IRepository<TableEntityMap[K]> {
    throw new Error(
      'SupabasePostgresAdapter dijadwalkan pada Tahap 4 (Migrasi Database). Gunakan DB_PROVIDER=sheets atau DB_PROVIDER=local untuk Tahap 2-3.'
    );
  }

  async withLock<R>(_key: string, fn: () => Promise<R>): Promise<R> {
    return fn();
  }

  async withTransaction<R>(_lockKey: string, fn: () => Promise<R>): Promise<R> {
    return fn();
  }

  async initializeSchema(): Promise<{ created: TableName[]; verified: TableName[] }> {
    throw new Error('Jalankan SQL Migration Supabase pada Tahap 4.');
  }

  async healthCheck(): Promise<DatabaseHealth> {
    throw new Error('SupabasePostgresAdapter belum diaktifkan (Tahap 4).');
  }
}
