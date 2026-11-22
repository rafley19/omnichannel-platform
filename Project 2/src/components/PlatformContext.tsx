'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Business, GlobalRole, Location } from '@/db/types';
import { apiFetch } from '@/lib/api-client';
import { parseEnabledModules } from '@/lib/format';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  globalRole: GlobalRole;
}

export interface BusinessWithLocations extends Business {
  locations: Location[];
}

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface PlatformContextValue {
  user: AuthUser | null;
  authLoading: boolean;
  businesses: BusinessWithLocations[];
  businessesLoading: boolean;
  selectedBusinessId: string; // "" means "Semua Usaha"
  selectedBusiness: BusinessWithLocations | null;
  enabledModules: string[];
  setSelectedBusinessId: (id: string) => void;
  refreshBusinesses: () => Promise<void>;
  getCache: <T>(key: string) => T | undefined;
  setCache: <T>(key: string, value: T) => void;
  invalidateCache: (prefix?: string) => void;
  showToast: (kind: ToastKind, message: string) => void;
  logout: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessWithLocations[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const cacheRef = useRef<Map<string, unknown>>(new Map());
  const toastCounter = useRef(1);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = toastCounter.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getCache = useCallback(<T,>(key: string): T | undefined => {
    return cacheRef.current.get(key) as T | undefined;
  }, []);

  const setCache = useCallback(<T,>(key: string, value: T): void => {
    cacheRef.current.set(key, value);
  }, []);

  const invalidateCache = useCallback((prefix?: string): void => {
    if (!prefix) {
      cacheRef.current.clear();
      return;
    }
    Array.from(cacheRef.current.keys()).forEach((k) => {
      if (k.startsWith(prefix)) cacheRef.current.delete(k);
    });
  }, []);

  const refreshBusinesses = useCallback(async () => {
    setBusinessesLoading(true);
    try {
      const { data } = await apiFetch<BusinessWithLocations[]>(
        '/api/v1/businesses?include_inactive=true'
      );
      setBusinesses(data);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal memuat daftar usaha.'
      );
    } finally {
      setBusinessesLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const { data } = await apiFetch<{ user: AuthUser }>('/api/v1/auth/me');
        if (!active) return;
        setUser(data.user);
        setAuthLoading(false);
        await refreshBusinesses();
      } catch {
        if (!active) return;
        setUser(null);
        setAuthLoading(false);
        router.replace('/login');
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [refreshBusinesses, router]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      cacheRef.current.clear();
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const selectedBusiness = useMemo(() => {
    if (!selectedBusinessId) return null;
    return businesses.find((b) => b.id === selectedBusinessId) ?? null;
  }, [businesses, selectedBusinessId]);

  const enabledModules = useMemo(() => {
    if (!selectedBusiness) {
      return ['dashboard', 'products', 'inventory', 'orders'];
    }
    return parseEnabledModules(selectedBusiness.enabled_modules_json);
  }, [selectedBusiness]);

  const value = useMemo<PlatformContextValue>(
    () => ({
      user,
      authLoading,
      businesses,
      businessesLoading,
      selectedBusinessId,
      selectedBusiness,
      enabledModules,
      setSelectedBusinessId,
      refreshBusinesses,
      getCache,
      setCache,
      invalidateCache,
      showToast,
      logout,
    }),
    [
      user,
      authLoading,
      businesses,
      businessesLoading,
      selectedBusinessId,
      selectedBusiness,
      enabledModules,
      refreshBusinesses,
      getCache,
      setCache,
      invalidateCache,
      showToast,
      logout,
    ]
  );

  return (
    <PlatformContext.Provider value={value}>
      {children}
      {/* Custom Toast Stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all ${
              t.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : t.kind === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            {t.kind === 'success' && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {t.kind === 'error' && (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            {t.kind === 'info' && (
              <Info className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Tutup notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error('usePlatform harus digunakan di dalam PlatformProvider.');
  }
  return ctx;
}
