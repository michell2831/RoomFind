import React from "react";
import { DoorOpen, Users, TrendingUp, Wrench, ArrowUpRight, Clock, LogIn, LogOut } from "lucide-react";
import { Room, Schedule, AccessLog, DashboardStats } from "@/types";
import { cn } from "@/lib/utils";

interface DashboardPageProps {
  stats: DashboardStats;
  rooms: Room[];
  schedules: Schedule[];
  logs: AccessLog[];
}

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#0F1729] rounded-xl border border-white/5 p-5 flex items-start justify-between hover:border-white/10 transition-colors">
      <div>
        <p className="text-[#94A3B8] text-xs uppercase tracking-wider font-medium mb-2">{label}</p>
        <p className={`text-3xl font-bold ${color}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {value}
        </p>
        {sub && <p className="text-[#94A3B8] text-xs mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center opacity-80 ${color.replace("text-", "bg-").replace("[", "[").replace("]", "]")}/10`}>
        {icon}
      </div>
    </div>
  );
}

function RoomStatusBadge({ status }: { status: Room["status"] }) {
  if (status === "available")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00D4AA]/10 text-[#00D4AA] text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse"></span>
        Available
      </span>
    );
  if (status === "occupied")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>
        Occupied
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 text-[#94A3B8] text-[11px] font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]"></span>
      Maintenance
    </span>
  );
}

export default function DashboardPage({ stats, rooms, schedules, logs }: DashboardPageProps) {
  const recentLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 6);
  const todayDay = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todaySchedules = schedules.filter((s) => s.day_of_week === todayDay).slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Available Rooms"
          value={stats.availableRooms}
          icon={<DoorOpen size={18} className="text-[#00D4AA]" />}
          color="text-[#00D4AA]"
          sub={`of ${stats.totalRooms} total`}
        />
        <StatCard
          label="Occupied Rooms"
          value={stats.occupiedRooms}
          icon={<ArrowUpRight size={18} className="text-[#F59E0B]" />}
          color="text-[#F59E0B]"
          sub="currently in use"
        />
        <StatCard
          label="Active Users"
          value={stats.activeUsers}
          icon={<Users size={18} className="text-blue-400" />}
          color="text-blue-400"
          sub={`of ${stats.totalUsers} registered`}
        />
        <StatCard
          label="Today's Check-ins"
          value={stats.todayCheckIns}
          icon={<TrendingUp size={18} className="text-purple-400" />}
          color="text-purple-400"
          sub="RFID taps today"
        />
      </div>

      {/* Room Status Grid + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Cards */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Live Room Status
            </h2>
            <span className="text-[#94A3B8] text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
              {rooms.length} rooms
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={cn(
                  "bg-[#0F1729] rounded-xl border p-4 transition-all",
                  room.status === "available"
                    ? "border-[#00D4AA]/20 hover:border-[#00D4AA]/40"
                    : room.status === "occupied"
                    ? "border-[#F59E0B]/20 hover:border-[#F59E0B]/40"
                    : "border-white/5 hover:border-white/10"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-bold text-sm font-mono">{room.room_code}</p>
                    <p className="text-[#94A3B8] text-xs mt-0.5">{room.name}</p>
                  </div>
                  <RoomStatusBadge status={room.status} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[#94A3B8] text-xs">{room.building} · Fl. {room.floor}</p>
                  <p className="text-[#94A3B8] text-xs font-mono">{room.capacity} cap.</p>
                </div>
                {room.status === "occupied" && room.current_user_name && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <p className="text-[#F59E0B] text-xs">
                      <span className="text-[#94A3B8]">by</span> {room.current_user_name}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Recent Activity
            </h2>
          </div>
          <div className="bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden">
            {recentLogs.map((log, idx) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  idx !== recentLogs.length - 1 && "border-b border-white/5"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  log.action === "check_in" ? "bg-[#00D4AA]/10" : "bg-[#F59E0B]/10"
                )}>
                  {log.action === "check_in" ? (
                    <LogIn size={11} className="text-[#00D4AA]" />
                  ) : (
                    <LogOut size={11} className="text-[#F59E0B]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{log.user_name}</p>
                  <p className="text-[#94A3B8] text-[11px]">
                    {log.action === "check_in" ? "checked in to" : "checked out from"}{" "}
                    <span className="text-white/70 font-mono">{log.room_code}</span>
                  </p>
                  <p className="text-[#94A3B8]/60 text-[10px] font-mono mt-0.5 flex items-center gap-1">
                    <Clock size={9} />
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Today's Schedule
          </h2>
          <span className="text-[#94A3B8] text-xs font-mono bg-white/5 px-2 py-0.5 rounded">{todayDay}</span>
        </div>

        {todaySchedules.length === 0 ? (
          <div className="bg-[#0F1729] rounded-xl border border-white/5 p-8 text-center">
            <p className="text-[#94A3B8] text-sm">No schedules for today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {todaySchedules.map((schedule) => (
              <div key={schedule.id} className="bg-[#0F1729] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-white font-mono text-xs font-bold bg-white/5 px-2 py-0.5 rounded">
                    {schedule.room_code}
                  </span>
                </div>
                <p className="text-white text-sm font-medium mb-1">{schedule.subject}</p>
                <p className="text-[#94A3B8] text-xs mb-2">{schedule.faculty_name}</p>
                <div className="flex items-center gap-1 text-[#94A3B8]/70 text-[11px] font-mono">
                  <Clock size={10} />
                  <span>{schedule.time_start} – {schedule.time_end}</span>
                </div>
                <p className="text-[#94A3B8] text-[11px] mt-1">{schedule.section}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
