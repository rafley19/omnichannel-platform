'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  RefreshCw,
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

function MiniBarSparkline({
  values,
  color = '#4ADE80',
}: {
  values: number[];
  color?: string;
}) {
  const safeValues = values.length > 0 ? values.slice(-5) : [0, 0, 0, 0, 0];
  while (safeValues.length < 5) safeValues.unshift(0);
  const maxVal = Math.max(1, ...safeValues);

  return (
    <svg
      width="56"
      height="36"
      viewBox="0 0 56 36"
      className="shrink-0"
      aria-hidden="true"
    >
      {safeValues.map((val, idx) => {
        const ratio = val > 0 ? Math.max(0.22, val / maxVal) : 0.18;
        const barH = Math.round(ratio * 30);
        const x = idx * 11;
        const y = 34 - barH;
        const fillOpacity = idx === 4 ? 1 : 0.45 + idx * 0.1;
        return (
          <rect
            key={idx}
            x={x}
            y={y}
            width="7"
            height={barH}
            rx="2.5"
            fill={color}
            fillOpacity={val > 0 ? fillOpacity : 0.25}
          />
        );
      })}
    </svg>
  );
}

function SemicircleGauge({ percentage }: { percentage: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = 56;
  const cx = 74;
  const cy = 72;
  const arcLen = Math.PI * radius;
  const filledLen = (clamped / 100) * arcLen;

  return (
    <svg
      width="148"
      height="86"
      viewBox="0 0 148 86"
      className="mx-auto"
      aria-label={`Rasio pembayaran lunas ${clamped}%`}
    >
      {/* Background Dark Pine Track */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="#0B3B3C"
        strokeWidth="22"
        strokeLinecap="butt"
      />
      {/* Active Emerald Arch */}
      {clamped > 0 && (
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#2ED47A"
          strokeWidth="22"
          strokeDasharray={`${filledLen} ${arcLen}`}
          strokeLinecap="butt"
        />
      )}
    </svg>
  );
}

function MiniRingBadge({
  value,
  ringColor,
  trackColor,
  textColor,
}: {
  value: number | string;
  ringColor: string;
  trackColor: string;
  textColor: string;
}) {
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          stroke={trackColor}
          strokeWidth="4.5"
        />
        <circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          stroke={ringColor}
          strokeWidth="4.5"
          strokeDasharray="88 120"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`absolute text-xs font-bold tabular-nums ${textColor}`}
      >
        {value}
      </span>
    </div>
  );
}

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

  const paidRatio = useMemo(() => {
    if (!data || data.total_orders === 0) return 0;
    return Math.round((data.payment_breakdown.paid / data.total_orders) * 100);
  }, [data]);

  const dailySalesValues = useMemo(
    () => (data?.daily_sales ?? []).map((d) => d.sales_idr),
    [data]
  );
  const dailyOrderValues = useMemo(
    () => (data?.daily_sales ?? []).map((d) => d.orders),
    [data]
  );

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2D2E] tracking-tight">
            Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-[#567475]">
            {selectedBusiness
              ? `Ringkasan operasional usaha ${selectedBusiness.name} (${selectedBusiness.code})`
              : 'Ringkasan gabungan real-time dari seluruh usaha yang Anda kelola'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-xl border border-[#D5E3E3] bg-white px-3 py-2 text-xs font-medium text-[#0B2D2E] focus:border-[#0B3B3C] focus:outline-none"
          >
            <option value={7}>7 Hari Terakhir</option>
            <option value={30}>30 Hari Terakhir</option>
            <option value={90}>90 Hari Terakhir</option>
          </select>
          <button
            type="button"
            onClick={handleForceRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3B3C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#134E4F] transition-colors shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={handleForceRefresh} />}

      {loading && !data ? (
        <TableSkeleton rows={6} />
      ) : data ? (
        <>
          {/* Row 1: 3 Top Bento KPI Cards with Mini Vertical Sparklines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[#E5EFEF] bg-white p-5 shadow-[0_2px_10px_rgba(11,59,60,0.03)] flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#567475]">
                  Total Penjualan ({days} Hari)
                </p>
                <p className="mt-2 text-2xl font-bold text-[#0B2D2E] tabular-nums truncate">
                  {formatIdr(data.total_sales_idr)}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-[#1E8E5A]">
                  {data.total_orders} pesanan tercatat
                </p>
              </div>
              <MiniBarSparkline values={dailySalesValues} color="#4ADE80" />
            </div>

            <div className="rounded-2xl border border-[#E5EFEF] bg-white p-5 shadow-[0_2px_10px_rgba(11,59,60,0.03)] flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#567475]">
                  Pembayaran Terverifikasi Lunas
                </p>
                <p className="mt-2 text-2xl font-bold text-[#0B2D2E] tabular-nums truncate">
                  {formatIdr(data.paid_sales_idr)}
                </p>
                <p
                  className={`mt-1.5 text-[11px] font-medium ${
                    data.payment_breakdown.waiting_verification > 0
                      ? 'text-[#D66A3C]'
                      : 'text-[#1E8E5A]'
                  }`}
                >
                  {data.payment_breakdown.waiting_verification} menunggu verifikasi ·{' '}
                  {data.payment_breakdown.pending} pending
                </p>
              </div>
              <MiniBarSparkline
                values={dailyOrderValues}
                color={
                  data.payment_breakdown.waiting_verification > 0
                    ? '#E07A7A'
                    : '#4ADE80'
                }
              />
            </div>

            <div className="rounded-2xl border border-[#E5EFEF] bg-white p-5 shadow-[0_2px_10px_rgba(11,59,60,0.03)] flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#567475]">
                  Total Stok Tersedia
                </p>
                <p className="mt-2 text-2xl font-bold text-[#0B2D2E] tabular-nums">
                  {data.total_stock_units}{' '}
                  <span className="text-sm font-medium text-[#567475]">unit</span>
                </p>
                <p
                  className={`mt-1.5 text-[11px] font-medium ${
                    data.low_stock_count > 0 ? 'text-[#D66A3C]' : 'text-[#1E8E5A]'
                  }`}
                >
                  {data.low_stock_count} SKU stok menipis · {data.total_products_count} produk aktif
                </p>
              </div>
              <MiniBarSparkline
                values={[
                  data.active_businesses_count,
                  data.total_products_count,
                  data.total_orders,
                  data.payment_breakdown.paid,
                  data.low_stock_count,
                ]}
                color={data.low_stock_count > 0 ? '#E87A48' : '#4ADE80'}
              />
            </div>
          </div>

          {/* Row 2: 3-Column Bento Analytics (Gauge + Distribution + Sales Trend) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Semicircle Gauge Arch */}
            <div className="lg:col-span-3 rounded-2xl border border-[#E5EFEF] bg-white p-5 shadow-[0_2px_10px_rgba(11,59,60,0.03)] flex flex-col justify-between text-center">
              <div>
                <p className="text-xs font-semibold text-[#0B2D2E]">
                  Rasio Pelunasan
                </p>
                <p className="mt-3 text-4xl font-bold text-[#0B2D2E] tabular-nums">
                  {paidRatio}%
                </p>
              </div>
              <div className="my-3">
                <SemicircleGauge percentage={paidRatio} />
              </div>
              <p className="text-[11px] text-[#567475]">
                {data.payment_breakdown.paid} dari {data.total_orders} pesanan berstatus Lunas
              </p>
            </div>

            {/* Middle: Distribution Legend + Outlined Button */}
            <div className="lg:col-span-4 rounded-2xl border border-[#E5EFEF] bg-white p-5 shadow-[0_2px_10px_rgba(11,59,60,0.03)] flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-[#0B2D2E]">
                  Distribusi Status Pembayaran
                </p>
                <p className="mt-2 text-4xl font-bold text-[#0B2D2E] tabular-nums">
                  {data.total_orders}{' '}
                  <span className="text-xs font-normal text-[#567475]">pesanan</span>
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  {[
                    {
                      label: 'Lunas (Paid)',
                      count: data.payment_breakdown.paid,
                      dot: 'bg-[#2ED47A]',
                    },
                    {
                      label: 'Menunggu Verifikasi',
                      count: data.payment_breakdown.waiting_verification,
                      dot: 'bg-[#E87A48]',
                    },
                    {
                      label: 'Pending',
                      count: data.payment_breakdown.pending,
                      dot: 'bg-[#0B3B3C]',
                    },
                    {
                      label: 'Gagal / Refund',
                      count:
                        data.payment_breakdown.failed +
                        data.payment_breakdown.refunded,
                      dot: 'bg-rose-400',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-0.5"
                    >
                      <span className="flex items-center gap-2 text-[#4E6E6F]">
                        <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                        {item.label}
                      </span>
                      <span className="font-semibold text-[#0B2D2E] tabular-nums">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href="/orders"
                className="mt-4 inline-flex items-center justify-center rounded-xl border border-[#C9DADA] bg-white py-2 text-xs font-semibold text-[#0B3B3C] hover:bg-[#F4F7F6] transition-colors"
              >
                Kelola Orders &amp; Verifikasi
              </Link>
            </div>

            {/* Right: Daily Sales Chart */}
            <div className="lg:col-span-5 rounded-2xl border border-[#E5EFEF] bg-white p-5 shadow-[0_2px_10px_rgba(11,59,60,0.03)] flex flex-col justify-between">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-xs font-semibold text-[#0B2D2E]">
                    Tren Penjualan Harian
                  </h2>
                  <p className="text-[11px] text-[#567475]">
                    Omzet harian dari seluruh kanal aktif ({days} hari terakhir)
                  </p>
                </div>
                <span className="rounded-full bg-[#EBF4F4] px-2.5 py-0.5 text-[10px] font-semibold text-[#0B3B3C]">
                  IDR
                </span>
              </div>

              {data.daily_sales.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-[#567475] border border-dashed border-[#D5E3E3] rounded-xl bg-[#F8FAFA]">
                  Belum ada data penjualan pada periode ini.
                </div>
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily_sales}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E5EFEF"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => formatShortDateWib(String(v))}
                        tick={{ fontSize: 11, fill: '#567475' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${Math.round(Number(v) / 1000)}rb`}
                        tick={{ fontSize: 11, fill: '#567475' }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                      />
                      <Tooltip
                        formatter={(val) => [formatIdr(Number(val)), 'Penjualan']}
                        labelFormatter={(label) => `Tanggal ${label}`}
                        contentStyle={{
                          borderRadius: '12px',
                          borderColor: '#D5E3E3',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="sales_idr" fill="#0B3B3C" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: 2 Stacked Pill Strips (Left) + Deep Emerald Gradient Feature Card (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 flex flex-col gap-3.5 justify-between">
              {/* Dark Pine Pill Strip */}
              <Link
                href="/inventory"
                className="group flex items-center justify-between gap-4 rounded-[28px] bg-[#0B3B3C] px-5 py-4 text-white shadow-sm hover:bg-[#104748] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <MiniRingBadge
                    value={data.low_stock_count}
                    ringColor="#E87A48"
                    trackColor="#1A5556"
                    textColor="text-white"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Peringatan Stok Menipis
                    </p>
                    <p className="mt-0.5 text-xs text-[#A3C2C2] truncate">
                      {data.low_stock_count > 0
                        ? `${data.low_stock_count} SKU berada di bawah batas minimum stok`
                        : 'Seluruh stok produk masih dalam batas aman'}
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8BB3B3] group-hover:text-white transition-colors" />
              </Link>

              {/* Light White Pill Strip */}
              <Link
                href="/businesses"
                className="group flex items-center justify-between gap-4 rounded-[28px] border border-[#E5EFEF] bg-white px-5 py-4 shadow-[0_2px_10px_rgba(11,59,60,0.03)] hover:border-[#C9DADA] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <MiniRingBadge
                    value={data.active_businesses_count}
                    ringColor="#2ED47A"
                    trackColor="#E5EFEF"
                    textColor="text-[#0B2D2E]"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0B2D2E]">
                      Unit Usaha &amp; Katalog Aktif
                    </p>
                    <p className="mt-0.5 text-xs text-[#567475] truncate">
                      {data.active_businesses_count} usaha aktif · {data.total_products_count} produk ·{' '}
                      {data.total_stock_units} unit stok
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#7A9899] group-hover:text-[#0B3B3C] transition-colors" />
              </Link>
            </div>

            {/* Right: Deep Emerald Accent Card (Live Recent Orders Overview) */}
            <div className="lg:col-span-6 rounded-[24px] bg-gradient-to-br from-[#0B3B3C] via-[#0F4E46] to-[#177A58] p-5 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="pointer-events-none absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-[#2ED47A]/20 blur-2xl" />

              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-[#B8EFE0]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2ED47A]" />
                    Aktivitas Pesanan Terkini
                  </span>
                  <h2 className="mt-2 text-lg font-bold tracking-tight text-white">
                    Ringkasan Transaksi Lintas Usaha
                  </h2>
                </div>
                <Link
                  href="/orders"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white hover:text-[#0B3B3C] transition-colors"
                  title="Buka Orders & Sales"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="relative mt-4 space-y-2">
                {data.recent_orders.length === 0 ? (
                  <div className="rounded-xl bg-white/10 px-4 py-3 text-xs text-[#D5EFE8] flex items-center justify-between">
                    <span>Belum ada transaksi tercatat di periode ini.</span>
                    <Link
                      href="/orders"
                      className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0B3B3C] hover:bg-[#EBF4F4]"
                    >
                      Buat Pesanan
                    </Link>
                  </div>
                ) : (
                  data.recent_orders.slice(0, 3).map((ord) => (
                    <div
                      key={ord.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3.5 py-2 text-xs backdrop-blur-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-white truncate">
                          {ord.order_number} ·{' '}
                          <span className="font-sans font-normal text-[#CBECE2]">
                            {ord.customer_name}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#A2D6C8] truncate">
                          {ord.business_name} · {formatDateWib(ord.created_at)}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums text-white shrink-0">
                        {formatIdr(ord.total_idr)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Operational Detail Tables (Business Performance & Low Stock Items) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[#E5EFEF] bg-white overflow-hidden shadow-[0_2px_10px_rgba(11,59,60,0.03)]">
              <div className="flex items-center justify-between border-b border-[#E5EFEF] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#0B3B3C]" />
                  <h2 className="text-sm font-semibold text-[#0B2D2E]">
                    Performa Per Usaha
                  </h2>
                </div>
                <Link
                  href="/businesses"
                  className="text-xs font-medium text-[#1A5D5E] hover:text-[#0B3B3C]"
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
                        className="inline-flex items-center rounded-xl bg-[#0B3B3C] px-4 py-2 text-xs font-medium text-white hover:bg-[#134E4F]"
                      >
                        Tambah Usaha Pertama
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F4F8F8] text-[#4E6E6F] border-b border-[#E5EFEF]">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Usaha</th>
                        <th className="px-4 py-2.5 font-medium">Bidang</th>
                        <th className="px-4 py-2.5 font-medium text-right">Pesanan</th>
                        <th className="px-4 py-2.5 font-medium text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF4F4]">
                      {data.business_performance.map((b) => (
                        <tr key={b.business_id} className="hover:bg-[#F8FAFA]">
                          <td className="px-4 py-3 font-medium text-[#0B2D2E]">
                            {b.business_name}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={b.category} />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[#355A5B]">
                            {b.orders_count}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#0B2D2E]">
                            {formatIdr(b.sales_idr)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#E5EFEF] bg-white overflow-hidden shadow-[0_2px_10px_rgba(11,59,60,0.03)]">
              <div className="flex items-center justify-between border-b border-[#E5EFEF] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#E87A48]" />
                  <h2 className="text-sm font-semibold text-[#0B2D2E]">
                    Produk dengan Stok Menipis
                  </h2>
                </div>
                <Link
                  href="/inventory"
                  className="text-xs font-medium text-[#1A5D5E] hover:text-[#0B3B3C]"
                >
                  Lihat Inventory
                </Link>
              </div>
              {data.low_stock_items.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#567475]">
                  Tidak ada produk dengan stok di bawah batas minimum.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F4F8F8] text-[#4E6E6F] border-b border-[#E5EFEF]">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Produk</th>
                        <th className="px-4 py-2.5 font-medium">Lokasi</th>
                        <th className="px-4 py-2.5 font-medium text-right">Tersedia</th>
                        <th className="px-4 py-2.5 font-medium text-right">Batas Min</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF4F4]">
                      {data.low_stock_items.map((item) => (
                        <tr key={item.inventory_id} className="hover:bg-[#F8FAFA]">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0B2D2E]">
                              {item.product_name}
                            </p>
                            <p className="text-[11px] text-[#567475]">
                              {item.business_name} · {item.sku}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[#355A5B]">
                            {item.location_name}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#D66A3C] tabular-nums">
                            {item.qty_available}
                          </td>
                          <td className="px-4 py-3 text-right text-[#567475] tabular-nums">
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

          {/* Row 5: Full Recent Orders Table */}
          <div className="rounded-2xl border border-[#E5EFEF] bg-white overflow-hidden shadow-[0_2px_10px_rgba(11,59,60,0.03)]">
            <div className="flex items-center justify-between border-b border-[#E5EFEF] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-[#0B2D2E]">
                Daftar Pesanan Terbaru
              </h2>
              <Link
                href="/orders"
                className="text-xs font-medium text-[#1A5D5E] hover:text-[#0B3B3C]"
              >
                Lihat Semua
              </Link>
            </div>
            {data.recent_orders.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#567475]">
                Belum ada pesanan yang tercatat.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4F8F8] text-[#4E6E6F] border-b border-[#E5EFEF]">
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
                  <tbody className="divide-y divide-[#EEF4F4]">
                    {data.recent_orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-[#F8FAFA]">
                        <td className="px-4 py-3">
                          <p className="font-mono font-medium text-[#0B2D2E]">
                            {ord.order_number}
                          </p>
                          <p className="text-[11px] text-[#567475]">
                            {formatDateWib(ord.created_at)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-[#355A5B]">{ord.business_name}</td>
                        <td className="px-4 py-3 text-[#0B2D2E] font-medium">
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
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#0B2D2E]">
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
