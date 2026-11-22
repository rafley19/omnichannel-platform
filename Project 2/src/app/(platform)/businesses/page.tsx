'use client';

import React, { useMemo, useState } from 'react';
import { Building2, MapPin, Plus, Search, Settings2 } from 'lucide-react';
import {
  usePlatform,
  type BusinessWithLocations,
} from '@/components/PlatformContext';
import {
  Drawer,
  EmptyState,
  Modal,
  StatusBadge,
  TableSkeleton,
} from '@/components/ui/Primitives';
import type { BusinessCategory, LocationType } from '@/db/types';
import { apiFetch } from '@/lib/api-client';
import { parseEnabledModules } from '@/lib/format';

const ALL_MODULE_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Product & Catalog' },
  { key: 'inventory', label: 'Inventory Management' },
  { key: 'orders', label: 'Orders & Sales' },
];

export default function BusinessesPage() {
  const {
    user,
    businesses,
    businessesLoading,
    refreshBusinesses,
    invalidateCache,
    showToast,
  } = usePlatform();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<BusinessWithLocations | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create Business form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('fashion');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [primaryLocName, setPrimaryLocName] = useState('Toko / Gudang Utama');
  const [primaryLocType, setPrimaryLocType] = useState<LocationType>('store');
  const [enabledModules, setEnabledModules] = useState<string[]>([
    'dashboard',
    'products',
    'inventory',
    'orders',
  ]);

  // Edit Business & Add Location drawer state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<BusinessCategory>('fashion');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editModules, setEditModules] = useState<string[]>([]);

  const [newLocCode, setNewLocCode] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<LocationType>('warehouse');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocPrimary, setNewLocPrimary] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [businesses, search]);

  function openDrawer(b: BusinessWithLocations) {
    setSelectedBiz(b);
    setEditName(b.name);
    setEditCategory(b.category);
    setEditPhone(b.contact_phone);
    setEditEmail(b.contact_email);
    setEditAddress(b.address);
    setEditActive(b.is_active);
    setEditModules(parseEnabledModules(b.enabled_modules_json));
    setNewLocCode('');
    setNewLocName('');
    setNewLocAddress('');
    setNewLocPrimary(false);
  }

  function toggleModule(list: string[], key: string, setter: (v: string[]) => void) {
    if (key === 'dashboard') return; // dashboard always enabled
    if (list.includes(key)) {
      setter(list.filter((m) => m !== key));
    } else {
      setter([...list, key]);
    }
  }

  async function handleCreateBusiness(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/businesses', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          category,
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim(),
          address: address.trim(),
          enabled_modules: enabledModules,
          primary_location_name: primaryLocName.trim(),
          primary_location_type: primaryLocType,
        }),
      });
      showToast('success', `Usaha "${name.trim()}" berhasil ditambahkan.`);
      setCreateOpen(false);
      setCode('');
      setName('');
      setContactEmail('');
      setContactPhone('');
      setAddress('');
      invalidateCache();
      await refreshBusinesses();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menambah usaha.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateBusiness(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedBiz) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/businesses/${selectedBiz.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory,
          contact_phone: editPhone.trim(),
          contact_email: editEmail.trim(),
          address: editAddress.trim(),
          is_active: editActive,
          enabled_modules: editModules,
        }),
      });
      showToast('success', 'Profil usaha berhasil diperbarui.');
      invalidateCache();
      await refreshBusinesses();
      setSelectedBiz(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui usaha.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedBiz) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/businesses/${selectedBiz.id}/locations`, {
        method: 'POST',
        body: JSON.stringify({
          code: newLocCode.trim(),
          name: newLocName.trim(),
          type: newLocType,
          address: newLocAddress.trim(),
          is_primary_stock_source: newLocPrimary,
        }),
      });
      showToast('success', `Lokasi "${newLocName.trim()}" berhasil ditambahkan.`);
      invalidateCache();
      await refreshBusinesses();
      setSelectedBiz(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menambah lokasi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Business Management
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Kelola seluruh unit usaha, cabang/lokasi stok, dan modul aktif per jenis usaha.
          </p>
        </div>
        {user?.globalRole === 'owner' && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah Usaha Baru
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kode, atau bidang usaha..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
        </div>
      </div>

      {businessesLoading ? (
        <TableSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Belum ada usaha yang sesuai"
          description="Buat unit usaha pertama Anda (misalnya Fashion, F&B, atau Jasa). Setiap usaha otomatis mendapatkan ID unik dan lokasi stok utama."
          action={
            user?.globalRole === 'owner' ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Tambah Usaha Sekarang
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => {
            const mods = parseEnabledModules(b.enabled_modules_json);
            return (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                          {b.name}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-500">
                          {b.code} · {b.id}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={b.is_active ? 'active' : 'inactive'} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={b.category} />
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                      <MapPin className="h-3 w-3" />
                      {b.locations.length} lokasi
                    </span>
                  </div>

                  {b.address && (
                    <p className="mt-3 text-xs text-slate-600 line-clamp-2">
                      {b.address}
                    </p>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                      Modul Aktif:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {mods.map((m) => (
                        <span
                          key={m}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => openDrawer(b)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Kelola Profil & Lokasi
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Business */}
      <Modal
        open={createOpen}
        title="Tambah Usaha Baru"
        subtitle="Setiap usaha memiliki katalog, lokasi stok, dan pesanan yang terisolasi."
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreateBusiness} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kode Usaha *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Misal: FSH01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bidang Usaha *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const val = e.target.value as BusinessCategory;
                  setCategory(val);
                  if (val === 'service') {
                    setEnabledModules(['dashboard', 'products', 'orders']);
                    setPrimaryLocType('office');
                  } else {
                    setEnabledModules(['dashboard', 'products', 'inventory', 'orders']);
                    setPrimaryLocType('store');
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
              >
                <option value="fashion">Fashion</option>
                <option value="fnb">Makanan & Minuman (F&B)</option>
                <option value="service">Jasa</option>
                <option value="retail">Ritel / Perdagangan</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nama Usaha *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Khaluna Fashion Studio"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Kontak
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="ops@usaha.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Telepon Kontak
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Alamat Usaha
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5">
            <p className="text-xs font-semibold text-slate-800">
              Lokasi Sumber Stok Utama (Otomatis Dibuat)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={primaryLocName}
                onChange={(e) => setPrimaryLocName(e.target.value)}
                placeholder="Nama lokasi utama"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
              />
              <select
                value={primaryLocType}
                onChange={(e) => setPrimaryLocType(e.target.value as LocationType)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
              >
                <option value="store">Toko Fisik</option>
                <option value="warehouse">Gudang</option>
                <option value="kitchen">Dapur / Outlet F&B</option>
                <option value="office">Kantor / Studio Jasa</option>
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1.5">
              Menu Aktif untuk Usaha Ini:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULE_OPTIONS.map((m) => (
                <label
                  key={m.key}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={enabledModules.includes(m.key)}
                    disabled={m.key === 'dashboard'}
                    onChange={() =>
                      toggleModule(enabledModules, m.key, setEnabledModules)
                    }
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Usaha'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Drawer: Edit Business & Manage Locations */}
      <Drawer
        open={Boolean(selectedBiz)}
        title={selectedBiz ? `Kelola ${selectedBiz.name}` : ''}
        subtitle={selectedBiz ? `ID: ${selectedBiz.id} · Kode: ${selectedBiz.code}` : ''}
        onClose={() => setSelectedBiz(null)}
      >
        {selectedBiz && (
          <div className="space-y-6">
            <form onSubmit={handleUpdateBusiness} className="space-y-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Profil & Modul Usaha
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Usaha
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bidang
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as BusinessCategory)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="fashion">Fashion</option>
                    <option value="fnb">Makanan & Minuman</option>
                    <option value="service">Jasa</option>
                    <option value="retail">Ritel</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status Usaha
                  </label>
                  <select
                    value={editActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditActive(e.target.value === 'active')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email kontak"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="No. Telepon"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <textarea
                rows={2}
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Alamat usaha"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODULE_OPTIONS.map((m) => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={editModules.includes(m.key)}
                      disabled={m.key === 'dashboard'}
                      onChange={() =>
                        toggleModule(editModules, m.key, setEditModules)
                      }
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan Usaha'}
              </button>
            </form>

            <div className="border-t border-slate-200 pt-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Lokasi & Cabang ({selectedBiz.locations.length})
              </h3>
              <div className="space-y-2">
                {selectedBiz.locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {loc.name}{' '}
                        <span className="font-mono text-[11px] text-slate-500">
                          ({loc.code})
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 capitalize">
                        Tipe: {loc.type} {loc.address ? `· ${loc.address}` : ''}
                      </p>
                    </div>
                    {loc.is_primary_stock_source && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Sumber Stok Utama
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleAddLocation}
                className="rounded-lg border border-slate-200 p-3.5 space-y-2.5"
              >
                <p className="text-xs font-semibold text-slate-800">
                  Tambah Lokasi / Cabang Baru
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newLocCode}
                    onChange={(e) => setNewLocCode(e.target.value.toUpperCase())}
                    placeholder="Kode (mis: GDG-02)"
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono uppercase"
                  />
                  <select
                    value={newLocType}
                    onChange={(e) => setNewLocType(e.target.value as LocationType)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  >
                    <option value="store">Toko</option>
                    <option value="warehouse">Gudang</option>
                    <option value="kitchen">Dapur</option>
                    <option value="office">Kantor</option>
                  </select>
                </div>
                <input
                  type="text"
                  required
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder="Nama cabang / gudang"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={newLocAddress}
                  onChange={(e) => setNewLocAddress(e.target.value)}
                  placeholder="Alamat lokasi (opsional)"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={newLocPrimary}
                    onChange={(e) => setNewLocPrimary(e.target.checked)}
                  />
                  <span>Jadikan sumber stok utama usaha ini</span>
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg border border-slate-900 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-900 hover:text-white transition-colors disabled:opacity-60"
                >
                  Tambah Lokasi
                </button>
              </form>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
