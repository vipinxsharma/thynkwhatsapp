import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "thynkWISE | WhatsApp Business SaaS Platform",
  description: "Enterprise Multi-Tenant WhatsApp Business API & Unified CRM Inbox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0e14] text-gray-100 min-h-screen antialiased selection:bg-whatsapp-light/30 selection:text-whatsapp-light">
        {children}
      </body>
    </html>
  );
}
