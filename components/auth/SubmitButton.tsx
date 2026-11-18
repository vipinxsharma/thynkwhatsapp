"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

const baseClass =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-whatsapp px-4 py-2.5 text-sm font-semibold text-[#0b132a] shadow-glow hover:bg-whatsapp-dark disabled:cursor-wait disabled:opacity-70 disabled:hover:bg-whatsapp";

/**
 * Submit button for forms that post to a server action. From the first click
 * until the action settles it is disabled and marked busy, so a second click
 * or Enter press cannot submit the form again.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = baseClass,
  ariaLabel,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-label={ariaLabel} disabled={pending} aria-busy={pending} className={className}>
      {pending && (
        <span
          aria-hidden="true"
          data-testid="submit-spinner"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <span aria-live="polite">{pending ? pendingLabel : children}</span>
    </button>
  );
}
