import type { TableName } from './types';

export type ColumnType = 'string' | 'number' | 'boolean';

export interface ColumnDef {
  name: string;
  type: ColumnType;
}

/**
 * Canonical column definitions for all 14 tables.
 * Used as index-based mapping (0-based) for Google Sheets Adapter,
 * Safe Migration initializer, and Stage 4 PostgreSQL ETL migration.
 */
export const TABLE_SCHEMAS: Record<TableName, readonly ColumnDef[]> = {
  businesses: [
    { name: 'id', type: 'string' },
    { name: 'code', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'category', type: 'string' },
    { name: 'logo_url', type: 'string' },
    { name: 'contact_email', type: 'string' },
    { name: 'contact_phone', type: 'string' },
    { name: 'address', type: 'string' },
    { name: 'enabled_modules_json', type: 'string' },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_at', type: 'string' },
    { name: 'updated_at', type: 'string' },
  ],
  users: [
    { name: 'id', type: 'string' },
    { name: 'auth_subject_id', type: 'string' },
    { name: 'full_name', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'global_role', type: 'string' },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_at', type: 'string' },
    { name: 'updated_at', type: 'string' },
  ],
  business_users: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'user_id', type: 'string' },
    { name: 'role', type: 'string' },
    { name: 'location_scope_id', type: 'string' },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_at', type: 'string' },
  ],
  locations: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'code', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'type', type: 'string' },
    { name: 'address', type: 'string' },
    { name: 'is_primary_stock_source', type: 'boolean' },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_at', type: 'string' },
  ],
  products: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'sku', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'category', type: 'string' },
    { name: 'product_type', type: 'string' },
    { name: 'image_url', type: 'string' },
    { name: 'base_price_idr', type: 'number' },
    { name: 'track_inventory', type: 'boolean' },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_at', type: 'string' },
    { name: 'updated_at', type: 'string' },
  ],
  product_variants: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'product_id', type: 'string' },
    { name: 'sku', type: 'string' },
    { name: 'variant_name', type: 'string' },
    { name: 'attributes_json', type: 'string' },
    { name: 'price_idr', type: 'number' },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_at', type: 'string' },
  ],
  inventory: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'product_id', type: 'string' },
    { name: 'variant_id', type: 'string' },
    { name: 'location_id', type: 'string' },
    { name: 'qty_on_hand', type: 'number' },
    { name: 'qty_reserved', type: 'number' },
    { name: 'qty_available', type: 'number' },
    { name: 'low_stock_threshold', type: 'number' },
    { name: 'updated_at', type: 'string' },
  ],
  inventory_movements: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'inventory_id', type: 'string' },
    { name: 'product_id', type: 'string' },
    { name: 'variant_id', type: 'string' },
    { name: 'location_id', type: 'string' },
    { name: 'movement_type', type: 'string' },
    { name: 'qty_delta', type: 'number' },
    { name: 'qty_before', type: 'number' },
    { name: 'qty_after', type: 'number' },
    { name: 'reference_type', type: 'string' },
    { name: 'reference_id', type: 'string' },
    { name: 'notes', type: 'string' },
    { name: 'created_by', type: 'string' },
    { name: 'created_at', type: 'string' },
  ],
  orders: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'order_number', type: 'string' },
    { name: 'idempotency_key', type: 'string' },
    { name: 'channel', type: 'string' },
    { name: 'integration_id', type: 'string' },
    { name: 'location_id', type: 'string' },
    { name: 'customer_name', type: 'string' },
    { name: 'customer_contact', type: 'string' },
    { name: 'subtotal_idr', type: 'number' },
    { name: 'discount_idr', type: 'number' },
    { name: 'total_idr', type: 'number' },
    { name: 'order_status', type: 'string' },
    { name: 'payment_status', type: 'string' },
    { name: 'notes', type: 'string' },
    { name: 'created_at', type: 'string' },
    { name: 'updated_at', type: 'string' },
  ],
  order_items: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'order_id', type: 'string' },
    { name: 'product_id', type: 'string' },
    { name: 'variant_id', type: 'string' },
    { name: 'sku_snapshot', type: 'string' },
    { name: 'product_name_snapshot', type: 'string' },
    { name: 'qty', type: 'number' },
    { name: 'unit_price_idr', type: 'number' },
    { name: 'line_total_idr', type: 'number' },
  ],
  payments: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'order_id', type: 'string' },
    { name: 'amount_idr', type: 'number' },
    { name: 'payment_method', type: 'string' },
    { name: 'destination_account_label', type: 'string' },
    { name: 'payment_status', type: 'string' },
    { name: 'proof_url', type: 'string' },
    { name: 'paid_at', type: 'string' },
    { name: 'verified_by', type: 'string' },
    { name: 'verified_at', type: 'string' },
    { name: 'verification_notes', type: 'string' },
    { name: 'created_at', type: 'string' },
  ],
  integrations: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'channel_type', type: 'string' },
    { name: 'api_key_prefix', type: 'string' },
    { name: 'webhook_url', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'last_synced_at', type: 'string' },
    { name: 'created_at', type: 'string' },
  ],
  sync_logs: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'integration_id', type: 'string' },
    { name: 'direction', type: 'string' },
    { name: 'entity_type', type: 'string' },
    { name: 'entity_id', type: 'string' },
    { name: 'idempotency_key', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'http_status', type: 'number' },
    { name: 'error_message', type: 'string' },
    { name: 'created_at', type: 'string' },
  ],
  audit_logs: [
    { name: 'id', type: 'string' },
    { name: 'business_id', type: 'string' },
    { name: 'actor_user_id', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'entity_type', type: 'string' },
    { name: 'entity_id', type: 'string' },
    { name: 'payload_summary_json', type: 'string' },
    { name: 'ip_address', type: 'string' },
    { name: 'created_at', type: 'string' },
  ],
} as const;

export const ALL_TABLES: readonly TableName[] = [
  'businesses',
  'users',
  'business_users',
  'locations',
  'products',
  'product_variants',
  'inventory',
  'inventory_movements',
  'orders',
  'order_items',
  'payments',
  'integrations',
  'sync_logs',
  'audit_logs',
];

export const DEFAULT_ENABLED_MODULES = [
  'dashboard',
  'products',
  'inventory',
  'orders',
] as const;

export function serializeRecordToRow<T extends Record<string, unknown>>(
  table: TableName,
  record: T
): string[] {
  const schema = TABLE_SCHEMAS[table];
  return schema.map((col) => {
    const val = record[col.name];
    if (val === null || val === undefined) return '';
    if (col.type === 'boolean') return val ? 'true' : 'false';
    return String(val);
  });
}

export function deserializeRowToRecord<T>(
  table: TableName,
  row: readonly string[]
): T {
  const schema = TABLE_SCHEMAS[table];
  const result: Record<string, unknown> = {};
  for (let i = 0; i < schema.length; i++) {
    const col = schema[i];
    const raw = row[i] ?? '';
    if (col.type === 'number') {
      const parsed = Number(raw);
      result[col.name] = Number.isFinite(parsed) ? parsed : 0;
    } else if (col.type === 'boolean') {
      result[col.name] = raw === 'true' || raw === 'TRUE' || raw === '1';
    } else {
      result[col.name] = String(raw);
    }
  }
  return result as T;
}
