'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePlatform } from '@/components/PlatformContext';
import {
  EmptyState,
  ErrorState,
  StatusBadge,
  TableSkeleton,
} from '@/components/ui/Primitives';
import { apiFetch } from '@/lib/api-client';
import { formatDateWib, formatIdr, formatShortDateWib } from '@/lib/format';
import type { DashboardSummary } from '@/services/dashboard.service';

export default function DashboardPage() {
  const { selectedBusinessId, selectedBusiness, getCache, setCache, invalidateCache } =
    usePlatform();
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const cacheKey = `dashboard:${selectedBusinessId || 'all'}:${days}`;

  const loadSummary = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = getCache<DashboardSummary>(cacheKey);
        if (cached) {
          setData(cached);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ days: String(days) });
        if (selectedBusinessId) params.set('business_id', selectedBusinessId);
        const res = await apiFetch<DashboardSummary>(
          `/api/v1/dashboard/summary?${params.toString()}`
        );
        setData(res.data);
        setCache(cacheKey, res.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Gagal memuat ringkasan dashboard.'
        );
      } finally {
        setLoading(false);
      }
    },
    [cacheKey, days, getCache, selectedBusinessId, setCache]
  );

  useEffect(() => {
    loadSummary(false);
  }, [loadSummary]);

  function handleForceRefresh() {
    invalidateCache('dashboard:');
    loadSummary(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Dashboard Operasional
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {selectedBusiness
              ? `Menampilkan ringkasan usaha ${selectedBusiness.name} (${selectedBusiness.code})`
              : 'Ringkasan gabungan dari seluruh usaha yang Anda kelola'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-none"
          >
            <option value={7}>7 Hari Terakhir</option>
            <option value={30}>30 Hari Terakhir</option>
            <option value={90}>90 Hari Terakhir</option>
          </select>
          <button
            type="button"
            onClick={handleForceRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={handleForceRefresh} />}

      {loading && !data ? (
        <TableSkeleton rows={6} />
      ) : data ? (
        <>
          {/* 4-Column KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Total Penjualan</span>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-lg sm:text-xl font-semibold text-slate-900 tabular-nums">
                {formatIdr(data.total_sales_idr)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Periode {days} hari (di luar batal)
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Pembayaran Lunas</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-2 text-lg sm:text-xl font-semibold text-emerald-700 tabular-nums">
                {formatIdr(data.paid_sales_idr)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {data.payment_breakdown.waiting_verification} menunggu verifikasi
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Total Pesanan</span>
                <ShoppingBag className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-lg sm:text-xl font-semibold text-slate-900 tabular-nums">
                {data.total_orders}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {data.active_businesses_count} usaha aktif · {data.total_products_count} produk
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Stok Menipis</span>
                <AlertTriangle
                  className={`h-4 w-4 ${
                    data.low_stock_count > 0 ? 'text-amber-500' : 'text-slate-400'
                  }`}
                />
              </div>
              <p
                className={`mt-2 text-lg sm:text-xl font-semibold tabular-nums ${
                  data.low_stock_count > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {data.low_stock_count} SKU
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Total {data.total_stock_units} unit tersedia
              </p>
            </div>
          </div>

          {/* Chart & Payment Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Tren Penjualan Harian
                  </h2>
                  <p className="text-xs text-slate-500">
                    Akumulasi omzet pesanan aktif per hari
                  </p>
                </div>
              </div>
              {data.daily_sales.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  Belum ada data penjualan pada periode ini.
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily_sales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => formatShortDateWib(String(v))}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${Math.round(Number(v) / 1000)}rb`}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={54}
                      />
                      <Tooltip
                        formatter={(val) => [formatIdr(Number(val)), 'Penjualan']}
                        labelFormatter={(label) => `Tanggal ${label}`}
                        contentStyle={{
                          borderRadius: '8px',
                          borderColor: '#e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="sales_idr" fill="#0f172a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Status Pembayaran
                </h2>
                <p className="text-xs text-slate-500">
                  Distribusi status verifikasi pembayaran manual
                </p>
                <div className="mt-4 space-y-2.5 text-xs">
                  {[
                    { key: 'paid', label: 'Lunas (Paid)', count: data.payment_breakdown.paid },
                    {
                      key: 'waiting_verification',
                      label: 'Menunggu Verifikasi',
                      count: data.payment_breakdown.waiting_verification,
                    },
                    { key: 'pending', label: 'Pending', count: data.payment_breakdown.pending },
                    { key: 'failed', label: 'Gagal', count: data.payment_breakdown.failed },
                    { key: 'refunded', label: 'Refund', count: data.payment_breakdown.refunded },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
                    >
                      <StatusBadge status={item.key} customLabel={item.label} />
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href="/orders"
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Kelola Pesanan & Pembayaran
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Per-Business Comparison & Low Stock Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Performa Per Usaha
                  </h2>
                </div>
                <Link
                  href="/businesses"
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Kelola Usaha
                </Link>
              </div>
              {data.business_performance.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Belum ada usaha terdaftar"
                    description="Tambahkan usaha pertama Anda (misalnya Fashion, Makanan, atau Jasa) untuk mulai mengelola katalog, stok, dan pesanan."
                    action={
                      <Link
                        href="/businesses"
                        className="inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Tambah Usaha Pertama
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Usaha</th>
                        <th className="px-4 py-2.5 font-medium">Bidang</th>
                        <th className="px-4 py-2.5 font-medium text-right">Pesanan</th>
                        <th className="px-4 py-2.5 font-medium text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.business_performance.map((b) => (
                        <tr key={b.business_id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {b.business_name}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={b.category} />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {b.orders_count}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                            {formatIdr(b.sales_idr)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Produk dengan Stok Menipis
                  </h2>
                </div>
                <Link
                  href="/inventory"
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Lihat Inventory
                </Link>
              </div>
              {data.low_stock_items.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Tidak ada produk dengan stok di bawah batas minimum.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Produk</th>
                        <th className="px-4 py-2.5 font-medium">Lokasi</th>
                        <th className="px-4 py-2.5 font-medium text-right">Tersedia</th>
                        <th className="px-4 py-2.5 font-medium text-right">Batas Min</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.low_stock_items.map((item) => (
                        <tr key={item.inventory_id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {item.product_name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {item.business_name} · {item.sku}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.location_name}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-rose-700 tabular-nums">
                            {item.qty_available}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                            {item.threshold}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Pesanan Terbaru
              </h2>
              <Link
                href="/orders"
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Lihat Semua
              </Link>
            </div>
            {data.recent_orders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada pesanan yang tercatat.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">No. Pesanan</th>
                      <th className="px-4 py-2.5 font-medium">Usaha</th>
                      <th className="px-4 py-2.5 font-medium">Pelanggan</th>
                      <th className="px-4 py-2.5 font-medium">Kanal</th>
                      <th className="px-4 py-2.5 font-medium">Status Pesanan</th>
                      <th className="px-4 py-2.5 font-medium">Pembayaran</th>
                      <th className="px-4 py-2.5 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recent_orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-mono font-medium text-slate-900">
                            {ord.order_number}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatDateWib(ord.created_at)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{ord.business_name}</td>
                        <td className="px-4 py-3 text-slate-900 font-medium">
                          {ord.customer_name}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={ord.channel} />
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
