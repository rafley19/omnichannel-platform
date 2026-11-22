import fs from 'node:fs/promises';
import path from 'node:path';
import {
  applyQueryFilter,
  type IDatabaseAdapter,
  type IRepository,
} from '../../interfaces/repository';
import { KeyedMutex } from '../../mutex';
import { ALL_TABLES } from '../../schema';
import type {
  BaseEntity,
  DatabaseHealth,
  PaginatedResult,
  QueryFilter,
  TableEntityMap,
  TableName,
} from '../../types';

type LocalStoreData = {
  [K in TableName]: TableEntityMap[K][];
};

function createEmptyStore(): LocalStoreData {
  return {
    businesses: [],
    users: [],
    business_users: [],
    locations: [],
    products: [],
    product_variants: [],
    inventory: [],
    inventory_movements: [],
    orders: [],
    order_items: [],
    payments: [],
    integrations: [],
    sync_logs: [],
    audit_logs: [],
  };
}

/**
 * Local JSON File Adapter (DB_PROVIDER=local).
 * Allows testing the entire MVP locally with real persistence before
 * connecting Google Sheets (DB_PROVIDER=sheets) or Supabase (DB_PROVIDER=supabase).
 */
export class LocalJsonAdapter implements IDatabaseAdapter {
  readonly providerName = 'local' as const;
  readonly supportsTransactions = false;

  private readonly filePath: string;
  private readonly mutex = new KeyedMutex();

  constructor(customPath?: string) {
    this.filePath =
      customPath ?? path.join(process.cwd(), '.data', 'local-db.json');
  }

  private async ensureFile(): Promise<LocalStoreData> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<LocalStoreData>;
      const base = createEmptyStore();
      for (const table of ALL_TABLES) {
        if (Array.isArray(parsed[table])) {
          (base as Record<string, unknown[]>)[table] = parsed[table] as unknown[];
        }
      }
      return base;
    } catch {
      const empty = createEmptyStore();
      await this.persist(empty);
      return empty;
    }
  }

  private async persist(data: LocalStoreData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }

  repo<K extends TableName>(table: K): IRepository<TableEntityMap[K]> {
    type Entity = TableEntityMap[K];

    return {
      create: async (record: Entity): Promise<Entity> => {
        return this.mutex.runExclusive('local-store', async () => {
          const store = await this.ensureFile();
          const list = store[table] as Entity[];
          list.push(record);
          await this.persist(store);
          return record;
        });
      },

      findById: async (id: string): Promise<Entity | null> => {
        const store = await this.ensureFile();
        const list = store[table] as Entity[];
        return list.find((item) => item.id === id) ?? null;
      },

      findMany: async (
        filter?: QueryFilter<Entity>
      ): Promise<PaginatedResult<Entity>> => {
        const store = await this.ensureFile();
        const list = store[table] as Entity[];
        return applyQueryFilter(list, filter);
      },

      update: async (id: string, patch: Partial<Entity>): Promise<Entity | null> => {
        return this.mutex.runExclusive('local-store', async () => {
          const store = await this.ensureFile();
          const list = store[table] as Entity[];
          const idx = list.findIndex((item) => item.id === id);
          if (idx === -1) return null;
          const updated: Entity = { ...list[idx], ...patch, id: list[idx].id };
          list[idx] = updated;
          await this.persist(store);
          return updated;
        });
      },

      delete: async (id: string): Promise<boolean> => {
        return this.mutex.runExclusive('local-store', async () => {
          const store = await this.ensureFile();
          const list = store[table] as Entity[];
          const idx = list.findIndex((item) => item.id === id);
          if (idx === -1) return false;
          list.splice(idx, 1);
          await this.persist(store);
          return true;
        });
      },

      count: async (filter?: QueryFilter<Entity>): Promise<number> => {
        const store = await this.ensureFile();
        const list = store[table] as Entity[];
        return applyQueryFilter(list, { ...filter, page: 1, limit: 1 }).total;
      },
    };
  }

  async withLock<R>(key: string, fn: () => Promise<R>): Promise<R> {
    return this.mutex.runExclusive(key, fn);
  }

  async withTransaction<R>(lockKey: string, fn: () => Promise<R>): Promise<R> {
    return this.mutex.runExclusive(lockKey, fn);
  }

  async initializeSchema(): Promise<{ created: TableName[]; verified: TableName[] }> {
    await this.ensureFile();
    return { created: [], verified: [...ALL_TABLES] };
  }

  async healthCheck(): Promise<DatabaseHealth> {
    const store = await this.ensureFile();
    const tables = {} as Record<TableName, number>;
    for (const table of ALL_TABLES) {
      tables[table] = (store[table] as BaseEntity[]).length;
    }
    return {
      provider: 'local',
      ok: true,
      message:
        'Mode Local File Pilot aktif (.data/local-db.json). Ubah DB_PROVIDER=sheets di .env.local untuk beralih ke Google Sheets.',
      tables,
    };
  }
}
