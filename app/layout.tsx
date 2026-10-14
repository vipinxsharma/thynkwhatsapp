import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xeccel | WhatsApp Business Platform",
  description: "Enterprise Multi-Tenant WhatsApp Business API & Unified CRM Inbox",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get("xeccel-theme")?.value;
  return (
    <html lang="en" className={theme === "dark" ? "dark" : ""} suppressHydrationWarning>
      <body className="min-h-screen antialiased selection:bg-whatsapp-light/30">
        {children}
      </body>
    </html>
  );
}
