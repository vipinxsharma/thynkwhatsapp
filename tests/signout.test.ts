import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearApplicationSession: vi.fn(async () => undefined),
  neonAuthSignOut: vi.fn(async () => undefined),
  redirect: vi.fn((url: string): never => { throw new Error(`REDIRECT:${url}`); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/bootstrap", () => ({
  issueApplicationSession: vi.fn(),
  clearApplicationSession: mocks.clearApplicationSession,
}));
vi.mock("@/lib/auth/neon", () => ({ neonAuth: { signOut: mocks.neonAuthSignOut } }));
vi.mock("@/lib/auth/config", () => ({
  neonAuthConfigured: () => true,
  workspaceAccessConfigured: () => true,
}));

import { signOutAction } from "../app/auth/actions";

describe("signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears the app session and redirects after provider sign-out", async () => {
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/login?notice=signed-out");

    expect(mocks.neonAuthSignOut).toHaveBeenCalledOnce();
    expect(mocks.clearApplicationSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login?notice=signed-out");
  });

  it("still clears the app session and redirects if provider sign-out fails", async () => {
    mocks.neonAuthSignOut.mockRejectedValueOnce(new Error("provider unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(signOutAction()).rejects.toThrow("REDIRECT:/login?notice=signed-out");

    expect(mocks.clearApplicationSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login?notice=signed-out");
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
