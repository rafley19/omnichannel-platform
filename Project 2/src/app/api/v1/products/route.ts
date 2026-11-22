import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { createProduct, listProducts } from '@/services/product.service';

const createProductSchema = z.object({
  business_id: z.string().min(3),
  sku: z.string().min(2, 'SKU minimal 2 karakter.').max(40),
  name: z.string().min(2, 'Nama produk minimal 2 karakter.').max(150),
  description: z.string().max(500).optional(),
  category: z.string().max(80).optional(),
  product_type: z.enum(['physical', 'service']),
  image_url: z.string().optional(),
  base_price_idr: z.number().min(0),
  track_inventory: z.boolean(),
  initial_stock: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(2).max(40),
        variant_name: z.string().min(1).max(100),
        price_idr: z.number().min(0),
        attributes: z.record(z.string()).optional(),
      })
    )
    .optional(),
});

export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'products:get', 120, 60_000);
    const session = await requireAuth();
    const url = new URL(request.url);
    const businessId = url.searchParams.get('business_id') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const statusParam = url.searchParams.get('status');
    const status =
      statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all';
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 50);

    const result = await listProducts(session, {
      businessId,
      search,
      category,
      status,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 50,
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
    enforceRateLimit(request, 'products:post', 60, 60_000);
    const session = await requireAuth();
    const body = createProductSchema.parse(await request.json());
    const product = await createProduct(session, body, getClientIp(request));
    return okResponse(product, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
