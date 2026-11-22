import { getDatabase } from '@/db/factory';
import type {
  Inventory,
  InventoryMovement,
  MovementRefType,
  MovementType,
} from '@/db/types';
import {
  getAccessibleBusinessIds,
  requireBusinessAccess,
  type SessionUser,
} from '@/lib/auth';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { createId, nowIso } from '@/lib/id';
import { recordAuditLog } from './audit.service';

export interface InventoryWithDetails extends Inventory {
  business_name: string;
  product_name: string;
  product_sku: string;
  variant_name: string;
  location_name: string;
  is_low_stock: boolean;
}

export interface MovementWithDetails extends InventoryMovement {
  business_name: string;
  product_name: string;
  location_name: string;
}

export interface RecordMovementInput {
  business_id: string;
  product_id: string;
  variant_id?: string;
  location_id: string;
  movement_type: MovementType;
  qty: number; // positive integer; for 'adjustment' can be target delta (+/-)
  reference_type?: MovementRefType;
  reference_id?: string;
  notes?: string;
  low_stock_threshold?: number;
}

export async function listInventory(
  session: SessionUser,
  options?: {
    businessId?: string;
    locationId?: string;
    lowStockOnly?: boolean;
    search?: string;
  }
): Promise<InventoryWithDetails[]> {
  const db = getDatabase();
  const allowedIds = await getAccessibleBusinessIds(session);

  if (options?.businessId) {
    await requireBusinessAccess(session, options.businessId);
  }

  const [invRes, bizRes, prodRes, varRes, locRes] = await Promise.all([
    db.repo('inventory').findMany({ limit: 500 }),
    db.repo('businesses').findMany({ limit: 500 }),
    db.repo('products').findMany({ limit: 500 }),
    db.repo('product_variants').findMany({ limit: 500 }),
    db.repo('locations').findMany({ limit: 500 }),
  ]);

  const bizMap = new Map(bizRes.items.map((b) => [b.id, b.name]));
  const prodMap = new Map(prodRes.items.map((p) => [p.id, p]));
  const varMap = new Map(varRes.items.map((v) => [v.id, v]));
  const locMap = new Map(locRes.items.map((l) => [l.id, l.name]));

  const search = options?.search?.trim().toLowerCase() ?? '';

  return invRes.items
    .filter((inv) => {
      if (allowedIds !== null && !allowedIds.includes(inv.business_id)) return false;
      if (options?.businessId && inv.business_id !== options.businessId) return false;
      if (options?.locationId && inv.location_id !== options.locationId) return false;
      return true;
    })
    .map((inv) => {
      const prod = prodMap.get(inv.product_id);
      const variant = inv.variant_id ? varMap.get(inv.variant_id) : undefined;
      const isLow = inv.qty_available <= inv.low_stock_threshold;
      return {
        ...inv,
        business_name: bizMap.get(inv.business_id) ?? '-',
        product_name: prod?.name ?? 'Produk Dihapus',
        product_sku: variant?.sku ?? prod?.sku ?? '-',
        variant_name: variant?.variant_name ?? '',
        location_name: locMap.get(inv.location_id) ?? '-',
        is_low_stock: isLow,
      };
    })
    .filter((row) => {
      if (options?.lowStockOnly && !row.is_low_stock) return false;
      if (
        search &&
        !row.product_name.toLowerCase().includes(search) &&
        !row.product_sku.toLowerCase().includes(search) &&
        !row.location_name.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Number(b.is_low_stock) - Number(a.is_low_stock));
}

export async function listMovements(
  session: SessionUser,
  options?: { businessId?: string; productId?: string; limit?: number }
): Promise<MovementWithDetails[]> {
  const db = getDatabase();
  const allowedIds = await getAccessibleBusinessIds(session);

  if (options?.businessId) {
    await requireBusinessAccess(session, options.businessId);
  }

  const [movRes, bizRes, prodRes, locRes] = await Promise.all([
    db.repo('inventory_movements').findMany({
      predicate: (m) => {
        if (allowedIds !== null && !allowedIds.includes(m.business_id)) return false;
        if (options?.businessId && m.business_id !== options.businessId) return false;
        if (options?.productId && m.product_id !== options.productId) return false;
        return true;
      },
      sortBy: 'created_at',
      sortDir: 'desc',
      limit: options?.limit ?? 100,
    }),
    db.repo('businesses').findMany({ limit: 500 }),
    db.repo('products').findMany({ limit: 500 }),
    db.repo('locations').findMany({ limit: 500 }),
  ]);

  const bizMap = new Map(bizRes.items.map((b) => [b.id, b.name]));
  const prodMap = new Map(prodRes.items.map((p) => [p.id, p.name]));
  const locMap = new Map(locRes.items.map((l) => [l.id, l.name]));

  return movRes.items.map((m) => ({
    ...m,
    business_name: bizMap.get(m.business_id) ?? '-',
    product_name: prodMap.get(m.product_id) ?? '-',
    location_name: locMap.get(m.location_id) ?? '-',
  }));
}

/**
 * Core Inventory Ledger Operation.
 * Every stock mutation MUST pass through this function so `inventory` and
 * `inventory_movements` stay strictly consistent and protected by lock.
 */
export async function recordStockMovement(
  session: SessionUser,
  input: RecordMovementInput,
  ipAddress?: string
): Promise<{ inventory: Inventory; movement: InventoryMovement }> {
  await requireBusinessAccess(session, input.business_id, ['admin', 'manager', 'staff']);
  const db = getDatabase();

  const variantId = input.variant_id ?? '';
  const lockKey = `inv:${input.business_id}:${input.product_id}:${variantId}:${input.location_id}`;

  return db.withLock(lockKey, async () => {
    const product = await db.repo('products').findById(input.product_id);
    if (!product || product.business_id !== input.business_id) {
      throw new NotFoundError('Produk tidak ditemukan pada usaha ini.');
    }

    const location = await db.repo('locations').findById(input.location_id);
    if (!location || location.business_id !== input.business_id) {
      throw new NotFoundError('Lokasi tidak ditemukan pada usaha ini.');
    }

    const existingList = await db.repo('inventory').findMany({
      where: {
        business_id: input.business_id,
        product_id: input.product_id,
        variant_id: variantId,
        location_id: input.location_id,
      },
      limit: 1,
    });

    const ts = nowIso();
    let inv = existingList.items[0];
    if (!inv) {
      inv = await db.repo('inventory').create({
        id: createId('inv'),
        business_id: input.business_id,
        product_id: input.product_id,
        variant_id: variantId,
        location_id: input.location_id,
        qty_on_hand: 0,
        qty_reserved: 0,
        qty_available: 0,
        low_stock_threshold: input.low_stock_threshold ?? 5,
        updated_at: ts,
      });
    }

    const absQty = Math.abs(Math.round(input.qty));
    let delta = 0;

    switch (input.movement_type) {
      case 'stock_in':
      case 'order_cancel':
      case 'return':
      case 'transfer_in':
        if (absQty <= 0) throw new ValidationError('Jumlah stok masuk harus > 0.');
        delta = absQty;
        break;
      case 'stock_out':
      case 'sale':
      case 'transfer_out':
        if (absQty <= 0) throw new ValidationError('Jumlah stok keluar harus > 0.');
        if (inv.qty_available < absQty) {
          throw new ConflictError(
            'INSUFFICIENT_STOCK',
            `Stok tersedia untuk "${product.name}" tidak mencukupi (tersedia: ${inv.qty_available}, diminta: ${absQty}).`
          );
        }
        delta = -absQty;
        break;
      case 'adjustment':
      case 'opname':
        delta = Math.round(input.qty);
        if (delta === 0) {
          throw new ValidationError('Nilai penyesuaian stok tidak boleh 0.');
        }
        if (inv.qty_on_hand + delta < 0) {
          throw new ConflictError(
            'INSUFFICIENT_STOCK',
            `Penyesuaian menyebabkan stok menjadi negatif (stok saat ini: ${inv.qty_on_hand}).`
          );
        }
        break;
    }

    const qtyBefore = inv.qty_on_hand;
    const qtyAfter = qtyBefore + delta;
    const qtyAvailable = Math.max(0, qtyAfter - inv.qty_reserved);

    const updatedInv = await db.repo('inventory').update(inv.id, {
      qty_on_hand: qtyAfter,
      qty_available: qtyAvailable,
      ...(input.low_stock_threshold !== undefined
        ? { low_stock_threshold: Math.max(0, Math.round(input.low_stock_threshold)) }
        : {}),
      updated_at: ts,
    });

    const movement = await db.repo('inventory_movements').create({
      id: createId('mov'),
      business_id: input.business_id,
      inventory_id: inv.id,
      product_id: input.product_id,
      variant_id: variantId,
      location_id: input.location_id,
      movement_type: input.movement_type,
      qty_delta: delta,
      qty_before: qtyBefore,
      qty_after: qtyAfter,
      reference_type: input.reference_type ?? 'manual',
      reference_id: input.reference_id ?? '',
      notes: (input.notes ?? '').trim(),
      created_by: session.userId,
      created_at: ts,
    });

    await recordAuditLog({
      businessId: input.business_id,
      actorUserId: session.userId,
      action: 'STOCK_MOVEMENT_RECORDED',
      entityType: 'inventory',
      entityId: inv.id,
      summary: {
        movement_type: input.movement_type,
        qty_delta: delta,
        qty_before: qtyBefore,
        qty_after: qtyAfter,
      },
      ipAddress,
    });

    return { inventory: updatedInv ?? inv, movement };
  });
}
