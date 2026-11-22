import { getDatabase } from '@/db/factory';
import { createId, nowIso } from '@/lib/id';

export interface AuditInput {
  businessId?: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary?: Record<string, unknown>;
  ipAddress?: string;
}

export async function recordAuditLog(input: AuditInput): Promise<void> {
  const db = getDatabase();
  await db.repo('audit_logs').create({
    id: createId('aud'),
    business_id: input.businessId ?? '',
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    payload_summary_json: JSON.stringify(input.summary ?? {}),
    ip_address: input.ipAddress ?? '127.0.0.1',
    created_at: nowIso(),
  });
}
