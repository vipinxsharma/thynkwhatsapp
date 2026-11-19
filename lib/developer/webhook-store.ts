import { randomUUID } from "node:crypto";
import { decryptToken, encryptToken, type EncryptedData } from "@/lib/meta/encryption";
import { developerDatabase, recordAuditEvent } from "@/lib/developer/db";
import { generateSigningSecret, type WebhookEventType } from "@/lib/developer/webhook-signing";

export interface WebhookConfig {
  id: string;
  url: string;
  events: WebhookEventType[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryRow {
  id: string;
  eventId: string;
  eventType: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastResponseCode: number | null;
  lastError: string | null;
  nextAttemptAt: string;
  deliveredAt: string | null;
  createdAt: string;
}

/** Returns the workspace's subscription without its secret. */
export async function getWebhookConfig(workspaceId: string): Promise<WebhookConfig | null> {
  const rows = await developerDatabase().query(
    `SELECT id, url, to_jsonb(events) AS events, enabled, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM app_webhook_endpoints WHERE workspace_id = $1::uuid LIMIT 1`,
    [workspaceId],
  );
  return (rows[0] as WebhookConfig | undefined) || null;
}

// Event names are a fixed lowercase list with dots and underscores, so no quoting is needed.
function toPgTextArray(values: readonly string[]): string {
  return `{${values.join(",")}}`;
}

function encryptedSecretColumns(secret: string): { ciphertext: string; iv: string; tag: string } {
  const encrypted: EncryptedData = encryptToken(secret);
  return { ciphertext: encrypted.ciphertext, iv: encrypted.iv, tag: encrypted.authTag };
}

/**
 * Creates or updates the workspace subscription. The signing secret is generated only when the
 * subscription is created, and is returned once. Updates keep the existing secret.
 */
export async function saveWebhookConfig(input: {
  workspaceId: string;
  authUserId: string;
  url: string;
  events: WebhookEventType[];
  enabled: boolean;
}): Promise<{ config: WebhookConfig; signingSecret: string | null }> {
  const candidateSecret = generateSigningSecret();
  const sealed = encryptedSecretColumns(candidateSecret);
  const rows = await developerDatabase().query(
    `INSERT INTO app_webhook_endpoints
       (id, workspace_id, url, events, enabled, encrypted_secret, secret_iv, secret_tag,
        created_by_auth_user_id, updated_by_auth_user_id)
     VALUES ($1::uuid, $2::uuid, $3, $4::text[], $5, $6, $7, $8, $9, $9)
     ON CONFLICT (workspace_id) DO UPDATE SET
       url = EXCLUDED.url,
       events = EXCLUDED.events,
       enabled = EXCLUDED.enabled,
       updated_by_auth_user_id = EXCLUDED.updated_by_auth_user_id,
       updated_at = now()
     RETURNING id, url, to_jsonb(events) AS events, enabled, created_at AS "createdAt", updated_at AS "updatedAt",
       (xmax = 0) AS created`,
    [
      randomUUID(), input.workspaceId, input.url, toPgTextArray(input.events), input.enabled,
      sealed.ciphertext, sealed.iv, sealed.tag, input.authUserId,
    ],
  );
  const row = rows[0] as WebhookConfig & { created: boolean };
  const { created, ...config } = row;
  await recordAuditEvent({
    workspaceId: input.workspaceId,
    authUserId: input.authUserId,
    action: created ? "webhook.created" : "webhook.updated",
    resourceType: "webhook_endpoint",
    resourceId: config.id,
    metadata: { url: config.url, events: config.events, enabled: config.enabled },
  });
  return { config, signingSecret: created ? candidateSecret : null };
}

/** Replaces the signing secret. The old secret stops verifying immediately. */
export async function rotateWebhookSecret(input: {
  workspaceId: string;
  authUserId: string;
}): Promise<string | null> {
  const secret = generateSigningSecret();
  const sealed = encryptedSecretColumns(secret);
  const rows = await developerDatabase().query(
    `UPDATE app_webhook_endpoints SET encrypted_secret = $2, secret_iv = $3, secret_tag = $4,
       updated_by_auth_user_id = $5, updated_at = now()
     WHERE workspace_id = $1::uuid
     RETURNING id`,
    [input.workspaceId, sealed.ciphertext, sealed.iv, sealed.tag, input.authUserId],
  );
  const row = rows[0] as { id: string } | undefined;
  if (!row) return null;
  await recordAuditEvent({
    workspaceId: input.workspaceId,
    authUserId: input.authUserId,
    action: "webhook.secret_rotated",
    resourceType: "webhook_endpoint",
    resourceId: row.id,
  });
  return secret;
}

export async function deleteWebhookConfig(input: { workspaceId: string; authUserId: string }): Promise<boolean> {
  const rows = await developerDatabase().query(
    `DELETE FROM app_webhook_endpoints WHERE workspace_id = $1::uuid RETURNING id, url`,
    [input.workspaceId],
  );
  const row = rows[0] as { id: string; url: string } | undefined;
  if (!row) return false;
  await recordAuditEvent({
    workspaceId: input.workspaceId,
    authUserId: input.authUserId,
    action: "webhook.deleted",
    resourceType: "webhook_endpoint",
    resourceId: row.id,
    metadata: { url: row.url },
  });
  return true;
}

export async function listWebhookDeliveries(workspaceId: string, limit = 50): Promise<WebhookDeliveryRow[]> {
  const rows = await developerDatabase().query(
    `SELECT id, event_id AS "eventId", event_type AS "eventType", status, attempts,
       last_response_code AS "lastResponseCode", last_error AS "lastError",
       next_attempt_at AS "nextAttemptAt", delivered_at AS "deliveredAt", created_at AS "createdAt"
     FROM app_webhook_deliveries WHERE workspace_id = $1::uuid
     ORDER BY created_at DESC LIMIT $2`,
    [workspaceId, Math.min(Math.max(limit, 1), 200)],
  );
  return rows as WebhookDeliveryRow[];
}

/** Puts a failed delivery back in the queue with a fresh attempt budget. */
export async function requeueFailedDelivery(input: { workspaceId: string; deliveryId: string }): Promise<boolean> {
  const rows = await developerDatabase().query(
    `UPDATE app_webhook_deliveries SET status = 'pending', attempts = 0, next_attempt_at = now(),
       last_error = NULL, updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'failed'
     RETURNING id`,
    [input.workspaceId, input.deliveryId],
  );
  return rows.length > 0;
}

/**
 * Queues one event for the workspace's subscription when it is enabled and subscribed to the
 * event type. The event_id is the deduplication key. A repeated call with the same key queues nothing.
 */
export async function queueWebhookDeliveries(input: {
  workspaceId: string;
  eventType: WebhookEventType;
  eventId: string;
  payload: Record<string, unknown>;
}): Promise<number> {
  const rows = await developerDatabase().query(
    `INSERT INTO app_webhook_deliveries (id, workspace_id, endpoint_id, event_id, event_type, payload)
     SELECT $1::uuid, e.workspace_id, e.id, $3::text, $4::text, $5::jsonb
     FROM app_webhook_endpoints e
     WHERE e.workspace_id = $2::uuid AND e.enabled AND $4::text = ANY(e.events)
     ON CONFLICT (endpoint_id, event_id) DO NOTHING
     RETURNING id`,
    [randomUUID(), input.workspaceId, input.eventId, input.eventType, JSON.stringify(input.payload)],
  );
  return rows.length;
}

export function openSigningSecret(sealed: { ciphertext: string; iv: string; tag: string }): string {
  return decryptToken({ ciphertext: sealed.ciphertext, iv: sealed.iv, authTag: sealed.tag });
}
