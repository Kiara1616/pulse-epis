"use client";

import { useState } from "react";
import { Sidebar } from "@/widgets/Sidebar/ui/Sidebar";
import { Header } from "@/widgets/Header/ui/Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen min-w-0 bg-[#f6f8fc]">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45 md:hidden"
        />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div
        aria-hidden="true"
        className={`hidden shrink-0 transition-[width] duration-200 ease-out md:block ${sidebarCollapsed ? "md:w-[76px]" : "md:w-64"}`}
      />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#f6f8fc]">
        <Header onOpenMenu={() => setMobileMenuOpen(true)} />
        <div className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-7 lg:px-10 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
