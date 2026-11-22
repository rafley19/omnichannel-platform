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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

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
      <div className="min-h-screen flex items-center justify-center bg-[#0B3B3C]">
        <div className="flex flex-col items-center gap-2.5">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#194F50] border-t-[#2ED47A]" />
          <span className="text-xs font-medium text-[#A9C7C7]">
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
    <div className="flex h-full flex-col bg-[#0B3B3C] text-white">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-5 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#134647] text-[#38E587]">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white leading-none">
              Omnichannel Hub
            </p>
            <p className="mt-1 text-[11px] text-[#7DA8A8] leading-none">
              Multi-Business Platform
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden rounded-lg p-1.5 text-[#8BB3B3] hover:bg-[#134647] hover:text-white transition-colors"
          aria-label="Tutup menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1.5">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B9898]">
          Navigation
        </p>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`group flex items-center gap-3 rounded-full px-2.5 py-2 text-xs font-medium transition-all duration-200 ${
                active
                  ? 'bg-[#194F50] text-white shadow-sm'
                  : 'text-[#A9C7C7] hover:bg-[#134647] hover:text-white'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                  active
                    ? 'bg-white text-[#0B3B3C] shadow-sm'
                    : 'bg-[#134647] text-[#8BB3B3] group-hover:bg-[#1A5D5E] group-hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-5 space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B9898]">
            Roadmap Bertahap
          </p>
          {UPCOMING_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-full px-2.5 py-1.5 text-xs text-[#6B9898] cursor-not-allowed select-none"
                title={`Dijadwalkan pada ${item.stage}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#104243]/70 text-[#5D8989]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="rounded-full bg-[#104243] px-2 py-0.5 text-[10px] font-medium text-[#739B9B] shrink-0">
                  {item.stage}
                </span>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Bottom User Account */}
      <div className="px-4 pb-4 pt-2">
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B9898]">
          User Account
        </p>
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#134647]/70 px-3 py-2.5 border border-[#1E5B5C]/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2ED47A] to-[#138A5C] text-xs font-semibold text-white shadow-sm">
              {getInitials(user.fullName || user.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white leading-tight">
                {user.fullName}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[#8FB5B5] leading-tight">
                {user.globalRole === 'owner' ? 'Owner Account' : 'Staf Operasional'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full p-2 text-[#8FB5B5] hover:bg-[#194F50] hover:text-white transition-colors shrink-0"
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
    <div className="min-h-screen bg-[#0B3B3C] text-[#0D2E2F] flex lg:p-3 lg:pl-0">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-3 h-[calc(100vh-1.5rem)]">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full shadow-2xl">{sidebarContent}</div>
          <div
            className="flex-1 bg-[#062425]/60 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Floating Rounded Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#F4F7F6] lg:rounded-[24px] overflow-hidden shadow-2xl">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E5EFEF] bg-white/85 px-4 sm:px-6 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-xl border border-[#D5E3E3] bg-white p-2 text-[#0B3B3C] hover:bg-[#F4F7F6] transition-colors"
              aria-label="Buka navigasi"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <label
                htmlFor="global-biz-switcher"
                className="hidden sm:inline text-xs font-medium text-[#4E6E6F] whitespace-nowrap"
              >
                Konteks Usaha:
              </label>
              <select
                id="global-biz-switcher"
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                className="rounded-xl border border-[#D5E3E3] bg-white px-3 py-1.5 text-sm font-medium text-[#0B2D2E] focus:border-[#0B3B3C] focus:outline-none focus:ring-2 focus:ring-[#0B3B3C]/10 max-w-[230px] sm:max-w-xs"
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
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[#D3E4E4] bg-[#EBF4F4] px-3 py-1 text-xs font-medium text-[#0B3B3C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2ED47A]" />
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
