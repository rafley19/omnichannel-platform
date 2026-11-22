'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { usePlatform } from '@/components/PlatformContext';
import { ErrorState, TableSkeleton } from '@/components/ui/Primitives';
import type { DatabaseHealth } from '@/db/types';
import { apiFetch } from '@/lib/api-client';

interface SystemStatusPayload {
  health: DatabaseHealth;
  supportsTransactions: boolean;
  stage: string;
}

export default function SettingsPage() {
  const { user, showToast } = usePlatform();
  const [status, setStatus] = useState<SystemStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<SystemStatusPayload>('/api/v1/system/status');
      setStatus(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memeriksa status sistem.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleInitSchema() {
    setInitializing(true);
    try {
      const res = await apiFetch<{ created: string[]; verified: string[] }>(
        '/api/v1/system/status',
        { method: 'POST' }
      );
      showToast(
        'success',
        `Skema diverifikasi (${res.data.created.length} tabel baru, ${res.data.verified.length} terverifikasi).`
      );
      await loadStatus();
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal menginisialisasi skema.'
      );
    } finally {
      setInitializing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Settings & Database Adapter
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Informasi akun, status lapisan penyimpanan data (Adapter Pattern), dan kesiapan migrasi.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStatus}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Cek Ulang Koneksi
        </button>
      </div>

      {/* Account & Security Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold">Profil & Keamanan Akun</h2>
          </div>
          <div className="pt-2 space-y-1.5 text-xs">
            <p className="text-slate-600">
              Nama: <span className="font-medium text-slate-900">{user?.fullName}</span>
            </p>
            <p className="text-slate-600">
              Email: <span className="font-mono text-slate-900">{user?.email}</span>
            </p>
            <p className="text-slate-600">
              Role Global:{' '}
              <span className="font-medium uppercase text-slate-900">
                {user?.globalRole}
              </span>
            </p>
          </div>
          <p className="pt-2 text-[11px] text-slate-500 leading-relaxed">
            Hash password Bcrypt disimpan terisolasi pada tabel{' '}
            <code className="font-mono text-slate-700">auth_credentials</code> di Neon PostgreSQL (100% aman untuk Vercel Serverless tanpa penulisan file lokal).
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-900">
            <Database className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold">Arsitektur Adapter Database</h2>
          </div>
          {loading ? (
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ) : status ? (
            <div className="pt-2 space-y-1.5 text-xs">
              <p className="text-slate-600">
                Provider Aktif:{' '}
                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-medium text-white uppercase">
                  {status.health.provider}
                </span>
              </p>
              <p className="text-slate-600">
                ACID Transaction:{' '}
                <span className="font-medium text-slate-900">
                  {status.supportsTransactions
                    ? 'Native PostgreSQL'
                    : 'Serialized Keyed Mutex Lock (Mode Pilot)'}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                {status.health.message}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadStatus} />}

      {/* 14 Tables Verification */}
      {loading && !status ? (
        <TableSkeleton rows={5} />
      ) : status ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Status 14 Tabel Operasional (Neon PostgreSQL Ready)
              </h2>
              <p className="text-xs text-slate-500">
                Skema tabel otomatis dibuat saat login pertama kali, atau verifikasi ulang secara aman (idempoten) kapan saja di sini.
              </p>
            </div>
            {user?.globalRole === 'owner' && (
              <button
                type="button"
                disabled={initializing}
                onClick={handleInitSchema}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Wrench className="h-3.5 w-3.5" />
                {initializing ? 'Memverifikasi...' : 'Inisialisasi / Verifikasi 14 Tabel'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
            {Object.entries(status.health.tables).map(([tableName, count]) => (
              <div
                key={tableName}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2
                    className={`h-3.5 w-3.5 shrink-0 ${
                      count >= 0 ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  />
                  <span className="truncate font-mono text-[11px] font-medium text-slate-800">
                    {tableName}
                  </span>
                </div>
                <span className="font-semibold tabular-nums text-slate-600 ml-2">
                  {count >= 0 ? count : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
