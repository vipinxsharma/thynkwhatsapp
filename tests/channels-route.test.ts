import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), list: vi.fn(), rename: vi.fn(), setDefault: vi.fn(), connection: vi.fn(),
  numbers: vi.fn(), sync: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/meta/connections", () => ({
  listWhatsAppChannels: mocks.list,
  renameWhatsAppChannel: mocks.rename,
  setDefaultWhatsAppChannel: mocks.setDefault,
  getMetaConnectionForNumber: mocks.connection,
  syncWhatsAppChannelStatus: mocks.sync,
}));
vi.mock("@/lib/meta/client", () => ({
  MetaGraphClient: class { listPhoneNumbers = mocks.numbers; },
}));

import { GET, PATCH, POST } from "../app/api/channels/whatsapp/route";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const phoneNumberId = "123456789012345";
function request(method: string, body?: unknown) {
  return new NextRequest("http://localhost:3000/api/channels/whatsapp", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, session: { tenantId: workspaceId, role: "admin" } });
  mocks.list.mockResolvedValue([]);
  mocks.rename.mockResolvedValue(true);
  mocks.setDefault.mockResolvedValue(true);
  mocks.connection.mockResolvedValue({ workspaceId, wabaId: "987654321012345", phoneNumberId, accessToken: "token" });
  mocks.numbers.mockResolvedValue([{ id: phoneNumberId, display_phone_number: "+91 9328008800", quality_rating: "GREEN" }]);
  mocks.sync.mockResolvedValue(true);
});

describe("WhatsApp channel management", () => {
  it("lists only the authenticated workspace inventory", async () => {
    expect((await GET(request("GET"))).status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(workspaceId);
  });

  it("enforces management permission before a change", async () => {
    mocks.auth.mockResolvedValueOnce({ ok: false, response: new Response("Forbidden", { status: 403 }) });
    expect((await PATCH(request("PATCH", { action: "make_default", phoneNumberId }))).status).toBe(403);
    expect(mocks.setDefault).not.toHaveBeenCalled();
  });

  it("changes only a workspace-owned default and validates names", async () => {
    expect((await PATCH(request("PATCH", { action: "make_default", phoneNumberId }))).status).toBe(200);
    expect(mocks.setDefault).toHaveBeenCalledWith(workspaceId, phoneNumberId);
    expect((await PATCH(request("PATCH", { action: "rename", phoneNumberId, name: " " }))).status).toBe(400);
    expect(mocks.rename).not.toHaveBeenCalled();
  });

  it("refuses to mark a missing Meta number as listed", async () => {
    mocks.numbers.mockResolvedValueOnce([]);
    expect((await POST(request("POST", { phoneNumberId }))).status).toBe(409);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("records a Meta inventory observation without claiming delivery", async () => {
    expect((await POST(request("POST", { phoneNumberId }))).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId, phoneNumberId, metaStatus: "LISTED_BY_META", qualityRating: "GREEN",
    }));
  });
});
