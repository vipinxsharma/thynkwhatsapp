import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  pending: false,
  redirect: vi.fn((url: string): never => { throw new Error(`REDIRECT:${url}`); }),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  getSession: vi.fn(),
  ensureWorkspaceForUser: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: mocks.pending, data: null, method: null, action: null }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.cookieSet, delete: vi.fn() }) }));
vi.mock("@/lib/auth/neon", () => ({
  neonAuth: {
    signIn: { email: mocks.signInEmail },
    signUp: { email: mocks.signUpEmail },
    getSession: mocks.getSession,
  },
}));
vi.mock("@/lib/auth/config", () => ({
  neonAuthConfigured: () => true,
  workspaceAccessConfigured: () => true,
}));
vi.mock("@/lib/workspaces/store", () => ({ ensureWorkspaceForUser: mocks.ensureWorkspaceForUser }));

import { signInAction, signUpAction } from "../app/auth/actions";
import { SubmitButton } from "../components/auth/SubmitButton";

const user = { id: "user-1", email: "owner@example.test", name: "Owner" };

function credentials(extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("email", "Owner@Example.test");
  form.set("password", "a-long-test-password");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = false;
  vi.stubEnv("AUTH_SESSION_SECRET", "test-session-secret-0123456789abcdef");
  // A signed-out browser: the request carries no Neon Auth cookie, so
  // getSession() cannot see the session the sign-in call has just created.
  mocks.getSession.mockResolvedValue({ data: null, error: null });
  mocks.ensureWorkspaceForUser.mockResolvedValue({
    workspaceId: "ws-1", workspaceName: "Owner Workspace", workspaceSlug: "owner", role: "owner",
  });
});

describe("SubmitButton", () => {
  it("is an enabled submit button while idle", () => {
    const html = renderToStaticMarkup(<SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>);
    expect(html).toContain('type="submit"');
    expect(html).toContain('aria-busy="false"');
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
    expect(html).not.toContain("submit-spinner");
    expect(html).toContain("Sign in");
  });

  it("is disabled, busy and shows a spinner while the action is pending", () => {
    mocks.pending = true;
    const html = renderToStaticMarkup(<SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>);
    expect(html).toMatch(/<button[^>]* disabled=""/);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("submit-spinner");
    expect(html).toContain("Signing in…");
  });
});

describe("signInAction", () => {
  it("issues the app session from the sign-in response when the request has no auth cookie", async () => {
    mocks.signInEmail.mockResolvedValue({ data: { token: "t", user }, error: null });

    await expect(signInAction(credentials())).rejects.toThrow("REDIRECT:/dashboard");

    expect(mocks.signInEmail).toHaveBeenCalledWith({ email: "owner@example.test", password: "a-long-test-password" });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.ensureWorkspaceForUser).toHaveBeenCalledWith(user);
    expect(mocks.cookieSet).toHaveBeenCalledOnce();
  });

  it("tolerates a duplicate submit: both requests end in the dashboard redirect", async () => {
    mocks.signInEmail.mockResolvedValue({ data: { token: "t", user }, error: null });

    const results = await Promise.allSettled([signInAction(credentials()), signInAction(credentials())]);

    expect(results.map((result) => (result as PromiseRejectedResult).reason.message)).toEqual([
      "REDIRECT:/dashboard",
      "REDIRECT:/dashboard",
    ]);
  });

  it("redirects back to the form when the credentials are rejected", async () => {
    mocks.signInEmail.mockResolvedValue({ data: null, error: { message: "Invalid email or password" } });

    await expect(signInAction(credentials())).rejects.toThrow("REDIRECT:/login?error=signin");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});

describe("signUpAction", () => {
  it("signs the new user in when sign-up returns a session token", async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { token: "t", user }, error: null });

    await expect(signUpAction(credentials({ name: "Owner" }))).rejects.toThrow("REDIRECT:/billing?welcome=1");
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.cookieSet).toHaveBeenCalledOnce();
  });

  it("asks for email verification when sign-up starts no session", async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { token: null, user }, error: null });

    await expect(signUpAction(credentials({ name: "Owner" }))).rejects.toThrow("REDIRECT:/login?notice=verify-email");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
