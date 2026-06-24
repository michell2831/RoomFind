import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { Notification } from "../../types";

interface LayoutProps {
  onLogout: () => void;
  currentUser: { name: string; role: string; email: string; department?: string };
  isPolling: boolean;
  lastUpdated: Date | null;
  onRefresh?: () => void;
  notifications: Notification[];
  onMarkNotificationAsRead: (id: string) => void;
  onMarkAllNotificationsAsRead: () => void;
  onClearNotification: (id: string) => void;
  onClearAllNotifications: () => void;
}

export default function Layout({
  onLogout,
  currentUser,
  isPolling,
  lastUpdated,
  onRefresh,
  notifications,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onClearNotification,
  onClearAllNotifications,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "night">(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("theme") : null;
    return (saved === "light" || saved === "night") ? saved : "light";
  });
  const location = useLocation();

  useEffect(() => {
    // close mobile sidebar on navigation
    setSidebarOpen(false);
  }, [location.pathname]);

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
          notifications={notifications}
          onMarkNotificationAsRead={onMarkNotificationAsRead}
          onMarkAllNotificationsAsRead={onMarkAllNotificationsAsRead}
          onClearNotification={onClearNotification}
          onClearAllNotifications={onClearAllNotifications}
        />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
