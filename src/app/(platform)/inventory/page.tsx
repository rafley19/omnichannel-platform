'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  History,
  PackageCheck,
  Search,
} from 'lucide-react';
import { usePlatform } from '@/components/PlatformContext';
import {
  EmptyState,
  ErrorState,
  Modal,
  StatusBadge,
  TableSkeleton,
} from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api-client';
import { formatDateWib } from '@/lib/format';
import type {
  InventoryWithDetails,
  MovementWithDetails,
} from '@/services/inventory.service';
import type { ProductWithDetails } from '@/services/product.service';

export default function InventoryPage() {
  const {
    businesses,
    selectedBusinessId,
    invalidateCache,
    showToast,
  } = usePlatform();

  const [tab, setTab] = useState<'balances' | 'ledger'>('balances');
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [movements, setMovements] = useState<MovementWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  // Movement modal state
  const [moveOpen, setMoveOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formBizId, setFormBizId] = useState('');
  const [formProducts, setFormProducts] = useState<ProductWithDetails[]>([]);
  const [formProductId, setFormProductId] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formType, setFormType] = useState<
    'stock_in' | 'stock_out' | 'adjustment' | 'return' | 'opname'
  >('stock_in');
  const [formQty, setFormQty] = useState('1');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedBusinessId) params.set('business_id', selectedBusinessId);
      if (search.trim()) params.set('search', search.trim());
      if (lowOnly) params.set('low_stock', 'true');

      const [invRes, movRes] = await Promise.all([
        apiFetch<InventoryWithDetails[]>(`/api/v1/inventory?${params.toString()}`),
        apiFetch<MovementWithDetails[]>(
          `/api/v1/inventory/movements?${
            selectedBusinessId ? `business_id=${selectedBusinessId}&` : ''
          }limit=100`
        ),
      ]);
      setInventory(invRes.data);
      setMovements(movRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data stok.');
    } finally {
      setLoading(false);
    }
  }, [lowOnly, search, selectedBusinessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadBizProducts = useCallback(async (businessId: string) => {
    if (!businessId) {
      setFormProducts([]);
      return;
    }
    try {
      const res = await apiFetch<ProductWithDetails[]>(
        `/api/v1/products?business_id=${businessId}&status=active&limit=200`
      );
      const tracked = res.data.filter((p) => p.track_inventory);
      setFormProducts(tracked);
      setFormProductId(tracked[0]?.id ?? '');
    } catch {
      setFormProducts([]);
    }
  }, []);

  function openMovementModal(preset?: InventoryWithDetails) {
    const targetBizId = preset?.business_id || selectedBusinessId || businesses[0]?.id || '';
    setFormBizId(targetBizId);
    const biz = businesses.find((b) => b.id === targetBizId);
    setFormLocationId(preset?.location_id || biz?.locations[0]?.id || '');
    setFormType('stock_in');
    setFormQty('1');
    setFormNotes('');
    setMoveOpen(true);

    loadBizProducts(targetBizId).then(() => {
      if (preset?.product_id) setFormProductId(preset.product_id);
    });
  }

  async function handleSubmitMovement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formBizId || !formProductId || !formLocationId) {
      showToast('error', 'Lengkapi usaha, produk, dan lokasi terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          business_id: formBizId,
          product_id: formProductId,
          location_id: formLocationId,
          movement_type: formType,
          qty: Number(formQty),
          notes: formNotes.trim(),
        }),
      });
      showToast('success', 'Pergerakan stok berhasil dicatat pada inventory ledger.');
      setMoveOpen(false);
      invalidateCache();
      await loadData();
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal mencatat pergerakan stok.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const formBiz = businesses.find((b) => b.id === formBizId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2D2E] tracking-tight">
            Inventory Management
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Pantau stok per lokasi & catat seluruh mutasi melalui buku besar stok (Inventory Ledger).
          </p>
        </div>
        <button
          type="button"
          disabled={businesses.length === 0}
          onClick={() => openMovementModal()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B3B3C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-50 transition-colors"
        >
          <ArrowDownUp className="h-4 w-4" />
          Catat Pergerakan Stok
        </button>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[#E5EFEF] bg-white p-1 w-fit">
          <button
            type="button"
            onClick={() => setTab('balances')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'balances'
                ? 'bg-[#0B3B3C] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PackageCheck className="h-3.5 w-3.5" />
            Saldo Stok ({inventory.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('ledger')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'ledger'
                ? 'bg-[#0B3B3C] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Riwayat Pergerakan ({movements.length})
          </button>
        </div>

        {tab === 'balances' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk, SKU, lokasi..."
                className="rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-[#0B3B3C] focus:outline-none"
              />
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(e) => setLowOnly(e.target.checked)}
              />
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Hanya Stok Menipis</span>
            </label>
          </div>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={loadData} />}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : tab === 'balances' ? (
        inventory.length === 0 ? (
          <EmptyState
            title="Belum ada catatan stok"
            description="Tambahkan produk fisik dengan pelacakan stok aktif di menu Product & Catalog, atau catat stok masuk baru."
            action={
              businesses.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openMovementModal()}
                  className="rounded-lg bg-[#0B3B3C] px-4 py-2 text-xs font-medium text-white hover:bg-[#134E4F]"
                >
                  Catat Stok Masuk
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
                    <th className="px-4 py-3 font-medium">Produk & SKU</th>
                    <th className="px-4 py-3 font-medium">Usaha / Lokasi</th>
                    <th className="px-4 py-3 font-medium text-right">Fisik</th>
                    <th className="px-4 py-3 font-medium text-right">Dipesan</th>
                    <th className="px-4 py-3 font-medium text-right">Tersedia</th>
                    <th className="px-4 py-3 font-medium">Kondisi</th>
                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {inv.product_name}
                          {inv.variant_name ? ` — ${inv.variant_name}` : ''}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          {inv.product_sku}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800 font-medium">{inv.business_name}</p>
                        <p className="text-[11px] text-slate-500">{inv.location_name}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {inv.qty_on_hand}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {inv.qty_reserved}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          inv.is_low_stock ? 'text-rose-700' : 'text-slate-900'
                        }`}
                      >
                        {inv.qty_available}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={inv.is_low_stock ? 'low_stock' : 'in_stock'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openMovementModal(inv)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          Mutasi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : movements.length === 0 ? (
        <EmptyState
          title="Riwayat pergerakan stok masih kosong"
          description="Setiap stok masuk, penjualan, pembatalan, maupun penyesuaian akan tercatat permanen di sini."
        />
      ) : (
        <div className="rounded-2xl border border-[#E5EFEF] bg-white overflow-hidden shadow-[0_2px_10px_rgba(11,59,60,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F8F8] text-[#4E6E6F] border-b border-[#E5EFEF]">
                <tr>
                  <th className="px-4 py-3 font-medium">Waktu (WIB)</th>
                  <th className="px-4 py-3 font-medium">Usaha / Produk</th>
                  <th className="px-4 py-3 font-medium">Jenis Mutasi</th>
                  <th className="px-4 py-3 font-medium text-right">Perubahan</th>
                  <th className="px-4 py-3 font-medium text-right">Sebelum → Sesudah</th>
                  <th className="px-4 py-3 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDateWib(m.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{m.product_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {m.business_name} · {m.location_name}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.movement_type} />
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        m.qty_delta > 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {m.qty_delta > 0 ? `+${m.qty_delta}` : m.qty_delta}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {m.qty_before} → {m.qty_after}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs">
                      {m.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Record Stock Movement */}
      <Modal
        open={moveOpen}
        title="Catat Pergerakan Stok (Ledger)"
        subtitle="Semua perubahan stok dicatat dengan alasan yang jelas untuk mencegah selisih."
        onClose={() => setMoveOpen(false)}
      >
        <form onSubmit={handleSubmitMovement} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Usaha *
              </label>
              <select
                required
                value={formBizId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFormBizId(id);
                  const b = businesses.find((x) => x.id === id);
                  setFormLocationId(b?.locations[0]?.id ?? '');
                  loadBizProducts(id);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Lokasi *
              </label>
              <select
                required
                value={formLocationId}
                onChange={(e) => setFormLocationId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                {(formBiz?.locations ?? []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Produk *
            </label>
            <select
              required
              value={formProductId}
              onChange={(e) => setFormProductId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            >
              {formProducts.length === 0 ? (
                <option value="">Tidak ada produk dengan pelacakan stok</option>
              ) : (
                formProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jenis Mutasi *
              </label>
              <select
                value={formType}
                onChange={(e) =>
                  setFormType(
                    e.target.value as
                      | 'stock_in'
                      | 'stock_out'
                      | 'adjustment'
                      | 'return'
                      | 'opname'
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                <option value="stock_in">Stok Masuk (+)</option>
                <option value="stock_out">Stok Keluar (-)</option>
                <option value="return">Retur Pelanggan (+)</option>
                <option value="adjustment">Penyesuaian (+/-)</option>
                <option value="opname">Selisih Stock Opname (+/-)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jumlah {formType === 'adjustment' || formType === 'opname' ? '(boleh minus)' : ''} *
              </label>
              <input
                type="number"
                required
                value={formQty}
                onChange={(e) => setFormQty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Penyebab Mutasi *
            </label>
            <input
              type="text"
              required
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Contoh: Restock supplier batch #12 / Barang rusak"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setMoveOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || formProducts.length === 0}
              className="rounded-lg bg-[#0B3B3C] px-4 py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-60"
            >
              {submitting ? 'Mencatat...' : 'Simpan Mutasi Stok'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
