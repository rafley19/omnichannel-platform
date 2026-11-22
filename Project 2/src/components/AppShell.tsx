'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  Building2,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Package,
  Plug,
  Settings,
  ShoppingBag,
  Workflow,
  X,
} from 'lucide-react';
import { usePlatform } from './PlatformContext';

interface NavItem {
  label: string;
  href: string;
  moduleKey?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTIVE_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', moduleKey: 'dashboard', icon: LayoutDashboard },
  { label: 'Business Management', href: '/businesses', icon: Building2 },
  { label: 'Product & Catalog', href: '/products', moduleKey: 'products', icon: Package },
  { label: 'Inventory Management', href: '/inventory', moduleKey: 'inventory', icon: Boxes },
  { label: 'Orders & Sales', href: '/orders', moduleKey: 'orders', icon: ShoppingBag },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const UPCOMING_NAV_ITEMS = [
  { label: 'Integrations', stage: 'Tahap 3', icon: Plug },
  { label: 'Automation', stage: 'Tahap 5', icon: Workflow },
  { label: 'Reports & Analytics', stage: 'Tahap 5', icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    user,
    authLoading,
    businesses,
    selectedBusinessId,
    setSelectedBusinessId,
    enabledModules,
    logout,
  } = usePlatform();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <span className="text-xs font-medium text-slate-500">
            Memuat sesi platform...
          </span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const visibleNavItems = ACTIVE_NAV_ITEMS.filter((item) => {
    if (!item.moduleKey) return true;
    return enabledModules.includes(item.moduleKey);
  });

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-900">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white leading-none">
              Omnichannel Hub
            </p>
            <p className="mt-1 text-[11px] text-slate-400 leading-none">
              Multi-Business Platform
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Tutup menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Operasional Aktif (MVP)
        </p>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Roadmap Bertahap
          </p>
          {UPCOMING_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-500 cursor-not-allowed select-none"
                title={`Dijadwalkan pada ${item.stage}`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 opacity-60" />
                  <span>{item.label}</span>
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  {item.stage}
                </span>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">
              {user.fullName}
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {user.globalRole === 'owner' ? 'Pemilik Usaha (Owner)' : 'Staf Operasional'}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            title="Keluar"
            aria-label="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full shadow-2xl">{sidebarContent}</div>
          <div
            className="flex-1 bg-slate-900/45"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Buka navigasi"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <label
                htmlFor="global-biz-switcher"
                className="hidden sm:inline text-xs font-medium text-slate-500 whitespace-nowrap"
              >
                Konteks Usaha:
              </label>
              <select
                id="global-biz-switcher"
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 max-w-[230px] sm:max-w-xs"
              >
                {user.globalRole === 'owner' && (
                  <option value="">Semua Usaha ({businesses.length})</option>
                )}
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              Tahap 2 — MVP
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
