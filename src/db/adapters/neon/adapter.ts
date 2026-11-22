import {
  applyQueryFilter,
  type IDatabaseAdapter,
  type IRepository,
} from '../../interfaces/repository';
import { KeyedMutex } from '../../mutex';
import { ALL_TABLES, TABLE_SCHEMAS } from '../../schema';
import type {
  DatabaseHealth,
  PaginatedResult,
  QueryFilter,
  TableEntityMap,
  TableName,
} from '../../types';
import { execNeonQuery } from './client';

const VALID_TABLES = new Set<string>(ALL_TABLES);

const INIT_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    logo_url TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    contact_phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    enabled_modules_json TEXT NOT NULL DEFAULT '["dashboard","products","inventory","orders"]',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    auth_subject_id TEXT NOT NULL DEFAULT '',
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    global_role TEXT NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_credentials (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'store',
    address TEXT NOT NULL DEFAULT '',
    is_primary_stock_source BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_locations_business ON locations(business_id)`,
  `CREATE TABLE IF NOT EXISTS business_users (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff',
    location_scope_id TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_business_users_biz_user ON business_users(business_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Umum',
    product_type TEXT NOT NULL DEFAULT 'physical',
    image_url TEXT NOT NULL DEFAULT '',
    base_price_idr BIGINT NOT NULL DEFAULT 0,
    track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_products_business_sku ON products(business_id, sku)`,
  `CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    attributes_json TEXT NOT NULL DEFAULT '{}',
    price_idr BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)`,
  `CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id TEXT NOT NULL DEFAULT '',
    location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    qty_on_hand INTEGER NOT NULL DEFAULT 0,
    qty_reserved INTEGER NOT NULL DEFAULT 0,
    qty_available INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory(business_id, product_id, location_id)`,
  `CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    variant_id TEXT NOT NULL DEFAULT '',
    location_id TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    qty_delta INTEGER NOT NULL,
    qty_before INTEGER NOT NULL,
    qty_after INTEGER NOT NULL,
    reference_type TEXT NOT NULL DEFAULT 'manual',
    reference_id TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_movements_business_created ON inventory_movements(business_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel_type TEXT NOT NULL DEFAULT 'website',
    api_key_prefix TEXT NOT NULL DEFAULT '',
    webhook_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    last_synced_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_integrations_business ON integrations(business_id)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    idempotency_key TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'manual',
    integration_id TEXT NOT NULL DEFAULT '',
    location_id TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL,
    customer_contact TEXT NOT NULL DEFAULT '',
    subtotal_idr BIGINT NOT NULL DEFAULT 0,
    discount_idr BIGINT NOT NULL DEFAULT 0,
    total_idr BIGINT NOT NULL DEFAULT 0,
    order_status TEXT NOT NULL DEFAULT 'pending',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_business_created ON orders(business_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(business_id, idempotency_key)`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    variant_id TEXT NOT NULL DEFAULT '',
    sku_snapshot TEXT NOT NULL DEFAULT '',
    product_name_snapshot TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price_idr BIGINT NOT NULL DEFAULT 0,
    line_total_idr BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount_idr BIGINT NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
    destination_account_label TEXT NOT NULL DEFAULT '',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    proof_url TEXT NOT NULL DEFAULT '',
    paid_at TEXT NOT NULL DEFAULT '',
    verified_by TEXT NOT NULL DEFAULT '',
    verified_at TEXT NOT NULL DEFAULT '',
    verification_notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)`,
  `CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    integration_id TEXT NOT NULL DEFAULT '',
    direction TEXT NOT NULL DEFAULT 'inbound',
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    idempotency_key TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'success',
    http_status INTEGER NOT NULL DEFAULT 200,
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_logs_business_created ON sync_logs(business_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL DEFAULT '',
    actor_user_id TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    payload_summary_json TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`,
];

function assertSafeTable(table: TableName): void {
  if (!VALID_TABLES.has(table)) {
    throw new Error(`Tabel tidak dikenal: ${table}`);
  }
}

function normalizeRow<T>(table: TableName, raw: Record<string, unknown>): T {
  const schema = TABLE_SCHEMAS[table];
  const out: Record<string, unknown> = {};
  for (const col of schema) {
    const val = raw[col.name];
    if (col.type === 'number') {
      const parsed = Number(val ?? 0);
      out[col.name] = Number.isFinite(parsed) ? parsed : 0;
    } else if (col.type === 'boolean') {
      out[col.name] =
        val === true || val === 'true' || val === 't' || val === 1;
    } else {
      out[col.name] = val === null || val === undefined ? '' : String(val);
    }
  }
  return out as T;
}

/**
 * Production Serverless PostgreSQL Adapter powered by Neon (@neondatabase/serverless).
 * 100% compatible with Vercel Serverless Functions.
 */
export class NeonPostgresAdapter implements IDatabaseAdapter {
  readonly providerName = 'neon' as const;
  readonly supportsTransactions = true;

  private readonly mutex = new KeyedMutex();
  private schemaInitPromise: Promise<{ created: TableName[]; verified: TableName[] }> | null =
    null;

  private async ensureSchemaReady(): Promise<void> {
    if (!this.schemaInitPromise) {
      this.schemaInitPromise = this.initializeSchema().catch((err) => {
        this.schemaInitPromise = null;
        throw err;
      });
    }
    await this.schemaInitPromise;
  }

  repo<K extends TableName>(table: K): IRepository<TableEntityMap[K]> {
    assertSafeTable(table);
    type Entity = TableEntityMap[K];
    const schema = TABLE_SCHEMAS[table];
    const validCols = new Set(schema.map((c) => c.name));
    const colListSql = schema.map((c) => `"${c.name}"`).join(', ');

    return {
      create: async (record: Entity): Promise<Entity> => {
        await this.ensureSchemaReady();
        const rec = record as unknown as Record<string, unknown>;
        const values = schema.map((c) => {
          const v = rec[c.name];
          if (c.type === 'number') return Number(v ?? 0);
          if (c.type === 'boolean') return Boolean(v);
          return v === null || v === undefined ? '' : String(v);
        });
        const placeholders = schema.map((_, i) => `$${i + 1}`).join(', ');
        const rows = await execNeonQuery(
          `INSERT INTO "${table}" (${colListSql}) VALUES (${placeholders}) RETURNING ${colListSql}`,
          values
        );
        return rows[0] ? normalizeRow<Entity>(table, rows[0]) : record;
      },

      findById: async (id: string): Promise<Entity | null> => {
        await this.ensureSchemaReady();
        const rows = await execNeonQuery(
          `SELECT ${colListSql} FROM "${table}" WHERE "id" = $1 LIMIT 1`,
          [id]
        );
        return rows[0] ? normalizeRow<Entity>(table, rows[0]) : null;
      },

      findMany: async (
        filter?: QueryFilter<Entity>
      ): Promise<PaginatedResult<Entity>> => {
        await this.ensureSchemaReady();
        const whereClauses: string[] = [];
        const params: unknown[] = [];

        if (filter?.where) {
          for (const [k, v] of Object.entries(filter.where)) {
            if (v === undefined || !validCols.has(k)) continue;
            params.push(v);
            whereClauses.push(`"${k}" = $${params.length}`);
          }
        }

        const whereSql =
          whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
        let orderSql = '';
        if (filter?.sortBy && validCols.has(String(filter.sortBy))) {
          const dir = filter.sortDir === 'asc' ? 'ASC' : 'DESC';
          orderSql = ` ORDER BY "${String(filter.sortBy)}" ${dir}`;
        }

        const rows = await execNeonQuery(
          `SELECT ${colListSql} FROM "${table}"${whereSql}${orderSql}`,
          params
        );
        const entities = rows.map((r) => normalizeRow<Entity>(table, r));

        // Apply optional predicate & pagination consistently with repository contract
        return applyQueryFilter(entities, {
          predicate: filter?.predicate,
          sortBy: filter?.sortBy,
          sortDir: filter?.sortDir,
          page: filter?.page,
          limit: filter?.limit,
        });
      },

      update: async (id: string, patch: Partial<Entity>): Promise<Entity | null> => {
        await this.ensureSchemaReady();
        const sets: string[] = [];
        const params: unknown[] = [];

        for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
          if (k === 'id' || v === undefined || !validCols.has(k)) continue;
          params.push(v);
          sets.push(`"${k}" = $${params.length}`);
        }

        if (sets.length === 0) {
          return this.repo(table).findById(id);
        }

        params.push(id);
        const rows = await execNeonQuery(
          `UPDATE "${table}" SET ${sets.join(', ')} WHERE "id" = $${params.length} RETURNING ${colListSql}`,
          params
        );
        return rows[0] ? normalizeRow<Entity>(table, rows[0]) : null;
      },

      delete: async (id: string): Promise<boolean> => {
        await this.ensureSchemaReady();
        const rows = await execNeonQuery(
          `DELETE FROM "${table}" WHERE "id" = $1 RETURNING "id"`,
          [id]
        );
        return rows.length > 0;
      },

      count: async (filter?: QueryFilter<Entity>): Promise<number> => {
        const res = await this.repo(table).findMany({
          ...filter,
          page: 1,
          limit: 1,
        });
        return res.total;
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
    const existingRes = await execNeonQuery(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const existingSet = new Set(existingRes.map((r) => String(r.table_name)));

    for (const stmt of INIT_STATEMENTS) {
      await execNeonQuery(stmt);
    }

    const created: TableName[] = [];
    const verified: TableName[] = [];
    for (const table of ALL_TABLES) {
      if (existingSet.has(table)) verified.push(table);
      else created.push(table);
    }

    return { created, verified };
  }

  async healthCheck(): Promise<DatabaseHealth> {
    const tables = {} as Record<TableName, number>;
    try {
      await this.ensureSchemaReady();
      for (const table of ALL_TABLES) {
        try {
          const rows = await execNeonQuery(
            `SELECT COUNT(*)::int AS total FROM "${table}"`
          );
          tables[table] = Number(rows[0]?.total ?? 0);
        } catch {
          tables[table] = -1;
        }
      }
      const missingCount = Object.values(tables).filter((n) => n < 0).length;
      return {
        provider: 'neon',
        ok: missingCount === 0,
        message:
          missingCount === 0
            ? 'Terhubung ke Neon PostgreSQL (14 tabel operasional + auth_credentials siap di Vercel Serverless).'
            : `${missingCount} tabel belum ditemukan. Klik "Inisialisasi / Verifikasi 14 Tabel".`,
        tables,
      };
    } catch (err) {
      for (const t of ALL_TABLES) tables[t] = -1;
      return {
        provider: 'neon',
        ok: false,
        message:
          err instanceof Error
            ? `Gagal terhubung ke Neon PostgreSQL: ${err.message}`
            : 'Gagal terhubung ke Neon PostgreSQL.',
        tables,
      };
    }
  }
}
