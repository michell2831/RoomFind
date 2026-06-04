import React from "react";
import { Bell, RefreshCw, Signal, Menu, Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "System overview & live status" },
  "/rooms": { title: "Rooms", subtitle: "Manage room availability and details" },
  "/users": { title: "Users", subtitle: "Manage faculty and admin accounts" },
  "/schedules": { title: "Schedules", subtitle: "Room scheduling and calendar" },
  "/logs": { title: "Access Logs", subtitle: "RFID access history and audit trail" },
  "/rfid": { title: "RFID Cards", subtitle: "Card assignment and management" },
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
}

export default function TopBar({ isPolling, lastUpdated, onToggleSidebar, collapsed, onToggleCollapse, onRefresh, theme = "light", onToggleTheme }: TopBarProps) {
  const location = useLocation();
  const page = pageTitles[location.pathname] || { title: "Room Find", subtitle: "" };

  return (
    <header className="h-14 bg-[var(--panel-bg)]/90 backdrop-blur border-b border-[color:var(--panel-border)] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button onClick={onToggleSidebar} className="sm:hidden p-2 rounded-md text-[#94A3B8] hover:bg-white/5">
          <Menu size={18} />
        </button>
        {/* desktop collapse toggle removed per user request */}
        <div>
          <h1 className="text-white font-semibold text-sm tracking-wide truncate" style={{ fontFamily: "'Space Grotesk', sans-serif", maxWidth: "22rem" }}>
            {page.title}
          </h1>
          <p className="text-[#94A3B8] text-xs hidden sm:block">{page.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Polling indicator */}
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

        <button className="relative w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
          <Bell size={15} className="text-[#94A3B8]" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#00D4AA] rounded-full"></span>
        </button>
      </div>
    </header>
  );
}
