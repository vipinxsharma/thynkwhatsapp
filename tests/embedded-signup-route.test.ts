import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), exchange: vi.fn(), granted: vi.fn(), numbers: vi.fn(), verify: vi.fn(),
  subscribe: vi.fn(), registration: vi.fn(), register: vi.fn(), save: vi.fn(),
  inspect: vi.fn(), recordState: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/meta/connections", () => ({
  saveMetaConnection: mocks.save,
  recordTokenState: mocks.recordState,
  validMetaIdentifier: (value: string) => /^\d{5,30}$/.test(value),
}));
vi.mock("@/lib/meta/encryption", () => ({
  encryptToken: () => ({ ciphertext: "c", iv: "i", authTag: "t" }),
}));
vi.mock("@/lib/meta/client", () => ({
  MetaGraphClient: class {
    static exchangeCodeForToken = mocks.exchange;
    listGrantedWabaIds = mocks.granted;
    listPhoneNumbers = mocks.numbers;
    verifyPhoneOwnership = mocks.verify;
    subscribeWabaToWebhook = mocks.subscribe;
    getPhoneRegistration = mocks.registration;
    registerPhoneNumber = mocks.register;
    inspectToken = mocks.inspect;
  },
}));

import { POST } from "../app/api/meta/embedded-signup/route";

const wabaId = "987654321012345";
const phoneNumberId = "123456789012345";
function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/meta/embedded-signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://test");
  vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key-with-at-least-32-characters");
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ ok: true, session: { tenantId: "tenant", userId: "user" } });
  mocks.exchange.mockResolvedValue({ access_token: "business-token", token_type: "bearer" });
  mocks.verify.mockResolvedValue({ displayPhoneNumber: "+91 98765 43210", verifiedName: "Test" });
  mocks.subscribe.mockResolvedValue({ success: true });
  mocks.registration.mockResolvedValue({ registered: false });
  mocks.register.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
  mocks.inspect.mockResolvedValue({ isValid: true, expiresAt: new Date("2027-01-17T00:00:00Z"), wabaIds: [] });
  mocks.recordState.mockResolvedValue(undefined);
});

describe("Embedded Signup onboarding route", () => {
  it("subscribes webhooks, saves the connection and registers a new Cloud API number", async () => {
    const res = await POST(request({ code: "abc", wabaId, phoneNumberId, channelName: "Support" }));
    expect(res.status).toBe(200);
    expect(mocks.subscribe).toHaveBeenCalledWith(wabaId);
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.register).toHaveBeenCalledWith(phoneNumberId, expect.stringMatching(/^\d{6}$/));
    expect((await res.json()).data).toMatchObject({ registered: true, webhookSubscribed: true });
  });

  it("does not re-register a number Meta already lists as registered", async () => {
    mocks.registration.mockResolvedValue({ registered: true });
    const res = await POST(request({ code: "abc", wabaId, phoneNumberId, channelName: "Support" }));
    expect(res.status).toBe(200);
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("skips registration for WhatsApp Business app onboarding", async () => {
    const res = await POST(request({
      code: "abc", wabaId, phoneNumberId, channelName: "Support", finishType: "business_app",
    }));
    expect(res.status).toBe(200);
    expect(mocks.registration).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("keeps the saved connection and warns when registration fails", async () => {
    mocks.register.mockRejectedValue(new Error("PIN mismatch"));
    const res = await POST(request({ code: "abc", wabaId, phoneNumberId, channelName: "Support" }));
    expect(res.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body.data.registered).toBe(false);
    expect(body.data.warning).toMatch(/did not register/);
  });

  it("recovers the account from the token when Meta sent no session IDs", async () => {
    mocks.granted.mockResolvedValue([wabaId]);
    mocks.numbers.mockResolvedValue([{ id: phoneNumberId }]);
    const res = await POST(request({ code: "abc", channelName: "Support" }));
    expect(res.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith(wabaId, phoneNumberId);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      ownership: expect.objectContaining({ wabaId, phoneNumberId }),
    }));
  });

  it("explains when the login shared no WhatsApp account, without saving anything", async () => {
    mocks.granted.mockResolvedValue([]);
    const res = await POST(request({ code: "abc", channelName: "Support" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/did not share a WhatsApp Business account/);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("refuses to guess between several shared accounts or numbers", async () => {
    mocks.granted.mockResolvedValue([wabaId, "555555555555555"]);
    expect((await POST(request({ code: "abc", channelName: "Support" }))).status).toBe(422);
    mocks.granted.mockResolvedValue([wabaId]);
    mocks.numbers.mockResolvedValue([{ id: phoneNumberId }, { id: "222222222222222" }]);
    expect((await POST(request({ code: "abc", channelName: "Support" }))).status).toBe(422);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects a missing code and half-supplied IDs", async () => {
    expect((await POST(request({ wabaId, phoneNumberId, channelName: "Support" }))).status).toBe(400);
    expect((await POST(request({ code: "abc", wabaId, channelName: "Support" }))).status).toBe(400);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("records the token expiry and still succeeds when that record fails", async () => {
    const ok = await POST(request({ code: "abc", wabaId, phoneNumberId, channelName: "Support" }));
    expect(ok.status).toBe(200);
    expect(mocks.recordState).toHaveBeenCalledWith({ wabaId, expiresAt: new Date("2027-01-17T00:00:00Z") });
    mocks.recordState.mockRejectedValue(new Error("column does not exist"));
    expect((await POST(request({ code: "abc", wabaId, phoneNumberId, channelName: "Support" }))).status).toBe(200);
  });
});
