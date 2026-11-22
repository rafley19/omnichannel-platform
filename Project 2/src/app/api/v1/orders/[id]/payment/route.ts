import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { updateOrderPayment } from '@/services/order.service';

export const dynamic = 'force-dynamic';

const updatePaymentSchema = z.object({
  payment_status: z.enum([
    'pending',
    'waiting_verification',
    'paid',
    'failed',
    'refunded',
  ]),
  payment_method: z.enum(['bank_transfer', 'qris', 'cash']).optional(),
  destination_account_label: z.string().max(120).optional(),
  proof_url: z.string().max(400).optional(),
  verification_notes: z.string().max(300).optional(),
});

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const body = updatePaymentSchema.parse(await request.json());
    const result = await updateOrderPayment(
      session,
      context.params.id,
      body,
      getClientIp(request)
    );
    return okResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}
