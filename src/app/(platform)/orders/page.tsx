'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Eye,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { usePlatform } from '@/components/PlatformContext';
import {
  Drawer,
  EmptyState,
  ErrorState,
  Modal,
  StatusBadge,
  TableSkeleton,
} from '@/components/ui/Primitives';
import type {
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/db/types';
import { apiFetch } from '@/lib/api-client';
import { formatDateWib, formatIdr } from '@/lib/format';
import type { OrderWithDetails } from '@/services/order.service';
import type { ProductWithDetails } from '@/services/product.service';

interface OrderItemDraft {
  product_id: string;
  qty: number;
}

export default function OrdersPage() {
  const {
    businesses,
    selectedBusinessId,
    invalidateCache,
    showToast,
  } = usePlatform();

  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');

  // Create order modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formBizId, setFormBizId] = useState('');
  const [bizProducts, setBizProducts] = useState<ProductWithDetails[]>([]);
  const [channel, setChannel] = useState<OrderChannel>('manual');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [destAccount, setDestAccount] = useState('');
  const [discountIdr, setDiscountIdr] = useState('0');
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<OrderItemDraft[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Detail drawer state
  const [activeOrder, setActiveOrder] = useState<OrderWithDetails | null>(null);
  const [nextOrderStatus, setNextOrderStatus] = useState<OrderStatus>('confirmed');
  const [nextPayStatus, setNextPayStatus] = useState<PaymentStatus>('waiting_verification');
  const [proofUrl, setProofUrl] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedBusinessId) params.set('business_id', selectedBusinessId);
      if (orderStatusFilter) params.set('order_status', orderStatusFilter);
      if (paymentStatusFilter) params.set('payment_status', paymentStatusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiFetch<OrderWithDetails[]>(
        `/api/v1/orders?${params.toString()}`
      );
      setOrders(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar pesanan.');
    } finally {
      setLoading(false);
    }
  }, [orderStatusFilter, paymentStatusFilter, search, selectedBusinessId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadBizProducts = useCallback(async (businessId: string) => {
    if (!businessId) {
      setBizProducts([]);
      setDraftItems([]);
      return;
    }
    try {
      const res = await apiFetch<ProductWithDetails[]>(
        `/api/v1/products?business_id=${businessId}&status=active&limit=200`
      );
      setBizProducts(res.data);
      if (res.data.length > 0) {
        setDraftItems([{ product_id: res.data[0].id, qty: 1 }]);
      } else {
        setDraftItems([]);
      }
    } catch {
      setBizProducts([]);
      setDraftItems([]);
    }
  }, []);

  function openCreateOrderModal() {
    const initialBiz = selectedBusinessId || businesses[0]?.id || '';
    setFormBizId(initialBiz);
    setChannel('manual');
    setCustomerName('');
    setCustomerContact('');
    setPaymentMethod('bank_transfer');
    setDestAccount('');
    setDiscountIdr('0');
    setNotes('');
    setIdempotencyKey(`ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    setCreateOpen(true);
    loadBizProducts(initialBiz);
  }

  function openDetailDrawer(ord: OrderWithDetails) {
    setActiveOrder(ord);
    setNextOrderStatus(ord.order_status);
    setNextPayStatus(ord.payment_status);
    const latestPay = ord.payments[0];
    setProofUrl(latestPay?.proof_url ?? '');
    setVerifyNotes(latestPay?.verification_notes ?? '');
    setCancelReason('');
  }

  const draftSubtotal = draftItems.reduce((sum, item) => {
    const p = bizProducts.find((x) => x.id === item.product_id);
    return sum + (p?.base_price_idr ?? 0) * Math.max(1, item.qty);
  }, 0);
  const draftTotal = Math.max(0, draftSubtotal - (Number(discountIdr) || 0));

  async function handleCreateOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formBizId || draftItems.length === 0) {
      showToast('error', 'Pilih usaha dan minimal 1 item produk.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          business_id: formBizId,
          channel,
          idempotency_key: idempotencyKey,
          customer_name: customerName.trim(),
          customer_contact: customerContact.trim(),
          payment_method: paymentMethod,
          destination_account_label: destAccount.trim(),
          discount_idr: Number(discountIdr) || 0,
          notes: notes.trim(),
          items: draftItems.map((i) => ({
            product_id: i.product_id,
            qty: Math.max(1, Number(i.qty) || 1),
          })),
        }),
      });
      showToast('success', 'Pesanan berhasil dibuat dan stok otomatis terpotong.');
      setCreateOpen(false);
      invalidateCache();
      await loadOrders();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal membuat pesanan.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateOrderStatus() {
    if (!activeOrder) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/orders/${activeOrder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ order_status: nextOrderStatus }),
      });
      showToast('success', 'Status pesanan berhasil diperbarui.');
      invalidateCache();
      await loadOrders();
      setActiveOrder(null);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal memperbarui status pesanan.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdatePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeOrder) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/orders/${activeOrder.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          payment_status: nextPayStatus,
          proof_url: proofUrl.trim(),
          verification_notes: verifyNotes.trim(),
        }),
      });
      showToast('success', 'Status verifikasi pembayaran berhasil diperbarui.');
      invalidateCache();
      await loadOrders();
      setActiveOrder(null);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal memperbarui pembayaran.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelOrder() {
    if (!activeOrder) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/orders/${activeOrder.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      showToast('info', 'Pesanan dibatalkan dan stok dikembalikan otomatis.');
      invalidateCache();
      await loadOrders();
      setActiveOrder(null);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal membatalkan pesanan.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2D2E] tracking-tight">
            Orders & Sales
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Kelola pesanan lintas kanal, status operasional terpisah dari verifikasi pembayaran manual.
          </p>
        </div>
        <button
          type="button"
          disabled={businesses.length === 0}
          onClick={openCreateOrderModal}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B3B3C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Buat Pesanan Baru
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari no. pesanan atau nama pelanggan..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs focus:border-[#0B3B3C] focus:outline-none"
          />
        </div>
        <select
          value={orderStatusFilter}
          onChange={(e) => setOrderStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
        >
          <option value="">Semua Status Pesanan</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Dikonfirmasi</option>
          <option value="processing">Diproses</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
        <select
          value={paymentStatusFilter}
          onChange={(e) => setPaymentStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
        >
          <option value="">Semua Status Bayar</option>
          <option value="pending">Pending</option>
          <option value="waiting_verification">Menunggu Verifikasi</option>
          <option value="paid">Lunas (Paid)</option>
          <option value="failed">Gagal</option>
          <option value="refunded">Refund</option>
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={loadOrders} />}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Belum ada pesanan"
          description="Buat pesanan baru untuk menguji alur pengurangan stok otomatis dan verifikasi pembayaran manual."
          action={
            businesses.length > 0 ? (
              <button
                type="button"
                onClick={openCreateOrderModal}
                className="rounded-lg bg-[#0B3B3C] px-4 py-2 text-xs font-medium text-white hover:bg-[#134E4F]"
              >
                Buat Pesanan Pertama
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-[#E5EFEF] bg-white overflow-hidden shadow-[0_2px_10px_rgba(11,59,60,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F8F8] text-[#4E6E6F] border-b border-[#E5EFEF]">
                <tr>
                  <th className="px-4 py-3 font-medium">No. Pesanan & Waktu</th>
                  <th className="px-4 py-3 font-medium">Usaha & Kanal</th>
                  <th className="px-4 py-3 font-medium">Pelanggan</th>
                  <th className="px-4 py-3 font-medium">Status Pesanan</th>
                  <th className="px-4 py-3 font-medium">Pembayaran</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-slate-900">
                        {ord.order_number}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatDateWib(ord.created_at)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{ord.business_name}</p>
                      <div className="mt-1">
                        <StatusBadge status={ord.channel} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{ord.customer_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {ord.customer_contact || `${ord.items.length} item`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ord.order_status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ord.payment_status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatIdr(ord.total_idr)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetailDrawer(ord)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Kelola
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Order */}
      <Modal
        open={createOpen}
        title="Buat Pesanan Baru"
        subtitle="Pesanan otomatis memotong stok di lokasi utama dan dilindungi Idempotency Key."
        onClose={() => setCreateOpen(false)}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Usaha *
              </label>
              <select
                required
                value={formBizId}
                onChange={(e) => {
                  setFormBizId(e.target.value);
                  loadBizProducts(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Asal Kanal Pesanan
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as OrderChannel)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                <option value="manual">Input Manual Admin</option>
                <option value="website">Website Usaha</option>
                <option value="pos">Aplikasi Kasir (POS)</option>
                <option value="marketplace">Marketplace</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Pelanggan *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama pembeli"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kontak Pelanggan (Opsional)
              </label>
              <input
                type="text"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder="No HP / Email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Item Produk / Layanan
              </span>
              {bizProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDraftItems([
                      ...draftItems,
                      { product_id: bizProducts[0].id, qty: 1 },
                    ])
                  }
                  className="text-xs font-medium text-slate-900 hover:underline"
                >
                  + Tambah Item
                </button>
              )}
            </div>
            {bizProducts.length === 0 ? (
              <p className="text-xs text-slate-500">
                Usaha ini belum memiliki produk aktif. Tambahkan produk di menu Product & Catalog.
              </p>
            ) : (
              draftItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    value={item.product_id}
                    onChange={(e) => {
                      const next = [...draftItems];
                      next[idx] = { ...item, product_id: e.target.value };
                      setDraftItems(next);
                    }}
                    className="col-span-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {bizProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} ({formatIdr(p.base_price_idr)}
                        {p.track_inventory ? ` | Stok: ${p.total_available_stock}` : ''})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => {
                      const next = [...draftItems];
                      next[idx] = { ...item, qty: Math.max(1, Number(e.target.value) || 1) };
                      setDraftItems(next);
                    }}
                    className="col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={draftItems.length === 1}
                    onClick={() =>
                      setDraftItems(draftItems.filter((_, i) => i !== idx))
                    }
                    className="col-span-1 flex justify-center text-slate-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                <option value="bank_transfer">Transfer Bank</option>
                <option value="qris">QRIS</option>
                <option value="cash">Tunai</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Rekening / Tujuan Bayar
              </label>
              <input
                type="text"
                value={destAccount}
                onChange={(e) => setDestAccount(e.target.value)}
                placeholder="Misal: BCA a.n. Pemilik"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Diskon (IDR)
              </label>
              <input
                type="number"
                min={0}
                value={discountIdr}
                onChange={(e) => setDiscountIdr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
          </div>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan pesanan (opsional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-medium text-slate-600">
              Estimasi Total Transaksi
            </span>
            <span className="text-base font-bold text-slate-900 tabular-nums">
              {formatIdr(draftTotal)}
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || draftItems.length === 0}
              className="rounded-lg bg-[#0B3B3C] px-4 py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-60"
            >
              {submitting ? 'Memproses...' : 'Simpan Pesanan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Drawer: Order Details & Manual Payment Verification */}
      <Drawer
        open={Boolean(activeOrder)}
        title={activeOrder ? `Pesanan ${activeOrder.order_number}` : ''}
        subtitle={
          activeOrder
            ? `${activeOrder.business_name} · ${formatDateWib(activeOrder.created_at)}`
            : ''
        }
        onClose={() => setActiveOrder(null)}
      >
        {activeOrder && (
          <div className="space-y-6 text-xs">
            {/* Summary */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggan</span>
                <span className="font-medium text-slate-900">
                  {activeOrder.customer_name}
                  {activeOrder.customer_contact
                    ? ` (${activeOrder.customer_contact})`
                    : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kanal</span>
                <StatusBadge status={activeOrder.channel} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Pesanan</span>
                <StatusBadge status={activeOrder.order_status} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Pembayaran</span>
                <StatusBadge status={activeOrder.payment_status} />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Rincian Item
              </h3>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {activeOrder.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {it.product_name_snapshot}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {it.sku_snapshot} · {it.qty} × {formatIdr(it.unit_price_idr)}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatIdr(it.line_total_idr)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2.5 bg-slate-50 font-semibold text-slate-900">
                  <span>Total</span>
                  <span className="tabular-nums">{formatIdr(activeOrder.total_idr)}</span>
                </div>
              </div>
            </div>

            {/* Independent Order Status Update */}
            {activeOrder.order_status !== 'cancelled' && (
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Update Status Pesanan (Operasional)
                </h3>
                <div className="flex gap-2">
                  <select
                    value={nextOrderStatus}
                    onChange={(e) => setNextOrderStatus(e.target.value as OrderStatus)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Dikonfirmasi</option>
                    <option value="processing">Diproses</option>
                    <option value="completed">Selesai</option>
                    <option value="refunded">Refunded</option>
                  </select>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleUpdateOrderStatus}
                    className="rounded-lg bg-[#0B3B3C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-60"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}

            {/* Independent Manual Payment Verification */}
            <form
              onSubmit={handleUpdatePayment}
              className="border-t border-slate-200 pt-4 space-y-3"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Verifikasi Pembayaran Manual (Transfer / QRIS)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">
                Status pembayaran dipisah dari status pesanan. Mengisi bukti transfer tidak otomatis melunaskan tanpa verifikasi admin.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Status Pembayaran
                </label>
                <select
                  value={nextPayStatus}
                  onChange={(e) => setNextPayStatus(e.target.value as PaymentStatus)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="pending">Pending</option>
                  <option value="waiting_verification">Waiting Verification (Bukti Diterima)</option>
                  <option value="paid">Paid (Diverifikasi Lunas oleh Admin)</option>
                  <option value="failed">Failed (Tidak Valid / Ditolak)</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tautan Bukti Pembayaran (Opsional)
                </label>
                <input
                  type="text"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://... (link bukti transfer)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Verifikasi Admin
                </label>
                <input
                  type="text"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Contoh: Mutasi BCA masuk jam 14:20"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#0B3B3C] py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-60"
              >
                {submitting ? 'Memperbarui...' : 'Simpan Verifikasi Pembayaran'}
              </button>
            </form>

            {/* Cancel Order (Auto Restock) */}
            {activeOrder.order_status !== 'cancelled' && (
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                  <Ban className="h-3.5 w-3.5" />
                  Pembatalan Pesanan
                </h3>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Alasan pembatalan (stok akan dikembalikan otomatis)"
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCancelOrder}
                  className="w-full rounded-lg border border-rose-300 bg-rose-50 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  Batalkan Pesanan & Kembalikan Stok
                </button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
