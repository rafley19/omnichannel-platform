'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Plus, Power, Search, Trash2 } from 'lucide-react';
import { usePlatform } from '@/components/PlatformContext';
import {
  EmptyState,
  ErrorState,
  Modal,
  StatusBadge,
  TableSkeleton,
} from '@/components/ui/Primitives';
import type { ProductType } from '@/db/types';
import { apiFetch } from '@/lib/api-client';
import { formatIdr } from '@/lib/format';
import type { ProductWithDetails } from '@/services/product.service';

interface VariantDraft {
  sku: string;
  variant_name: string;
  price_idr: string;
}

export default function ProductsPage() {
  const {
    businesses,
    selectedBusinessId,
    invalidateCache,
    showToast,
  } = usePlatform();

  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductWithDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [bizId, setBizId] = useState('');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [productType, setProductType] = useState<ProductType>('physical');
  const [basePrice, setBasePrice] = useState('0');
  const [description, setDescription] = useState('');
  const [trackInventory, setTrackInventory] = useState(true);
  const [initialStock, setInitialStock] = useState('0');
  const [lowThreshold, setLowThreshold] = useState('5');
  const [variants, setVariants] = useState<VariantDraft[]>([]);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('0');
  const [editDesc, setEditDesc] = useState('');
  const [editActive, setEditActive] = useState(true);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (selectedBusinessId) params.set('business_id', selectedBusinessId);
      if (search.trim()) params.set('search', search.trim());
      const res = await apiFetch<ProductWithDetails[]>(
        `/api/v1/products?${params.toString()}`
      );
      setProducts(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat katalog produk.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedBusinessId, statusFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function openCreateModal() {
    setBizId(selectedBusinessId || businesses[0]?.id || '');
    setSku('');
    setName('');
    setCategory('');
    setProductType('physical');
    setBasePrice('0');
    setDescription('');
    setTrackInventory(true);
    setInitialStock('0');
    setLowThreshold('5');
    setVariants([]);
    setCreateOpen(true);
  }

  function openEditModal(p: ProductWithDetails) {
    setEditTarget(p);
    setEditName(p.name);
    setEditCategory(p.category);
    setEditPrice(String(p.base_price_idr));
    setEditDesc(p.description);
    setEditActive(p.is_active);
  }

  async function handleCreateProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!bizId) {
      showToast('error', 'Pilih usaha terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    try {
      const validVariants = variants
        .filter((v) => v.sku.trim() && v.variant_name.trim())
        .map((v) => ({
          sku: v.sku.trim(),
          variant_name: v.variant_name.trim(),
          price_idr: Number(v.price_idr) || Number(basePrice) || 0,
        }));

      await apiFetch('/api/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          business_id: bizId,
          sku: sku.trim(),
          name: name.trim(),
          category: category.trim() || 'Umum',
          product_type: productType,
          description: description.trim(),
          base_price_idr: Number(basePrice) || 0,
          track_inventory: productType === 'service' ? false : trackInventory,
          initial_stock: Number(initialStock) || 0,
          low_stock_threshold: Number(lowThreshold) || 5,
          variants: validVariants.length > 0 ? validVariants : undefined,
        }),
      });
      showToast('success', `Produk "${name.trim()}" berhasil ditambahkan.`);
      setCreateOpen(false);
      invalidateCache();
      await loadProducts();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menambah produk.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/products/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory.trim(),
          base_price_idr: Number(editPrice) || 0,
          description: editDesc.trim(),
          is_active: editActive,
        }),
      });
      showToast('success', 'Produk berhasil diperbarui.');
      setEditTarget(null);
      invalidateCache();
      await loadProducts();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui produk.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(p: ProductWithDetails) {
    try {
      await apiFetch(`/api/v1/products/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      showToast(
        'info',
        `Produk "${p.name}" ${p.is_active ? 'dinonaktifkan' : 'diaktifkan kembali'}.`
      );
      invalidateCache();
      await loadProducts();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengubah status.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2D2E] tracking-tight">
            Product & Catalog
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Kelola katalog produk fisik maupun layanan beserta SKU, variasi, dan harga jual IDR.
          </p>
        </div>
        <button
          type="button"
          disabled={businesses.length === 0}
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B3B3C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Produk / Jasa
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama produk, SKU, atau kategori..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs focus:border-[#0B3B3C] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={loadProducts} />}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : products.length === 0 ? (
        <EmptyState
          title="Belum ada produk pada katalog"
          description={
            businesses.length === 0
              ? 'Tambahkan usaha terlebih dahulu di menu Business Management sebelum membuat katalog produk.'
              : 'Mulai tambahkan produk atau layanan untuk usaha Anda.'
          }
          action={
            businesses.length > 0 ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-lg bg-[#0B3B3C] px-4 py-2 text-xs font-medium text-white hover:bg-[#134E4F]"
              >
                Tambah Produk Pertama
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
                  <th className="px-4 py-3 font-medium">SKU & Produk</th>
                  <th className="px-4 py-3 font-medium">Usaha</th>
                  <th className="px-4 py-3 font-medium">Kategori / Tipe</th>
                  <th className="px-4 py-3 font-medium text-right">Harga Jual</th>
                  <th className="px-4 py-3 font-medium text-right">Stok Tersedia</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-[11px] font-mono text-slate-500">
                        {p.sku}
                        {p.variants.length > 0
                          ? ` · ${p.variants.length} variasi`
                          : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.business_name}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{p.category}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.product_type === 'service' ? 'Layanan / Jasa' : 'Produk Fisik'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatIdr(p.base_price_idr)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {p.track_inventory ? p.total_available_stock : 'Non-Stok'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Edit produk"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title={p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Product */}
      <Modal
        open={createOpen}
        title="Tambah Produk / Layanan"
        subtitle="Produk yang melacak stok otomatis dibuatkan saldo awal pada lokasi utama usaha."
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Usaha Terkait *
              </label>
              <select
                required
                value={bizId}
                onChange={(e) => setBizId(e.target.value)}
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
                SKU / Kode Produk *
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="Misal: KJN-001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nama Produk / Layanan *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kemeja Linen Oversize"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tipe *
              </label>
              <select
                value={productType}
                onChange={(e) => {
                  const val = e.target.value as ProductType;
                  setProductType(val);
                  if (val === 'service') setTrackInventory(false);
                  else setTrackInventory(true);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                <option value="physical">Produk Fisik</option>
                <option value="service">Layanan / Jasa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kategori
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Atasan / Makanan / Jasa"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Harga Jual (IDR) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
          </div>

          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi singkat produk atau layanan..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />

          {productType === 'physical' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={trackInventory}
                  onChange={(e) => setTrackInventory(e.target.checked)}
                />
                <span>Lacak stok pada Inventory Management</span>
              </label>
              {trackInventory && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Stok Awal (di Lokasi Utama)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Batas Peringatan Stok Menipis
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={lowThreshold}
                      onChange={(e) => setLowThreshold(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optional Variants */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">
                Variasi Produk (Opsional — misal Ukuran / Warna)
              </span>
              <button
                type="button"
                onClick={() =>
                  setVariants([
                    ...variants,
                    { sku: '', variant_name: '', price_idr: basePrice },
                  ])
                }
                className="text-xs font-medium text-slate-900 hover:underline"
              >
                + Tambah Variasi
              </button>
            </div>
            {variants.map((v, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={v.sku}
                  onChange={(e) => {
                    const next = [...variants];
                    next[idx] = { ...v, sku: e.target.value.toUpperCase() };
                    setVariants(next);
                  }}
                  placeholder="SKU Variasi"
                  className="col-span-4 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono uppercase"
                />
                <input
                  type="text"
                  value={v.variant_name}
                  onChange={(e) => {
                    const next = [...variants];
                    next[idx] = { ...v, variant_name: e.target.value };
                    setVariants(next);
                  }}
                  placeholder="Nama (mis: Size L)"
                  className="col-span-4 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={v.price_idr}
                  onChange={(e) => {
                    const next = [...variants];
                    next[idx] = { ...v, price_idr: e.target.value };
                    setVariants(next);
                  }}
                  placeholder="Harga"
                  className="col-span-3 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
                <button
                  type="button"
                  onClick={() =>
                    setVariants(variants.filter((_, i) => i !== idx))
                  }
                  className="col-span-1 flex justify-center text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#0B3B3C] px-4 py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-60"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Product */}
      <Modal
        open={Boolean(editTarget)}
        title={editTarget ? `Edit ${editTarget.name}` : ''}
        subtitle={editTarget ? `SKU: ${editTarget.sku}` : ''}
        onClose={() => setEditTarget(null)}
      >
        <form onSubmit={handleUpdateProduct} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nama Produk
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kategori
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Harga Jual (IDR)
              </label>
              <input
                type="number"
                required
                min={0}
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
          </div>
          <textarea
            rows={2}
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
            />
            <span>Produk aktif di katalog</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#0B3B3C] px-4 py-2 text-xs font-medium text-white hover:bg-[#134E4F] disabled:opacity-60"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
