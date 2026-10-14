import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://xeccel.com"),
  title: "Xeccel | WhatsApp Business Platform",
  description: "Enterprise Multi-Tenant WhatsApp Business API & Unified CRM Inbox",
  icons: { icon: [{ url: "/brand/xeccel-logo.jpg", type: "image/jpeg" }] },
  openGraph: { images: [{ url: "/brand/xeccel-logo.jpg", width: 2000, height: 2000, alt: "Xeccel logo" }] },
  twitter: { card: "summary_large_image", images: ["/brand/xeccel-logo.jpg"] },
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
