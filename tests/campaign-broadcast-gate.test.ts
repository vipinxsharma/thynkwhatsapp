import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireApiSession: auth }));

import { POST } from "../app/api/campaigns/broadcast/route";

describe("campaign broadcast gate", () => {
  it("requires an owner or administrator before revealing the gate", async () => {
    auth.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const response = await POST(new NextRequest("http://localhost/api/campaigns/broadcast", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(auth).toHaveBeenCalledWith(expect.any(NextRequest), ["owner", "admin"]);
  });

  it("never sends a broadcast from the old development path", async () => {
    auth.mockResolvedValueOnce({ ok: true, session: { tenantId: "test-workspace" } });
    const response = await POST(new NextRequest("http://localhost/api/campaigns/broadcast", {
      method: "POST",
      body: JSON.stringify({ segment: "missing", templateName: "promotion" }),
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
