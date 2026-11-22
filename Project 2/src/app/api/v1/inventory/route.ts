import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { enforceRateLimit } from '@/lib/rate-limit';
import { listInventory } from '@/services/inventory.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'inventory:get', 120, 60_000);
    const session = await requireAuth();
    const url = new URL(request.url);
    const businessId = url.searchParams.get('business_id') || undefined;
    const locationId = url.searchParams.get('location_id') || undefined;
    const lowStockOnly = url.searchParams.get('low_stock') === 'true';
    const search = url.searchParams.get('search') || undefined;

    const items = await listInventory(session, {
      businessId,
      locationId,
      lowStockOnly,
      search,
    });
    return okResponse(items, { total: items.length });
  } catch (err) {
    return handleApiError(err);
  }
}
