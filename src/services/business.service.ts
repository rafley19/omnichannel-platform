import { getDatabase } from '@/db/factory';
import { DEFAULT_ENABLED_MODULES } from '@/db/schema';
import type {
  Business,
  BusinessCategory,
  Location,
  LocationType,
} from '@/db/types';
import {
  getAccessibleBusinessIds,
  requireBusinessAccess,
  requireOwner,
  type SessionUser,
} from '@/lib/auth';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { createId, nowIso } from '@/lib/id';
import { recordAuditLog } from './audit.service';

export interface CreateBusinessInput {
  code: string;
  name: string;
  category: BusinessCategory;
  logo_url?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  enabled_modules?: string[];
  primary_location_name?: string;
  primary_location_type?: LocationType;
}

export interface UpdateBusinessInput {
  name?: string;
  category?: BusinessCategory;
  logo_url?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  enabled_modules?: string[];
  is_active?: boolean;
}

export interface CreateLocationInput {
  code: string;
  name: string;
  type: LocationType;
  address?: string;
  is_primary_stock_source?: boolean;
}

export async function listBusinesses(
  session: SessionUser,
  options?: { search?: string; includeInactive?: boolean }
): Promise<Array<Business & { locations: Location[] }>> {
  const db = getDatabase();
  const allowedIds = await getAccessibleBusinessIds(session);

  const search = options?.search?.trim().toLowerCase() ?? '';
  const result = await db.repo('businesses').findMany({
    predicate: (b) => {
      if (allowedIds !== null && !allowedIds.includes(b.id)) return false;
      if (!options?.includeInactive && !b.is_active) return false;
      if (
        search &&
        !b.name.toLowerCase().includes(search) &&
        !b.code.toLowerCase().includes(search) &&
        !b.category.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    },
    sortBy: 'created_at',
    sortDir: 'desc',
    limit: 500,
  });

  const allLocations = await db.repo('locations').findMany({ limit: 500 });
  const locByBiz = new Map<string, Location[]>();
  for (const loc of allLocations.items) {
    const arr = locByBiz.get(loc.business_id) ?? [];
    arr.push(loc);
    locByBiz.set(loc.business_id, arr);
  }

  return result.items.map((b) => ({
    ...b,
    locations: locByBiz.get(b.id) ?? [],
  }));
}

export async function getBusinessById(
  session: SessionUser,
  businessId: string
): Promise<Business & { locations: Location[] }> {
  await requireBusinessAccess(session, businessId);
  const db = getDatabase();
  const biz = await db.repo('businesses').findById(businessId);
  if (!biz) throw new NotFoundError('Usaha tidak ditemukan.');

  const locs = await db.repo('locations').findMany({
    where: { business_id: businessId },
    sortBy: 'created_at',
    sortDir: 'asc',
    limit: 100,
  });

  return { ...biz, locations: locs.items };
}

export async function createBusiness(
  session: SessionUser,
  input: CreateBusinessInput,
  ipAddress?: string
): Promise<{ business: Business; primaryLocation: Location }> {
  requireOwner(session);
  const db = getDatabase();
  const normalizedCode = input.code.trim().toUpperCase();

  const dup = await db.repo('businesses').findMany({
    predicate: (b) => b.code.toUpperCase() === normalizedCode,
    limit: 1,
  });
  if (dup.total > 0) {
    throw new ConflictError(
      'BUSINESS_CODE_EXISTS',
      `Kode usaha "${normalizedCode}" sudah digunakan.`
    );
  }

  const defaultModules =
    input.enabled_modules && input.enabled_modules.length > 0
      ? input.enabled_modules
      : input.category === 'service'
        ? ['dashboard', 'products', 'orders']
        : [...DEFAULT_ENABLED_MODULES];

  const ts = nowIso();
  const business = await db.repo('businesses').create({
    id: createId('biz'),
    code: normalizedCode,
    name: input.name.trim(),
    category: input.category,
    logo_url: (input.logo_url ?? '').trim(),
    contact_email: (input.contact_email ?? '').trim(),
    contact_phone: (input.contact_phone ?? '').trim(),
    address: (input.address ?? '').trim(),
    enabled_modules_json: JSON.stringify(defaultModules),
    is_active: true,
    created_at: ts,
    updated_at: ts,
  });

  const primaryLocation = await db.repo('locations').create({
    id: createId('loc'),
    business_id: business.id,
    code: `${normalizedCode}-MAIN`,
    name: (input.primary_location_name || 'Lokasi Utama').trim(),
    type: input.primary_location_type ?? (input.category === 'service' ? 'office' : 'store'),
    address: business.address,
    is_primary_stock_source: true,
    is_active: true,
    created_at: ts,
  });

  await recordAuditLog({
    businessId: business.id,
    actorUserId: session.userId,
    action: 'BUSINESS_CREATED',
    entityType: 'business',
    entityId: business.id,
    summary: { code: business.code, name: business.name, category: business.category },
    ipAddress,
  });

  return { business, primaryLocation };
}

export async function updateBusiness(
  session: SessionUser,
  businessId: string,
  input: UpdateBusinessInput,
  ipAddress?: string
): Promise<Business> {
  await requireBusinessAccess(session, businessId, ['admin']);
  const db = getDatabase();
  const existing = await db.repo('businesses').findById(businessId);
  if (!existing) throw new NotFoundError('Usaha tidak ditemukan.');

  const patch: Partial<Business> = {
    updated_at: nowIso(),
  };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.category !== undefined) patch.category = input.category;
  if (input.logo_url !== undefined) patch.logo_url = input.logo_url.trim();
  if (input.contact_email !== undefined) patch.contact_email = input.contact_email.trim();
  if (input.contact_phone !== undefined) patch.contact_phone = input.contact_phone.trim();
  if (input.address !== undefined) patch.address = input.address.trim();
  if (input.enabled_modules !== undefined) {
    patch.enabled_modules_json = JSON.stringify(input.enabled_modules);
  }
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const updated = await db.repo('businesses').update(businessId, patch);
  if (!updated) throw new NotFoundError('Gagal memperbarui usaha.');

  await recordAuditLog({
    businessId,
    actorUserId: session.userId,
    action: 'BUSINESS_UPDATED',
    entityType: 'business',
    entityId: businessId,
    summary: { fields: Object.keys(input) },
    ipAddress,
  });

  return updated;
}

export async function listLocations(
  session: SessionUser,
  businessId: string
): Promise<Location[]> {
  await requireBusinessAccess(session, businessId);
  const db = getDatabase();
  const res = await db.repo('locations').findMany({
    where: { business_id: businessId },
    sortBy: 'created_at',
    sortDir: 'asc',
    limit: 200,
  });
  return res.items;
}

export async function createLocation(
  session: SessionUser,
  businessId: string,
  input: CreateLocationInput,
  ipAddress?: string
): Promise<Location> {
  await requireBusinessAccess(session, businessId, ['admin', 'manager']);
  const db = getDatabase();

  const existing = await db.repo('locations').findMany({
    where: { business_id: businessId },
    limit: 200,
  });

  const normalizedCode = input.code.trim().toUpperCase();
  if (existing.items.some((l) => l.code.toUpperCase() === normalizedCode)) {
    throw new ConflictError(
      'LOCATION_CODE_EXISTS',
      `Kode lokasi "${normalizedCode}" sudah terdaftar pada usaha ini.`
    );
  }

  const makePrimary = Boolean(input.is_primary_stock_source) || existing.total === 0;
  if (makePrimary) {
    for (const loc of existing.items) {
      if (loc.is_primary_stock_source) {
        await db.repo('locations').update(loc.id, { is_primary_stock_source: false });
      }
    }
  }

  const location = await db.repo('locations').create({
    id: createId('loc'),
    business_id: businessId,
    code: normalizedCode,
    name: input.name.trim(),
    type: input.type,
    address: (input.address ?? '').trim(),
    is_primary_stock_source: makePrimary,
    is_active: true,
    created_at: nowIso(),
  });

  await recordAuditLog({
    businessId,
    actorUserId: session.userId,
    action: 'LOCATION_CREATED',
    entityType: 'location',
    entityId: location.id,
    summary: { code: location.code, name: location.name, isPrimary: makePrimary },
    ipAddress,
  });

  return location;
}
