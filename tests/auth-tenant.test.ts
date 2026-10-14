import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken, verifySessionToken, type AppSession } from "../lib/auth/session";
import { GET as getContacts, POST as createContact } from "../app/api/contacts/route";
import { POST as startEmbeddedSignup } from "../app/api/meta/embedded-signup/route";

const secret = "test-auth-session-secret-that-is-at-least-32-characters";

function session(tenantId: string, role: AppSession["role"] = "admin"): AppSession {
  return {
    userId: `user-${tenantId}`,
    email: `${tenantId}@example.com`,
    tenantId,
    tenantName: `Tenant ${tenantId}`,
    role,
  };
}

async function authenticatedRequest(
  url: string,
  tenantId: string,
  init: RequestInit = {},
  role: AppSession["role"] = "admin"
) {
  const token = await createSessionToken(session(tenantId, role));
  return new NextRequest(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
}

describe("signed tenant sessions", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SESSION_SECRET", secret);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("round-trips a signed session and rejects tampering", async () => {
    const token = await createSessionToken(session("tenant-a"));
    await expect(verifySessionToken(token)).resolves.toMatchObject({ tenantId: "tenant-a" });
    await expect(verifySessionToken(`${token}tampered`)).resolves.toBeNull();
  });

  it("rejects unauthenticated API requests", async () => {
    const response = await getContacts(new NextRequest("http://localhost:3000/api/contacts"));
    expect(response.status).toBe(401);
  });

  it("enforces role permissions on contact mutations", async () => {
    const request = await authenticatedRequest(
      "http://localhost:3000/api/contacts",
      "tenant-viewer",
      {
        method: "POST",
        body: JSON.stringify({ name: "Blocked User", phoneNumber: "+919100000001" }),
      },
      "viewer"
    );
    const response = await createContact(request);
    expect(response.status).toBe(403);
  });

  it("keeps local development data isolated by tenant", async () => {
    const createRequest = await authenticatedRequest(
      "http://localhost:3000/api/contacts",
      "tenant-a",
      {
        method: "POST",
        body: JSON.stringify({ name: "Tenant A Only", phoneNumber: "+919100000002" }),
      }
    );
    expect((await createContact(createRequest)).status).toBe(200);

    const tenantAResponse = await getContacts(
      await authenticatedRequest("http://localhost:3000/api/contacts", "tenant-a")
    );
    const tenantBResponse = await getContacts(
      await authenticatedRequest("http://localhost:3000/api/contacts", "tenant-b")
    );
    const tenantAData = await tenantAResponse.json();
    const tenantBData = await tenantBResponse.json();

    expect(tenantAData.data.some((contact: { name: string }) => contact.name === "Tenant A Only")).toBe(true);
    expect(tenantBData.data.some((contact: { name: string }) => contact.name === "Tenant A Only")).toBe(false);
  });

  it("does not consume an Embedded Signup code before durable WABA storage exists", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const request = await authenticatedRequest(
      "http://localhost:3000/api/meta/embedded-signup",
      "tenant-meta",
      {
        method: "POST",
        body: JSON.stringify({
          code: "one-time-code",
          wabaId: "109823485723910",
          phoneNumberId: "105678234901234",
        }),
      },
      "owner"
    );

    const response = await startEmbeddedSignup(request);
    expect(response.status).toBe(501);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
