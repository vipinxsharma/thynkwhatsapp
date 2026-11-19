import { describe, expect, it } from "vitest";
import { platformTenantHealthStatus, type PlatformTenantHealth } from "../lib/workspaces/store";

const now = new Date("2026-11-16T12:00:00Z");
const base: PlatformTenantHealth = {
  workspaceId: "w1",
  enabledChannels: 1,
  conversations: 3,
  outbound7d: 2,
  failed7d: 0,
  lastInboundAt: "2026-11-15T12:00:00Z",
  lastOutboundAt: null,
};

describe("platformTenantHealthStatus", () => {
  it("reports no channel when none is enabled or no row exists", () => {
    expect(platformTenantHealthStatus(undefined, now)).toBe("No channel");
    expect(platformTenantHealthStatus({ ...base, enabledChannels: 0 }, now)).toBe("No channel");
  });
  it("reports send failures before activity", () => {
    expect(platformTenantHealthStatus({ ...base, failed7d: 1 }, now)).toBe("Send failures");
  });
  it("reports active when there was recent traffic", () => {
    expect(platformTenantHealthStatus(base, now)).toBe("Active");
  });
  it("reports idle when the last message is older than 7 days", () => {
    expect(platformTenantHealthStatus({ ...base, lastInboundAt: "2026-11-01T00:00:00Z" }, now)).toBe("Idle");
  });
});
