import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, Activity, AlertTriangle, CheckCircle, Play, Pause, RefreshCw } from "lucide-react";
import { Room, User } from "@/types";
import iotService from "@/services/iotService";
import { cn } from "@/lib/utils";

interface IoTDevice {
  id: string;
  name: string;
  type: 'rfid_reader' | 'room_sensor' | 'door_sensor';
  room_id?: number;
  room_name?: string;
  status: 'online' | 'offline' | 'error';
  last_seen: string;
  battery_level?: number;
}

interface IoTPageProps {
  rooms: Room[];
  users: User[];
  isAdmin: boolean;
}

export default function IoTPage({ rooms, users, isAdmin }: IoTPageProps) {
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [selectedRoom, setSelectedRoom] = useState<number>(1);
  const [selectedUser, setSelectedUser] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    // Update connection status
    const updateConnectionStatus = () => {
      setConnectionStatus(iotService.getConnectionStatus());
    };

    updateConnectionStatus();
    const interval = setInterval(updateConnectionStatus, 1000);

    // Simulate some IoT devices
    const simulatedDevices: IoTDevice[] = rooms.slice(0, 5).map((room, index) => ({
      id: `rfid_${room.id}`,
      name: `RFID Reader - ${room.name}`,
      type: 'rfid_reader' as const,
      room_id: room.id,
      room_name: room.name,
      status: Math.random() > 0.2 ? 'online' : 'offline',
      last_seen: new Date(Date.now() - Math.random() * 300000).toISOString(),
      battery_level: 80 + Math.floor(Math.random() * 20)
    }));

    // Add room sensors
    rooms.slice(0, 3).forEach((room) => {
      simulatedDevices.push({
        id: `sensor_${room.id}`,
        name: `Room Sensor - ${room.name}`,
        type: 'room_sensor' as const,
        room_id: room.id,
        room_name: room.name,
        status: Math.random() > 0.1 ? 'online' : 'offline',
        last_seen: new Date(Date.now() - Math.random() * 300000).toISOString(),
        battery_level: 70 + Math.floor(Math.random() * 30)
      });
    });

    setDevices(simulatedDevices);

    return () => clearInterval(interval);
  }, [rooms]);

  const simulateRFIDScan = () => {
    const user = users.find(u => u.id === selectedUser);
    const room = rooms.find(r => r.id === selectedRoom);
    
    if (user && user.rfid_card && room) {
      const action = Math.random() > 0.5 ? 'check_in' : 'check_out';
      iotService.simulateRFIDScan(user.rfid_card.card_uid, selectedRoom, action);
      
      // Show notification
      alert(`Simulated ${action} for ${user.name} in ${room.name}`);
    } else {
      alert('Please select a user with an RFID card and a room');
    }
  };

  const simulateRoomSensor = () => {
    const room = rooms.find(r => r.id === selectedRoom);
    if (room) {
      const occupancy = Math.random() > 0.5;
      const doorOpen = Math.random() > 0.5;
      iotService.simulateRoomSensor(selectedRoom, occupancy, doorOpen);
      
      // Show notification
      alert(`Simulated sensor data for ${room.name}: Occupied=${occupancy}, Door=${doorOpen ? 'Open' : 'Closed'}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'offline':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'error':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-5 h-5 text-green-400" />;
      case 'connecting':
        return <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />;
      default:
        return <WifiOff className="w-5 h-5 text-red-400" />;
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-[#94A3B8]">You don't have permission to access IoT settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">IoT Dashboard</h1>
          <p className="text-[#94A3B8] text-sm">Monitor and manage IoT devices</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0F1729] px-3 py-2 rounded-lg border border-white/5">
            {getConnectionStatusIcon()}
            <span className="text-sm text-white capitalize">{connectionStatus}</span>
          </div>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="bg-[#0F1729] rounded-xl border border-white/5 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">IoT Simulation</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-[#94A3B8] text-xs uppercase tracking-wider mb-2 block">Select Room</label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_code} - {room.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-[#94A3B8] text-xs uppercase tracking-wider mb-2 block">Select User</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00D4AA]/50"
            >
              {users.filter(u => u.rfid_card).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end gap-2">
            <button
              onClick={simulateRFIDScan}
              className="flex-1 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold px-4 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Simulate RFID
            </button>
          </div>
          
          <div className="flex items-end gap-2">
            <button
              onClick={simulateRoomSensor}
              className="flex-1 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Simulate Sensor
            </button>
          </div>
        </div>
      </div>

      {/* Device List */}
      <div className="bg-[#0F1729] rounded-xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Connected Devices</h2>
          <p className="text-[#94A3B8] text-sm">{devices.length} devices found</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-[#94A3B8] text-xs uppercase tracking-wider font-medium px-6 py-3">Device</th>
                <th className="text-left text-[#94A3B8] text-xs uppercase tracking-wider font-medium px-6 py-3">Type</th>
                <th className="text-left text-[#94A3B8] text-xs uppercase tracking-wider font-medium px-6 py-3">Room</th>
                <th className="text-left text-[#94A3B8] text-xs uppercase tracking-wider font-medium px-6 py-3">Status</th>
                <th className="text-left text-[#94A3B8] text-xs uppercase tracking-wider font-medium px-6 py-3">Last Seen</th>
                <th className="text-left text-[#94A3B8] text-xs uppercase tracking-wider font-medium px-6 py-3">Battery</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-white font-medium text-sm">{device.name}</div>
                      <div className="text-[#94A3B8] text-xs">{device.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[#94A3B8] text-sm capitalize">{device.type.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white text-sm">{device.room_name || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(device.status)}
                      <span className={cn("text-xs font-medium px-2 py-1 rounded-full border", getStatusColor(device.status))}>
                        {device.status.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[#94A3B8] text-sm">
                      {new Date(device.last_seen).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {device.battery_level !== undefined ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-white/10 rounded-full h-2">
                          <div 
                            className={cn(
                              "h-2 rounded-full transition-all",
                              device.battery_level > 50 ? "bg-green-400" : 
                              device.battery_level > 20 ? "bg-yellow-400" : "bg-red-400"
                            )}
                            style={{ width: `${device.battery_level}%` }}
                          />
                        </div>
                        <span className="text-[#94A3B8] text-xs">{device.battery_level}%</span>
                      </div>
                    ) : (
                      <span className="text-[#94A3B8] text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
