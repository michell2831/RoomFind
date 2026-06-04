import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  DoorOpen,
  Users,
  Calendar,
  FileText,
  CreditCard,
  LogOut,
  ChevronRight,
  Wifi,
  X,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
  authorizedRoles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/", icon: <LayoutDashboard size={18} />, authorizedRoles: ["admin", "faculty", "student"] },
  { label: "Rooms", path: "/rooms", icon: <DoorOpen size={18} />, authorizedRoles: ["admin", "faculty", "student"] },
  { label: "Users", path: "/users", icon: <Users size={18} />, authorizedRoles: ["admin"] },
  { label: "Schedules", path: "/schedules", icon: <Calendar size={18} />, authorizedRoles: ["admin", "faculty", "student"] },
  { label: "Access Logs", path: "/logs", icon: <FileText size={18} />, authorizedRoles: ["admin", "faculty"] },
  { label: "RFID Cards", path: "/rfid", icon: <CreditCard size={18} />, authorizedRoles: ["admin"] },
  { label: "Devices", path: "/devices", icon: <Cpu size={18} />, authorizedRoles: ["admin"] },
];

interface SidebarProps {
  onLogout: () => void;
  currentUser: { name: string; role: string; email: string };
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
}

export default function Sidebar({ onLogout, currentUser, isOpen, onClose, collapsed }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-[var(--panel-bg)] flex flex-col border-r border-[color:var(--panel-border)]">
            <div className="px-4 py-4 border-b border-[color:var(--panel-border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-12 h-12 flex items-center justify-center p-1 overflow-hidden">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    RoomFind
                  </p>
                  <p className="text-[#94A3B8] text-[10px] tracking-widest uppercase">IoT Portal</p>
                </div>
              </div>
              <button onClick={onClose} className="text-[#94A3B8] p-1 rounded-md hover:bg-white/5">
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <p className="text-[#94A3B8] text-[9px] tracking-widest uppercase px-2 mb-3 font-medium">Navigation</p>
              <ul className="space-y-0.5">
                {navItems.filter(item => item.authorizedRoles.includes(currentUser.role)).map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                          isActive
                            ? "bg-[#00D4AA]/15 text-[#00D4AA] font-medium"
                            : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <span className={cn("transition-colors", isActive ? "text-[#00D4AA]" : "text-[#94A3B8] group-hover:text-white")}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {isActive && <ChevronRight size={12} className="text-[#00D4AA]" />}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="px-3 pb-4 border-t border-[color:var(--panel-border)] pt-3">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#00D4AA]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#00D4AA] text-xs font-bold">
                    {currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{currentUser.name}</p>
                  <p className="text-[#94A3B8] text-[10px] capitalize">{currentUser.role}</p>
                </div>
              </div>
              <button
                onClick={() => { onLogout(); onClose?.(); }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10 transition-all w-full text-sm"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className={cn(
        "hidden sm:fixed sm:left-0 sm:top-0 sm:h-full sm:bg-[var(--panel-bg)] sm:flex sm:flex-col sm:z-50 sm:border-r sm:border-[color:var(--panel-border)]",
        collapsed ? "sm:w-16" : "sm:w-60"
      )}>
        {/* Logo */}
        <div className={cn("border-b border-[color:var(--panel-border)]", collapsed ? "px-2.5 py-4" : "px-5 py-5")}>
          <div className={cn("flex items-center gap-2.5")}>
            <div className={cn("flex items-center justify-center overflow-hidden transition-all", collapsed ? "w-10 h-10" : "w-14 h-14")}>
              <img src="/logo_trans.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <div>
                <p className="text-white font-semibold text-sm leading-tight tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  RoomFind
                </p>
                <p className="text-[#94A3B8] text-[10px] tracking-widest uppercase">IoT Portal</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 overflow-y-auto", collapsed ? "px-1.5 py-4" : "px-3 py-4")}>
          {!collapsed && <p className="text-[#94A3B8] text-[9px] tracking-widest uppercase px-2 mb-3 font-medium">Navigation</p>}
          <ul className={cn("space-y-0.5", collapsed && "py-2")}>
            {navItems.filter(item => item.authorizedRoles.includes(currentUser.role)).map((item) => {
              const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={cn(
                      "flex items-center transition-all duration-150 group",
                      collapsed ? "px-2 py-2 justify-center" : "gap-3 px-3 py-2.5 text-sm",
                      isActive
                        ? "bg-[#00D4AA]/15 text-[#00D4AA] font-medium"
                        : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span className={cn("transition-colors flex-shrink-0", isActive ? "text-[#00D4AA]" : "text-[#94A3B8] group-hover:text-white")}>
                      {item.icon}
                    </span>
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && isActive && <ChevronRight size={12} className="text-[#00D4AA]" />}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User */}
        <div className={cn("border-t border-[color:var(--panel-border)] pt-3", collapsed ? "px-1.5 pb-4" : "px-3 pb-4")}>
          <div className={cn("mb-2", collapsed ? "flex items-center justify-center" : "")}>
            <div className={cn("rounded-full flex items-center justify-center flex-shrink-0", collapsed ? "w-8 h-8 bg-[#00D4AA]/20" : "w-7 h-7 bg-[#00D4AA]/20 px-3 py-2")}>
              <span className="text-[#00D4AA] text-xs font-bold">
                {currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 ml-3">
                <p className="text-white text-xs font-medium truncate">{currentUser.name}</p>
                <p className="text-[#94A3B8] text-[10px] capitalize">{currentUser.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => { onLogout(); onClose?.(); }}
            className={cn(
              "flex items-center transition-all rounded-lg",
              collapsed ? "w-full justify-center py-2" : "gap-3 px-3 py-2 text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10 w-full"
            )}
          >
            <LogOut size={15} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
