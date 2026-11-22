import { getDatabase } from '@/db/factory';
import { requireAuth, requireOwner } from '@/lib/auth';
import { handleApiError, okResponse } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { recordAuditLog } from '@/services/audit.service';

export async function GET() {
  try {
    await requireAuth();
    const db = getDatabase();
    const health = await db.healthCheck();
    return okResponse({
      health,
      supportsTransactions: db.supportsTransactions,
      stage: 'Tahap 2 — MVP',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    requireOwner(session);
    const db = getDatabase();
    const result = await db.initializeSchema();

    await recordAuditLog({
      actorUserId: session.userId,
      action: 'SCHEMA_INITIALIZED',
      entityType: 'system',
      entityId: db.providerName,
      summary: result,
      ipAddress: getClientIp(request),
    });

    return okResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}
