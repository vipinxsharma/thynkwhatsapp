import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";
import CookieConsent from "@/components/consent/CookieConsent";
import { consentBootstrapScript } from "@/components/consent/consentConfig";

export const metadata: Metadata = {
  metadataBase: new URL("https://xeccel.com"),
  title: "Xeccel | WhatsApp Business Platform",
  description: "Enterprise Multi-Tenant WhatsApp Business API & Unified CRM Inbox",
  icons: { icon: [{ url: "/brand/xeccel-logo.jpg", type: "image/jpeg" }] },
  openGraph: { images: [{ url: "/brand/xeccel-logo-horizontal.png", width: 1200, height: 600, alt: "Xeccel logo" }] },
  twitter: { card: "summary_large_image", images: ["/brand/xeccel-logo-horizontal.png"] },
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
        {/* Consent defaults must run before any tag. Add GTM/GA4 only after this script. */}
        <Script id="consent-default" strategy="beforeInteractive">{consentBootstrapScript()}</Script>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
