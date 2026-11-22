import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { cancelOrder } from '@/services/order.service';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({
  reason: z.string().max(300).optional(),
});

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const raw = await request.json().catch(() => ({}));
    const body = cancelSchema.parse(raw);
    const updated = await cancelOrder(
      session,
      context.params.id,
      body.reason,
      getClientIp(request)
    );
    return okResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
