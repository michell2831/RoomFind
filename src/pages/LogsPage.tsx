import React, { useState } from "react";
import { Search, LogIn, LogOut, Clock, Filter, X } from "lucide-react";
import { AccessLog } from "@/types";
import { cn } from "@/lib/utils";

interface LogsPageProps {
  logs: AccessLog[];
  isAdmin: boolean;
  currentUserId: number;
}

export default function LogsPage({ logs, isAdmin, currentUserId }: LogsPageProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | "check_in" | "check_out" | "exceeded">("all");
  const [roomFilter, setRoomFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const visibleLogs = isAdmin ? logs : logs.filter((l) => l.user_id === currentUserId);

  const uniqueRooms = Array.from(new Set(visibleLogs.map((l) => l.room_code))).sort();
  const uniqueUsers = Array.from(new Set(visibleLogs.map((l) => l.user_name))).sort();

  const filtered = visibleLogs
    .filter((l) => {
      const matchSearch =
        l.user_name.toLowerCase().includes(search.toLowerCase()) ||
        l.room_code.toLowerCase().includes(search.toLowerCase()) ||
        l.room_name.toLowerCase().includes(search.toLowerCase()) ||
        l.card_uid.toLowerCase().includes(search.toLowerCase());
      const matchAction =
        actionFilter === "all" ||
        (actionFilter === "exceeded"
          ? !!(l.deny_reason && l.deny_reason.toLowerCase().includes("exceeded"))
          : l.action === actionFilter);
      const matchRoom = !roomFilter || l.room_code === roomFilter;
      const matchUser = !userFilter || l.user_name === userFilter;
      return matchSearch && matchAction && matchRoom && matchUser;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "check_in", "check_out", "exceeded"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActionFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                actionFilter === f
                  ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                  : "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white border border-transparent"
              )}
            >
              {f === "check_in" ? <LogIn size={11} /> : f === "check_out" ? <LogOut size={11} /> : f === "exceeded" ? <Clock size={11} /> : null}
              {f === "all" ? "All Events" : f === "check_in" ? "Check Ins" : f === "check_out" ? "Check Outs" : "Exceeded"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          <div className="relative flex-1 sm:flex-none">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 w-full sm:w-52"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all border flex-shrink-0",
              showFilters
                ? "bg-[#00D4AA]/15 text-[#00D4AA] border-[#00D4AA]/30"
                : "bg-white/5 text-[#94A3B8] border-transparent hover:bg-white/10"
            )}
          >
            <Filter size={12} />
            Filters
          </button>
        </div>
      </div>

      {/* Extra filters */}
      {showFilters && (
        <div className="bg-[#0F1729] rounded-xl border border-white/5 p-4 flex flex-wrap items-center gap-4">
          <div>
            <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Room</label>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00D4AA]/50"
            >
              <option value="">All Rooms</option>
              {uniqueRooms.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">User</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00D4AA]/50"
            >
              <option value="">All Users</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          {(roomFilter || userFilter) && (
            <button
              onClick={() => {
                setRoomFilter("");
                setUserFilter("");
              }}
              className="flex items-center gap-1 text-[#94A3B8] hover:text-white text-xs mt-4"
            >
              <X size={11} /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: visibleLogs.length, color: "text-white" },
          { label: "Check Ins", value: visibleLogs.filter((l) => l.action === "check_in").length, color: "text-[#00D4AA]" },
          { label: "Denied", value: visibleLogs.filter((l) => l.access_result === "denied").length, color: "text-[#EF4444]" },
          { label: "Exceeded", value: visibleLogs.filter((l) => l.deny_reason && l.deny_reason.toLowerCase().includes("exceeded")).length, color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0F1729] rounded-xl border border-white/5 px-4 py-3">
            <p className="text-[#94A3B8] text-[10px] uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden overflow-x-auto w-full">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-white/5">
              {["Event", "User", "Room", "Card UID", "Timestamp"].map((h) => (
                <th key={h} className="text-left text-[#94A3B8] text-[10px] uppercase tracking-wider font-medium px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((log, idx) => (
              <tr
                key={log.id}
                className={cn(
                  "hover:bg-white/3 transition-colors",
                  idx !== filtered.length - 1 && "border-b border-white/5"
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "flex items-center gap-2 w-fit px-2.5 py-1 rounded-full text-[11px] font-medium",
                        log.access_result === "denied"
                          ? "bg-[#EF4444]/10 text-[#EF4444]"
                          : log.action === "check_in"
                          ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                          : "bg-[#F59E0B]/10 text-[#F59E0B]"
                      )}>
                        {log.access_result === "denied" ? <X size={10} /> : log.action === "check_in" ? <LogIn size={10} /> : <LogOut size={10} />}
                        {log.access_result === "denied" ? "Denied" : log.action === "check_in" ? "Check In" : "Check Out"}
                      </span>
                      {log.action === "check_out" && log.deny_reason && log.deny_reason.toLowerCase().includes("exceeded") && (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold animate-pulse">
                          Overtime
                        </span>
                      )}
                    </div>
                    {log.access_result === "denied" && log.deny_reason && (
                      <p className="text-[#EF4444] text-[11px] mt-0.5">{log.deny_reason}</p>
                    )}
                    {log.access_result !== "denied" && log.deny_reason && log.deny_reason.toLowerCase().includes("exceeded") && (
                      <p className="text-red-400 text-[11px] mt-0.5">{log.deny_reason}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-white text-sm">{log.user_name}</td>
                <td className="px-4 py-3">
                  <div>
                    <span className="text-white font-mono text-xs font-bold">{log.room_code}</span>
                    <p className="text-[#94A3B8] text-[11px]">{log.room_name}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[#94A3B8] font-mono text-xs bg-white/5 px-2 py-0.5 rounded">
                    {log.card_uid}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[#94A3B8] font-mono text-xs">
                    <Clock size={10} />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#94A3B8] text-sm">
                  No logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
