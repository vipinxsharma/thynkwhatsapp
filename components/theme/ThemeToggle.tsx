"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const themeEvent = "xeccel-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(themeEvent, onChange);
  return () => window.removeEventListener(themeEvent, onChange);
}

function getTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  const nextTheme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.cookie = `xeccel-theme=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    window.dispatchEvent(new Event(themeEvent));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${className}`}
    >
      {theme === "dark" ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
      <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
