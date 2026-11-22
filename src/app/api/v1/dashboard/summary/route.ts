import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getDashboardSummary } from '@/services/dashboard.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'dashboard:summary', 120, 60_000);
    const session = await requireAuth();
    const url = new URL(request.url);
    const businessId = url.searchParams.get('business_id') || undefined;
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    const summary = await getDashboardSummary(session, {
      businessId,
      days: Number.isFinite(days) ? days : 30,
    });
    return okResponse(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
