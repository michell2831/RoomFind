import React, { useState } from "react";
import { Plus, Search, Edit2, Trash2, X, Check, Clock } from "lucide-react";
import { Schedule, Room, User } from "@/types";
import { cn } from "@/lib/utils";

interface SchedulesPageProps {
  schedules: Schedule[];
  rooms: Room[];
  users: User[];
  onAddSchedule: (s: Omit<Schedule, "id" | "created_at" | "room_code" | "room_name" | "faculty_name">) => void;
  onUpdateSchedule: (id: number, updates: Partial<Schedule>) => void;
  onDeleteSchedule: (id: number) => void;
  isAdmin: boolean;
  currentUserId: number;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ScheduleFormData {
  room_id: number;
  user_id: number;
  subject: string;
  section: string;
  day_of_week: string;
  time_start: string;
  time_end: string;
}

const emptyForm: ScheduleFormData = {
  room_id: 0,
  user_id: 0,
  subject: "",
  section: "",
  day_of_week: "Monday",
  time_start: "08:00",
  time_end: "10:00",
};

export default function SchedulesPage({
  schedules,
  rooms,
  users,
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

  const visibleSchedules = isAdmin ? schedules : schedules.filter((s) => s.user_id === currentUserId);

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
    setForm({ ...emptyForm, user_id: isAdmin ? (users[0]?.id || 0) : currentUserId, room_id: rooms[0]?.id || 0 });
    setShowModal(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingSchedule(s);
    setForm({
      room_id: s.room_id,
      user_id: s.user_id,
      subject: s.subject,
      section: s.section,
      day_of_week: s.day_of_week,
      time_start: s.time_start,
      time_end: s.time_end,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSchedule) {
      onUpdateSchedule(editingSchedule.id, form);
    } else {
      onAddSchedule(form);
    }
    setShowModal(false);
  };

  const todayDay = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="space-y-5 max-w-7xl">
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
                  <span className={cn(
                    "text-xs font-medium",
                    s.day_of_week === todayDay ? "text-[#00D4AA]" : "text-[#94A3B8]"
                  )}>
                    {s.day_of_week}
                    {s.day_of_week === todayDay && <span className="ml-1 text-[9px]">Today</span>}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[#94A3B8] text-xs font-mono">
                    <Clock size={11} />
                    {s.time_start} – {s.time_end}
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
      {showModal && (
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
                      value={form.user_id}
                      onChange={(e) => setForm({ ...form, user_id: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                    >
                      <option value={0}>Select faculty...</option>
                      {users.filter((u) => u.role === "faculty").map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
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
                <input
                  required
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  placeholder="CS-1A"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Day of Week</label>
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                >
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Start Time</label>
                  <input
                    type="time"
                    value={form.time_start}
                    onChange={(e) => setForm({ ...form, time_start: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#00D4AA]/50"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">End Time</label>
                  <input
                    type="time"
                    value={form.time_end}
                    onChange={(e) => setForm({ ...form, time_end: e.target.value })}
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
        </div>
      )}
    </div>
  );
}
