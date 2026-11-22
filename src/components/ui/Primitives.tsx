'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Inbox, X } from 'lucide-react';

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  // Order status
  pending: { label: 'Pending', classes: 'bg-[#EEF4F4] text-[#355A5B] border-[#D5E3E3]' },
  confirmed: { label: 'Dikonfirmasi', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  processing: { label: 'Diproses', classes: 'bg-teal-50 text-teal-800 border-teal-200' },
  completed: { label: 'Selesai', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Dibatalkan', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  refunded: { label: 'Refund', classes: 'bg-amber-50 text-amber-800 border-amber-200' },

  // Payment status
  waiting_verification: {
    label: 'Menunggu Verifikasi',
    classes: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  paid: { label: 'Lunas', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Gagal', classes: 'bg-rose-50 text-rose-700 border-rose-200' },

  // Active / Stock
  active: { label: 'Aktif', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Nonaktif', classes: 'bg-[#EEF4F4] text-[#567475] border-[#D5E3E3]' },
  low_stock: { label: 'Stok Menipis', classes: 'bg-orange-50 text-orange-800 border-orange-200' },
  in_stock: { label: 'Aman', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },

  // Business categories
  fashion: { label: 'Fashion', classes: 'bg-[#EEF4F4] text-[#0B3B3C] border-[#D5E3E3]' },
  fnb: { label: 'Makanan & Minuman', classes: 'bg-orange-50 text-orange-700 border-orange-200' },
  service: { label: 'Jasa', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  retail: { label: 'Ritel', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  other: { label: 'Lainnya', classes: 'bg-[#EEF4F4] text-[#355A5B] border-[#D5E3E3]' },

  // Movement types
  stock_in: { label: 'Stok Masuk', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  stock_out: { label: 'Stok Keluar', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  sale: { label: 'Penjualan', classes: 'bg-teal-50 text-teal-800 border-teal-200' },
  order_cancel: { label: 'Batal Pesanan', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  return: { label: 'Retur', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  adjustment: { label: 'Penyesuaian', classes: 'bg-amber-50 text-amber-800 border-amber-200' },
  opname: { label: 'Stock Opname', classes: 'bg-[#EEF4F4] text-[#355A5B] border-[#D5E3E3]' },

  // Channels
  manual: { label: 'Manual', classes: 'bg-[#EEF4F4] text-[#355A5B] border-[#D5E3E3]' },
  website: { label: 'Website', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  pos: { label: 'Kasir POS', classes: 'bg-teal-50 text-teal-800 border-teal-200' },
  marketplace: { label: 'Marketplace', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
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
    classes: 'bg-[#EEF4F4] text-[#355A5B] border-[#D5E3E3]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${conf.classes}`}
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#062425]/55 p-4 backdrop-blur-[2px]">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] flex flex-col rounded-2xl border border-[#E5EFEF] bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between border-b border-[#E5EFEF] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#0B2D2E]">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#567475]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#7A9899] hover:bg-[#F4F7F6] hover:text-[#0B3B3C] transition-colors"
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
    <div className="fixed inset-0 z-40 flex justify-end bg-[#062425]/50 backdrop-blur-[2px]">
      <div className="w-full max-w-lg h-full flex flex-col bg-white shadow-2xl border-l border-[#E5EFEF]">
        <div className="flex items-start justify-between border-b border-[#E5EFEF] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#0B2D2E]">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#567475]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#7A9899] hover:bg-[#F4F7F6] hover:text-[#0B3B3C] transition-colors"
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#C9DADA] bg-white px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EBF4F4] text-[#0B3B3C]">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-[#0B2D2E]">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-[#567475]">{description}</p>
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/80 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-rose-600" />
      <p className="mt-2 text-sm font-medium text-rose-900">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors"
        >
          Coba Muat Ulang
        </button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-[#E5EFEF] bg-white p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 w-full animate-pulse rounded-xl bg-[#EDF3F3]" />
      ))}
    </div>
  );
}
