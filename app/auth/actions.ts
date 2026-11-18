"use server";

import { redirect } from "next/navigation";
import { issueApplicationSession, clearApplicationSession } from "@/lib/auth/bootstrap";
import { neonAuth } from "@/lib/auth/neon";
import { neonAuthConfigured, workspaceAccessConfigured } from "@/lib/auth/config";

function configuredOrRedirect(): void {
  if (!workspaceAccessConfigured()) {
    redirect("/login?error=configuration");
  }
}

export async function signInAction(formData: FormData) {
  configuredOrRedirect();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const { data, error } = await neonAuth.signIn.email({ email, password });
  if (error || !data?.user) redirect("/login?error=signin");
  // Use the user from this sign-in response: the session cookie it set is not
  // readable through getSession() until the next request.
  await issueApplicationSession(data.user);
  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  configuredOrRedirect();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (name.length < 2 || !email.includes("@") || password.length < 12) {
    redirect("/login?mode=signup&error=validation");
  }
  const { data, error } = await neonAuth.signUp.email({ name, email, password });
  if (error) redirect("/login?mode=signup&error=signup");

  // No token means no session was started (email verification is pending).
  if (!data?.token || !data.user) redirect("/login?notice=verify-email");
  await issueApplicationSession(data.user);
  redirect("/billing?welcome=1");
}

export async function requestPasswordResetAction(formData: FormData) {
  configuredOrRedirect();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  await neonAuth.requestPasswordReset({
    email,
    redirectTo: "/auth/reset-password",
  });
  redirect("/login?notice=reset-sent");
}

export async function resetPasswordAction(formData: FormData) {
  configuredOrRedirect();
  const token = String(formData.get("token") || "");
  const newPassword = String(formData.get("password") || "");
  if (!token || newPassword.length < 12) {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=validation`);
  }
  const { error } = await neonAuth.resetPassword({ token, newPassword });
  if (error) redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=reset`);
  redirect("/login?notice=password-reset");
}

export async function signOutAction() {
  try {
    if (neonAuthConfigured()) await neonAuth.signOut();
  } catch (error) {
    // Provider sign-out can fail independently; still revoke Xeccel's app session.
    console.error("Neon Auth sign-out failed; clearing the Xeccel session", error);
  } finally {
    await clearApplicationSession();
  }
  redirect("/login?notice=signed-out");
}
