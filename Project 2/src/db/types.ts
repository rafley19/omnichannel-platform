// =============================================================================
// Domain & Database Types — 14 Tables (PostgreSQL / Supabase Migration Ready)
// All money values in integer IDR. All timestamps in ISO 8601 UTC string.
// =============================================================================

export type TableName =
  | 'businesses'
  | 'users'
  | 'business_users'
  | 'locations'
  | 'products'
  | 'product_variants'
  | 'inventory'
  | 'inventory_movements'
  | 'orders'
  | 'order_items'
  | 'payments'
  | 'integrations'
  | 'sync_logs'
  | 'audit_logs';

export type BusinessCategory = 'fashion' | 'fnb' | 'service' | 'retail' | 'other';
export type GlobalRole = 'owner' | 'member';
export type BusinessRole = 'admin' | 'manager' | 'staff' | 'viewer';
export type LocationType = 'store' | 'warehouse' | 'kitchen' | 'office';
export type ProductType = 'physical' | 'service';
export type MovementType =
  | 'stock_in'
  | 'stock_out'
  | 'sale'
  | 'order_cancel'
  | 'return'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'opname';
export type MovementRefType = 'order' | 'manual' | 'transfer' | 'opname';
export type OrderChannel = 'manual' | 'website' | 'pos' | 'marketplace';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'refunded';
export type PaymentStatus =
  | 'pending'
  | 'waiting_verification'
  | 'paid'
  | 'failed'
  | 'refunded';
export type PaymentMethod = 'bank_transfer' | 'qris' | 'cash';
export type IntegrationChannelType = 'website' | 'pos' | 'marketplace';
export type IntegrationStatus = 'active' | 'paused' | 'revoked' | 'simulated';
export type SyncDirection = 'inbound' | 'outbound';
export type SyncStatus = 'success' | 'failed' | 'retrying';

export interface BaseEntity {
  id: string;
}

export interface Business extends BaseEntity {
  code: string;
  name: string;
  category: BusinessCategory;
  logo_url: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  enabled_modules_json: string; // JSON string array of enabled module keys
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User extends BaseEntity {
  auth_subject_id: string;
  full_name: string;
  email: string;
  global_role: GlobalRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessUser extends BaseEntity {
  business_id: string;
  user_id: string;
  role: BusinessRole;
  location_scope_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Location extends BaseEntity {
  business_id: string;
  code: string;
  name: string;
  type: LocationType;
  address: string;
  is_primary_stock_source: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Product extends BaseEntity {
  business_id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  product_type: ProductType;
  image_url: string;
  base_price_idr: number;
  track_inventory: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant extends BaseEntity {
  business_id: string;
  product_id: string;
  sku: string;
  variant_name: string;
  attributes_json: string;
  price_idr: number;
  is_active: boolean;
  created_at: string;
}

export interface Inventory extends BaseEntity {
  business_id: string;
  product_id: string;
  variant_id: string;
  location_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface InventoryMovement extends BaseEntity {
  business_id: string;
  inventory_id: string;
  product_id: string;
  variant_id: string;
  location_id: string;
  movement_type: MovementType;
  qty_delta: number;
  qty_before: number;
  qty_after: number;
  reference_type: MovementRefType;
  reference_id: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface Order extends BaseEntity {
  business_id: string;
  order_number: string;
  idempotency_key: string;
  channel: OrderChannel;
  integration_id: string;
  location_id: string;
  customer_name: string;
  customer_contact: string;
  subtotal_idr: number;
  discount_idr: number;
  total_idr: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem extends BaseEntity {
  business_id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  qty: number;
  unit_price_idr: number;
  line_total_idr: number;
}

export interface Payment extends BaseEntity {
  business_id: string;
  order_id: string;
  amount_idr: number;
  payment_method: PaymentMethod;
  destination_account_label: string;
  payment_status: PaymentStatus;
  proof_url: string;
  paid_at: string;
  verified_by: string;
  verified_at: string;
  verification_notes: string;
  created_at: string;
}

export interface Integration extends BaseEntity {
  business_id: string;
  name: string;
  channel_type: IntegrationChannelType;
  api_key_prefix: string;
  webhook_url: string;
  status: IntegrationStatus;
  last_synced_at: string;
  created_at: string;
}

export interface SyncLog extends BaseEntity {
  business_id: string;
  integration_id: string;
  direction: SyncDirection;
  entity_type: string;
  entity_id: string;
  idempotency_key: string;
  status: SyncStatus;
  http_status: number;
  error_message: string;
  created_at: string;
}

export interface AuditLog extends BaseEntity {
  business_id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload_summary_json: string;
  ip_address: string;
  created_at: string;
}

export interface TableEntityMap {
  businesses: Business;
  users: User;
  business_users: BusinessUser;
  locations: Location;
  products: Product;
  product_variants: ProductVariant;
  inventory: Inventory;
  inventory_movements: InventoryMovement;
  orders: Order;
  order_items: OrderItem;
  payments: Payment;
  integrations: Integration;
  sync_logs: SyncLog;
  audit_logs: AuditLog;
}

export interface QueryFilter<T> {
  where?: Partial<T>;
  predicate?: (row: T) => boolean;
  sortBy?: keyof T;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DatabaseHealth {
  provider: 'neon' | 'sheets' | 'local' | 'supabase';
  ok: boolean;
  message: string;
  tables: Record<TableName, number>;
}
