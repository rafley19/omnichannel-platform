import { getDatabase } from '@/db/factory';
import type {
  Order,
  OrderChannel,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '@/db/types';
import {
  getAccessibleBusinessIds,
  requireBusinessAccess,
  type SessionUser,
} from '@/lib/auth';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { createId, formatOrderNumber, nowIso } from '@/lib/id';
import { recordAuditLog } from './audit.service';
import { recordStockMovement } from './inventory.service';

export interface CreateOrderInput {
  business_id: string;
  location_id?: string;
  channel: OrderChannel;
  idempotency_key?: string;
  customer_name: string;
  customer_contact?: string;
  discount_idr?: number;
  payment_method: PaymentMethod;
  destination_account_label?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    variant_id?: string;
    qty: number;
    unit_price_idr?: number;
  }>;
}

export interface OrderWithDetails extends Order {
  business_name: string;
  items: OrderItem[];
  payments: Payment[];
}

export async function listOrders(
  session: SessionUser,
  options?: {
    businessId?: string;
    orderStatus?: string;
    paymentStatus?: string;
    channel?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ items: OrderWithDetails[]; total: number; page: number; limit: number }> {
  const db = getDatabase();
  const allowedIds = await getAccessibleBusinessIds(session);

  if (options?.businessId) {
    await requireBusinessAccess(session, options.businessId);
  }

  const search = options?.search?.trim().toLowerCase() ?? '';
  const fromMs = options?.from ? new Date(options.from).getTime() : null;
  const toMs = options?.to ? new Date(options.to).getTime() + 86_400_000 : null;

  const ordersRes = await db.repo('orders').findMany({
    predicate: (o) => {
      if (allowedIds !== null && !allowedIds.includes(o.business_id)) return false;
      if (options?.businessId && o.business_id !== options.businessId) return false;
      if (options?.orderStatus && o.order_status !== options.orderStatus) return false;
      if (options?.paymentStatus && o.payment_status !== options.paymentStatus) return false;
      if (options?.channel && o.channel !== options.channel) return false;
      if (fromMs !== null && new Date(o.created_at).getTime() < fromMs) return false;
      if (toMs !== null && new Date(o.created_at).getTime() > toMs) return false;
      if (
        search &&
        !o.order_number.toLowerCase().includes(search) &&
        !o.customer_name.toLowerCase().includes(search) &&
        !o.customer_contact.toLowerCase().includes(search)
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

  const [bizRes, itemsRes, payRes] = await Promise.all([
    db.repo('businesses').findMany({ limit: 500 }),
    db.repo('order_items').findMany({ limit: 500 }),
    db.repo('payments').findMany({ limit: 500 }),
  ]);

  const bizMap = new Map(bizRes.items.map((b) => [b.id, b.name]));
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of itemsRes.items) {
    const arr = itemsByOrder.get(item.order_id) ?? [];
    arr.push(item);
    itemsByOrder.set(item.order_id, arr);
  }
  const paysByOrder = new Map<string, Payment[]>();
  for (const p of payRes.items) {
    const arr = paysByOrder.get(p.order_id) ?? [];
    arr.push(p);
    paysByOrder.set(p.order_id, arr);
  }

  return {
    items: ordersRes.items.map((o) => ({
      ...o,
      business_name: bizMap.get(o.business_id) ?? '-',
      items: itemsByOrder.get(o.id) ?? [],
      payments: paysByOrder.get(o.id) ?? [],
    })),
    total: ordersRes.total,
    page: ordersRes.page,
    limit: ordersRes.limit,
  };
}

export async function getOrderById(
  session: SessionUser,
  orderId: string
): Promise<OrderWithDetails> {
  const db = getDatabase();
  const order = await db.repo('orders').findById(orderId);
  if (!order) throw new NotFoundError('Pesanan tidak ditemukan.');
  await requireBusinessAccess(session, order.business_id);

  const [biz, itemsRes, payRes] = await Promise.all([
    db.repo('businesses').findById(order.business_id),
    db.repo('order_items').findMany({ where: { order_id: orderId }, limit: 200 }),
    db.repo('payments').findMany({ where: { order_id: orderId }, limit: 50 }),
  ]);

  return {
    ...order,
    business_name: biz?.name ?? '-',
    items: itemsRes.items,
    payments: payRes.items,
  };
}

export async function createOrder(
  session: SessionUser,
  input: CreateOrderInput,
  ipAddress?: string
): Promise<{ order: OrderWithDetails; deduplicated: boolean }> {
  await requireBusinessAccess(session, input.business_id, ['admin', 'manager', 'staff']);
  if (!input.items || input.items.length === 0) {
    throw new ValidationError('Pesanan harus memiliki minimal 1 item produk.');
  }

  const db = getDatabase();

  return db.withTransaction(`order:${input.business_id}`, async () => {
    // 1. Idempotency check (prevents double orders & double stock deduction on retries)
    const idempKey = (input.idempotency_key ?? '').trim();
    if (idempKey) {
      const existing = await db.repo('orders').findMany({
        where: { business_id: input.business_id, idempotency_key: idempKey },
        limit: 1,
      });
      if (existing.items[0]) {
        const full = await getOrderById(session, existing.items[0].id);
        return { order: full, deduplicated: true };
      }
    }

    const business = await db.repo('businesses').findById(input.business_id);
    if (!business) throw new NotFoundError('Usaha tidak ditemukan.');

    // Resolve location (use provided location_id or primary stock source)
    let resolvedLocationId = input.location_id ?? '';
    if (!resolvedLocationId) {
      const locs = await db.repo('locations').findMany({
        where: { business_id: input.business_id, is_active: true },
        limit: 50,
      });
      const primary = locs.items.find((l) => l.is_primary_stock_source) ?? locs.items[0];
      resolvedLocationId = primary?.id ?? '';
    }

    // 2. Validate every item & pre-check inventory availability BEFORE creating order
    const preparedItems: Array<{
      productId: string;
      variantId: string;
      sku: string;
      name: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
      trackInventory: boolean;
    }> = [];

    for (const item of input.items) {
      const qty = Math.round(item.qty);
      if (qty <= 0) {
        throw new ValidationError('Jumlah item harus lebih dari 0.');
      }
      const product = await db.repo('products').findById(item.product_id);
      if (!product || product.business_id !== input.business_id) {
        throw new NotFoundError(`Produk ${item.product_id} tidak ditemukan pada usaha ini.`);
      }
      if (!product.is_active) {
        throw new ValidationError(`Produk "${product.name}" sedang nonaktif.`);
      }

      let sku = product.sku;
      let displayName = product.name;
      let defaultPrice = product.base_price_idr;
      const variantId = item.variant_id ?? '';

      if (variantId) {
        const variant = await db.repo('product_variants').findById(variantId);
        if (!variant || variant.product_id !== product.id) {
          throw new NotFoundError('Variasi produk tidak valid.');
        }
        sku = variant.sku;
        displayName = `${product.name} — ${variant.variant_name}`;
        defaultPrice = variant.price_idr;
      }

      if (product.track_inventory) {
        if (!resolvedLocationId) {
          throw new ValidationError(
            'Lokasi stok belum diatur untuk usaha ini. Tambahkan lokasi terlebih dahulu.'
          );
        }
        const invRes = await db.repo('inventory').findMany({
          where: {
            business_id: input.business_id,
            product_id: product.id,
            variant_id: variantId,
            location_id: resolvedLocationId,
          },
          limit: 1,
        });
        const available = invRes.items[0]?.qty_available ?? 0;
        if (available < qty) {
          throw new ConflictError(
            'INSUFFICIENT_STOCK',
            `Stok "${displayName}" tidak cukup (tersedia: ${available}, diminta: ${qty}).`
          );
        }
      }

      const unitPrice =
        item.unit_price_idr !== undefined
          ? Math.max(0, Math.round(item.unit_price_idr))
          : defaultPrice;

      preparedItems.push({
        productId: product.id,
        variantId,
        sku,
        name: displayName,
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
        trackInventory: product.track_inventory,
      });
    }

    const subtotal = preparedItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const discount = Math.min(subtotal, Math.max(0, Math.round(input.discount_idr ?? 0)));
    const total = subtotal - discount;

    // 3. Generate sequential Order Number safely inside lock
    const allBizOrders = await db.repo('orders').findMany({
      where: { business_id: input.business_id },
      limit: 500,
    });
    const orderNumber = formatOrderNumber(allBizOrders.items.map((o) => o.order_number));
    const ts = nowIso();
    const orderId = createId('ord');

    const order = await db.repo('orders').create({
      id: orderId,
      business_id: input.business_id,
      order_number: orderNumber,
      idempotency_key: idempKey || createId('ord'),
      channel: input.channel,
      integration_id: '',
      location_id: resolvedLocationId,
      customer_name: input.customer_name.trim(),
      customer_contact: (input.customer_contact ?? '').trim(),
      subtotal_idr: subtotal,
      discount_idr: discount,
      total_idr: total,
      order_status: 'pending',
      payment_status: 'pending',
      notes: (input.notes ?? '').trim(),
      created_at: ts,
      updated_at: ts,
    });

    const createdItems: OrderItem[] = [];
    for (const pi of preparedItems) {
      const oi = await db.repo('order_items').create({
        id: createId('oi'),
        business_id: input.business_id,
        order_id: order.id,
        product_id: pi.productId,
        variant_id: pi.variantId,
        sku_snapshot: pi.sku,
        product_name_snapshot: pi.name,
        qty: pi.qty,
        unit_price_idr: pi.unitPrice,
        line_total_idr: pi.lineTotal,
      });
      createdItems.push(oi);

      if (pi.trackInventory && resolvedLocationId) {
        await recordStockMovement(
          session,
          {
            business_id: input.business_id,
            product_id: pi.productId,
            variant_id: pi.variantId,
            location_id: resolvedLocationId,
            movement_type: 'sale',
            qty: pi.qty,
            reference_type: 'order',
            reference_id: order.id,
            notes: `Pengurangan stok otomatis dari pesanan ${orderNumber}`,
          },
          ipAddress
        );
      }
    }

    const payment = await db.repo('payments').create({
      id: createId('pay'),
      business_id: input.business_id,
      order_id: order.id,
      amount_idr: total,
      payment_method: input.payment_method,
      destination_account_label: (input.destination_account_label ?? '').trim(),
      payment_status: 'pending',
      proof_url: '',
      paid_at: '',
      verified_by: '',
      verified_at: '',
      verification_notes: '',
      created_at: ts,
    });

    await recordAuditLog({
      businessId: input.business_id,
      actorUserId: session.userId,
      action: 'ORDER_CREATED',
      entityType: 'order',
      entityId: order.id,
      summary: { order_number: orderNumber, total_idr: total, channel: input.channel },
      ipAddress,
    });

    return {
      order: {
        ...order,
        business_name: business.name,
        items: createdItems,
        payments: [payment],
      },
      deduplicated: false,
    };
  });
}

export async function updateOrderStatus(
  session: SessionUser,
  orderId: string,
  nextStatus: OrderStatus,
  ipAddress?: string
): Promise<Order> {
  const db = getDatabase();
  const order = await db.repo('orders').findById(orderId);
  if (!order) throw new NotFoundError('Pesanan tidak ditemukan.');
  await requireBusinessAccess(session, order.business_id, ['admin', 'manager', 'staff']);

  if (order.order_status === 'cancelled') {
    throw new ConflictError(
      'ORDER_ALREADY_CANCELLED',
      'Pesanan yang sudah dibatalkan tidak dapat diubah statusnya.'
    );
  }
  if (nextStatus === 'cancelled') {
    throw new ValidationError('Gunakan aksi pembatalan pesanan agar stok dikembalikan otomatis.');
  }

  const updated = await db.repo('orders').update(orderId, {
    order_status: nextStatus,
    updated_at: nowIso(),
  });
  if (!updated) throw new NotFoundError('Gagal memperbarui status pesanan.');

  await recordAuditLog({
    businessId: order.business_id,
    actorUserId: session.userId,
    action: 'ORDER_STATUS_UPDATED',
    entityType: 'order',
    entityId: orderId,
    summary: { from: order.order_status, to: nextStatus },
    ipAddress,
  });

  return updated;
}

export async function cancelOrder(
  session: SessionUser,
  orderId: string,
  reason?: string,
  ipAddress?: string
): Promise<Order> {
  const db = getDatabase();
  const order = await db.repo('orders').findById(orderId);
  if (!order) throw new NotFoundError('Pesanan tidak ditemukan.');
  await requireBusinessAccess(session, order.business_id, ['admin', 'manager']);

  if (order.order_status === 'cancelled') {
    throw new ConflictError('ORDER_ALREADY_CANCELLED', 'Pesanan ini sudah dibatalkan.');
  }

  return db.withTransaction(`order:${order.business_id}`, async () => {
    const itemsRes = await db.repo('order_items').findMany({
      where: { order_id: orderId },
      limit: 200,
    });

    if (order.location_id) {
      for (const item of itemsRes.items) {
        const prod = await db.repo('products').findById(item.product_id);
        if (prod?.track_inventory) {
          await recordStockMovement(
            session,
            {
              business_id: order.business_id,
              product_id: item.product_id,
              variant_id: item.variant_id,
              location_id: order.location_id,
              movement_type: 'order_cancel',
              qty: item.qty,
              reference_type: 'order',
              reference_id: order.id,
              notes: `Pengembalian stok dari pembatalan ${order.order_number}${reason ? `: ${reason}` : ''}`,
            },
            ipAddress
          );
        }
      }
    }

    const updated = await db.repo('orders').update(orderId, {
      order_status: 'cancelled',
      notes: reason
        ? `${order.notes ? `${order.notes} | ` : ''}Batal: ${reason}`
        : order.notes,
      updated_at: nowIso(),
    });

    await recordAuditLog({
      businessId: order.business_id,
      actorUserId: session.userId,
      action: 'ORDER_CANCELLED',
      entityType: 'order',
      entityId: orderId,
      summary: { order_number: order.order_number, reason: reason ?? '' },
      ipAddress,
    });

    return updated ?? order;
  });
}

/**
 * Manual payment verification / update — strictly separated from order_status.
 * Uploading a proof URL alone never marks payment as Paid without explicit admin verification.
 */
export async function updateOrderPayment(
  session: SessionUser,
  orderId: string,
  input: {
    payment_status: PaymentStatus;
    payment_method?: PaymentMethod;
    destination_account_label?: string;
    proof_url?: string;
    verification_notes?: string;
  },
  ipAddress?: string
): Promise<{ order: Order; payment: Payment }> {
  const db = getDatabase();
  const order = await db.repo('orders').findById(orderId);
  if (!order) throw new NotFoundError('Pesanan tidak ditemukan.');

  const requiredRoles: Array<'admin' | 'manager' | 'staff'> =
    input.payment_status === 'paid' || input.payment_status === 'refunded'
      ? ['admin', 'manager']
      : ['admin', 'manager', 'staff'];

  await requireBusinessAccess(session, order.business_id, requiredRoles);

  const payRes = await db.repo('payments').findMany({
    where: { order_id: orderId },
    sortBy: 'created_at',
    sortDir: 'desc',
    limit: 1,
  });

  const ts = nowIso();
  let payment = payRes.items[0];
  const isVerifiedAction =
    input.payment_status === 'paid' ||
    input.payment_status === 'failed' ||
    input.payment_status === 'refunded';

  if (!payment) {
    payment = await db.repo('payments').create({
      id: createId('pay'),
      business_id: order.business_id,
      order_id: order.id,
      amount_idr: order.total_idr,
      payment_method: input.payment_method ?? 'bank_transfer',
      destination_account_label: (input.destination_account_label ?? '').trim(),
      payment_status: input.payment_status,
      proof_url: (input.proof_url ?? '').trim(),
      paid_at: input.payment_status === 'paid' ? ts : '',
      verified_by: isVerifiedAction ? session.userId : '',
      verified_at: isVerifiedAction ? ts : '',
      verification_notes: (input.verification_notes ?? '').trim(),
      created_at: ts,
    });
  } else {
    payment =
      (await db.repo('payments').update(payment.id, {
        payment_status: input.payment_status,
        ...(input.payment_method ? { payment_method: input.payment_method } : {}),
        ...(input.destination_account_label !== undefined
          ? { destination_account_label: input.destination_account_label.trim() }
          : {}),
        ...(input.proof_url !== undefined ? { proof_url: input.proof_url.trim() } : {}),
        ...(input.payment_status === 'paid' ? { paid_at: payment.paid_at || ts } : {}),
        ...(isVerifiedAction
          ? { verified_by: session.userId, verified_at: ts }
          : {}),
        ...(input.verification_notes !== undefined
          ? { verification_notes: input.verification_notes.trim() }
          : {}),
      })) ?? payment;
  }

  const updatedOrder =
    (await db.repo('orders').update(orderId, {
      payment_status: input.payment_status,
      updated_at: ts,
    })) ?? order;

  await recordAuditLog({
    businessId: order.business_id,
    actorUserId: session.userId,
    action: 'PAYMENT_STATUS_UPDATED',
    entityType: 'payment',
    entityId: payment.id,
    summary: {
      order_number: order.order_number,
      payment_status: input.payment_status,
      verified_by: isVerifiedAction ? session.userId : '',
    },
    ipAddress,
  });

  return { order: updatedOrder, payment };
}
