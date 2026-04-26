import React, { useState } from "react";
import { Plus, Search, Edit2, Trash2, X, Check, Building, Users, Wrench } from "lucide-react";
import { Room } from "@/types";
import { cn } from "@/lib/utils";

interface RoomsPageProps {
  rooms: Room[];
  onAddRoom: (room: Omit<Room, "id" | "created_at" | "updated_at">) => void;
  onUpdateRoom: (id: number, updates: Partial<Room>) => void;
  onDeleteRoom: (id: number) => void;
  isAdmin: boolean;
}

function StatusBadge({ status }: { status: Room["status"] }) {
  const map = {
    available: "bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/20",
    occupied: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
    maintenance: "bg-white/5 text-[#94A3B8] border-white/10",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border", map[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

interface RoomFormData {
  room_code: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  status: Room["status"];
  features: string;
}

const emptyForm: RoomFormData = {
  room_code: "",
  name: "",
  building: "",
  floor: 1,
  capacity: 30,
  status: "available",
  features: "",
};

export default function RoomsPage({ rooms, onAddRoom, onUpdateRoom, onDeleteRoom, isAdmin }: RoomsPageProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Room["status"]>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const filtered = rooms.filter((r) => {
    const matchSearch =
      r.room_code.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.building.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || r.status === filter;
    return matchSearch && matchFilter;
  });

  const openAdd = () => {
    setEditingRoom(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setForm({
      room_code: room.room_code,
      name: room.name,
      building: room.building,
      floor: room.floor,
      capacity: room.capacity,
      status: room.status,
      features: (room.features || []).join(", "),
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      features: form.features.split(",").map((f) => f.trim()).filter(Boolean),
    };
    if (editingRoom) {
      onUpdateRoom(editingRoom.id, data);
    } else {
      onAddRoom({ ...data, current_user_id: undefined, current_user_name: undefined });
    }
    setShowModal(false);
  };

  const counts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === "available").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
    maintenance: rooms.filter((r) => r.status === "maintenance").length,
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {(["all", "available", "occupied", "maintenance"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                filter === f
                  ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                  : "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white border border-transparent"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 font-mono text-[10px] opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none w-full sm:w-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 w-full sm:w-52"
            />
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold px-3 py-2 rounded-lg text-xs transition-all"
            >
              <Plus size={13} />
              Add Room
            </button>
          )}
        </div>
      </div>

      {/* Table (visible on sm+) */}
      <div className="hidden sm:block bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {["Room Code", "Name", "Building", "Floor", "Capacity", "Status", "Features", isAdmin ? "Actions" : ""].filter(Boolean).map((h) => (
                <th key={h} className="text-left text-[#94A3B8] text-[10px] uppercase tracking-wider font-medium px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((room, idx) => (
              <tr
                key={room.id}
                className={cn(
                  "hover:bg-white/3 transition-colors",
                  idx !== filtered.length - 1 && "border-b border-white/5"
                )}
              >
                <td className="px-4 py-3">
                  <span className="text-white font-mono text-xs font-bold">{room.room_code}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white text-sm">{room.name}</span>
                  {room.status === "occupied" && room.current_user_name && (
                    <p className="text-[#F59E0B] text-[11px] mt-0.5">by {room.current_user_name}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[#94A3B8] text-xs">
                    <Building size={11} />
                    {room.building}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#94A3B8] text-xs">{room.floor}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[#94A3B8] text-xs">
                    <Users size={11} />
                    {room.capacity}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={room.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(room.features || []).slice(0, 2).map((f) => (
                      <span key={f} className="text-[10px] text-[#94A3B8] bg-white/5 px-1.5 py-0.5 rounded">
                        {f}
                      </span>
                    ))}
                    {(room.features || []).length > 2 && (
                      <span className="text-[10px] text-[#94A3B8] bg-white/5 px-1.5 py-0.5 rounded">
                        +{(room.features || []).length - 2}
                      </span>
                    )}
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    {deleteConfirm === room.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { onDeleteRoom(room.id); setDeleteConfirm(null); }}
                          className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                        >
                          <Check size={12} /> Confirm
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[#94A3B8] hover:text-white text-xs">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(room)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-all"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(room.id)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-all"
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
                <td colSpan={8} className="px-4 py-12 text-center text-[#94A3B8] text-sm">
                  No rooms found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile only) */}
      <div className="block sm:hidden grid gap-4 grid-cols-1">
        {filtered.map((room) => (
          <div key={room.id} className="bg-[#0F1729] rounded-xl border border-white/5 p-4 hover:shadow-lg transition">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm font-bold">{room.room_code}</span>
                  <StatusBadge status={room.status} />
                </div>
                <h3 className="text-white font-semibold text-sm mt-2">{room.name}</h3>
                {room.status === "occupied" && room.current_user_name && (
                  <p className="text-[#F59E0B] text-[11px] mt-1">by {room.current_user_name}</p>
                )}
                <div className="mt-3 text-[#94A3B8] text-xs flex flex-col gap-1">
                  <div className="flex items-center gap-2"><Building size={12} />{room.building}</div>
                  <div className="flex items-center gap-2"><span className="text-[#94A3B8]">Floor</span> {room.floor}</div>
                  <div className="flex items-center gap-2"><Users size={12} />{room.capacity} seats</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(room.features || []).slice(0, 3).map((f) => (
                    <span key={f} className="text-[10px] text-[#94A3B8] bg-white/5 px-2 py-0.5 rounded">{f}</span>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <button onClick={() => openEdit(room)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition">
                    <Edit2 size={14} />
                  </button>
                  {deleteConfirm === room.id ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => { onDeleteRoom(room.id); setDeleteConfirm(null); }} className="text-red-400 text-xs flex items-center gap-1"><Check size={12}/> Confirm</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-[#94A3B8]"><X size={12} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(room.id)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 text-center py-12 text-[#94A3B8]">
            No rooms found
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {editingRoom ? "Edit Room" : "Add New Room"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Room Code *</label>
                  <input
                    required
                    value={form.room_code}
                    onChange={(e) => setForm({ ...form, room_code: e.target.value })}
                    placeholder="CS-101"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Room["status"] })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Room Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Computer Lab 1"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Building *</label>
                <input
                  required
                  value={form.building}
                  onChange={(e) => setForm({ ...form, building: e.target.value })}
                  placeholder="Science Building"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Floor</label>
                  <input
                    type="number"
                    min="1"
                    value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Features (comma-separated)</label>
                <input
                  value={form.features}
                  onChange={(e) => setForm({ ...form, features: e.target.value })}
                  placeholder="Projector, AC, Whiteboard"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-white py-2.5 rounded-lg text-sm transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm transition-all">
                  {editingRoom ? "Update Room" : "Add Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
