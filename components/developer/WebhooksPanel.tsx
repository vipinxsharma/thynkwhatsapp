"use client";

import { useCallback, useEffect, useState } from "react";

const EVENTS = [
  { value: "message.received", label: "Inbound message received" },
  { value: "message.status_changed", label: "Message status changed" },
  { value: "contact.created", label: "Contact created" },
] as const;

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  updatedAt: string;
}

interface DeliveryRow {
  id: string;
  eventId: string;
  eventType: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastResponseCode: number | null;
  lastError: string | null;
  createdAt: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function WebhooksPanel({ canManage }: { canManage: boolean }) {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["message.received"]);
  const [enabled, setEnabled] = useState(true);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [configResponse, deliveryResponse] = await Promise.all([
      fetch("/api/developer/webhooks", { cache: "no-store" }),
      fetch("/api/developer/webhooks/deliveries?limit=50", { cache: "no-store" }),
    ]);
    const configPayload = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok) {
      setError(configPayload.error || "Unable to load webhook settings");
      return;
    }
    const current: WebhookConfig | null = configPayload.data || null;
    setConfig(current);
    if (current) {
      setUrl(current.url);
      setEvents(current.events);
      setEnabled(current.enabled);
    }
    const deliveryPayload = await deliveryResponse.json().catch(() => ({}));
    setDeliveries(deliveryResponse.ok ? deliveryPayload.data || [] : []);
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  function toggleEvent(value: string) {
    setEvents((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/developer/webhooks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events, enabled }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Unable to save the webhook endpoint");
    } else {
      if (payload.signingSecret) setRevealedSecret(payload.signingSecret);
      setNotice("Webhook endpoint saved.");
      await load();
    }
    setPending(false);
  }

  async function rotateSecret() {
    if (!window.confirm("Generate a new signing secret? The current secret stops working immediately.")) return;
    setError("");
    const response = await fetch("/api/developer/webhooks/rotate-secret", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to rotate the signing secret");
    else setRevealedSecret(payload.signingSecret);
  }

  async function removeEndpoint() {
    if (!window.confirm("Remove the webhook endpoint? Pending deliveries will be discarded.")) return;
    setError("");
    const response = await fetch("/api/developer/webhooks", { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to remove the endpoint");
    setRevealedSecret(null);
    await load();
  }

  async function retryDelivery(delivery: DeliveryRow) {
    setError("");
    const response = await fetch(`/api/developer/webhooks/deliveries/${delivery.id}/retry`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to retry this delivery");
    await load();
  }

  if (!canManage) {
    return <p className="text-sm text-[var(--muted)]">Only workspace owners and admins can configure webhooks.</p>;
  }

  return (
    <div className="space-y-6">
      {revealedSecret && (
        <div role="alert" className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-[var(--heading)]">
            Save this signing secret. It is shown once. Verify each request&apos;s <code>X-Xeccel-Signature</code> header with it.
          </p>
          <code className="block break-all rounded-lg bg-[var(--surface-muted)] p-3 font-mono text-xs text-[var(--foreground)]">{revealedSecret}</code>
          <button type="button" onClick={() => setRevealedSecret(null)} className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)]">
            I have saved it
          </button>
        </div>
      )}

      <form onSubmit={save} className="space-y-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--foreground)]">
          Endpoint URL
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/xeccel-events"
            required
            className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--foreground)]"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--foreground)]">Events</legend>
          {EVENTS.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input type="checkbox" checked={events.includes(item.value)} onChange={() => toggleEvent(item.value)} />
              <span>{item.label}</span>
              <code className="text-xs text-[var(--muted)]">{item.value}</code>
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Deliveries enabled
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending || events.length === 0} className="min-h-10 rounded-lg bg-whatsapp px-4 text-sm font-semibold text-black disabled:opacity-50">
            {pending ? "Saving…" : config ? "Save changes" : "Create endpoint"}
          </button>
          {config && (
            <>
              <button type="button" onClick={rotateSecret} className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)]">
                Rotate signing secret
              </button>
              <button type="button" onClick={removeEndpoint} className="min-h-10 rounded-lg px-4 text-sm font-semibold text-red-400 hover:underline">
                Remove endpoint
              </button>
            </>
          )}
        </div>
        {notice && <p role="status" className="text-sm text-[var(--muted)]">{notice}</p>}
        {error && <p role="status" className="text-sm text-red-400">{error}</p>}
      </form>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--heading)]">Recent deliveries</h3>
        {deliveries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No deliveries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Time</th>
                  <th className="py-2 pr-3 font-semibold">Event</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Attempts</th>
                  <th className="py-2 pr-3 font-semibold">Response</th>
                  <th className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-t border-[var(--border)]">
                    <td className="py-3 pr-3 text-[var(--muted)]">{formatDate(delivery.createdAt)}</td>
                    <td className="py-3 pr-3 font-mono text-xs text-[var(--heading)]">{delivery.eventType}</td>
                    <td className="py-3 pr-3">{delivery.status}</td>
                    <td className="py-3 pr-3">{delivery.attempts}</td>
                    <td className="py-3 pr-3 text-[var(--muted)]">
                      {delivery.lastResponseCode ?? "—"}
                      {delivery.lastError && <span className="block text-xs">{delivery.lastError}</span>}
                    </td>
                    <td className="py-3 text-right">
                      {delivery.status === "failed" && (
                        <button type="button" onClick={() => retryDelivery(delivery)} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-whatsapp-dark hover:underline">
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
