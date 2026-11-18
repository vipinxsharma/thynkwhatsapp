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
