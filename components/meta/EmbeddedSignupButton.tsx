"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface EmbeddedSignupButtonProps {
  onSuccess?: (data: { wabaId: string; phoneNumberId: string }) => void;
  tenantId?: string;
}

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: any;
  }
}

export function EmbeddedSignupButton({ onSuccess, tenantId = "1" }: EmbeddedSignupButtonProps) {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "108923485723910";
  const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID || "123456789012345";

  useEffect(() => {
    // 1. Initialize Facebook JavaScript SDK
    if (typeof window !== "undefined") {
      window.fbAsyncInit = function () {
        window.FB?.init({
          appId: META_APP_ID,
          cookie: true,
          xfbml: true,
          version: "v21.0",
        });
      };

      // Load SDK script if not already present
      if (!document.getElementById("facebook-jssdk")) {
        const js = document.createElement("script");
        js.id = "facebook-jssdk";
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        document.body.appendChild(js);
      }

      // 2. Listen for postMessage from Meta's Embedded Signup popup
      const handlePostMessage = async (event: MessageEvent) => {
        if (
          event.origin !== "https://www.facebook.com" &&
          event.origin !== "https://web.facebook.com"
        ) {
          return;
        }

        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (data.type === "WA_EMBEDDED_SIGNUP") {
            const { waba_id, phone_number_id } = data.data || {};
            console.log("[Embedded Signup postMessage received]", { waba_id, phone_number_id });
          }
        } catch (e) {
          // Non-JSON message from other sources
        }
      };

      window.addEventListener("message", handlePostMessage);
      return () => window.removeEventListener("message", handlePostMessage);
    }
  }, [META_APP_ID]);

  const handleLaunchSignup = () => {
    setLoading(true);
    setError(null);

    // If FB SDK is loaded and real app is configured
    if (window.FB && META_APP_ID !== "108923485723910") {
      window.FB.login(
        (response: any) => {
          if (response.authResponse?.code) {
            exchangeOAuthCode(response.authResponse.code);
          } else {
            setLoading(false);
            setError("Meta Embedded Signup was closed or cancelled.");
          }
        },
        {
          config_id: CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "",
            sessionInfoVersion: "2",
          },
        }
      );
    } else {
      // Mock Embedded Signup for local development & testing
      setTimeout(() => {
        exchangeOAuthCode("mock_code_thynkwise_sandbox_123");
      }, 1200);
    }
  };

  const exchangeOAuthCode = async (code: string) => {
    try {
      const res = await fetch("/api/meta/embedded-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          tenantId,
          wabaId: "109823485723910",
          phoneNumberId: "105678234901234",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link WABA");

      setConnected(true);
      setLoading(false);
      if (onSuccess) {
        onSuccess(data.data);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {connected ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-whatsapp-light/10 border border-whatsapp-light/20 text-whatsapp-light text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-whatsapp-light" />
          <span>WhatsApp Business Account Connected (Verified)</span>
        </div>
      ) : (
        <button
          onClick={handleLaunchSignup}
          disabled={loading}
          className="relative group overflow-hidden px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-[#1877F2] to-[#0A56C2] hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2.5 shadow-lg shadow-blue-900/30 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to Meta...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Connect with Meta Embedded Signup</span>
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded border border-red-800/40">
          {error}
        </p>
      )}
    </div>
  );
}
