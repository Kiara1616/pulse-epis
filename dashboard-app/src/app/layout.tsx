import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/widgets/Sidebar/ui/Sidebar";
import { Header } from "@/widgets/Header/ui/Header";
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
            <div className="flex min-h-screen bg-[#f3f6fb] w-full">
              <Sidebar />
              <main className="flex-1 ml-28 flex flex-col min-h-screen overflow-hidden bg-[#f3f6fb]">
                <Header />
                <div className="px-8 py-7 flex-1 w-full max-w-[1500px] mx-auto">{children}</div>
              </main>
            </div>
            </AuthBoundary>
          </AuthProvider>
      </body>
    </html>
  );
}
