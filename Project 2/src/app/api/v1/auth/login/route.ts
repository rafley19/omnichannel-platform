import { z } from 'zod';
import {
  authenticateCredentials,
  createSessionToken,
  setSessionCookie,
} from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
});

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'auth:login', 20, 60_000);
    const body = loginSchema.parse(await request.json());
    const user = await authenticateCredentials(body.email, body.password);
    const token = await createSessionToken(user);

    await recordAuditLog({
      actorUserId: user.userId,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.userId,
      summary: { email: user.email },
      ipAddress: getClientIp(request),
    });

    const response = okResponse({ user });
    response.cookies.set(setSessionCookie(token));
    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
