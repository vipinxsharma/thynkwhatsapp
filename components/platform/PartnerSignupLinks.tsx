import { buildPartnerSignupLink, partnerJourneys } from "@/lib/partner-solutions/journeys";

export function PartnerSignupLinks({ baseUrl }: { baseUrl: string }) {
  return (
    <section aria-labelledby="partner-journeys" className="mt-10">
      <h2 id="partner-journeys" className="text-lg font-bold">Partner signup links</h2>
      <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
        Partner journeys run in parallel with direct tenant onboarding. Share these links with a partner; they do not change any workspace or Meta account.
      </p>
      <ul className="grid gap-4">
        {partnerJourneys.map((journey) => {
          const link = buildPartnerSignupLink(baseUrl, journey.code);
          return (
            <li key={journey.code} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="font-semibold">{journey.name}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{journey.pathway}</p>
              {link ? (
                <p className="mt-3 break-all rounded-lg bg-[var(--background)] p-3 font-mono text-xs">{link}</p>
              ) : (
                <p role="alert" className="mt-3 text-sm text-red-300">Link could not be built. Check the base URL and code.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
