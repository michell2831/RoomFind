import React, { useState } from "react";
import { CreditCard, Plus, Search, UserCheck, X, Edit2, Check, AlertCircle, Wifi } from "lucide-react";
import { User } from "@/types";
import { cn } from "@/lib/utils";

interface RFIDPageProps {
  users: User[];
  onAssignRFID: (userId: number, cardUid: string) => void;
  onDeactivateCard: (userId: number) => void;
}

export default function RFIDPage({ users, onAssignRFID, onDeactivateCard }: RFIDPageProps) {
  const [search, setSearch] = useState("");
  const [assignModal, setAssignModal] = useState<User | null>(null);
  const [cardInput, setCardInput] = useState("");
  const [deactivateConfirm, setDeactivateConfirm] = useState<number | null>(null);

  const usersWithCards = users.filter((u) => u.rfid_card);
  const usersWithoutCards = users.filter((u) => !u.rfid_card && u.is_active);

  const filteredWithCards = usersWithCards.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.rfid_card?.card_uid || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (assignModal && cardInput.trim()) {
      onAssignRFID(assignModal.id, cardInput.trim().toUpperCase());
      setAssignModal(null);
      setCardInput("");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0F1729] rounded-xl border border-white/5 px-5 py-4">
          <p className="text-[#94A3B8] text-[10px] uppercase tracking-wider">Total Cards Assigned</p>
          <p className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {usersWithCards.length}
          </p>
        </div>
        <div className="bg-[#0F1729] rounded-xl border border-white/5 px-5 py-4">
          <p className="text-[#94A3B8] text-[10px] uppercase tracking-wider">Active Cards</p>
          <p className="text-2xl font-bold text-[#00D4AA] mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {users.filter((u) => u.rfid_card?.is_active).length}
          </p>
        </div>
        <div className="bg-[#0F1729] rounded-xl border border-white/5 px-5 py-4">
          <p className="text-[#94A3B8] text-[10px] uppercase tracking-wider">Users Without Card</p>
          <p className="text-2xl font-bold text-[#F59E0B] mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {usersWithoutCards.length}
          </p>
        </div>
      </div>

      {/* Unassigned users alert */}
      {usersWithoutCards.length > 0 && (
        <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-[#F59E0B] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[#F59E0B] text-sm font-medium mb-2">Users without RFID cards</p>
              <div className="flex flex-wrap gap-2">
                {usersWithoutCards.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setAssignModal(u); setCardInput(""); }}
                    className="flex items-center gap-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 rounded-lg px-3 py-1.5 transition-all"
                  >
                    <span className="text-white text-xs">{u.name}</span>
                    <Plus size={11} className="text-[#F59E0B]" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Assigned RFID Cards
          </h2>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 w-52"
            />
          </div>
        </div>

        <div className="bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {["Card UID", "Assigned To", "Department", "Status", "Assigned Date", "Actions"].map((h) => (
                  <th key={h} className="text-left text-[#94A3B8] text-[10px] uppercase tracking-wider font-medium px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredWithCards.map((user, idx) => (
                <tr
                  key={user.id}
                  className={cn(
                    "hover:bg-white/3 transition-colors",
                    idx !== filteredWithCards.length - 1 && "border-b border-white/5"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#00D4AA]/10 flex items-center justify-center">
                        <CreditCard size={13} className="text-[#00D4AA]" />
                      </div>
                      <span className="text-white font-mono text-sm font-bold">
                        {user.rfid_card?.card_uid}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">
                          {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <span className="text-white text-sm">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#94A3B8] text-xs">{user.department || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-[11px] font-medium",
                      user.rfid_card?.is_active
                        ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                        : "bg-white/5 text-[#94A3B8]"
                    )}>
                      <Wifi size={10} />
                      {user.rfid_card?.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94A3B8] text-xs font-mono">
                    {user.rfid_card?.assigned_at
                      ? new Date(user.rfid_card.assigned_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {deactivateConfirm === user.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { onDeactivateCard(user.id); setDeactivateConfirm(null); }}
                          className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                        >
                          <Check size={12} /> Confirm
                        </button>
                        <button onClick={() => setDeactivateConfirm(null)} className="text-[#94A3B8]">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setAssignModal(user); setCardInput(user.rfid_card?.card_uid || ""); }}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-all"
                          title="Reassign Card"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setDeactivateConfirm(user.id)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-all"
                          title="Deactivate"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredWithCards.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#94A3B8] text-sm">
                    No RFID cards assigned yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-[#00D4AA]" />
                <h3 className="text-white font-semibold text-sm">Assign RFID Card</h3>
              </div>
              <button onClick={() => setAssignModal(null)} className="text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3">
                <UserCheck size={15} className="text-[#94A3B8]" />
                <div>
                  <p className="text-white text-sm font-medium">{assignModal.name}</p>
                  <p className="text-[#94A3B8] text-xs font-mono">{assignModal.email}</p>
                </div>
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Card UID *</label>
                <input
                  required
                  value={cardInput}
                  onChange={(e) => setCardInput(e.target.value)}
                  placeholder="A1B2C3D4"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50"
                />
                <p className="text-[#94A3B8] text-[11px] mt-1">Scan the RFID card or enter the UID manually</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAssignModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-[#94A3B8] py-2.5 rounded-lg text-sm">
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
