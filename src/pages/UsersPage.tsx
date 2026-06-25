import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Edit2, Trash2, X, Check, CreditCard, Shield, User, CheckCircle2, AlertCircle } from "lucide-react";
import { Schedule, User as UserType } from "@/types";
import { cn, formatTime12 } from "@/lib/utils";
import { iotService } from "@/services/iotService";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface UsersPageProps {
  users: UserType[];
  schedules: Schedule[];
  onAddUser: (user: Omit<UserType, "id" | "created_at">) => void;
  onUpdateUser: (id: number, updates: Partial<UserType>) => void;
  onDeleteUser: (id: number) => void;
  onAssignRFID: (userId: number, cardUid: string) => void | Promise<void>;
}

interface UserFormData {
  name: string;
  email: string;
  role: "admin" | "faculty" | "student";
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

export default function UsersPage({ users, schedules, onAddUser, onUpdateUser, onDeleteUser, onAssignRFID }: UsersPageProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "faculty" | "student">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [rfidModal, setRfidModal] = useState<UserType | null>(null);
  const [rfidInput, setRfidInput] = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [scanMessage, setScanMessage] = useState("Scan a new or pre-registered RFID card on the reader.");
  const [lastScannedUid, setLastScannedUid] = useState("");
  const [lastValidation, setLastValidation] = useState<string>("unregistered");

  // Outcome Modal State
  const [outcomeModal, setOutcomeModal] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

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

  useEffect(() => {
    fetchSections();
  }, []);

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSectionName.trim().toUpperCase();
    if (!name) return;

    try {
      const { data, error } = await supabase.from("sections").insert({ name }).select().single();
      if (error) {
        setOutcomeModal({ type: "error", title: "Error Adding Section", message: error.message });
      } else {
        setNewSectionName("");
        fetchSections();
      }
    } catch (err: any) {
      console.error("Error adding section:", err);
      setOutcomeModal({ type: "error", title: "Error", message: err.message });
    }
  };

  const handleDeleteSection = async (id: number) => {
    try {
      const { error } = await supabase.from("sections").delete().eq("id", id);
      if (error) {
        setOutcomeModal({ type: "error", title: "Error Deleting Section", message: error.message });
      } else {
        fetchSections();
      }
    } catch (err: any) {
      console.error("Error deleting section:", err);
      setOutcomeModal({ type: "error", title: "Error", message: err.message });
    }
  };

  useEffect(() => {
    const handleScan = (event: any) => {
      const payload = event?.data || event;
      const scannedUid = String(payload.card_uid ?? payload.cardUid ?? payload.uid ?? payload.card_id ?? "").toUpperCase();

      let validation = "unregistered";
      if (event.type === "scan_result") {
        if (payload.code === "UNASSIGNED_CARD") validation = "registered_unassigned";
        else if (payload.code === "UNKNOWN_CARD" || payload.code === "SERVER_NOT_CONFIGURED") validation = "unregistered";
        else if (payload.code) validation = "already_assigned";
      } else {
        validation = String(payload.validation_status ?? "unregistered");
      }

      console.log("[RFID ASSIGN DEBUG] scan event received", { scannedUid, validation, raw: event });

      if (scannedUid) {
        setLastScannedUid(scannedUid);
        setLastValidation(validation);
        setRfidInput(scannedUid);

        if (validation === "registered_unassigned" || validation === "unregistered") {
          setScanStatus("valid");
          setScanMessage("Card verified. Ready to assign.");
        } else if (validation === "inactive") {
          setScanStatus("invalid");
          setScanMessage("This card is registered but inactive.");
        } else {
          setScanStatus("invalid");
          setScanMessage("This card is already assigned to a user.");
        }
      }
    };

    const unsubscribe0 = iotService.subscribe("rfid_scan", handleScan);
    const unsubscribe1 = iotService.subscribe("rfid_scan_detected", handleScan);
    const unsubscribe2 = iotService.subscribe("scan_result", handleScan);
    const unsubscribeAll = iotService.subscribe("*", handleScan);

    iotService.startScanPolling();

    return () => {
      unsubscribe0();
      unsubscribe1();
      unsubscribe2();
      unsubscribeAll();
      iotService.stopScanPolling();
    };
  }, []);

  useEffect(() => {
    if (!rfidModal || !lastScannedUid) return;
    setRfidInput(lastScannedUid);

    if (lastValidation === "registered_unassigned" || lastValidation === "unregistered") {
      setScanStatus("valid");
      setScanMessage("Card verified. Ready to assign.");
    } else if (lastValidation === "already_assigned") {
      const existingUser = users.find(u => u.rfid_card?.card_uid === lastScannedUid);
      setScanStatus("invalid");
      if (existingUser) {
        setScanMessage(`This card is already assigned to ${existingUser.name}.`);
      } else {
        setScanMessage("This card is already assigned to another user.");
      }
    } else if (lastValidation === "inactive") {
      setScanStatus("invalid");
      setScanMessage("This card is registered but inactive.");
    } else {
      setScanStatus("invalid");
      setScanMessage("Scan a new or pre-registered RFID card on the reader.");
    }
  }, [rfidModal, lastScannedUid, lastValidation, users]);

  useEffect(() => {
    console.log("[RFID ASSIGN DEBUG] modal state", { open: Boolean(rfidModal), user: rfidModal?.name || null });
  }, [rfidModal]);

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

  const closeRfidModal = () => {
    setRfidModal(null);
    setRfidInput("");
    setLastScannedUid("");
    setLastValidation("unregistered");
    setScanStatus("idle");
    setScanMessage("Scan a new or pre-registered RFID card on the reader.");
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

    // Enforce PUP student email domain validation
    if (form.role === "student" && !form.email.toLowerCase().endsWith("@iskolarngbayan.pup.edu.ph")) {
      toast.error("Student accounts must use a valid PUP student email ending in @iskolarngbayan.pup.edu.ph");
      return;
    }

    if (editingUser) {
      onUpdateUser(editingUser.id, form);
    } else {
      onAddUser({ ...form, rfid_card: undefined });
    }
    setShowModal(false);
  };

  const handleRFIDAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfidInput.trim()) {
      setOutcomeModal({ type: "error", title: "Missing Card", message: "Please scan a card first." });
      return;
    }

    if (rfidModal && scanStatus === "valid") {
      try {
        await onAssignRFID(rfidModal.id, rfidInput.trim().toUpperCase());
        setOutcomeModal({ type: "success", title: "Card Assigned Successfully!", message: `The RFID card has been assigned to ${rfidModal.name}.` });
        closeRfidModal();
      } catch (err: any) {
        setOutcomeModal({ 
          type: "error", 
          title: "Assignment Failed", 
          message: err?.message || "There was an error while assigning the card. Please try again." 
        });
      }
    } else {
      setOutcomeModal({ type: "error", title: "Invalid Card", message: scanMessage });
    }
  };

  return (
    <div className="space-y-5 max-w-6xl w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "admin", "faculty", "student"] as const).map((f) => (
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
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          <div className="relative flex-1 sm:flex-none">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              id="search-users"
              name="search-users"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 w-full sm:w-52"
            />
          </div>
          <button
            onClick={() => setShowSectionsModal(true)}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold px-3 py-2 rounded-lg text-xs transition-all flex-shrink-0"
          >
            <Shield size={13} className="text-[#00D4AA]" />
            Manage Sections
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold px-3 py-2 rounded-lg text-xs transition-all flex-shrink-0"
          >
            <Plus size={13} />
            Add User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden overflow-x-auto w-full">
        <table className="w-full min-w-[950px]">
          <thead>
            <tr className="border-b border-white/5">
              {["User", "Email", "Role", "Department", "Schedules", "RFID Card", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left text-[#94A3B8] text-[10px] uppercase tracking-wider font-medium px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, idx) => {
              const userSchedules = schedules.filter((s) => (s.faculty_id ?? s.user_id) === user.id);
              const isExpanded = expandedUserId === user.id;
              return (
                <React.Fragment key={user.id}>
                  <tr
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
                    <td className="px-4 py-3 text-[#94A3B8] text-xs">
                      {userSchedules.length === 0 ? (
                        "—"
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                          className="text-[#00D4AA] hover:text-[#00D4AA]/90 text-xs"
                        >
                          {isExpanded ? "Hide schedules" : `View schedules (${userSchedules.length})`}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.rfid_card && user.rfid_card.is_active ? (
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={11} className="text-[#00D4AA]" />
                          <span className="text-[#00D4AA] text-xs font-mono">{user.rfid_card.card_uid}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setRfidModal(user);
                            setRfidInput("");
                            setLastScannedUid("");
                            setLastValidation("unregistered");
                            setScanStatus("idle");
                            setScanMessage("Scan a new or pre-registered RFID card on the reader.");
                          }}
                          className="text-[#94A3B8] text-xs hover:text-[#00D4AA] transition-colors flex items-center gap-1"
                        >
                          <Plus size={10} /> {user.rfid_card ? "Reassign" : "Assign"}
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
                          {/* {user.rfid_card && (
                            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[#4B5563]" title="Assigned RFID locked to scanned pre-registered cards">
                              <CreditCard size={12} />
                            </div>
                          )} */}
                          <button
                            onClick={() => openEdit(user)}
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (user.role === 'admin') return;
                              setDeleteConfirm(user.id);
                            }}
                            disabled={user.role === 'admin'}
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                              user.role === 'admin'
                                ? "bg-white/5 opacity-30 text-[#94A3B8] cursor-not-allowed"
                                : "bg-white/5 hover:bg-red-500/20 text-[#94A3B8] hover:text-red-400"
                            )}
                            title={user.role === 'admin' ? "Admin accounts cannot be deleted" : "Delete User"}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {isExpanded && userSchedules.length > 0 && (
                    <tr className="border-b border-white/5">
                      <td colSpan={8} className="px-4 py-3 bg-white/2">
                        <div className="rounded-lg border border-white/5 overflow-hidden overflow-x-auto w-full">
                          <table className="w-full min-w-[600px]">
                            <thead>
                              <tr className="bg-white/3">
                                {["Day", "Time", "Room", "Subject", "Section"].map((h) => (
                                  <th key={h} className="text-left text-[#94A3B8] text-[10px] uppercase tracking-wider font-medium px-3 py-2">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {userSchedules.map((s) => (
                                <tr key={s.id} className="border-t border-white/5">
                                  <td className="px-3 py-2 text-[#94A3B8] text-[11px]">{s.day_of_week}</td>
                                  <td className="px-3 py-2 text-[#94A3B8] text-[11px] font-mono">
                                    {formatTime12(s.time_start ?? '')}–{formatTime12(s.time_end ?? '')}
                                  </td>
                                  <td className="px-3 py-2 text-[#94A3B8] text-[11px] font-mono">{s.room_code}</td>
                                  <td className="px-3 py-2 text-[#94A3B8] text-[11px]">{s.subject}</td>
                                  <td className="px-3 py-2 text-[#94A3B8] text-[11px] font-mono">{s.section}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
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
      {showModal && createPortal(
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
                <label htmlFor="user-name" className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Full Name *</label>
                <input
                  id="user-name"
                  name="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Dr. Maria Santos"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div>
                <label htmlFor="user-email" className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Email *</label>
                <input
                  id="user-email"
                  name="email"
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
                  <label htmlFor="user-role" className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Role</label>
                  <select
                    id="user-role"
                    name="role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "faculty" | "student" })}
                    disabled={editingUser?.role === "admin" || editingUser?.role === "student"}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                    <option value="student">Student</option>
                  </select>
                  {editingUser?.role === "admin" && (
                    <span className="text-[10px] text-purple-400/80 mt-1 block leading-tight">
                      Admin accounts cannot be demoted to Faculty.
                    </span>
                  )}
                  {editingUser?.role === "student" && (
                    <span className="text-[10px] text-[#00D4AA]/80 mt-1 block leading-tight">
                      Student accounts cannot have their role changed.
                    </span>
                  )}
                </div>
                <div>
                  <label htmlFor="user-status" className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Status</label>
                  <select
                    id="user-status"
                    name="status"
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
                <label htmlFor="user-department" className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Department</label>
                <input
                  id="user-department"
                  name="department"
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
        </div>,
        document.body
      )}

      {/* RFID Assign Modal */}
      {rfidModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold text-sm">Assign RFID Card</h3>
              <button type="button" onClick={closeRfidModal} className="text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRFIDAssign} className="p-6 space-y-4">
              <p className="text-[#94A3B8] text-sm">
                Assigning card to: <span className="text-white font-medium">{rfidModal.name}</span>
              </p>
              <p className={cn(
                "text-xs",
                scanStatus === "valid" ? "text-[#00D4AA]" : scanStatus === "invalid" ? "text-[#EF4444]" : "text-[#94A3B8]"
              )}>
                {scanMessage}
              </p>
              <div>
                <label htmlFor="rfid-uid" className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Card UID *</label>
                <input
                  id="rfid-uid"
                  name="rfid_uid"
                  required
                  value={rfidInput}
                  readOnly
                  placeholder="Waiting for scan..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={closeRfidModal} className="flex-1 bg-white/5 hover:bg-white/10 text-[#94A3B8] py-2.5 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm">
                  Assign Card
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Manage Sections Modal */}
      {showSectionsModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
              <h3 className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Manage Course Sections
              </h3>
              <button onClick={() => setShowSectionsModal(false)} className="text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            {/* Sections List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <p className="text-xs text-[#94A3B8]">
                Add or delete official sections. Students will be required to choose from these options when registering.
              </p>
              
              <div className="bg-[#0B1120] rounded-xl border border-white/5 divide-y divide-white/5 max-h-60 overflow-y-auto">
                {sections.length === 0 ? (
                  <div className="p-4 text-center text-[#94A3B8] text-xs">
                    No sections added yet.
                  </div>
                ) : (
                  sections.map((sec) => (
                    <div key={sec.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-white text-sm font-mono font-medium">{sec.name}</span>
                      <button
                        onClick={() => handleDeleteSection(sec.id)}
                        className="p-1 hover:bg-red-500/20 text-[#94A3B8] hover:text-red-400 rounded transition-colors"
                        title="Delete Section"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Section Form */}
            <form onSubmit={handleAddSection} className="p-6 border-t border-white/5 bg-[#0B1120] rounded-b-2xl flex-shrink-0 space-y-3">
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">
                  Add New Section
                </label>
                <div className="flex gap-2">
                  <input
                    required
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="e.g. BSIT 3-2"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                  />
                  <button
                    type="submit"
                    className="bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-bold px-4 py-2 rounded-lg text-sm transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Outcome Modal */}
      {outcomeModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl p-6 text-center transform transition-all scale-100">
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
