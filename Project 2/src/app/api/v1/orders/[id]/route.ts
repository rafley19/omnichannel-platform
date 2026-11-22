import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { getOrderById, updateOrderStatus } from '@/services/order.service';

const updateOrderSchema = z.object({
  order_status: z.enum([
    'pending',
    'confirmed',
    'processing',
    'completed',
    'refunded',
  ]),
});

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const order = await getOrderById(session, context.params.id);
    return okResponse(order);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const body = updateOrderSchema.parse(await request.json());
    const updated = await updateOrderStatus(
      session,
      context.params.id,
      body.order_status,
      getClientIp(request)
    );
    return okResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
