import { StrapiClient } from "@/lib/strapi/client";
import { EmbeddedSignupButton } from "@/components/meta/EmbeddedSignupButton";
import {
  ShieldCheck,
  Phone,
  Radio,
  CheckCircle2,
  ExternalLink,
  Server,
  Lock,
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WabaSettingsPage() {
  const strapi = new StrapiClient();
  const waba = await strapi.getWABA();

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

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Meta Tech Provider Mode
          </span>
        </div>
      </div>

      {/* Meta Embedded Signup Action Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0e1626] to-[#0a0e14] border border-blue-500/20 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Connect Client WABA via Meta Embedded Signup</span>
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-xl leading-relaxed">
              Use Meta Embedded Signup to onboard customer WhatsApp Business Accounts in under 60
              seconds. The popup grants thynkWISE permission to send messages and register webhooks
              on their behalf without sharing Facebook passwords.
            </p>
          </div>

          <EmbeddedSignupButton tenantId="1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-white/5 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-whatsapp-light" />
            <span>Encrypted at Rest with AES-256-GCM</span>
          </div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>Webhook Auto-Subscription Enabled</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            <span>Strapi Multi-Tenant Isolated</span>
          </div>
        </div>
      </div>

      {/* Active WABA Details */}
      <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Active Account Profile</h3>
          <span className="px-2.5 py-0.5 rounded-full bg-whatsapp-light/10 text-whatsapp-light border border-whatsapp-light/20 text-xs font-semibold">
            {waba.accountReviewStatus}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-gray-400">Meta WABA ID</span>
            <p className="text-sm font-mono font-bold text-white">{waba.wabaId}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-gray-400">Display Business Name</span>
            <p className="text-sm font-semibold text-white">{waba.name}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-gray-400">Billing Currency & Timezone</span>
            <p className="text-sm font-semibold text-white">
              {waba.currency} ({waba.timezoneId})
            </p>
          </div>
        </div>
      </div>

      {/* Connected Phone Numbers List */}
      <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Connected Phone Numbers</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Sender endpoints verified on Meta Cloud API
            </p>
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
                  <p className="text-emerald-400 font-bold">{phone.qualityRating}</p>
                </div>

                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                  {phone.codeVerificationStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Configuration Information */}
      <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-3">
        <h3 className="text-base font-bold text-white">Meta Webhook Configuration Details</h3>
        <p className="text-xs text-gray-400">
          Configure these values inside the Meta App Dashboard under{" "}
          <strong>WhatsApp &gt; Configuration</strong>.
        </p>

        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
            <span className="text-gray-400 font-medium">Callback URL</span>
            <code className="text-whatsapp-light font-mono">
              https://your-domain.vercel.app/api/webhooks/meta
            </code>
          </div>
          <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
            <span className="text-gray-400 font-medium">Verify Token</span>
            <code className="text-gray-200 font-mono">
              thynkwise_meta_verify_token_secure_2026
            </code>
          </div>
          <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
            <span className="text-gray-400 font-medium">Subscribed Webhook Fields</span>
            <span className="text-gray-200 font-mono font-semibold">
              messages, message_template_status_update
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
