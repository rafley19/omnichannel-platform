import { getDatabase } from '@/db/factory';
import type { Product, ProductType, ProductVariant } from '@/db/types';
import {
  getAccessibleBusinessIds,
  requireBusinessAccess,
  type SessionUser,
} from '@/lib/auth';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { createId, nowIso } from '@/lib/id';
import { recordAuditLog } from './audit.service';

export interface CreateProductInput {
  business_id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  product_type: ProductType;
  image_url?: string;
  base_price_idr: number;
  track_inventory: boolean;
  initial_stock?: number;
  low_stock_threshold?: number;
  variants?: Array<{
    sku: string;
    variant_name: string;
    price_idr: number;
    attributes?: Record<string, string>;
  }>;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  product_type?: ProductType;
  image_url?: string;
  base_price_idr?: number;
  track_inventory?: boolean;
  is_active?: boolean;
}

export interface ProductWithDetails extends Product {
  business_name: string;
  variants: ProductVariant[];
  total_available_stock: number;
}

export async function listProducts(
  session: SessionUser,
  options?: {
    businessId?: string;
    search?: string;
    category?: string;
    status?: 'active' | 'inactive' | 'all';
    page?: number;
    limit?: number;
  }
): Promise<{ items: ProductWithDetails[]; total: number; page: number; limit: number }> {
  const db = getDatabase();
  const allowedIds = await getAccessibleBusinessIds(session);

  if (options?.businessId) {
    await requireBusinessAccess(session, options.businessId);
  }

  const search = options?.search?.trim().toLowerCase() ?? '';
  const category = options?.category?.trim().toLowerCase() ?? '';
  const status = options?.status ?? 'all';

  const result = await db.repo('products').findMany({
    predicate: (p) => {
      if (allowedIds !== null && !allowedIds.includes(p.business_id)) return false;
      if (options?.businessId && p.business_id !== options.businessId) return false;
      if (status === 'active' && !p.is_active) return false;
      if (status === 'inactive' && p.is_active) return false;
      if (category && p.category.toLowerCase() !== category) return false;
      if (
        search &&
        !p.name.toLowerCase().includes(search) &&
        !p.sku.toLowerCase().includes(search) &&
        !p.category.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    },
    sortBy: 'created_at',
    sortDir: 'desc',
    page: options?.page ?? 1,
    limit: options?.limit ?? 50,
  });

  const [bizRes, varRes, invRes] = await Promise.all([
    db.repo('businesses').findMany({ limit: 500 }),
    db.repo('product_variants').findMany({ limit: 500 }),
    db.repo('inventory').findMany({ limit: 500 }),
  ]);

  const bizNameMap = new Map(bizRes.items.map((b) => [b.id, b.name]));
  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of varRes.items) {
    const arr = variantsByProduct.get(v.product_id) ?? [];
    arr.push(v);
    variantsByProduct.set(v.product_id, arr);
  }

  const stockByProduct = new Map<string, number>();
  for (const inv of invRes.items) {
    stockByProduct.set(
      inv.product_id,
      (stockByProduct.get(inv.product_id) ?? 0) + inv.qty_available
    );
  }

  return {
    items: result.items.map((p) => ({
      ...p,
      business_name: bizNameMap.get(p.business_id) ?? 'Usaha Tidak Dikenal',
      variants: variantsByProduct.get(p.id) ?? [],
      total_available_stock: stockByProduct.get(p.id) ?? 0,
    })),
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
}

export async function createProduct(
  session: SessionUser,
  input: CreateProductInput,
  ipAddress?: string
): Promise<ProductWithDetails> {
  await requireBusinessAccess(session, input.business_id, ['admin', 'manager']);
  const db = getDatabase();

  const business = await db.repo('businesses').findById(input.business_id);
  if (!business) throw new NotFoundError('Usaha tidak ditemukan.');

  const normalizedSku = input.sku.trim().toUpperCase();
  const dupSku = await db.repo('products').findMany({
    predicate: (p) =>
      p.business_id === input.business_id && p.sku.toUpperCase() === normalizedSku,
    limit: 1,
  });
  if (dupSku.total > 0) {
    throw new ConflictError(
      'SKU_EXISTS',
      `SKU "${normalizedSku}" sudah dipakai pada usaha ${business.name}.`
    );
  }

  const ts = nowIso();
  const trackInventory =
    input.product_type === 'service' ? false : Boolean(input.track_inventory);

  const product = await db.repo('products').create({
    id: createId('prd'),
    business_id: input.business_id,
    sku: normalizedSku,
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    category: (input.category || 'Umum').trim(),
    product_type: input.product_type,
    image_url: (input.image_url ?? '').trim(),
    base_price_idr: Math.max(0, Math.round(input.base_price_idr)),
    track_inventory: trackInventory,
    is_active: true,
    created_at: ts,
    updated_at: ts,
  });

  const createdVariants: ProductVariant[] = [];
  if (input.variants && input.variants.length > 0) {
    for (const v of input.variants) {
      const created = await db.repo('product_variants').create({
        id: createId('var'),
        business_id: input.business_id,
        product_id: product.id,
        sku: v.sku.trim().toUpperCase(),
        variant_name: v.variant_name.trim(),
        attributes_json: JSON.stringify(v.attributes ?? {}),
        price_idr: Math.max(0, Math.round(v.price_idr)),
        is_active: true,
        created_at: ts,
      });
      createdVariants.push(created);
    }
  }

  let initialStock = 0;
  if (trackInventory) {
    const locs = await db.repo('locations').findMany({
      where: { business_id: input.business_id, is_active: true },
      limit: 50,
    });
    const primaryLoc =
      locs.items.find((l) => l.is_primary_stock_source) ?? locs.items[0];

    if (primaryLoc) {
      const qtyInit = Math.max(0, Math.round(input.initial_stock ?? 0));
      const threshold = Math.max(0, Math.round(input.low_stock_threshold ?? 5));
      const invTargets =
        createdVariants.length > 0
          ? createdVariants.map((v) => v.id)
          : [''];

      for (const variantId of invTargets) {
        const inv = await db.repo('inventory').create({
          id: createId('inv'),
          business_id: input.business_id,
          product_id: product.id,
          variant_id: variantId,
          location_id: primaryLoc.id,
          qty_on_hand: qtyInit,
          qty_reserved: 0,
          qty_available: qtyInit,
          low_stock_threshold: threshold,
          updated_at: ts,
        });

        if (qtyInit > 0) {
          await db.repo('inventory_movements').create({
            id: createId('mov'),
            business_id: input.business_id,
            inventory_id: inv.id,
            product_id: product.id,
            variant_id: variantId,
            location_id: primaryLoc.id,
            movement_type: 'stock_in',
            qty_delta: qtyInit,
            qty_before: 0,
            qty_after: qtyInit,
            reference_type: 'manual',
            reference_id: product.id,
            notes: 'Stok awal saat penambahan produk',
            created_by: session.userId,
            created_at: ts,
          });
          initialStock += qtyInit;
        }
      }
    }
  }

  await recordAuditLog({
    businessId: input.business_id,
    actorUserId: session.userId,
    action: 'PRODUCT_CREATED',
    entityType: 'product',
    entityId: product.id,
    summary: { sku: product.sku, name: product.name, price: product.base_price_idr },
    ipAddress,
  });

  return {
    ...product,
    business_name: business.name,
    variants: createdVariants,
    total_available_stock: initialStock,
  };
}

export async function updateProduct(
  session: SessionUser,
  productId: string,
  input: UpdateProductInput,
  ipAddress?: string
): Promise<Product> {
  const db = getDatabase();
  const existing = await db.repo('products').findById(productId);
  if (!existing) throw new NotFoundError('Produk tidak ditemukan.');

  await requireBusinessAccess(session, existing.business_id, ['admin', 'manager']);

  const patch: Partial<Product> = { updated_at: nowIso() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.category !== undefined) patch.category = input.category.trim();
  if (input.product_type !== undefined) patch.product_type = input.product_type;
  if (input.image_url !== undefined) patch.image_url = input.image_url.trim();
  if (input.base_price_idr !== undefined) {
    patch.base_price_idr = Math.max(0, Math.round(input.base_price_idr));
  }
  if (input.track_inventory !== undefined) patch.track_inventory = input.track_inventory;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const updated = await db.repo('products').update(productId, patch);
  if (!updated) throw new NotFoundError('Gagal memperbarui produk.');

  await recordAuditLog({
    businessId: existing.business_id,
    actorUserId: session.userId,
    action: 'PRODUCT_UPDATED',
    entityType: 'product',
    entityId: productId,
    summary: { fields: Object.keys(input) },
    ipAddress,
  });

  return updated;
}

export async function softDeleteProduct(
  session: SessionUser,
  productId: string,
  ipAddress?: string
): Promise<Product> {
  const db = getDatabase();
  const existing = await db.repo('products').findById(productId);
  if (!existing) throw new NotFoundError('Produk tidak ditemukan.');

  await requireBusinessAccess(session, existing.business_id, ['admin', 'manager']);

  const updated = await db.repo('products').update(productId, {
    is_active: false,
    updated_at: nowIso(),
  });
  if (!updated) throw new NotFoundError('Produk tidak ditemukan.');

  await recordAuditLog({
    businessId: existing.business_id,
    actorUserId: session.userId,
    action: 'PRODUCT_DEACTIVATED',
    entityType: 'product',
    entityId: productId,
    summary: { sku: existing.sku, name: existing.name },
    ipAddress,
  });

  return updated;
}
