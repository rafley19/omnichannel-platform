import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  listMovements,
  recordStockMovement,
} from '@/services/inventory.service';

export const dynamic = 'force-dynamic';

const movementSchema = z.object({
  business_id: z.string().min(3),
  product_id: z.string().min(3),
  variant_id: z.string().optional(),
  location_id: z.string().min(3),
  movement_type: z.enum([
    'stock_in',
    'stock_out',
    'return',
    'adjustment',
    'opname',
  ]),
  qty: z.number().int(),
  notes: z.string().max(300).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'inventory:movements:get', 120, 60_000);
    const session = await requireAuth();
    const url = new URL(request.url);
    const businessId = url.searchParams.get('business_id') || undefined;
    const productId = url.searchParams.get('product_id') || undefined;
    const limit = Number(url.searchParams.get('limit') || 100);

    const items = await listMovements(session, {
      businessId,
      productId,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    return okResponse(items, { total: items.length });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'inventory:movements:post', 60, 60_000);
    const session = await requireAuth();
    const body = movementSchema.parse(await request.json());
    const result = await recordStockMovement(session, body, getClientIp(request));
    return okResponse(result, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
