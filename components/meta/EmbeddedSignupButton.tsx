"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { parseSignupSessionEvent } from "@/lib/meta/embedded-signup-session";

interface EmbeddedSignupButtonProps {
  channelName?: string;
  onSuccess?: (data: { wabaId: string; phoneNumberId: string }) => void;
}

// Shown when Meta finishes the popup without a WhatsApp Business account for this login.
export const NO_WABA_MAPPED_MESSAGE =
  "This Meta account doesn't have a WhatsApp Business account mapped to it, so it can't be connected. " +
  "In Meta Business Settings, add or share a WhatsApp Business account with this login, then try again.";

// Meta sends the account IDs just before the code. If they have not arrived shortly after
// the code, ask the server to recover the account from the token instead of failing.
const SESSION_GRACE_MS = 4_000;
// FB.init only versions the SDK's own calls; Meta asks for the latest Graph API version here.
const SDK_GRAPH_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION || "v27.0";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: any;
  }
}

export function EmbeddedSignupButton({ channelName = "", onSuccess }: EmbeddedSignupButtonProps) {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
  const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID;
  const activeRef = useRef(false);
  const submittingRef = useRef(false);
  const codeRef = useRef<string | null>(null);
  const idsRef = useRef<{ wabaId: string; phoneNumberId: string; finishType: string } | null>(null);
  const allowRecoveryRef = useRef(false);
  const channelNameRef = useRef("");
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopWaiting = useCallback(() => {
    if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    waitTimerRef.current = null;
  }, []);

  const fail = useCallback(
    (message: string) => {
      stopWaiting();
      activeRef.current = false;
      submittingRef.current = false;
      codeRef.current = null;
      idsRef.current = null;
      allowRecoveryRef.current = false;
      setLoading(false);
      setError(message);
    },
    [stopWaiting]
  );

  const submitIfReady = useCallback(async () => {
    const code = codeRef.current;
    const ids = idsRef.current;
    if (!activeRef.current || submittingRef.current || !code) return;
    if (!ids && !allowRecoveryRef.current) return;

    submittingRef.current = true;
    stopWaiting();
    try {
      const res = await fetch("/api/meta/embedded-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...(ids || {}), channelName: channelNameRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link WABA");

      activeRef.current = false;
      setNotice(typeof data.data?.warning === "string" ? data.data.warning : null);
      setConnected(true);
      setLoading(false);
      onSuccessRef.current?.(data.data);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Failed to link WABA");
    }
  }, [fail, stopWaiting]);

  useEffect(() => {
    // 1. Initialize Facebook JavaScript SDK
    if (typeof window !== "undefined") {
      if (META_APP_ID && /^\d+$/.test(META_APP_ID)) {
        window.fbAsyncInit = function () {
          window.FB?.init({
            appId: META_APP_ID,
            cookie: true,
            xfbml: true,
            version: SDK_GRAPH_VERSION,
          });
        };

        // Load SDK script if not already present
        if (!document.getElementById("facebook-jssdk")) {
          const js = document.createElement("script");
          js.id = "facebook-jssdk";
          js.src = "https://connect.facebook.net/en_US/sdk.js";
          document.body.appendChild(js);
        }
        if (window.FB) window.fbAsyncInit();
      }

      // 2. Listen for postMessage from Meta's Embedded Signup popup
      const handlePostMessage = (event: MessageEvent) => {
        if (!activeRef.current || submittingRef.current) return;
        const session = parseSignupSessionEvent(event.origin, event.data);
        if (!session) return;
        if (session.kind === "cancel") {
          return fail(
            session.currentStep
              ? `Meta Embedded Signup was cancelled at step ${session.currentStep}.`
              : "Meta Embedded Signup was cancelled."
          );
        }
        if (session.kind === "error") {
          const reference = [session.errorCode && `code ${session.errorCode}`, session.sessionId && `session ${session.sessionId}`]
            .filter(Boolean).join(", ");
          return fail(
            (session.errorMessage || "Meta Embedded Signup reported an error. Please try again.") +
            (reference ? ` (${reference})` : "")
          );
        }
        if (session.kind === "incomplete") {
          return fail(NO_WABA_MAPPED_MESSAGE);
        }
        idsRef.current = {
          wabaId: session.wabaId,
          phoneNumberId: session.phoneNumberId,
          finishType: session.finishType,
        };
        void submitIfReady();
      };

      window.addEventListener("message", handlePostMessage);
      return () => {
        window.removeEventListener("message", handlePostMessage);
        activeRef.current = false;
        stopWaiting();
      };
    }
  }, [META_APP_ID, fail, stopWaiting, submitIfReady]);

  const handleLaunchSignup = () => {
    if (!channelName || channelName.length > 60) {
      setError("Enter a channel name (1–60 characters) before connecting.");
      return;
    }
    if (!META_APP_ID || !/^\d+$/.test(META_APP_ID) || !CONFIG_ID || !/^\d+$/.test(CONFIG_ID)) {
      setError("Meta Embedded Signup is not configured. Contact your workspace administrator.");
      return;
    }
    if (!window.FB) {
      setError("Meta sign-in is unavailable. Check your connection and try again.");
      return;
    }
    stopWaiting();
    channelNameRef.current = channelName;
    activeRef.current = true;
    submittingRef.current = false;
    codeRef.current = null;
    idsRef.current = null;
    allowRecoveryRef.current = false;
    setLoading(true);
    setError(null);
    setNotice(null);

    window.FB.login(
      (response: { authResponse?: { code?: string } }) => {
        if (!activeRef.current) return;
        const code = response.authResponse?.code;
        if (!code) return fail("Meta Embedded Signup was closed or cancelled.");
        codeRef.current = code;
        void submitIfReady();
        if (!idsRef.current) {
          waitTimerRef.current = setTimeout(() => {
            allowRecoveryRef.current = true;
            void submitIfReady();
          }, SESSION_GRACE_MS);
        }
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        // Requests are served as Embedded Signup v4, which returns session info for every flow.
        // These extras are the set proven in production; v4 treats them as optional.
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "2",
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      {connected ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-whatsapp-light/10 border border-whatsapp-light/20 text-whatsapp-light text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-whatsapp-light" />
          <span>
            Number saved. Add a payment method for it in WhatsApp Manager before sending, then check Meta
            status and live delivery.
          </span>
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

      {notice && (
        <p className="text-xs text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-800/40">
          {notice}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded border border-red-800/40">
          {error}
        </p>
      )}
    </div>
  );
}
