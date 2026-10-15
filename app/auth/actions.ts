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
  const { error } = await neonAuth.signIn.email({ email, password });
  if (error) redirect("/login?error=signin");
  await issueApplicationSession();
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
  const { error } = await neonAuth.signUp.email({ name, email, password });
  if (error) redirect("/login?mode=signup&error=signup");

  const { data } = await neonAuth.getSession();
  if (!data?.user) redirect("/login?notice=verify-email");
  await issueApplicationSession();
  redirect("/dashboard");
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
  if (neonAuthConfigured()) await neonAuth.signOut();
  await clearApplicationSession();
  redirect("/login");
}
