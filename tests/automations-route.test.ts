import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const engine = vi.hoisted(() => ({ getRules: vi.fn(), addRule: vi.fn(), updateRule: vi.fn(), deleteRule: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: vi.fn(async () => ({ ok: true, session: { tenantId: "11111111-1111-4111-8111-111111111111", role: "owner" } })),
}));
vi.mock("@/lib/automations/rules", () => ({ AutomationEngine: engine }));

import { GET, POST, PUT, DELETE } from "../app/api/automations/route";

beforeEach(() => vi.stubEnv("NODE_ENV", "production"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("production automation gate", () => {
  it("rejects reads and mutations before touching in-memory rules", async () => {
    const url = "http://localhost:3000/api/automations";
    const requests = [
      GET(new NextRequest(url)),
      POST(new NextRequest(url, { method: "POST", body: "{}" })),
      PUT(new NextRequest(url, { method: "PUT", body: "{}" })),
      DELETE(new NextRequest(url, { method: "DELETE" })),
    ];
    for (const response of await Promise.all(requests)) expect(response.status).toBe(503);
    expect(engine.getRules).not.toHaveBeenCalled();
    expect(engine.addRule).not.toHaveBeenCalled();
    expect(engine.updateRule).not.toHaveBeenCalled();
    expect(engine.deleteRule).not.toHaveBeenCalled();
  });
});
