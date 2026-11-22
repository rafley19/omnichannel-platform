import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { getBusinessById, updateBusiness } from '@/services/business.service';

export const dynamic = 'force-dynamic';

const updateBusinessSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.enum(['fashion', 'fnb', 'service', 'retail', 'other']).optional(),
  logo_url: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  enabled_modules: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const business = await getBusinessById(session, context.params.id);
    return okResponse(business);
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
    const body = updateBusinessSchema.parse(await request.json());
    const updated = await updateBusiness(
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
