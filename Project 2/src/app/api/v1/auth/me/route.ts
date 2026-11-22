import { getAccessibleBusinessIds, requireAuth } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuth();
    const accessibleBusinessIds = await getAccessibleBusinessIds(user);
    return okResponse({ user, accessibleBusinessIds });
  } catch (err) {
    return handleApiError(err);
  }
}
