import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { createBusiness, listBusinesses } from '@/services/business.service';

export const dynamic = 'force-dynamic';

const createBusinessSchema = z.object({
  code: z
    .string()
    .min(2, 'Kode usaha minimal 2 karakter.')
    .max(20, 'Kode usaha maksimal 20 karakter.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya boleh huruf, angka, -, atau _.'),
  name: z.string().min(2, 'Nama usaha minimal 2 karakter.').max(120),
  category: z.enum(['fashion', 'fnb', 'service', 'retail', 'other']),
  logo_url: z.string().optional(),
  contact_email: z.string().email('Email tidak valid.').optional().or(z.literal('')),
  contact_phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  enabled_modules: z.array(z.string()).optional(),
  primary_location_name: z.string().max(100).optional(),
  primary_location_type: z.enum(['store', 'warehouse', 'kitchen', 'office']).optional(),
});

export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'businesses:get', 120, 60_000);
    const session = await requireAuth();
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const includeInactive = url.searchParams.get('include_inactive') === 'true';

    const items = await listBusinesses(session, { search, includeInactive });
    return okResponse(items, { total: items.length });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'businesses:post', 40, 60_000);
    const session = await requireAuth();
    const body = createBusinessSchema.parse(await request.json());
    const result = await createBusiness(session, body, getClientIp(request));
    return okResponse(result, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
