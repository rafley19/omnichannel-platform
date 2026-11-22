import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { createOrder, listOrders } from '@/services/order.service';

export const dynamic = 'force-dynamic';

const createOrderSchema = z.object({
  business_id: z.string().min(3),
  location_id: z.string().optional(),
  channel: z.enum(['manual', 'website', 'pos', 'marketplace']).default('manual'),
  idempotency_key: z.string().max(120).optional(),
  customer_name: z.string().min(1, 'Nama pelanggan wajib diisi.').max(120),
  customer_contact: z.string().max(80).optional(),
  discount_idr: z.number().min(0).optional(),
  payment_method: z.enum(['bank_transfer', 'qris', 'cash']).default('bank_transfer'),
  destination_account_label: z.string().max(120).optional(),
  notes: z.string().max(400).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().min(3),
        variant_id: z.string().optional(),
        qty: z.number().int().min(1),
        unit_price_idr: z.number().min(0).optional(),
      })
    )
    .min(1, 'Minimal 1 item produk.'),
});

export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'orders:get', 120, 60_000);
    const session = await requireAuth();
    const url = new URL(request.url);
    const result = await listOrders(session, {
      businessId: url.searchParams.get('business_id') || undefined,
      orderStatus: url.searchParams.get('order_status') || undefined,
      paymentStatus: url.searchParams.get('payment_status') || undefined,
      channel: url.searchParams.get('channel') || undefined,
      search: url.searchParams.get('search') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      page: Number(url.searchParams.get('page') || 1),
      limit: Number(url.searchParams.get('limit') || 50),
    });
    return okResponse(result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'orders:post', 60, 60_000);
    const session = await requireAuth();
    const body = createOrderSchema.parse(await request.json());
    const headerIdemp = request.headers.get('x-idempotency-key') || undefined;

    const result = await createOrder(
      session,
      {
        ...body,
        idempotency_key: body.idempotency_key || headerIdemp,
      },
      getClientIp(request)
    );
    return okResponse(result.order, undefined, result.deduplicated ? 200 : 201);
  } catch (err) {
    return handleApiError(err);
  }
}
