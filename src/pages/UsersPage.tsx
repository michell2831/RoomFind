import React, { useState } from "react";
import { Plus, Search, Edit2, Trash2, X, Check, CreditCard, Shield, User } from "lucide-react";
import { User as UserType } from "@/types";
import { cn } from "@/lib/utils";

interface UsersPageProps {
  users: UserType[];
  onAddUser: (user: Omit<UserType, "id" | "created_at">) => void;
  onUpdateUser: (id: number, updates: Partial<UserType>) => void;
  onDeleteUser: (id: number) => void;
  onAssignRFID: (userId: number, cardUid: string) => void;
}

interface UserFormData {
  name: string;
  email: string;
  role: "admin" | "faculty";
  department: string;
  is_active: boolean;
}

const emptyForm: UserFormData = {
  name: "",
  email: "",
  role: "faculty",
  department: "",
  is_active: true,
};

export default function UsersPage({ users, onAddUser, onUpdateUser, onDeleteUser, onAssignRFID }: UsersPageProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "faculty">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [rfidModal, setRfidModal] = useState<UserType | null>(null);
  const [rfidInput, setRfidInput] = useState("");

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openAdd = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (user: UserType) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
      is_active: user.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      onUpdateUser(editingUser.id, form);
    } else {
      onAddUser({ ...form, rfid_card: undefined });
    }
    setShowModal(false);
  };

  const handleRFIDAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (rfidModal && rfidInput.trim()) {
      onAssignRFID(rfidModal.id, rfidInput.trim().toUpperCase());
      setRfidModal(null);
      setRfidInput("");
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {(["all", "admin", "faculty"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                roleFilter === f
                  ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                  : "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white border border-transparent"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 font-mono text-[10px] opacity-70">
                {f === "all" ? users.length : users.filter((u) => u.role === f).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 w-52"
            />
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold px-3 py-2 rounded-lg text-xs transition-all"
          >
            <Plus size={13} />
            Add User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {["User", "Email", "Role", "Department", "RFID Card", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left text-[#94A3B8] text-[10px] uppercase tracking-wider font-medium px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, idx) => (
              <tr
                key={user.id}
                className={cn(
                  "hover:bg-white/3 transition-colors",
                  idx !== filtered.length - 1 && "border-b border-white/5"
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <span className="text-white text-sm font-medium">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#94A3B8] text-xs font-mono">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "flex items-center gap-1.5 text-[11px] font-medium w-fit px-2 py-0.5 rounded-full",
                    user.role === "admin"
                      ? "bg-purple-500/10 text-purple-400"
                      : "bg-blue-500/10 text-blue-400"
                  )}>
                    {user.role === "admin" ? <Shield size={10} /> : <User size={10} />}
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#94A3B8] text-xs">{user.department || "—"}</td>
                <td className="px-4 py-3">
                  {user.rfid_card ? (
                    <div className="flex items-center gap-1.5">
                      <CreditCard size={11} className="text-[#00D4AA]" />
                      <span className="text-[#00D4AA] text-xs font-mono">{user.rfid_card.card_uid}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setRfidModal(user); setRfidInput(""); }}
                      className="text-[#94A3B8] text-xs hover:text-[#00D4AA] transition-colors flex items-center gap-1"
                    >
                      <Plus size={10} /> Assign
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-medium",
                    user.is_active
                      ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                      : "bg-white/5 text-[#94A3B8]"
                  )}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {deleteConfirm === user.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { onDeleteUser(user.id); setDeleteConfirm(null); }}
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
                      {user.rfid_card && (
                        <button
                          onClick={() => { setRfidModal(user); setRfidInput(user.rfid_card?.card_uid || ""); }}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-[#00D4AA] transition-all"
                          title="Reassign RFID"
                        >
                          <CreditCard size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(user)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-all"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(user.id)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#94A3B8] text-sm">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Full Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Dr. Maria Santos"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@university.edu"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "faculty" })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                  >
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Status</label>
                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Department</label>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="Computer Science"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-white py-2.5 rounded-lg text-sm transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm transition-all">
                  {editingUser ? "Update User" : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RFID Assign Modal */}
      {rfidModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold text-sm">Assign RFID Card</h3>
              <button onClick={() => setRfidModal(null)} className="text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRFIDAssign} className="p-6 space-y-4">
              <p className="text-[#94A3B8] text-sm">
                Assigning card to: <span className="text-white font-medium">{rfidModal.name}</span>
              </p>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Card UID *</label>
                <input
                  required
                  value={rfidInput}
                  onChange={(e) => setRfidInput(e.target.value)}
                  placeholder="A1B2C3D4"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setRfidModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-[#94A3B8] py-2.5 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm">
                  Assign Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
