import React, { useState } from "react";
import { DoorOpen, Users, TrendingUp, Wrench, ArrowUpRight, Clock, LogIn, LogOut } from "lucide-react";
import { Room, Schedule, AccessLog, DashboardStats, RoomSession } from "@/types";
import { cn, formatTime12 } from "@/lib/utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface DashboardPageProps {
  stats: DashboardStats;
  rooms: Room[];
  schedules: Schedule[];
  logs: AccessLog[];
  currentUser?: { id: number; name: string; email: string; role: "admin" | "faculty" | "student"; department?: string } | null;
  roomSessions?: RoomSession[];
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

function RoomStatusBadge({ status, isExceeded }: { status: Room["status"]; isExceeded?: boolean }) {
  if (isExceeded)
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[11px] font-medium border border-red-500/20 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
        Exceeded
      </span>
    );
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

export default function DashboardPage({ stats, rooms, schedules, logs, currentUser, roomSessions }: DashboardPageProps) {
  type FilterType = 'day' | 'week' | 'month' | 'year' | 'custom';
  const [usageFilter, setUsageFilter] = useState<FilterType>('day');
  const [checkinsFilter, setCheckinsFilter] = useState<FilterType>('day');
  const [occupancyFilter, setOccupancyFilter] = useState<FilterType>('day');
  const [topRoomsFilter, setTopRoomsFilter] = useState<FilterType>('day');

  const todayStrYYYYMMDD = new Date().toISOString().split('T')[0];
  const [usageCustomDate, setUsageCustomDate] = useState<string>(todayStrYYYYMMDD);
  const [checkinsCustomDate, setCheckinsCustomDate] = useState<string>(todayStrYYYYMMDD);
  const [occupancyCustomDate, setOccupancyCustomDate] = useState<string>(todayStrYYYYMMDD);
  const [topRoomsCustomDate, setTopRoomsCustomDate] = useState<string>(todayStrYYYYMMDD);

  const nowTemp = new Date();
  const currentYear = nowTemp.getFullYear();
  const currentMonth = nowTemp.getMonth();
  const todayDateStr = nowTemp.toDateString();

  const recentLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 6);
  const todayDay = nowTemp.toLocaleDateString("en-US", { weekday: "long" });

  const isStudent = currentUser?.role === "student";
  const isFaculty = currentUser?.role === "faculty";
  const isAdmin = currentUser?.role === "admin";

  const visibleSchedules = isAdmin
    ? schedules
    : isStudent
      ? schedules.filter((s) => s.section && currentUser?.department && s.section.trim().toLowerCase() === currentUser.department.trim().toLowerCase())
      : isFaculty
        ? schedules.filter((s) => (s.faculty_id ?? s.user_id) === currentUser?.id)
        : schedules;

  const getMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0] || "0", 10);
    const minutes = parseInt(parts[1] || "0", 10);
    return hours * 60 + minutes;
  };

  const currentMinutes = nowTemp.getHours() * 60 + nowTemp.getMinutes();

  const todaySchedules = visibleSchedules
    .filter((s) => s.day_of_week === todayDay)
    .sort((a, b) => {
      const startA = getMinutes(a.start_time ?? a.time_start ?? "");
      const endA = getMinutes(a.end_time ?? a.time_end ?? "");
      const startB = getMinutes(b.start_time ?? b.time_start ?? "");
      const endB = getMinutes(b.end_time ?? b.time_end ?? "");

      const isActiveA = currentMinutes >= startA && currentMinutes <= endA;
      const isActiveB = currentMinutes >= startB && currentMinutes <= endB;

      if (isActiveA && !isActiveB) return -1;
      if (!isActiveA && isActiveB) return 1;

      const diffA = Math.abs(startA - currentMinutes);
      const diffB = Math.abs(startB - currentMinutes);
      return diffA - diffB;
    });

  // Helper to check if a date is within the last 7 calendar days (including today)
  const isWithinLast7Days = (dateStr: string) => {
    const d = new Date(dateStr);
    const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const todayMidnight = new Date(nowTemp.getFullYear(), nowTemp.getMonth(), nowTemp.getDate()).getTime();
    const diffDays = (todayMidnight - dMidnight) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays < 7;
  };

  // Helper to check if a date matches a YYYY-MM-DD custom date string
  const isMatchingCustomDate = (dateStr: string, targetCustomDate: string) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` === targetCustomDate;
  };

  // Filter access logs by time range parameter
  const getFilteredCheckins = (filter: FilterType, customDateStr: string) => {
    return logs.filter((log) => {
      if (log.action !== "check_in" || log.access_result === "denied") return false;
      const logDate = new Date(log.timestamp);
      if (filter === 'day') {
        return logDate.toDateString() === todayDateStr;
      } else if (filter === 'week') {
        return isWithinLast7Days(log.timestamp);
      } else if (filter === 'month') {
        return logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth;
      } else if (filter === 'year') {
        return logDate.getFullYear() === currentYear;
      } else {
        // custom date YYYY-MM-DD
        return isMatchingCustomDate(log.timestamp, customDateStr);
      }
    });
  };

  // Filter room sessions by time range parameter
  const getFilteredSessions = (filter: FilterType, customDateStr: string) => {
    return (roomSessions || []).filter((s) => {
      if (!s.started_at) return false;
      const sessionDate = new Date(s.started_at);
      if (filter === 'day') {
        return sessionDate.toDateString() === todayDateStr;
      } else if (filter === 'week') {
        return isWithinLast7Days(s.started_at);
      } else if (filter === 'month') {
        return sessionDate.getFullYear() === currentYear && sessionDate.getMonth() === currentMonth;
      } else if (filter === 'year') {
        return sessionDate.getFullYear() === currentYear;
      } else {
        // custom date YYYY-MM-DD
        return isMatchingCustomDate(s.started_at, customDateStr);
      }
    });
  };

  // Data Calculations for Admin Analytics
  // 1. Room Usage Over Time (Line Graph)
  const usageDataKey = (usageFilter === 'day' || usageFilter === 'custom') ? "Occupied Rooms" : "Check-ins";
  
  let usageOverTimeData: any[] = [];
  if (usageFilter === 'day' || usageFilter === 'custom') {
    const targetWeekday = usageFilter === 'day'
      ? todayDay
      : new Date(usageCustomDate).toLocaleDateString("en-US", { weekday: "long" });

    const targetDateStr = usageFilter === 'day' ? null : usageCustomDate;

    const filteredSchedules = schedules.filter((s) => {
      if (targetDateStr && s.date) {
        return s.date === targetDateStr;
      }
      return s.day_of_week === targetWeekday;
    });

    const hoursList = Array.from({ length: 15 }, (_, i) => i + 7); // 7 to 21
    usageOverTimeData = hoursList.map((hour) => {
      const label = hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
      const schedulesAtHour = filteredSchedules.filter((s) => {
        const start = getMinutes(s.start_time ?? s.time_start ?? "");
        const end = getMinutes(s.end_time ?? s.time_end ?? "");
        const hourMin = hour * 60;
        return hourMin >= start && hourMin < end;
      });
      return {
        time: label,
        [usageDataKey]: schedulesAtHour.length,
      };
    });
  } else if (usageFilter === 'week') {
    const last7DaysList = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const weekCheckins = getFilteredCheckins('week', '');
    usageOverTimeData = last7DaysList.map((dateObj) => {
      const label = dateObj.toLocaleDateString("en-US", { weekday: "short" });
      const dateStr = dateObj.toDateString();
      const count = weekCheckins.filter((log) => new Date(log.timestamp).toDateString() === dateStr).length;
      return {
        time: label,
        [usageDataKey]: count,
      };
    });
  } else if (usageFilter === 'month') {
    const usageCheckins = getFilteredCheckins('month', '');
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    usageOverTimeData = Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
      const checkinCount = usageCheckins.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate.getDate() === dayNum;
      }).length;
      return {
        time: `${dayNum}`,
        [usageDataKey]: checkinCount,
      };
    });
  } else {
    // year
    const usageCheckins = getFilteredCheckins('year', '');
    const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    usageOverTimeData = monthsList.map((monthName, mIdx) => {
      const checkinCount = usageCheckins.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate.getMonth() === mIdx;
      }).length;
      return {
        time: monthName,
        [usageDataKey]: checkinCount,
      };
    });
  }

  // 2. Daily Check-ins (Bar Chart)
  let dailyCheckinsData: any[] = [];
  if (checkinsFilter === 'day' || checkinsFilter === 'custom') {
    const dayCheckins = getFilteredCheckins(checkinsFilter, checkinsCustomDate);
    const hoursList = Array.from({ length: 15 }, (_, i) => i + 7); // 7 to 21
    dailyCheckinsData = hoursList.map((hour) => {
      const label = hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
      const count = dayCheckins.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate.getHours() === hour;
      }).length;
      return {
        day: label,
        "Check-ins": count,
      };
    });
  } else if (checkinsFilter === 'week') {
    const last7DaysList = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const weekCheckins = getFilteredCheckins('week', '');
    dailyCheckinsData = last7DaysList.map((dateObj) => {
      const label = dateObj.toLocaleDateString("en-US", { weekday: "short" });
      const dateStr = dateObj.toDateString();
      const count = weekCheckins.filter((log) => new Date(log.timestamp).toDateString() === dateStr).length;
      return {
        day: label,
        "Check-ins": count,
      };
    });
  } else if (checkinsFilter === 'month') {
    const monthCheckins = getFilteredCheckins('month', '');
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    dailyCheckinsData = weekdays.map((dayName) => {
      const count = monthCheckins.filter((log) => {
        const logDate = new Date(log.timestamp);
        const weekdayIndex = weekdays.indexOf(dayName);
        const targetGetDay = weekdayIndex === 6 ? 0 : weekdayIndex + 1;
        return logDate.getDay() === targetGetDay;
      }).length;
      return {
        day: dayName.substring(0, 3),
        "Check-ins": count,
      };
    });
  } else {
    // year
    const yearCheckins = getFilteredCheckins('year', '');
    const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    dailyCheckinsData = monthsList.map((monthName, mIdx) => {
      const count = yearCheckins.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate.getMonth() === mIdx;
      }).length;
      return {
        day: monthName,
        "Check-ins": count,
      };
    });
  }

  // 3. Room Occupancy / Session Outcomes (Donut Chart)
  let occupancyData: any[] = [];
  if (occupancyFilter === 'day') {
    const availableCount = rooms.filter((r) => r.status === "available").length;
    const occupiedCount = rooms.filter((r) => r.status === "occupied").length;
    const maintenanceCount = rooms.filter((r) => r.status === "maintenance").length;
    occupancyData = [
      { name: "Available", value: availableCount, color: "#00D4AA" },
      { name: "Occupied", value: occupiedCount, color: "#F59E0B" },
      { name: "Maintenance", value: maintenanceCount, color: "#64748B" },
    ].filter((d) => d.value > 0);
  } else {
    const filteredSessions = getFilteredSessions(occupancyFilter, occupancyCustomDate);
    const completedSessions = filteredSessions.filter(s => s.status === 'completed').length;
    const timedOutSessions = filteredSessions.filter(s => s.status === 'timed_out').length;
    const activeSessions = filteredSessions.filter(s => s.status === 'active').length;
    occupancyData = [
      { name: "Completed", value: completedSessions, color: "#00D4AA" },
      { name: "Timed Out", value: timedOutSessions, color: "#EF4444" },
      { name: "Active", value: activeSessions, color: "#F59E0B" },
    ].filter(d => d.value > 0);
  }

  // 4. Top Rooms by Usage (Horizontal Bar Chart)
  const roomCheckinCounts: { [roomCode: string]: number } = {};
  const topRoomsCheckins = getFilteredCheckins(topRoomsFilter, topRoomsCustomDate);
  topRoomsCheckins.forEach((log) => {
    if (log.room_code) {
      roomCheckinCounts[log.room_code] = (roomCheckinCounts[log.room_code] || 0) + 1;
    }
  });

  const topRoomsData = Object.entries(roomCheckinCounts)
    .map(([roomCode, count]) => ({ name: roomCode, "Check-ins": count }))
    .sort((a, b) => b["Check-ins"] - a["Check-ins"])
    .slice(0, 5);

  if (topRoomsData.length === 0) {
    rooms.slice(0, 5).forEach((r) => {
      topRoomsData.push({ name: r.room_code, "Check-ins": 0 });
    });
  }

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
            {rooms.map((room) => {
              const activeSession = roomSessions?.find((s) => s.room_id === room.id && s.status === "active");
              let isExceeded = false;
              let scheduleStart = "";
              let scheduleEnd = "";
              let exceededMinutesCount = 0;
              let currentSection = "";
 
              if (activeSession) {
                const todayDayText = new Date().toLocaleDateString("en-US", { weekday: "long" });
                const matchingSchedules = schedules.filter(
                  (s) => s.room_id === room.id && 
                         (s.faculty_id ?? s.user_id) === activeSession.faculty_id && 
                         s.day_of_week === todayDayText
                );
 
                if (matchingSchedules.length > 0) {
                  const now = new Date();
                  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                  
                  const currentlyRunning = matchingSchedules.find((s) => {
                    const start = (s.start_time ?? s.time_start ?? "").substring(0, 5);
                    const end = (s.end_time ?? s.time_end ?? "").substring(0, 5);
                    return start && end && currentTime >= start && currentTime <= end;
                  });
 
                  if (currentlyRunning) {
                    isExceeded = false;
                    scheduleStart = currentlyRunning.start_time ?? currentlyRunning.time_start ?? "";
                    scheduleEnd = currentlyRunning.end_time ?? currentlyRunning.time_end ?? "";
                    currentSection = currentlyRunning.section || "";
                  } else {
                    const getMinutes = (timeStr: string) => {
                      const parts = timeStr.split(":");
                      return parseInt(parts[0] || "0", 10) * 60 + parseInt(parts[1] || "0", 10);
                    };
                    const currentMin = now.getHours() * 60 + now.getMinutes();
 
                    const upcomingSchedules = matchingSchedules.filter((s) => {
                      const start = s.start_time ?? s.time_start ?? "";
                      return start && getMinutes(start) > currentMin;
                    });
 
                    upcomingSchedules.sort((a, b) => getMinutes(a.start_time ?? a.time_start ?? "") - getMinutes(b.start_time ?? b.time_start ?? ""));
 
                    const nextSchedule = upcomingSchedules[0];
                    if (nextSchedule) {
                      const nextStartMin = getMinutes(nextSchedule.start_time ?? nextSchedule.time_start ?? "");
                      const minutesUntilNext = nextStartMin - currentMin;
                      if (minutesUntilNext <= 0) {
                        isExceeded = false;
                        scheduleStart = nextSchedule.start_time ?? nextSchedule.time_start ?? "";
                        scheduleEnd = nextSchedule.end_time ?? nextSchedule.time_end ?? "";
                        currentSection = nextSchedule.section || "";
                      } else {
                        isExceeded = true;
                      }
                    } else {
                      isExceeded = true;
                    }
 
                    if (isExceeded) {
                      const endedSchedules = matchingSchedules.filter((s) => {
                        const end = s.end_time ?? s.time_end ?? "";
                        return end && getMinutes(end) < currentMin;
                      });
                      
                      if (endedSchedules.length > 0) {
                        endedSchedules.sort((a, b) => getMinutes(b.end_time ?? b.time_end ?? "") - getMinutes(a.end_time ?? a.time_end ?? ""));
                        const lastSchedule = endedSchedules[0];
                        scheduleStart = lastSchedule.start_time ?? lastSchedule.time_start ?? "";
                        scheduleEnd = lastSchedule.end_time ?? lastSchedule.time_end ?? "";
                        exceededMinutesCount = currentMin - getMinutes(scheduleEnd);
                        currentSection = lastSchedule.section || "";
                      }
                    }
                  }
                }
              }
 
              return (
                <div
                  key={room.id}
                  className={cn(
                    "bg-[#0F1729] rounded-xl border p-4 transition-all",
                    isExceeded
                      ? "border-red-500/20 hover:border-red-500/40"
                      : room.status === "available"
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
                    <RoomStatusBadge status={room.status} isExceeded={isExceeded} />
                  </div>
                <div className="flex items-center justify-between">
                  <p className="text-[#94A3B8] text-xs">{room.building} · Fl. {room.floor}</p>
                  <p className="text-[#94A3B8] text-xs font-mono">{room.capacity} cap.</p>
                </div>
                {room.status === "occupied" && room.current_user_name && (
                  <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[#F59E0B] text-xs">
                        <span className="text-[#94A3B8]">by</span> {room.current_user_name}
                        {currentSection && (
                          <span className="text-[#94A3B8] text-[10px] font-mono ml-1.5 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 inline-block">
                            {currentSection}
                          </span>
                        )}
                      </p>
                      {scheduleStart && scheduleEnd && (
                        <p className="text-[#94A3B8] text-[10px] font-mono whitespace-nowrap">
                          {formatTime12(scheduleStart)} - {formatTime12(scheduleEnd)}
                        </p>
                      )}
                    </div>
                    {isExceeded && exceededMinutesCount > 0 && (
                      <p className="text-red-400 text-[10px] font-semibold flex items-center gap-1 animate-pulse">
                        <Clock size={10} />
                        Exceeded by {exceededMinutesCount} {exceededMinutesCount === 1 ? 'min' : 'mins'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 scrollbar-thin">
            {todaySchedules.length === 0 ? (
              <div className="bg-[#0F1729] rounded-xl border border-white/5 p-8 text-center">
                <p className="text-[#94A3B8] text-sm">No schedules for today</p>
              </div>
            ) : (
              todaySchedules.map((schedule) => (
                <div key={schedule.id} className="bg-[#0F1729] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-mono text-xs font-bold bg-white/5 px-2 py-0.5 rounded">
                      {schedule.room_code}
                    </span>
                    <span className="text-[#94A3B8] text-[11px] font-mono">{schedule.section}</span>
                  </div>
                  <p className="text-white text-sm font-semibold mb-1 truncate">{schedule.subject}</p>
                  <p className="text-[#94A3B8] text-xs mb-2 truncate">{schedule.faculty_name}</p>
                  <div className="flex items-center gap-1.5 text-[#00D4AA] text-[11px] font-mono">
                    <Clock size={11} />
                    <span>
                      {formatTime12(schedule.start_time ?? schedule.time_start ?? '')} – {formatTime12(schedule.end_time ?? schedule.time_end ?? '')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admin Analytics Section */}
      {isAdmin && (
        <div className="space-y-6 mt-6">
          <div className="border-t border-white/5 pt-6">
            <h2 className="text-white font-bold text-base mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Admin Analytics & Insights
            </h2>
            <p className="text-[#94A3B8] text-xs">
              System performance metrics, occupancy analysis, and room utilization data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Room Usage Over Time */}
            <div className="bg-[#0F1729] rounded-xl border border-white/5 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider text-[#94A3B8]">
                  {usageFilter === 'day'
                    ? "Room Usage Over Time (Today)"
                    : usageFilter === 'week'
                    ? "Daily Check-ins (Last 7 Days)"
                    : usageFilter === 'month'
                    ? "Daily Check-ins (This Month)"
                    : usageFilter === 'year'
                    ? "Monthly Check-ins (This Year)"
                    : `Room Usage (${usageCustomDate})`}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {usageFilter === 'custom' && (
                    <input
                      type="date"
                      value={usageCustomDate}
                      onChange={(e) => setUsageCustomDate(e.target.value)}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-[#1E293B]/60 text-white rounded border border-white/5 outline-none focus:border-[#00D4AA]/50"
                    />
                  )}
                  <div className="flex items-center bg-[#1E293B]/60 p-0.5 rounded-lg border border-white/5">
                    {(["day", "week", "month", "year", "custom"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setUsageFilter(filter)}
                        className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-semibold transition-all capitalize",
                          usageFilter === filter
                            ? "bg-[#00D4AA] text-[#0F1729] shadow-sm"
                            : "text-[#94A3B8] hover:text-white"
                        )}
                      >
                        {filter === "day" ? "Today" : filter === "week" ? "Week" : filter === "month" ? "Month" : filter === "year" ? "Year" : "Date"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={usageOverTimeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F1729",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#00D4AA" }}
                      labelStyle={{ color: "#94A3B8" }}
                    />
                    <Line type="monotone" dataKey={usageDataKey} stroke="#00D4AA" strokeWidth={2.5} dot={{ fill: "#00D4AA", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Daily Check-ins This Week */}
            <div className="bg-[#0F1729] rounded-xl border border-white/5 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider text-[#94A3B8]">
                  {checkinsFilter === 'day'
                    ? "Hourly Check-ins (Today)"
                    : checkinsFilter === 'week'
                    ? "Daily Check-ins (Last 7 Days)"
                    : checkinsFilter === 'month'
                    ? "Daily Check-ins (This Month)"
                    : checkinsFilter === 'year'
                    ? "Monthly Check-ins (This Year)"
                    : `Check-ins (${checkinsCustomDate})`}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {checkinsFilter === 'custom' && (
                    <input
                      type="date"
                      value={checkinsCustomDate}
                      onChange={(e) => setCheckinsCustomDate(e.target.value)}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-[#1E293B]/60 text-white rounded border border-white/5 outline-none focus:border-[#00D4AA]/50"
                    />
                  )}
                  <div className="flex items-center bg-[#1E293B]/60 p-0.5 rounded-lg border border-white/5">
                    {(["day", "week", "month", "year", "custom"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setCheckinsFilter(filter)}
                        className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-semibold transition-all capitalize",
                          checkinsFilter === filter
                            ? "bg-[#00D4AA] text-[#0F1729] shadow-sm"
                            : "text-[#94A3B8] hover:text-white"
                        )}
                      >
                        {filter === "day" ? "Today" : filter === "week" ? "Week" : filter === "month" ? "Month" : filter === "year" ? "Year" : "Date"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyCheckinsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" stroke="#64748B" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F1729",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#60A5FA" }}
                      labelStyle={{ color: "#94A3B8" }}
                    />
                    <Bar dataKey="Check-ins" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Room Occupancy Rate */}
            <div className="bg-[#0F1729] rounded-xl border border-white/5 p-5 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider text-[#94A3B8]">
                  {occupancyFilter === 'day'
                    ? "Room Occupancy Rate (Live)"
                    : occupancyFilter === 'week'
                    ? "Session Outcomes (Last 7 Days)"
                    : occupancyFilter === 'month'
                    ? "Session Outcomes (This Month)"
                    : occupancyFilter === 'year'
                    ? "Session Outcomes (This Year)"
                    : `Session Outcomes (${occupancyCustomDate})`}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {occupancyFilter === 'custom' && (
                    <input
                      type="date"
                      value={occupancyCustomDate}
                      onChange={(e) => setOccupancyCustomDate(e.target.value)}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-[#1E293B]/60 text-white rounded border border-white/5 outline-none focus:border-[#00D4AA]/50"
                    />
                  )}
                  <div className="flex items-center bg-[#1E293B]/60 p-0.5 rounded-lg border border-white/5">
                    {(["day", "week", "month", "year", "custom"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setOccupancyFilter(filter)}
                        className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-semibold transition-all capitalize",
                          occupancyFilter === filter
                            ? "bg-[#00D4AA] text-[#0F1729] shadow-sm"
                            : "text-[#94A3B8] hover:text-white"
                        )}
                      >
                        {filter === "day" ? "Today" : filter === "week" ? "Week" : filter === "month" ? "Month" : filter === "year" ? "Year" : "Date"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-64 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={occupancyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {occupancyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F1729",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend inside the chart card */}
                <div className="absolute bottom-2 flex justify-center gap-4 text-xs">
                  {occupancyData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                      <span className="text-[#94A3B8] font-medium">{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Top Rooms by Usage */}
            <div className="bg-[#0F1729] rounded-xl border border-white/5 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider text-[#94A3B8]">
                  Top Rooms by Usage ({
                    topRoomsFilter === 'day'
                      ? "Today"
                      : topRoomsFilter === 'week'
                      ? "Last 7 Days"
                      : topRoomsFilter === 'month'
                      ? "This Month"
                      : topRoomsFilter === 'year'
                      ? "This Year"
                      : topRoomsCustomDate
                  })
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {topRoomsFilter === 'custom' && (
                    <input
                      type="date"
                      value={topRoomsCustomDate}
                      onChange={(e) => setTopRoomsCustomDate(e.target.value)}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-[#1E293B]/60 text-white rounded border border-white/5 outline-none focus:border-[#00D4AA]/50"
                    />
                  )}
                  <div className="flex items-center bg-[#1E293B]/60 p-0.5 rounded-lg border border-white/5">
                    {(["day", "week", "month", "year", "custom"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setTopRoomsFilter(filter)}
                        className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-semibold transition-all capitalize",
                          topRoomsFilter === filter
                            ? "bg-[#00D4AA] text-[#0F1729] shadow-sm"
                            : "text-[#94A3B8] hover:text-white"
                        )}
                      >
                        {filter === "day" ? "Today" : filter === "week" ? "Week" : filter === "month" ? "Month" : filter === "year" ? "Year" : "Date"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                     layout="vertical"
                     data={topRoomsData}
                     margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#64748B" fontSize={10} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={10} tickLine={false} width={70} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F1729",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#C084FC" }}
                      labelStyle={{ color: "#94A3B8" }}
                    />
                    <Bar dataKey="Check-ins" fill="#C084FC" radius={[0, 4, 4, 0]} barSize={15} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
