import { getDatabase } from '@/db/factory';
import {
  getAccessibleBusinessIds,
  requireBusinessAccess,
  type SessionUser,
} from '@/lib/auth';

export interface DashboardSummary {
  total_sales_idr: number;
  paid_sales_idr: number;
  total_orders: number;
  active_businesses_count: number;
  total_products_count: number;
  total_stock_units: number;
  low_stock_count: number;
  payment_breakdown: {
    pending: number;
    waiting_verification: number;
    paid: number;
    failed: number;
    refunded: number;
  };
  daily_sales: Array<{ date: string; sales_idr: number; orders: number }>;
  business_performance: Array<{
    business_id: string;
    business_name: string;
    category: string;
    orders_count: number;
    sales_idr: number;
    low_stock_count: number;
  }>;
  low_stock_items: Array<{
    inventory_id: string;
    business_name: string;
    product_name: string;
    sku: string;
    location_name: string;
    qty_available: number;
    threshold: number;
  }>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    business_name: string;
    customer_name: string;
    channel: string;
    total_idr: number;
    order_status: string;
    payment_status: string;
    created_at: string;
  }>;
}

export async function getDashboardSummary(
  session: SessionUser,
  options?: { businessId?: string; days?: number }
): Promise<DashboardSummary> {
  const db = getDatabase();
  const allowedIds = await getAccessibleBusinessIds(session);

  if (options?.businessId) {
    await requireBusinessAccess(session, options.businessId);
  }

  const days = Math.max(1, Math.min(365, options?.days ?? 30));
  const cutoffMs = Date.now() - days * 86_400_000;

  const [bizRes, prodRes, locRes, invRes, ordRes] = await Promise.all([
    db.repo('businesses').findMany({ limit: 500 }),
    db.repo('products').findMany({ limit: 500 }),
    db.repo('locations').findMany({ limit: 500 }),
    db.repo('inventory').findMany({ limit: 500 }),
    db.repo('orders').findMany({ sortBy: 'created_at', sortDir: 'desc', limit: 500 }),
  ]);

  const scopeBiz = bizRes.items.filter((b) => {
    if (allowedIds !== null && !allowedIds.includes(b.id)) return false;
    if (options?.businessId && b.id !== options.businessId) return false;
    return true;
  });
  const scopeBizIds = new Set(scopeBiz.map((b) => b.id));
  const bizMap = new Map(bizRes.items.map((b) => [b.id, b]));
  const prodMap = new Map(prodRes.items.map((p) => [p.id, p]));
  const locMap = new Map(locRes.items.map((l) => [l.id, l]));

  const scopedOrders = ordRes.items.filter((o) => {
    if (!scopeBizIds.has(o.business_id)) return false;
    const createdMs = new Date(o.created_at).getTime();
    return Number.isFinite(createdMs) ? createdMs >= cutoffMs : true;
  });

  const nonCancelledOrders = scopedOrders.filter(
    (o) => o.order_status !== 'cancelled' && o.order_status !== 'refunded'
  );

  const totalSales = nonCancelledOrders.reduce((s, o) => s + o.total_idr, 0);
  const paidSales = nonCancelledOrders
    .filter((o) => o.payment_status === 'paid')
    .reduce((s, o) => s + o.total_idr, 0);

  const paymentBreakdown = {
    pending: 0,
    waiting_verification: 0,
    paid: 0,
    failed: 0,
    refunded: 0,
  };
  for (const o of scopedOrders) {
    if (o.payment_status in paymentBreakdown) {
      paymentBreakdown[o.payment_status] += 1;
    }
  }

  // Daily sales series
  const dailyMap = new Map<string, { sales_idr: number; orders: number }>();
  for (const o of nonCancelledOrders) {
    const dayKey = o.created_at.slice(0, 10);
    const curr = dailyMap.get(dayKey) ?? { sales_idr: 0, orders: 0 };
    curr.sales_idr += o.total_idr;
    curr.orders += 1;
    dailyMap.set(dayKey, curr);
  }
  const dailySales = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  // Inventory & Low stock
  const scopedInv = invRes.items.filter((inv) => scopeBizIds.has(inv.business_id));
  const totalStockUnits = scopedInv.reduce((s, i) => s + i.qty_available, 0);
  const lowStockRows = scopedInv.filter((i) => i.qty_available <= i.low_stock_threshold);

  const lowStockItems = lowStockRows.slice(0, 10).map((inv) => {
    const prod = prodMap.get(inv.product_id);
    const biz = bizMap.get(inv.business_id);
    const loc = locMap.get(inv.location_id);
    return {
      inventory_id: inv.id,
      business_name: biz?.name ?? '-',
      product_name: prod?.name ?? '-',
      sku: prod?.sku ?? '-',
      location_name: loc?.name ?? '-',
      qty_available: inv.qty_available,
      threshold: inv.low_stock_threshold,
    };
  });

  // Per-business performance comparison
  const bizPerf = scopeBiz.map((b) => {
    const bOrders = nonCancelledOrders.filter((o) => o.business_id === b.id);
    const bLow = lowStockRows.filter((i) => i.business_id === b.id).length;
    return {
      business_id: b.id,
      business_name: b.name,
      category: b.category,
      orders_count: bOrders.length,
      sales_idr: bOrders.reduce((s, o) => s + o.total_idr, 0),
      low_stock_count: bLow,
    };
  });

  const scopedProductsCount = prodRes.items.filter(
    (p) => scopeBizIds.has(p.business_id) && p.is_active
  ).length;

  return {
    total_sales_idr: totalSales,
    paid_sales_idr: paidSales,
    total_orders: scopedOrders.length,
    active_businesses_count: scopeBiz.filter((b) => b.is_active).length,
    total_products_count: scopedProductsCount,
    total_stock_units: totalStockUnits,
    low_stock_count: lowStockRows.length,
    payment_breakdown: paymentBreakdown,
    daily_sales: dailySales,
    business_performance: bizPerf,
    low_stock_items: lowStockItems,
    recent_orders: scopedOrders.slice(0, 8).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      business_name: bizMap.get(o.business_id)?.name ?? '-',
      customer_name: o.customer_name,
      channel: o.channel,
      total_idr: o.total_idr,
      order_status: o.order_status,
      payment_status: o.payment_status,
      created_at: o.created_at,
    })),
  };
}
