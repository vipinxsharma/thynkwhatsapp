import { describe, expect, it } from "vitest";
import { visibleNavigation } from "../lib/partner/navigation";

const items = [
  { name: "Inbox", href: "/inbox" },
  { name: "Partner solutions", href: "/partner-solutions", partnerOnly: true },
];

describe("partner navigation", () => {
  it("hides partner entries until a superadmin approves", () => {
    expect(visibleNavigation(items, false).map((item) => item.href)).toEqual(["/inbox"]);
  });

  it("shows partner entries once approved", () => {
    expect(visibleNavigation(items, true).map((item) => item.href)).toEqual(["/inbox", "/partner-solutions"]);
  });
});
