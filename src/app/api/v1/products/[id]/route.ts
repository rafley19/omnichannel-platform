import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { softDeleteProduct, updateProduct } from '@/services/product.service';

export const dynamic = 'force-dynamic';

const updateProductSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(80).optional(),
  product_type: z.enum(['physical', 'service']).optional(),
  image_url: z.string().optional(),
  base_price_idr: z.number().min(0).optional(),
  track_inventory: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const body = updateProductSchema.parse(await request.json());
    const updated = await updateProduct(
      session,
      context.params.id,
      body,
      getClientIp(request)
    );
    return okResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const updated = await softDeleteProduct(
      session,
      context.params.id,
      getClientIp(request)
    );
    return okResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
