import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Edit2, Trash2, X, Check, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Schedule, Room, User, RoomSession } from "@/types";
import { cn, formatTime12 } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface SchedulesPageProps {
  schedules: Schedule[];
  rooms: Room[];
  users: User[];
  roomSessions: RoomSession[];
  onAddSchedule: (s: Omit<Schedule, "id" | "created_at" | "room_code" | "room_name" | "faculty_name">) => Promise<any>;
  onUpdateSchedule: (id: number, updates: Partial<Schedule>) => Promise<any>;
  onDeleteSchedule: (id: number) => void;
  isAdmin: boolean;
  currentUserId: number;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface ScheduleFormData {
  room_id: number;
  faculty_id: number;
  subject: string;
  section: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  date: string;
}

const emptyForm: ScheduleFormData = {
  room_id: 0,
  faculty_id: 0,
  subject: "",
  section: "",
  day_of_week: "Monday",
  start_time: "08:00",
  end_time: "10:00",
  date: "",
};

export default function SchedulesPage({
  schedules,
  rooms,
  users,
  roomSessions,
  onAddSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  isAdmin,
  currentUserId,
}: SchedulesPageProps) {
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [form, setForm] = useState<ScheduleFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [outcomeModal, setOutcomeModal] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const { data, error } = await supabase.from("sections").select("id, name").order("name");
        if (!error && data) {
          setSections(data);
        }
      } catch (err) {
        console.error("Error fetching sections:", err);
      }
    };
    if (showModal) {
      fetchSections();
    }
  }, [showModal]);

  const currentUser = users.find((u) => u.id === currentUserId);
  const isStudent = currentUser?.role === "student";

  const visibleSchedules = isAdmin
    ? schedules
    : isStudent
      ? schedules.filter((s) => s.section && currentUser?.department && s.section.trim().toLowerCase() === currentUser.department.trim().toLowerCase())
      : schedules.filter((s) => (s.faculty_id ?? s.user_id) === currentUserId);

  const filtered = visibleSchedules.filter((s) => {
    const matchSearch =
      s.subject.toLowerCase().includes(search.toLowerCase()) ||
      s.section.toLowerCase().includes(search.toLowerCase()) ||
      s.room_code.toLowerCase().includes(search.toLowerCase()) ||
      s.faculty_name.toLowerCase().includes(search.toLowerCase());
    const matchDay = dayFilter === "all" || s.day_of_week === dayFilter;
    return matchSearch && matchDay;
  });

  const openAdd = () => {
    setEditingSchedule(null);
    const defaultFaculty = users.find((u) => u.role === "faculty");
    setForm({
      ...emptyForm,
      faculty_id: isAdmin ? (defaultFaculty?.id || 0) : currentUserId,
      room_id: rooms[0]?.id || 0,
      date: "",
    });
    setShowModal(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingSchedule(s);
    setForm({
      room_id: s.room_id || 0,
      faculty_id: s.faculty_id ?? s.user_id ?? 0,
      subject: s.subject || "",
      section: s.section || "",
      day_of_week: s.day_of_week || "Monday",
      start_time: s.start_time ?? s.time_start ?? "08:00",
      end_time: s.end_time ?? s.time_end ?? "10:00",
      date: s.date || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.start_time >= form.end_time) {
      setOutcomeModal({
        type: "error",
        title: "Validation Error",
        message: "Start time must be earlier than end time.",
      });
      return;
    }

    // Auto-calculate day_of_week if a specific date is selected
    let finalForm = { ...form };
    if (form.date) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const parts = form.date.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        finalForm.day_of_week = days[d.getDay()];
      }
    }

    try {
      if (editingSchedule) {
        await onUpdateSchedule(editingSchedule.id, finalForm);
        const room = rooms.find((r) => r.id === finalForm.room_id);
        const scheduleDayText = finalForm.date ? `${finalForm.day_of_week} (${finalForm.date})` : finalForm.day_of_week;
        setOutcomeModal({
          type: "success",
          title: "Schedule Updated Successfully!",
          message: `Successfully updated booking for ${finalForm.subject} (${finalForm.section}) inside room ${room ? room.room_code : 'Unknown'} for ${scheduleDayText} at ${finalForm.start_time} - ${finalForm.end_time}.`,
        });
      } else {
        await onAddSchedule(finalForm);
        const room = rooms.find((r) => r.id === finalForm.room_id);
        const scheduleDayText = finalForm.date ? `${finalForm.day_of_week} (${finalForm.date})` : finalForm.day_of_week;
        setOutcomeModal({
          type: "success",
          title: "Schedule Created Successfully!",
          message: `Successfully booked ${finalForm.subject} (${finalForm.section}) inside room ${room ? room.room_code : 'Unknown'} for ${scheduleDayText} at ${finalForm.start_time} - ${finalForm.end_time}.`,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      setOutcomeModal({
        type: "error",
        title: "Schedule Saving Failed",
        message: err.message || "An unexpected error occurred while saving the schedule. Please check table security policies.",
      });
    }
  };

  const todayDay = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="space-y-5 max-w-7xl">
      {isAdmin && (
        <div className="bg-[#0F1729] rounded-xl border border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Live Session Status
            </h2>
            <span className="text-[#94A3B8] text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
              {roomSessions.length} sessions
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map((room) => {
              const activeSession = roomSessions.find((s) => s.room_id === room.id && s.status === "active");
              const session = activeSession || null;
              const faculty = session ? users.find((u) => u.id === session.faculty_id) : null;
              
              let isExceeded = false;
              let scheduleStart = "";
              let scheduleEnd = "";
              let exceededMinutesCount = 0;

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
                      }
                    }
                  }
                }
              }

              const statusLabel = isExceeded
                ? "Exceeded"
                : activeSession
                  ? "Occupied"
                  : "Vacant";

              const statusStyles = isExceeded
                ? "bg-red-500/15 text-red-400 border-red-500/40 animate-pulse font-bold"
                : activeSession
                  ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
                  : "bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/30";

              return (
                <div key={room.id} className="bg-[#0B1120] rounded-lg border border-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-semibold font-mono">{room.room_code}</p>
                      <p className="text-[#94A3B8] text-xs">{room.name}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusStyles}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] text-[#94A3B8] space-y-1">
                    <p>Faculty: {faculty?.name || "—"}</p>
                    {scheduleStart && scheduleEnd && (
                      <p>Time Slot: {formatTime12(scheduleStart)} - {formatTime12(scheduleEnd)}</p>
                    )}
                    {isExceeded && exceededMinutesCount > 0 && (
                      <p className="text-red-400 font-semibold flex items-center gap-1 animate-pulse">
                        <Clock size={10} />
                        Exceeded by {exceededMinutesCount} {exceededMinutesCount === 1 ? 'min' : 'mins'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDayFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              dayFilter === "all"
                ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                : "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white border border-transparent"
            )}
          >
            All Days
          </button>
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDayFilter(d)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                dayFilter === d
                  ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                  : d === todayDay
                  ? "bg-white/8 text-white border border-white/20"
                  : "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white border border-transparent"
              )}
            >
              {d.slice(0, 3)}
              {d === todayDay && <span className="ml-1 text-[9px] text-[#00D4AA]">•</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search schedules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 w-52"
            />
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold px-3 py-2 rounded-lg text-xs transition-all"
            >
              <Plus size={13} />
              Add Schedule
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {["Room", "Subject", "Section", "Faculty", "Day", "Time", isAdmin ? "Actions" : ""].filter(Boolean).map((h) => (
                <th key={h} className="text-left text-[#94A3B8] text-[10px] uppercase tracking-wider font-medium px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, idx) => (
              <tr
                key={s.id}
                className={cn(
                  "hover:bg-white/3 transition-colors",
                  idx !== filtered.length - 1 && "border-b border-white/5",
                  s.day_of_week === todayDay && "bg-[#00D4AA]/3"
                )}
              >
                <td className="px-4 py-3">
                  <span className="text-white font-mono text-xs font-bold bg-white/5 px-2 py-0.5 rounded">
                    {s.room_code}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{s.subject}</p>
                </td>
                <td className="px-4 py-3 text-[#94A3B8] text-xs font-mono">{s.section}</td>
                <td className="px-4 py-3 text-[#94A3B8] text-xs">{s.faculty_name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-xs font-medium",
                      s.day_of_week === todayDay ? "text-[#00D4AA]" : "text-[#94A3B8]"
                    )}>
                      {s.day_of_week}
                      {s.day_of_week === todayDay && <span className="ml-1 text-[9px] bg-[#00D4AA]/10 px-1 py-0.2 rounded font-semibold">Today</span>}
                    </span>
                    {s.date && (
                      <span className="text-[10px] text-[#64748B] font-mono mt-0.5">{s.date}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[#94A3B8] text-xs font-mono">
                    <Clock size={11} />
                    {formatTime12(s.start_time ?? s.time_start ?? '')} – {formatTime12(s.end_time ?? s.time_end ?? '')}
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    {deleteConfirm === s.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { onDeleteSchedule(s.id); setDeleteConfirm(null); }}
                          className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                        >
                          <Check size={12} /> Confirm
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[#94A3B8] hover:text-white">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(s.id)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-[#94A3B8] hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#94A3B8] text-sm">
                  No schedules found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold text-sm">
                {editingSchedule ? "Edit Schedule" : "Add Schedule"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Room *</label>
                  <select
                    required
                    value={form.room_id}
                    onChange={(e) => setForm({ ...form, room_id: parseInt(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                  >
                    <option value={0}>Select room...</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.room_code} – {r.name}</option>
                    ))}
                  </select>
                </div>
                {isAdmin && (
                  <div>
                    <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Faculty *</label>
                    <select
                      required
                      value={form.faculty_id}
                      onChange={(e) => setForm({ ...form, faculty_id: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                    >
                      <option value={0}>Select faculty...</option>
                      {users
                        .filter(
                          (u) =>
                            (u.role === "faculty" || u.role === "admin") &&
                            u.is_active &&
                            u.rfid_card &&
                            u.rfid_card.is_active
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Subject *</label>
                <input
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Introduction to Programming"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Section *</label>
                {sections.length > 0 ? (
                  <select
                    required
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                  >
                    <option value="" disabled>Select a section...</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.name}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                    placeholder="e.g. CS-1A"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                  />
                )}
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Specific Date (Optional)</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50 font-mono"
                />
                <p className="text-[10px] text-[#64748B] mt-1">Leave blank for weekly recurring schedule.</p>
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Day of Week</label>
                <select
                  disabled={!!form.date}
                  value={form.date ? (() => {
                    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const parts = form.date.split('-');
                    if (parts.length === 3) {
                      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                      return days[d.getDay()];
                    }
                    return form.day_of_week;
                  })() : form.day_of_week}
                  onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50 disabled:opacity-50"
                >
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                {form.date && (
                  <p className="text-[10px] text-[#00D4AA] mt-1">Auto-calculated from selected date.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Start Time</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#00D4AA]/50"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">End Time</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#00D4AA]/50"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-white py-2.5 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm">
                  {editingSchedule ? "Update" : "Add Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Outcome Modal */}
      {outcomeModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl p-6 text-center transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-4">
              {outcomeModal.type === "success" ? (
                <div className="w-16 h-16 rounded-full bg-[#00D4AA]/10 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-[#00D4AA]" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertCircle size={32} className="text-red-500" />
                </div>
              )}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{outcomeModal.title}</h3>
            <p className="text-[#94A3B8] text-sm mb-6">{outcomeModal.message}</p>
            <button
              onClick={() => setOutcomeModal(null)}
              className={cn(
                "w-full font-semibold py-3 rounded-xl transition-all",
                outcomeModal.type === "success"
                  ? "bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729]"
                  : "bg-red-500 hover:bg-red-600 text-white"
              )}
            >
              {outcomeModal.type === "success" ? "Awesome!" : "Try Again"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
