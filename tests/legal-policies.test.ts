import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getPolicy, legalContact, policies } from "../lib/legal/policies";
import { proxy } from "../proxy";

describe("Xeccel public policies", () => {
  it("provides a distinct, complete page for each payment and trust topic", () => {
    expect(policies.map((policy) => policy.slug)).toEqual([
      "privacy", "terms", "refunds-cancellations", "service-delivery", "cookies", "messaging-use",
    ]);
    for (const policy of policies) {
      expect(getPolicy(policy.slug)).toBe(policy);
      expect(policy.summary.length).toBeGreaterThan(30);
      expect(policy.sections.length).toBeGreaterThan(0);
      expect(policy.sections.every((section) => section.heading && section.paragraphs.every(Boolean))).toBe(true);
    }
    expect(getPolicy("unknown")).toBeUndefined();
  });

  it("uses verified parent-company contact details rather than invented Xeccel credentials", () => {
    expect(legalContact.entity).toBe("ThynkWISE Advisors Private Limited");
    expect(legalContact.email).toBe("partner@thynkwise.co.in");
    expect(legalContact.address).toContain("Pune");
  });

  it("keeps policy pages public without opening private workspace routes", async () => {
    for (const path of ["/legal", ...policies.map((policy) => `/legal/${policy.slug}`)]) {
      const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
    const privateResponse = await proxy(new NextRequest("http://localhost:3000/dashboard"));
    expect(privateResponse.status).toBe(307);
    expect(privateResponse.headers.get("location")).toContain("/login");
  });
});
