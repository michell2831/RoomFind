import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  RefreshCw,
  Signal,
  Menu,
  Moon,
  Sun,
  Unlock,
  Lock,
  AlertCircle,
  Wifi,
  Info,
  Trash2,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { Notification } from "../../types";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "System overview & live status" },
  "/rooms": { title: "Rooms", subtitle: "Manage room availability and details" },
  "/users": { title: "Users", subtitle: "Manage all portal accounts" },
  "/schedules": { title: "Schedules", subtitle: "Room scheduling and calendar" },
  "/logs": { title: "Access Logs", subtitle: "RFID access history and audit trail" },
  "/rfid": { title: "RFID Cards", subtitle: "Card assignment and management" },
  "/devices": { title: "Devices", subtitle: "Manage connected hardware" },
};

interface TopBarProps {
  isPolling: boolean;
  lastUpdated: Date | null;
  onToggleSidebar?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onRefresh?: () => void;
  theme?: "light" | "night";
  onToggleTheme?: () => void;
  notifications: Notification[];
  onMarkNotificationAsRead: (id: string) => void;
  onMarkAllNotificationsAsRead: () => void;
  onClearNotification: (id: string) => void;
  onClearAllNotifications: () => void;
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

export default function TopBar({
  isPolling,
  lastUpdated,
  onToggleSidebar,
  collapsed,
  onToggleCollapse,
  onRefresh,
  theme = "light",
  onToggleTheme,
  notifications,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onClearNotification,
  onClearAllNotifications,
}: TopBarProps) {
  const location = useLocation();
  const page = pageTitles[location.pathname] || { title: "Room Find", subtitle: "" };
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "access_granted":
        return <Unlock size={14} className="text-[#00D4AA]" />;
      case "access_checked_out":
        return <Lock size={14} className="text-[#3B82F6]" />;
      case "access_denied":
        return <AlertCircle size={14} className="text-[#EF4444]" />;
      case "device_status":
        return <Wifi size={14} className="text-[#F59E0B]" />;
      default:
        return <Info size={14} className="text-[#94A3B8]" />;
    }
  };

  const getNotificationIconBg = (type: Notification["type"]) => {
    switch (type) {
      case "access_granted":
        return "bg-[#00D4AA]/10";
      case "access_checked_out":
        return "bg-[#3B82F6]/10";
      case "access_denied":
        return "bg-[#EF4444]/10";
      case "device_status":
        return "bg-[#F59E0B]/10";
      default:
        return "bg-[#94A3B8]/10";
    }
  };

  return (
    <header className="h-14 bg-[var(--panel-bg)]/90 backdrop-blur border-b border-[color:var(--panel-border)] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button onClick={onToggleSidebar} className="sm:hidden p-2 rounded-md text-[#94A3B8] hover:bg-white/5">
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-white font-semibold text-sm tracking-wide truncate" style={{ fontFamily: "'Space Grotesk', sans-serif", maxWidth: "22rem" }}>
            {page.title}
          </h1>
          <p className="text-[#94A3B8] text-xs hidden sm:block">{page.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <div className={`flex items-center gap-1.5 ${isPolling ? "text-[#00D4AA]" : "text-[#94A3B8]"}`}>
            <Signal size={13} />
            <span className="font-mono text-[10px] hidden sm:inline">LIVE</span>
          </div>
          {lastUpdated && (
            <span className="font-mono text-[10px] text-[#94A3B8]/60 hidden sm:inline">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleTheme}
            className="p-1 rounded-md hover:bg-white/5"
            aria-label="Toggle theme"
          >
            {theme === "night" ? (
              <Moon size={14} className="text-[#94A3B8]" />
            ) : (
              <Sun size={14} className="text-[#94A3B8]" />
            )}
          </button>
          <button
            onClick={() => { if (onRefresh) onRefresh(); }}
            className="p-1 rounded-md hover:bg-white/5"
            aria-label="Refresh"
          >
            <RefreshCw
              size={14}
              className={`text-[#94A3B8] ${isPolling ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="relative w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label="Notifications"
          >
            <Bell size={15} className="text-[#94A3B8]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#00D4AA] rounded-full animate-pulse"></span>
            )}
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0F1729] backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold text-xs tracking-wider uppercase font-mono">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#00D4AA]/15 text-[#00D4AA] rounded text-[9px] font-mono font-bold">
                      {unreadCount} NEW
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => onMarkAllNotificationsAsRead()}
                      className="text-[#00D4AA] hover:text-[#00D4AA]/80 text-[10px] font-medium transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={() => onClearAllNotifications()}
                      className="text-[#94A3B8] hover:text-red-400 text-[10px] font-medium transition-colors ml-2"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[350px] overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => onMarkNotificationAsRead(notification.id)}
                      className={`px-4 py-3 flex gap-3 hover:bg-white/[0.03] transition-colors cursor-pointer relative ${
                        !notification.read
                          ? "border-l-2 border-l-[#00D4AA] bg-[#00D4AA]/[0.02]"
                          : ""
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${getNotificationIconBg(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-semibold text-white truncate ${!notification.read ? "font-bold" : ""}`}>
                            {notification.title}
                          </p>
                          <span className="text-[9px] text-[#94A3B8]/50 shrink-0 font-mono">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed break-words">
                          {notification.message}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearNotification(notification.id);
                        }}
                        className="p-1 text-[#94A3B8]/40 hover:text-red-400 hover:bg-white/5 rounded transition-all shrink-0 self-center"
                        title="Delete notification"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
                      <Bell size={18} className="text-[#94A3B8]/30" />
                    </div>
                    <p className="text-white font-medium text-xs">
                      All caught up!
                    </p>
                    <p className="text-[10px] text-[#94A3B8]/60 mt-1">
                      No notifications yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
