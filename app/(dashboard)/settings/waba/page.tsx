import { StrapiClient, isDurableInboxEnabled } from "@/lib/strapi/client";
import { EmbeddedSignupButton } from "@/components/meta/EmbeddedSignupButton";
import {
  Phone,
  Lock,
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";
import { requirePageSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function WabaSettingsPage() {
  const session = await requirePageSession();
  const strapi = new StrapiClient(session.tenantId);
  const waba = await strapi.getWABA();
  const durableConnection = isDurableInboxEnabled();
  const hasAccount = Boolean(waba.wabaId);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="pb-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            WhatsApp Business Account (WABA) Settings
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your Meta Cloud API connection, phone numbers, and webhook subscriptions.
          </p>
        </div>

      </div>

      {!durableConnection && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          This page is not using durable account storage. Any displayed account details may be demo
          data and must not be treated as a live Meta connection.
        </div>
      )}

      {/* Meta Embedded Signup Action Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0e1626] to-[#0a0e14] border border-blue-500/20 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Connect Client WABA via Meta Embedded Signup</span>
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-xl leading-relaxed">
              Connect your WhatsApp Business Account through Meta without sharing your Facebook
              password. Connection is confirmed only after Meta returns your account and phone IDs
              and the platform stores the verified ownership record.
            </p>
          </div>

          <EmbeddedSignupButton />
        </div>

        <div className="pt-3 border-t border-white/5 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-whatsapp-light" />
            <span>Credentials are stored server-side after a successful connection.</span>
          </div>
        </div>
      </div>

      {/* Stored WABA details, without implying Meta review approval. */}
      <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Account Profile</h3>
          <span className="px-2.5 py-0.5 rounded-full bg-whatsapp-light/10 text-whatsapp-light border border-whatsapp-light/20 text-xs font-semibold">
            {hasAccount
              ? durableConnection
                ? "Connection stored"
                : "Unverified source"
              : "Not connected"}
          </span>
        </div>

        {!hasAccount ? (
          <p className="text-sm text-gray-400">
            No WhatsApp Business Account is connected to this workspace yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-gray-400">Meta WABA ID</span>
              <p className="text-sm font-mono font-bold text-white">{waba.wabaId}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-gray-400">Display Business Name</span>
              <p className="text-sm font-semibold text-white">{waba.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Connected Phone Numbers List */}
      <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Phone Numbers</h3>
            <p className="text-xs text-gray-400 mt-0.5">Numbers recorded for this workspace</p>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {waba.phoneNumbers?.map((phone) => (
            <div key={phone.id} className="py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-50 border border-white/5 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-whatsapp-light" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white font-mono">
                    {formatPhoneNumber(phone.displayPhoneNumber)}
                  </p>
                  <p className="text-xs text-gray-400">{phone.verifiedName}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <span className="text-gray-400">Phone Number ID:</span>
                  <p className="font-mono text-gray-200">{phone.phoneNumberId}</p>
                </div>

                <div className="text-right">
                  <span className="text-gray-400">Quality Rating:</span>
                  <p className="text-gray-200 font-bold">{phone.qualityRating}</p>
                </div>

                <span className="px-2 py-0.5 rounded bg-surface-50 text-gray-300 border border-white/10 text-xs font-semibold">
                  {phone.codeVerificationStatus}
                </span>
              </div>
            </div>
          ))}
          {!waba.phoneNumbers?.length && (
            <p className="py-3 text-sm text-gray-400">No phone number is recorded yet.</p>
          )}
        </div>
      </div>

      {/* Webhook status; the verification secret is never sent to the browser. */}
      <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-3">
        <h3 className="text-base font-bold text-white">Webhook Subscription</h3>
        <p className="text-xs text-gray-400">
          The platform operator configures the Meta app callback and verification secret. They are
          not customer account settings. A stored subscription does not prove live event delivery.
        </p>
        <p className="text-sm text-gray-200">
          {durableConnection && hasAccount && waba.webhookSubscribed
            ? "Subscription recorded for this account."
            : "No subscription is recorded for this workspace."}
        </p>
      </div>
    </div>
  );
}
