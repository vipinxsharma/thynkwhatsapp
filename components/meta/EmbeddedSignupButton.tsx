"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { parseSignupSessionEvent } from "@/lib/meta/embedded-signup-session";

interface EmbeddedSignupButtonProps {
  channelName?: string;
  onSuccess?: (data: { wabaId: string; phoneNumberId: string }) => void;
}

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

  const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
  const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID;
  const activeRef = useRef(false);
  const submittingRef = useRef(false);
  const codeRef = useRef<string | null>(null);
  const idsRef = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);
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
      setLoading(false);
      setError(message);
    },
    [stopWaiting]
  );

  const submitIfReady = useCallback(async () => {
    const code = codeRef.current;
    const ids = idsRef.current;
    if (!activeRef.current || submittingRef.current || !code || !ids) return;

    submittingRef.current = true;
    stopWaiting();
    try {
      const res = await fetch("/api/meta/embedded-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...ids, channelName: channelNameRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link WABA");

      activeRef.current = false;
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
        if (window.FB) window.fbAsyncInit();
      }

      // 2. Listen for postMessage from Meta's Embedded Signup popup
      const handlePostMessage = (event: MessageEvent) => {
        if (!activeRef.current || submittingRef.current) return;
        const session = parseSignupSessionEvent(event.origin, event.data);
        if (!session) return;
        if (session.kind === "cancel") return fail("Meta Embedded Signup was cancelled.");
        if (session.kind === "error") {
          return fail("Meta Embedded Signup reported an error. Please try again.");
        }
        if (session.kind === "incomplete") {
          return fail("Meta did not return a phone number. Complete phone setup and try again.");
        }
        idsRef.current = { wabaId: session.wabaId, phoneNumberId: session.phoneNumberId };
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
    setLoading(true);
    setError(null);

    window.FB.login(
      (response: { authResponse?: { code?: string } }) => {
        if (!activeRef.current) return;
        const code = response.authResponse?.code;
        if (!code) return fail("Meta Embedded Signup was closed or cancelled.");
        codeRef.current = code;
        void submitIfReady();
        if (!idsRef.current) {
          waitTimerRef.current = setTimeout(() => {
            fail("Meta did not return account details. Please retry the signup.");
          }, 20_000);
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
  };

  return (
    <div className="space-y-3">
      {connected ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-whatsapp-light/10 border border-whatsapp-light/20 text-whatsapp-light text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-whatsapp-light" />
          <span>Number saved. Check Meta status and live delivery separately.</span>
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
