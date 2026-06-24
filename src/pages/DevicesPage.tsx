import React, { useState, useEffect } from "react";
import { Cpu, Wifi, Settings, AlertCircle, CheckCircle2, Search, Edit2, X, Lock, Signal, DoorOpen, Loader2 } from "lucide-react";
import { Device, Room } from "@/types";
import { cn } from "@/lib/utils";
import iotService from "@/services/iotService";
import { toast } from "sonner";

interface DevicesPageProps {
  devices: Device[];
  rooms: Room[];
  onUpdateDevice: (id: number, updates: Partial<Device>) => void;
}

export default function DevicesPage({ devices, rooms, onUpdateDevice }: DevicesPageProps) {
  const [search, setSearch] = useState("");
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [wifiForm, setWifiForm] = useState({ ssid: "", password: "", roomId: "" });
  const [scannedNetworks, setScannedNetworks] = useState<Array<{ ssid: string; rssi: number; secure: boolean }>>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const filtered = devices.filter((d) => 
    d.device_uid.toLowerCase().includes(search.toLowerCase()) ||
    (d.room_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const openConfig = (device: Device) => {
    setEditingDevice(device);
    setWifiForm({
      ssid: device.wifi_ssid || "",
      password: device.wifi_password || "",
      roomId: device.room_id ? String(device.room_id) : ""
    });
    setScannedNetworks([]);
    setManualMode(!device.wifi_ssid);
    
    if (device.status === 'online') {
      setIsScanning(true);
      iotService.sendCommand(device.device_uid, { action: "scan_wifi" });
    } else {
      setIsScanning(false);
      setManualMode(true);
    }
  };

  useEffect(() => {
    if (!editingDevice || editingDevice.status !== 'online') return;

    const unsubscribe = iotService.subscribe('wifi_scan_results', (event: any) => {
      if (event.deviceId === editingDevice.device_uid) {
        setScannedNetworks(event.networks || []);
        setIsScanning(false);
        setManualMode(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [editingDevice]);

  const handleUpdate = () => {
    if (!editingDevice) return;
    
    const trimmedSsid = wifiForm.ssid.trim();
    if (!trimmedSsid) {
      toast.error("WiFi SSID cannot be empty");
      return;
    }
    
    if (trimmedSsid === ".") {
      toast.error("Invalid WiFi SSID. Single dots are not allowed.");
      return;
    }

    onUpdateDevice(editingDevice.id, {
      wifi_ssid: trimmedSsid,
      wifi_password: wifiForm.password,
      room_id: wifiForm.roomId ? Number(wifiForm.roomId) : null
    });
    setEditingDevice(null);
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="text-[#00D4AA]" size={24} />
            IoT Device Management
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">Manage ESP32 controllers and WiFi connectivity.</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--panel-bg)] border border-[color:var(--panel-border)] rounded-2xl p-5 backdrop-blur-xl">
          <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">Total Devices</p>
          <p className="text-3xl font-bold text-white mt-1">{devices.length}</p>
        </div>
        <div className="bg-[var(--panel-bg)] border border-[color:var(--panel-border)] rounded-2xl p-5 backdrop-blur-xl">
          <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">Online Now</p>
          <p className="text-3xl font-bold text-[#00D4AA] mt-1">{devices.filter(d => d.status === 'online').length}</p>
        </div>
        <div className="bg-[var(--panel-bg)] border border-[color:var(--panel-border)] rounded-2xl p-5 backdrop-blur-xl">
          <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">Offline</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{devices.filter(d => d.status === 'offline').length}</p>
        </div>
      </div>

      <div className="bg-[var(--panel-bg)] border border-[color:var(--panel-border)] rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="p-4 border-b border-[color:var(--panel-border)] bg-white/5 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={18} />
            <input
              type="text"
              placeholder="Search by Device UID or Room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--app-bg)] border border-[color:var(--panel-border)] rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-[#475569] focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-[#00D4AA] transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[color:var(--panel-border)] bg-white/5">
                <th className="px-6 py-4 text-[#94A3B8] font-semibold text-sm">Device Details</th>
                <th className="px-6 py-4 text-[#94A3B8] font-semibold text-sm">Room Assignment</th>
                <th className="px-6 py-4 text-[#94A3B8] font-semibold text-sm">WiFi Network</th>
                <th className="px-6 py-4 text-[#94A3B8] font-semibold text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--panel-border)]">
              {filtered.map((device) => (
                <tr key={device.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        device.status === 'online' ? "bg-[#00D4AA]/10 text-[#00D4AA]" : "bg-red-400/10 text-red-400"
                      )}>
                        <Cpu size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{device.device_uid}</p>
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            device.status === 'online' ? "bg-[#00D4AA] animate-pulse" : "bg-red-400"
                          )} />
                        </div>
                        <p className="text-[#94A3B8] text-[10px] uppercase tracking-wider">
                          Last seen: {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {device.room_name ? (
                      <div>
                        <p className="text-white font-medium">{device.room_name}</p>
                        <p className="text-[#94A3B8] text-xs font-mono">{device.room_code}</p>
                      </div>
                    ) : (
                      <span className="text-[#475569] text-sm italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    {device.wifi_ssid ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/5 rounded-lg">
                          <Wifi size={14} className="text-[#00D4AA]" />
                        </div>
                        <div>
                          <p className="text-white text-sm">{device.wifi_ssid}</p>
                          <div className="flex items-center gap-1">
                            <Lock size={10} className="text-[#475569]" />
                            <p className="text-[#475569] text-[10px]">••••••••</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-red-400/50 text-xs flex items-center gap-1">
                        <AlertCircle size={12} />
                        No WiFi Configured
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button
                      onClick={() => openConfig(device)}
                      className="inline-flex items-center gap-2 bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] px-4 py-2 rounded-xl text-sm font-semibold transition-all border border-[#00D4AA]/20"
                    >
                      <Settings size={16} />
                      Configure
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <Cpu className="mx-auto text-white/10 mb-4" size={48} />
              <p className="text-[#94A3B8]">No devices found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Card for Presentation */}
      <div className="bg-gradient-to-br from-[#00D4AA]/10 to-blue-500/10 border border-[#00D4AA]/20 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#00D4AA]/20 rounded-2xl">
            <Signal className="text-[#00D4AA]" size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg mb-1">Provisioning Tip for ESP32</h3>
            <p className="text-[#94A3B8] text-sm leading-relaxed max-w-2xl">
              Updating the WiFi credentials here will store them in the database. 
              The ESP32 controller is programmed to poll these settings via the 
              IoT Socket Server. This ensures that when you change network details 
              on campus, you don't need to manually re-flash each hardware unit.
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Modal */}
      {editingDevice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[var(--panel-bg)] border border-[color:var(--panel-border)] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-white/5 px-6 py-6 border-b border-[color:var(--panel-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#00D4AA]/10 rounded-xl">
                  <Wifi className="text-[#00D4AA]" size={24} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl">WiFi Settings</h3>
                  <p className="text-[#94A3B8] text-xs font-mono">{editingDevice.device_uid}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingDevice(null)}
                className="p-2 hover:bg-white/5 rounded-xl text-[#94A3B8] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider px-1">
                    Room Assignment
                  </label>
                  <div className="relative group">
                    <DoorOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#475569] group-focus-within:text-[#00D4AA] transition-colors" size={18} />
                    <select
                      value={wifiForm.roomId}
                      onChange={(e) => setWifiForm({ ...wifiForm, roomId: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-[#00D4AA] transition-all cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {rooms.map((room) => (
                        <option
                          key={room.id}
                          value={room.id}
                        >
                          {room.room_code} - {room.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
                      WiFi SSID (Network Name)
                    </label>
                    {editingDevice.status === 'online' && !isScanning && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsScanning(true);
                          setScannedNetworks([]);
                          iotService.sendCommand(editingDevice.device_uid, { action: "scan_wifi" });
                        }}
                        className="text-[10px] text-[#00D4AA] hover:underline font-bold uppercase tracking-wider"
                      >
                        Rescan
                      </button>
                    )}
                  </div>

                  <div className="relative group">
                    {isScanning ? (
                      <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00D4AA] animate-spin" size={18} />
                    ) : (
                      <Wifi className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#475569] group-focus-within:text-[#00D4AA] transition-colors" size={18} />
                    )}

                    {isScanning ? (
                      <select
                        disabled
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white/50 focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-[#00D4AA] transition-all cursor-not-allowed"
                      >
                        <option>Scanning for WiFi networks...</option>
                      </select>
                    ) : !manualMode && scannedNetworks.length > 0 ? (
                      <select
                        value={wifiForm.ssid}
                        onChange={(e) => {
                          if (e.target.value === "__manual__") {
                            setManualMode(true);
                            setWifiForm({ ...wifiForm, ssid: "" });
                          } else {
                            setWifiForm({ ...wifiForm, ssid: e.target.value });
                          }
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-[#00D4AA] transition-all cursor-pointer"
                      >
                        <option value="" disabled>Select WiFi Network...</option>
                        {scannedNetworks.map((net, idx) => (
                          <option
                            key={idx}
                            value={net.ssid}
                          >
                            {net.ssid} ({net.rssi} dBm) {net.secure ? "🔒" : "🔓"}
                          </option>
                        ))}
                        <option value="__manual__" className="text-[#00D4AA] font-bold">➕ Enter SSID Manually...</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={wifiForm.ssid}
                        onChange={(e) => setWifiForm({ ...wifiForm, ssid: e.target.value })}
                        placeholder="e.g. University_WiFi"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-[#00D4AA] transition-all"
                      />
                    )}
                  </div>
                  {!isScanning && manualMode && editingDevice.status === 'online' && scannedNetworks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setManualMode(false)}
                      className="text-xs text-[#00D4AA] hover:underline mt-1 block px-1"
                    >
                      ➔ Use scanned networks list
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider px-1">
                    WiFi Password
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#475569] group-focus-within:text-[#00D4AA] transition-colors" size={18} />
                    <input
                      type="password"
                      value={wifiForm.password}
                      onChange={(e) => setWifiForm({ ...wifiForm, password: e.target.value })}
                      placeholder="Enter network password"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-[#00D4AA]/50 focus:border-[#00D4AA] transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
                <AlertCircle className="text-blue-400 shrink-0" size={18} />
                <p className="text-blue-200/70 text-xs leading-relaxed">
                  The device will apply these settings the next time it syncs with the server. Ensure the room has adequate signal coverage.
                </p>
              </div>
            </div>

            <div className="p-6 bg-white/5 border-t border-[color:var(--panel-border)] flex gap-3">
              <button
                onClick={() => setEditingDevice(null)}
                className="flex-1 px-4 py-3 rounded-xl text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-bold py-3 rounded-xl shadow-lg hover:shadow-[#00D4AA]/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Save Config
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
