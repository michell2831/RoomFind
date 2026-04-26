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
  const location = useLocation();

  useEffect(() => {
    // close mobile sidebar on navigation
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0B1120] flex">
      <Sidebar onLogout={onLogout} currentUser={currentUser} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 sm:ml-60 flex flex-col min-h-screen">
        <TopBar isPolling={isPolling} lastUpdated={lastUpdated} onToggleSidebar={() => setSidebarOpen((s) => !s)} onRefresh={onRefresh} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
