import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { createLocation, listLocations } from '@/services/business.service';

export const dynamic = 'force-dynamic';

const createLocationSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(25)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(2).max(100),
  type: z.enum(['store', 'warehouse', 'kitchen', 'office']),
  address: z.string().max(300).optional(),
  is_primary_stock_source: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const items = await listLocations(session, context.params.id);
    return okResponse(items, { total: items.length });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const body = createLocationSchema.parse(await request.json());
    const location = await createLocation(
      session,
      context.params.id,
      body,
      getClientIp(request)
    );
    return okResponse(location, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
