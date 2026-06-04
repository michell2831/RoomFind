import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface LayoutProps {
  onLogout: () => void;
  currentUser: { name: string; role: string; email: string };
  isPolling: boolean;
  lastUpdated: Date | null;
  onRefresh?: () => void;
}

export default function Layout({ onLogout, currentUser, isPolling, lastUpdated, onRefresh }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "night">("light");
  const location = useLocation();

  useEffect(() => {
    // close mobile sidebar on navigation
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("theme") : null;
    if (saved === "light" || saved === "night") {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-night", "theme-light");
    root.classList.add(`theme-${theme}`);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex">
      <Sidebar onLogout={onLogout} currentUser={currentUser} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 sm:ml-60 flex flex-col min-h-screen">
        <TopBar
          isPolling={isPolling}
          lastUpdated={lastUpdated}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
          onRefresh={onRefresh}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === "light" ? "night" : "light"))}
        />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
