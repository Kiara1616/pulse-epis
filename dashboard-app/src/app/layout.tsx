import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/features/layout/AppShell";
import { AuthBoundary } from "@/features/access/AuthBoundary";
import { AuthProvider } from "@/features/access/AuthProvider";

export const metadata: Metadata = {
  title: "Pulse EPIS",
  description: "Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className="antialiased bg-[#F4F7FE] text-gray-900 min-h-screen"
        suppressHydrationWarning
      >
          <AuthProvider>
            <AuthBoundary>
            <AppShell>{children}</AppShell>
            </AuthBoundary>
          </AuthProvider>
      </body>
    </html>
  );
}
