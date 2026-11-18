import { describe, expect, it } from "vitest";
import { buildPartnerSignupLink, isValidPartnerCode } from "../lib/partner-solutions/journeys";

describe("partner signup links", () => {
  it("builds an https getting-started link with the partner code", () => {
    expect(buildPartnerSignupLink("https://xeccel.com", "acme-partner")).toBe(
      "https://xeccel.com/getting-started?partner=acme-partner"
    );
  });

  it("rejects codes with unsafe characters", () => {
    expect(isValidPartnerCode("Acme Partner")).toBe(false);
    expect(isValidPartnerCode("a")).toBe(false);
    expect(buildPartnerSignupLink("https://xeccel.com", "x/../admin")).toBeNull();
  });

  it("refuses non-https base URLs and malformed ones", () => {
    expect(buildPartnerSignupLink("http://xeccel.com", "acme")).toBeNull();
    expect(buildPartnerSignupLink("not a url", "acme")).toBeNull();
  });
});

describe("partner signup code migration", () => {
  it("keeps the code check in the schema as well as in code", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("db/migrations/0015_partner_signup_codes.sql", "utf8");
    expect(sql).toMatch(/CHECK \(partner_code ~ '\^\[a-z0-9\]\[a-z0-9-\]\{1,39\}\$'\)/);
    expect(sql).toMatch(/PRIMARY KEY/);
  });
});
