import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Plus, Search, UserCheck, X, Edit2, Check, AlertCircle, Wifi, CheckCircle2, Trash2 } from "lucide-react";
import { User } from "@/types";
import { cn } from "@/lib/utils";
import { iotService } from "@/services/iotService";

interface RFIDPageProps {
  users: User[];
  onAssignRFID: (userId: number, cardUid: string) => void | Promise<void>;
  onDeactivateCard: (userId: number) => void | Promise<void>;
  onActivateCard: (userId: number) => void | Promise<void>;
  onDeleteCard?: (userId: number) => void | Promise<void>;
}

export default function RFIDPage({ users, onAssignRFID, onDeactivateCard, onActivateCard, onDeleteCard }: RFIDPageProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "unassigned">("all");
  const [assignModal, setAssignModal] = useState<User | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [cardInput, setCardInput] = useState("");
  const [deactivateConfirm, setDeactivateConfirm] = useState<number | null>(null);
  const [scannedUnknownCard, setScannedUnknownCard] = useState<string | null>(null);
  const [lastScanValidation, setLastScanValidation] = useState<"registered_unassigned" | "already_assigned" | "inactive" | "unregistered" | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Outcome Modal State
  const [outcomeModal, setOutcomeModal] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  const addDebugLog = (msg: string) => {
    console.log("[RFID DEBUG]", msg);
    setDebugLogs(prev => [msg, ...prev].slice(0, 5));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("rfid-access-denied-gate", { detail: { enabled: isAddingCard } }));
    return () => {
      window.dispatchEvent(new CustomEvent("rfid-access-denied-gate", { detail: { enabled: false } }));
    };
  }, [isAddingCard]);

  useEffect(() => {
    if (!scannedUnknownCard) return;
    if (!assignModal && !isAddingCard) return;
    setCardInput(scannedUnknownCard);
  }, [scannedUnknownCard, assignModal, isAddingCard]);

  useEffect(() => {
    console.log('🔌 RFIDPage: Subscribing to IoT events');

    // Check if IoT service has a ws connection
    const checkConnection = () => {
      const ws = (iotService as any).ws as WebSocket | null;
      const hasWs = Boolean(ws && ws.readyState === WebSocket.OPEN);
      console.log('💻 IoT WebSocket connected:', hasWs);
      setWsConnected(hasWs);
    };
    checkConnection();

    // Re-check every 2 seconds
    const connCheckInterval = setInterval(checkConnection, 2000);

    const unsubscribeUnknownCard = iotService.subscribe('unknown_card', (event: any) => {
      console.log('📳 unknown_card event:', event);
      const uid = String(event?.cardUid || event?.card_uid || "").toUpperCase().trim();
      if (uid) {
        setScannedUnknownCard(uid);
        setLastScanValidation("unregistered");
        setCardInput(uid);
      }
    });

    const handleRawScan = (event: any) => {
      // The IoTEvent has shape: { type, timestamp, data }
      // For rfid_scan: UID is inside event.data.card_uid
      // For rfid_scan_detected: server sends it as a FLAT object, so UID is at event.card_uid
      // For scan_result: UID is inside event.data.card_uid
      const nested = event?.data || {};
      const uid = String(
        event?.card_uid ||          // rfid_scan_detected / unknown_card (flat broadcast)
        event?.cardUid ||
        nested?.card_uid ||         // rfid_scan / scan_result (nested under data)
        nested?.cardUid ||
        nested?.card_id ||
        event?.card_id ||
        ""
      ).toUpperCase().trim();

      if (uid && uid !== "UNDEFINED" && uid !== "") {
        addDebugLog(`Caught Scan: ${uid}`);
        setScannedUnknownCard(uid);
        setLastScanValidation(nested?.validation_status || event?.validation_status || "unregistered");
        setCardInput(uid);
      }
    };

    // Dedicated subscriber for rfid_scan_detected (primary event for ALL scans)
    const unsubscribeScanDetected = iotService.subscribe('rfid_scan_detected', (event: any) => {
      const uid = String(event?.card_uid || event?.cardUid || "").toUpperCase().trim();
      const validation = event?.validation_status || null;
      if (uid) {
        addDebugLog(`rfid_scan_detected: ${uid}`);
        setScannedUnknownCard(uid);
        if (validation) setLastScanValidation(validation as any);
        setCardInput(uid);
      }
    });

    const unsubscribeRaw = iotService.subscribe('rfid_scan', handleRawScan);
    const unsubscribeAll = iotService.subscribe('*', handleRawScan);

    const unsubscribeAccessDenied = iotService.subscribe('access_denied', (event: any) => {
      const uid = String(event.card_uid || "").toUpperCase();
      if (!uid) return;
      setScannedUnknownCard(uid);
      if (typeof event.reason === "string" && event.reason.toLowerCase().includes("unknown")) {
        setLastScanValidation("unregistered");
      }
      setCardInput(uid);
    });

    const unsubscribeAccessGranted = iotService.subscribe('access_granted', (event: any) => {
      const uid = String(event?.log?.card_uid || "").toUpperCase();
      if (!uid) return;
      setScannedUnknownCard(uid);
      setLastScanValidation("already_assigned");
      setCardInput(uid);
    });

    const unsubscribeAccessCheckedOut = iotService.subscribe('access_checked_out', (event: any) => {
      const uid = String(event?.log?.card_uid || "").toUpperCase();
      if (!uid) return;
      setScannedUnknownCard(uid);
      setLastScanValidation("already_assigned");
      setCardInput(uid);
    });

    const unsubscribeScanResult = iotService.subscribe('scan_result', (event: any) => {
      // event.data = latestScanResult = { card_uid, code, success, message, ... }
      const payload = event?.data || {};
      const uid = String(payload.card_uid || payload.cardUid || "").toUpperCase().trim();
      addDebugLog(`Poll Result: ${uid}`);
      if (!uid) return;

      let validation: "registered_unassigned" | "already_assigned" | "inactive" | "unregistered" | null = null;
      if (payload.code === "UNASSIGNED_CARD") validation = "registered_unassigned";
      else if (payload.code === "UNKNOWN_CARD") validation = "unregistered";
      else if (payload.code === "ACCESS_GRANTED") validation = "already_assigned";
      else if (payload.code) validation = "already_assigned";

      setScannedUnknownCard(uid);
      setLastScanValidation(validation);
      setCardInput(uid);
    });


    iotService.startScanPolling();

    return () => {
      clearInterval(connCheckInterval);
      unsubscribeUnknownCard();
      unsubscribeRaw();
      unsubscribeAll();
      unsubscribeScanDetected();
      unsubscribeAccessDenied();
      unsubscribeAccessGranted();
      unsubscribeAccessCheckedOut();
      unsubscribeScanResult();
      iotService.stopScanPolling();
    };
  }, []);

  const usersWithCards = users.filter((u) => u.rfid_card);
  const usersWithoutCards = users.filter((u) => !u.rfid_card && u.is_active);

  const filteredWithCards = usersWithCards.filter(
    (u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.rfid_card?.card_uid || "").toLowerCase().includes(search.toLowerCase());
      
      if (!matchesSearch) return false;
      if (filter === "active") return u.rfid_card?.is_active === true;
      if (filter === "inactive") return u.rfid_card?.is_active === false;
      return true;
    }
  );

  const counts = {
    all: usersWithCards.length,
    active: users.filter((u) => u.rfid_card?.is_active).length,
    inactive: users.filter((u) => u.rfid_card && !u.rfid_card.is_active).length,
  };

  const getAssignedUser = (uid: string, currentUserId?: number) => {
    if (!uid.trim()) return null;
    const match = users.find(u => 
      u.rfid_card && 
      u.rfid_card.card_uid.trim().toUpperCase() === uid.trim().toUpperCase()
    );
    if (match && match.id !== currentUserId) {
      return match;
    }
    return null;
  };

  const assignedUser = getAssignedUser(
    cardInput,
    assignModal ? assignModal.id : (selectedUserId ? Number(selectedUserId) : undefined)
  );

  const closeAssignModal = () => {
    setAssignModal(null);
    setCardInput("");
    setLastScanValidation(null);
    setScannedUnknownCard(null);
  };

  const closeAddCardModal = () => {
    setIsAddingCard(false);
    setCardInput("");
    setSelectedUserId("");
    setLastScanValidation(null);
    setScannedUnknownCard(null);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (assignedUser) {
        throw new Error(`This RFID card is already assigned to ${assignedUser.name}.`);
      }
      if (assignModal && cardInput.trim()) {
        await onAssignRFID(assignModal.id, cardInput.trim().toUpperCase());
        setOutcomeModal({ type: "success", title: "Card Assigned Successfully!", message: `The RFID card has been assigned to ${assignModal.name}.` });
        closeAssignModal();
      } else if (isAddingCard && selectedUserId && cardInput.trim()) {
        await onAssignRFID(Number(selectedUserId), cardInput.trim().toUpperCase());
        const user = usersWithoutCards.find(u => u.id === Number(selectedUserId));
        setOutcomeModal({ type: "success", title: "Card Added Successfully!", message: `The RFID card has been added for ${user?.name || 'the user'}.` });
        closeAddCardModal();
      }
    } catch (err: any) {
      setOutcomeModal({ 
        type: "error", 
        title: "Assignment Failed", 
        message: err?.message || "There was an error while assigning the card. Please try again." 
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Connection Status & Debug */}
      <div className="flex gap-4">
        <div className={`flex-1 rounded-xl border px-4 py-3 flex items-center gap-3 ${wsConnected ? 'bg-[#00D4AA]/5 border-[#00D4AA]/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <div className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-[#00D4AA] animate-pulse' : 'bg-red-500'}`} />
          <span className={`text-sm font-medium ${wsConnected ? 'text-[#00D4AA]' : 'text-red-500'}`}>
            {wsConnected ? '✓ IoT WebSocket Connected' : '✗ IoT WebSocket Disconnected'}
          </span>
        </div>

        {debugLogs.length > 0 && (
          <div className="flex-1 rounded-xl border border-white/10 bg-[#0F1729] px-4 py-2">
            <p className="text-[#94A3B8] text-[10px] uppercase mb-1">Recent Scans</p>
            <div className="text-white text-xs font-mono truncate">
              {debugLogs[0]}
            </div>
          </div>
        )}
      </div>
       {/* Tabs and Actions Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center",
                filter === f
                  ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                  : "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white border border-transparent"
              )}
            >
              {f === "all" ? "All Cards" : f === "active" ? "Active" : "Inactive"}
              <span className="ml-1.5 font-mono text-[10px] opacity-70 bg-white/5 px-1.5 py-0.5 rounded">
                {counts[f]}
              </span>
            </button>
          ))}
          <button
            onClick={() => setFilter("unassigned")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center",
              filter === "unassigned"
                ? "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30"
                : "bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white border border-transparent"
            )}
          >
            Unassigned Users
            <span className="ml-1.5 font-mono text-[10px] opacity-70 bg-white/5 px-1.5 py-0.5 rounded">
              {usersWithoutCards.length}
            </span>
          </button>
        </div>

        {/* Right side: Search and Add Card (Only visible when showing assigned cards table) */}
        {filter !== "unassigned" && (
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
            <div className="relative flex-1 sm:flex-none">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search cards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 w-full sm:w-52"
              />
            </div>
            <button
              onClick={() => { setIsAddingCard(true); setCardInput(""); setSelectedUserId(""); setLastScanValidation(null); setScannedUnknownCard(null); }}
              className="bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <Plus size={16} /> Add Card
            </button>
          </div>
        )}
      </div>

      {/* Tab Contents */}
      {filter !== "unassigned" ? (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden overflow-x-auto w-full">
              <table className="w-full min-w-[800px]">
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
                        {user.rfid_card?.is_active === false ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onActivateCard(user.id)}
                              className="text-[#00D4AA] hover:text-[#00D4AA]/90 text-xs flex items-center gap-1"
                              title="Activate Card"
                            >
                              <Check size={12} /> Activate
                            </button>
                            <button
                              onClick={() => { setAssignModal(user); setCardInput(""); setLastScanValidation(null); setScannedUnknownCard(null); }}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-all"
                              title="Reassign Card"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => onDeleteCard && onDeleteCard(user.id)}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-all"
                              title="Delete/Unassign Card"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : deactivateConfirm === user.id ? (
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
                              onClick={() => { setAssignModal(user); setCardInput(""); setLastScanValidation(null); setScannedUnknownCard(null); }}
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
      ) : (
        <div className="space-y-6">
          {/* Unassigned Users Grid */}
          <div className="bg-[#0F1729] rounded-xl border border-white/5 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                <AlertCircle size={20} className="text-[#F59E0B]" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Users Pending RFID Card Assignment
                </h3>
                <p className="text-[#94A3B8] text-xs">These active accounts do not have an RFID keycard mapped to them yet.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usersWithoutCards.map((u) => (
                <div
                  key={u.id}
                  className="bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#F59E0B] text-xs font-bold">
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{u.name}</p>
                      <p className="text-[#94A3B8] text-[10px] font-mono truncate">{u.email}</p>
                      <span className="text-[9px] bg-white/5 text-[#94A3B8] px-1.5 py-0.5 rounded mt-1 inline-block uppercase tracking-wider font-bold">
                        {u.role || "Faculty"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setAssignModal(u); setCardInput(""); setLastScanValidation(null); setScannedUnknownCard(null); }}
                    className="flex items-center gap-1.5 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/20 hover:border-[#F59E0B]/40 text-[#F59E0B] rounded-lg px-3 py-2 transition-all text-xs font-bold flex-shrink-0"
                  >
                    <Plus size={12} /> Assign
                  </button>
                </div>
              ))}

              {usersWithoutCards.length === 0 && (
                <div className="col-span-full py-12 text-center text-[#94A3B8] text-sm flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#00D4AA]/10 flex items-center justify-center text-[#00D4AA]">
                    <CheckCircle2 size={28} />
                  </div>
                  <div>
                    <p className="text-white font-medium">All caught up!</p>
                    <p className="text-[#94A3B8] text-xs mt-1">Every active user has an RFID card assigned.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-[#00D4AA]" />
                <h3 className="text-white font-semibold text-sm">Assign RFID Card</h3>
              </div>
              <button type="button" onClick={closeAssignModal} className="text-[#94A3B8] hover:text-white">
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
                  onChange={(e) => setCardInput(e.target.value.toUpperCase())}
                  placeholder="Scan card to fill UID..."
                  className={cn(
                    "w-full bg-white/5 border rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none",
                    assignedUser ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-[#00D4AA]/50"
                  )}
                />
                {assignedUser ? (
                  <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Already actively assigned to {assignedUser.name}.
                  </p>
                ) : (
                  <p className="text-[#94A3B8] text-[11px] mt-1.5">
                    {lastScanValidation === "already_assigned"
                      ? "This card is already assigned to another user."
                      : lastScanValidation === "inactive"
                        ? "This card is registered but inactive."
                        : "Scan a new or pre-registered RFID card on the reader."}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={closeAssignModal} className="flex-1 bg-white/5 hover:bg-white/10 text-[#94A3B8] py-2.5 rounded-lg text-sm">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={Boolean(assignedUser)}
                  className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm transition-all"
                >
                  Assign Card
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Card Modal */}
      {isAddingCard && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-[#00D4AA]" />
                <h3 className="text-white font-semibold text-sm">Add New RFID Card</h3>
              </div>
              <button type="button" onClick={closeAddCardModal} className="text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Select User *</label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
                >
                  <option value="" disabled>Select a user...</option>
                  {usersWithoutCards.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[#94A3B8] text-[10px] uppercase tracking-wider mb-1.5 block">Card UID *</label>
                <input
                  required
                  value={cardInput}
                  onChange={(e) => setCardInput(e.target.value.toUpperCase())}
                  placeholder="Scan card to fill UID..."
                  className={cn(
                    "w-full bg-white/5 border rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none",
                    assignedUser ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-[#00D4AA]/50"
                  )}
                />
                {assignedUser ? (
                  <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Already actively assigned to {assignedUser.name}.
                  </p>
                ) : (
                  <p className="text-[#94A3B8] text-[11px] mt-1.5">
                    {lastScanValidation === "already_assigned"
                      ? "This card is already assigned to another user."
                      : lastScanValidation === "inactive"
                        ? "This card is registered but inactive."
                        : "Scan a new or pre-registered RFID card on the reader."}
                  </p>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={closeAddCardModal} className="flex-1 bg-white/5 hover:bg-white/10 text-[#94A3B8] py-2.5 rounded-lg text-sm">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={Boolean(assignedUser)}
                  className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm transition-all"
                >
                  Add Card
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
