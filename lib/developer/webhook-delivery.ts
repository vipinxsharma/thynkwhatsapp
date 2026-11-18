import { after } from "next/server";
import { developerDatabase } from "@/lib/developer/db";
import {
  MAX_WEBHOOK_ATTEMPTS,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  signWebhookPayload,
  webhookRetryDelayMs,
  type WebhookEventType,
} from "@/lib/developer/webhook-signing";
import { openSigningSecret, queueWebhookDeliveries } from "@/lib/developer/webhook-store";

const DELIVERY_TIMEOUT_MS = 10_000;
// A claimed delivery is hidden from other workers for this long. A crashed worker's delivery
// becomes due again after the lease expires.
const CLAIM_LEASE_SQL = "interval '10 minutes'";

export interface WebhookEnvelope {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  workspaceId: string;
  data: Record<string, unknown>;
}

export function buildWebhookEnvelope(input: {
  eventId: string;
  eventType: WebhookEventType;
  workspaceId: string;
  data: Record<string, unknown>;
  now?: Date;
}): WebhookEnvelope {
  return {
    id: input.eventId,
    type: input.eventType,
    createdAt: (input.now ?? new Date()).toISOString(),
    workspaceId: input.workspaceId,
    data: input.data,
  };
}

/**
 * Called from the inbox store after a successful write. It queues the event for the workspace's
 * subscription and starts delivery after the response. It never throws, so a webhook problem
 * cannot fail an inbound message write.
 */
export async function emitWebhookEvent(input: {
  workspaceId: string;
  eventType: WebhookEventType;
  eventId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    const envelope = buildWebhookEnvelope(input);
    const queued = await queueWebhookDeliveries({
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      eventId: input.eventId,
      payload: envelope as unknown as Record<string, unknown>,
    });
    if (queued > 0) scheduleWebhookProcessing();
  } catch (error) {
    console.error("[Webhook Enqueue Error]", error);
  }
}

/** Runs due deliveries after the response is sent. Outside a request, it runs at once. */
export function scheduleWebhookProcessing(): void {
  const task = () =>
    processDueWebhookDeliveries().catch((error) => console.error("[Webhook Delivery Error]", error));
  try {
    after(task);
  } catch {
    void task();
  }
}

interface ClaimedDelivery {
  id: string;
  workspace_id: string;
  endpoint_id: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  url: string;
  encryptedSecret: string;
  secretIv: string;
  secretTag: string;
}

/** Takes up to `limit` due deliveries for this worker. Concurrent workers never claim the same row. */
async function claimDueDeliveries(limit: number): Promise<ClaimedDelivery[]> {
  const rows = await developerDatabase().query(
    `WITH due AS (
       SELECT d.id FROM app_webhook_deliveries d
       JOIN app_webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.status = 'pending' AND d.next_attempt_at <= now() AND e.enabled
       ORDER BY d.next_attempt_at ASC
       LIMIT $1
       FOR UPDATE OF d SKIP LOCKED
     ), claimed AS (
       UPDATE app_webhook_deliveries d
       SET attempts = d.attempts + 1, next_attempt_at = now() + ${CLAIM_LEASE_SQL}, updated_at = now()
       FROM due WHERE d.id = due.id
       RETURNING d.id, d.workspace_id, d.endpoint_id, d.event_id, d.event_type, d.payload, d.attempts
     )
     SELECT c.id, c.workspace_id, c.endpoint_id, c.event_id, c.event_type, c.payload, c.attempts,
       e.url, e.encrypted_secret AS "encryptedSecret", e.secret_iv AS "secretIv", e.secret_tag AS "secretTag"
     FROM claimed c JOIN app_webhook_endpoints e ON e.id = c.endpoint_id`,
    [limit],
  );
  return rows as ClaimedDelivery[];
}

async function markDelivered(deliveryId: string, responseCode: number): Promise<void> {
  await developerDatabase().query(
    `UPDATE app_webhook_deliveries
     SET status = 'delivered', delivered_at = now(), last_response_code = $2, last_error = NULL, updated_at = now()
     WHERE id = $1::uuid`,
    [deliveryId, responseCode],
  );
}

async function markAttemptFailed(delivery: ClaimedDelivery, responseCode: number | null, error: string): Promise<"retrying" | "failed"> {
  const exhausted = delivery.attempts >= MAX_WEBHOOK_ATTEMPTS;
  const status = exhausted ? "failed" : "pending";
  await developerDatabase().query(
    `UPDATE app_webhook_deliveries
     SET status = $2, last_response_code = $3, last_error = $4,
       next_attempt_at = CASE WHEN $2 = 'pending'
         THEN now() + make_interval(secs => $5::double precision / 1000) ELSE next_attempt_at END,
       updated_at = now()
     WHERE id = $1::uuid`,
    [delivery.id, status, responseCode, error.slice(0, 300), webhookRetryDelayMs(delivery.attempts)],
  );
  return exhausted ? "failed" : "retrying";
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function attemptDelivery(delivery: ClaimedDelivery): Promise<"delivered" | "retrying" | "failed"> {
  let secret: string;
  try {
    secret = openSigningSecret({ ciphertext: delivery.encryptedSecret, iv: delivery.secretIv, tag: delivery.secretTag });
  } catch {
    return markAttemptFailed(delivery, null, "Signing secret could not be opened");
  }

  const body = JSON.stringify(delivery.payload);
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Xeccel-Webhooks/1.0",
    [WEBHOOK_EVENT_HEADER]: delivery.event_type,
    [WEBHOOK_EVENT_ID_HEADER]: delivery.event_id,
    [WEBHOOK_SIGNATURE_HEADER]: signWebhookPayload({
      secret,
      body,
      timestampSeconds: Math.floor(Date.now() / 1000),
    }),
  };

  try {
    const response = await fetch(delivery.url, {
      method: "POST",
      headers,
      body,
      // A redirect would send the signed body to a host the subscriber did not configure.
      redirect: "manual",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    if (response.status >= 200 && response.status < 300) {
      await markDelivered(delivery.id, response.status);
      return "delivered";
    }
    return markAttemptFailed(delivery, response.status, `Endpoint responded with HTTP ${response.status}`);
  } catch (error) {
    return markAttemptFailed(delivery, null, describeError(error));
  }
}

/** Claims and attempts due deliveries. Safe to call from request hooks, retries and a worker route. */
export async function processDueWebhookDeliveries(options: { limit?: number } = {}): Promise<{
  claimed: number;
  delivered: number;
  retrying: number;
  failed: number;
}> {
  const claimed = await claimDueDeliveries(Math.min(Math.max(options.limit ?? 25, 1), 100));
  const outcomes = await Promise.all(claimed.map((delivery) => attemptDelivery(delivery)));
  return {
    claimed: claimed.length,
    delivered: outcomes.filter((outcome) => outcome === "delivered").length,
    retrying: outcomes.filter((outcome) => outcome === "retrying").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
  };
}
