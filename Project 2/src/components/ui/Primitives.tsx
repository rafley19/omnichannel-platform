'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Inbox, X } from 'lucide-react';

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  // Order status
  pending: { label: 'Pending', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  confirmed: { label: 'Dikonfirmasi', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  processing: { label: 'Diproses', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  completed: { label: 'Selesai', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Dibatalkan', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  refunded: { label: 'Refund', classes: 'bg-amber-50 text-amber-800 border-amber-200' },

  // Payment status
  waiting_verification: {
    label: 'Menunggu Verifikasi',
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  paid: { label: 'Lunas', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Gagal', classes: 'bg-rose-50 text-rose-700 border-rose-200' },

  // Active / Stock
  active: { label: 'Aktif', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Nonaktif', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  low_stock: { label: 'Stok Menipis', classes: 'bg-amber-50 text-amber-800 border-amber-200' },
  in_stock: { label: 'Aman', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },

  // Business categories
  fashion: { label: 'Fashion', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  fnb: { label: 'Makanan & Minuman', classes: 'bg-orange-50 text-orange-700 border-orange-200' },
  service: { label: 'Jasa', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  retail: { label: 'Ritel', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  other: { label: 'Lainnya', classes: 'bg-slate-100 text-slate-700 border-slate-200' },

  // Movement types
  stock_in: { label: 'Stok Masuk', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  stock_out: { label: 'Stok Keluar', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  sale: { label: 'Penjualan', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  order_cancel: { label: 'Batal Pesanan', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  return: { label: 'Retur', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  adjustment: { label: 'Penyesuaian', classes: 'bg-amber-50 text-amber-800 border-amber-200' },
  opname: { label: 'Stock Opname', classes: 'bg-slate-100 text-slate-700 border-slate-200' },

  // Channels
  manual: { label: 'Manual', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  website: { label: 'Website', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  pos: { label: 'Kasir POS', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  marketplace: { label: 'Marketplace', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
};

export function StatusBadge({
  status,
  customLabel,
}: {
  status: string;
  customLabel?: string;
}) {
  const conf = STATUS_STYLES[status] ?? {
    label: status,
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${conf.classes}`}
    >
      {customLabel ?? conf.label}
    </span>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-xl',
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
      <div className="w-full max-w-lg h-full flex flex-col bg-white shadow-2xl border-l border-slate-200">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Tutup panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-rose-600" />
      <p className="mt-2 text-sm font-medium text-rose-900">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors"
        >
          Coba Muat Ulang
        </button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}
