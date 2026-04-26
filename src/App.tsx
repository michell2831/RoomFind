import { Suspense, useState, useEffect } from "react";
import { supabase } from '@/lib/supabase'
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Layout from "./components/layout/Layout";
import DashboardPage from "./pages/DashboardPage";
import RoomsPage from "./pages/RoomsPage";
import UsersPage from "./pages/UsersPage";
import SchedulesPage from "./pages/SchedulesPage";
import LogsPage from "./pages/LogsPage";
import RFIDPage from "./pages/RFIDPage";
import IoTPage from "./pages/IoTPage";
import { Room, User, Schedule, DashboardStats, AccessLog } from "./types";
import iotService, { IoTEvent, RFIDScanEvent, RoomSensorEvent } from "./services/iotService";

const DEMO_USERS = [
  { id: 3, email: "admin@university.edu", password: "admin123", name: "Admin User", role: "admin" as const },
  { id: 1, email: "m.santos@university.edu", password: "faculty123", name: "Dr. Maria Santos", role: "faculty" as const },
];

function App() {
  const [authUser, setAuthUser] = useState<{ id: number; name: string; email: string; role: "admin" | "faculty" } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const defaultStats: DashboardStats = {
    totalRooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    maintenanceRooms: 0,
    totalUsers: 0,
    activeUsers: 0,
    todayCheckIns: 0,
    activeSchedules: 0,
  };
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRooms = async () => {
    try {
      setIsPolling(true);
      const { data, error } = await supabase.from('rooms').select('*');
      if (error) {
        console.error('supabase fetch rooms error:', error);
        // Show user-friendly error message
        alert(`Error fetching rooms: ${error.message}`);
      }
      if (data) {
        setRooms(data as Room[]);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error('fetchRooms unexpected error', e);
      alert('Unexpected error occurred while fetching rooms');
    } finally {
      setIsPolling(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) {
        console.error('supabase fetch users error:', error);
        alert(`Error fetching users: ${error.message}`);
      }
      if (data) setUsers(data as User[]);
    } catch (e) {
      console.error('fetchUsers unexpected error', e);
      alert('Unexpected error occurred while fetching users');
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase.from('schedules').select('*');
      if (error) {
        console.error('supabase fetch schedules error:', error);
        alert(`Error fetching schedules: ${error.message}`);
      }
      if (data) setSchedules(data as Schedule[]);
    } catch (e) {
      console.error('fetchSchedules unexpected error', e);
      alert('Unexpected error occurred while fetching schedules');
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase.from('access_logs').select('*');
      if (error) {
        console.error('supabase fetch logs error:', error);
        alert(`Error fetching logs: ${error.message}`);
      }
      if (data) setLogs(data as AccessLog[]);
    } catch (e) {
      console.error('fetchLogs unexpected error', e);
      alert('Unexpected error occurred while fetching logs');
    }
  };

  useEffect(() => {
    // initial fetch of data
    fetchRooms();
    fetchUsers();
    fetchSchedules();
    fetchLogs();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth: read current session and subscribe to changes
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (mounted && session && session.user) {
          const u = session.user;
          setAuthUser({
            id: 0,
            name: (u.user_metadata as any)?.name || u.email || "",
            email: u.email || "",
            role: ((u.user_metadata as any)?.role as "admin" | "faculty") || "faculty",
          });
        }
      } catch (e) {
        console.error('auth init error', e);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        const u = session.user;
        setAuthUser({
          id: 0,
          name: (u.user_metadata as any)?.name || u.email || "",
          email: u.email || "",
          role: ((u.user_metadata as any)?.role as "admin" | "faculty") || "faculty",
        });
        // refresh data on sign in
        fetchRooms();
        fetchUsers();
        fetchSchedules();
        fetchLogs();
      } else {
        setAuthUser(null);
      }
    });

    return () => {
      mounted = false;
      if (sub && typeof sub.subscription?.unsubscribe === 'function') sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const interval = setInterval(() => {
      setIsPolling(true);
      setTimeout(() => {
        setIsPolling(false);
        setLastUpdated(new Date());
        setStats((prev) => ({
          ...prev,
          availableRooms: rooms.filter((r) => r.status === "available").length,
          occupiedRooms: rooms.filter((r) => r.status === "occupied").length,
          maintenanceRooms: rooms.filter((r) => r.status === "maintenance").length,
        }));
      }, 600);
    }, 5000);
    return () => clearInterval(interval);
  }, [authUser, rooms]);

  // IoT Event Handling
  useEffect(() => {
    if (!authUser) return;

    // Handle RFID scan events
    const unsubscribeRFID = iotService.subscribe('rfid_scan', async (event: IoTEvent) => {
      const rfidData = event.data as RFIDScanEvent;
      
      try {
        // Find user by RFID card
        const user = users.find(u => u.rfid_card?.card_uid === rfidData.card_uid);
        
        if (user) {
          // Find room if specified
          const room = rfidData.room_id ? rooms.find(r => r.id === rfidData.room_id) : null;
          
          // Create access log
          const accessLog: Omit<AccessLog, 'id'> = {
            user_id: user.id,
            user_name: user.name,
            room_id: rfidData.room_id || 0,
            room_code: room?.room_code || '',
            room_name: room?.name || '',
            card_uid: rfidData.card_uid,
            action: rfidData.action,
            timestamp: event.timestamp
          };

          // Save to Supabase
          const { error } = await supabase
            .from('access_logs')
            .insert(accessLog);

          if (error) {
            console.error('Error saving access log:', error);
          } else {
            // Update local logs
            setLogs(prev => [...prev, { ...accessLog, id: Date.now() }]);
            
            // Update room status if check-in/check-out
            if (room && rfidData.room_id) {
              const newStatus = rfidData.action === 'check_in' ? 'occupied' : 'available';
              const updates: Partial<Room> = {
                status: newStatus,
                current_user_id: rfidData.action === 'check_in' ? user.id : undefined,
                current_user_name: rfidData.action === 'check_in' ? user.name : undefined,
                updated_at: new Date().toISOString()
              };

              // Update in Supabase
              await supabase
                .from('rooms')
                .update(updates)
                .eq('id', rfidData.room_id);

              // Update local state
              setRooms(prev => prev.map(r => 
                r.id === rfidData.room_id ? { ...r, ...updates } : r
              ));
            }
          }
        } else {
          console.warn('Unknown RFID card scanned:', rfidData.card_uid);
        }
      } catch (error) {
        console.error('Error handling RFID scan:', error);
      }
    });

    // Handle room sensor events
    const unsubscribeSensor = iotService.subscribe('room_sensor', async (event: IoTEvent) => {
      const sensorData = event.data as RoomSensorEvent;
      
      try {
        const room = rooms.find(r => r.id === sensorData.room_id);
        if (room) {
          // Update room status based on sensor data
          const newStatus = sensorData.occupancy ? 'occupied' : 'available';
          const updates: Partial<Room> = {
            status: newStatus,
            updated_at: new Date().toISOString()
          };

          // Update in Supabase
          await supabase
            .from('rooms')
            .update(updates)
            .eq('id', sensorData.room_id);

          // Update local state
          setRooms(prev => prev.map(r => 
            r.id === sensorData.room_id ? { ...r, ...updates } : r
          ));
        }
      } catch (error) {
        console.error('Error handling room sensor event:', error);
      }
    });

    return () => {
      unsubscribeRFID();
      unsubscribeSensor();
    };
  }, [authUser, users, rooms]);

  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    const user = DEMO_USERS.find((u) => u.email === email && u.password === password);
    if (user) {
      setAuthUser({ id: user.id, name: user.name, email: user.email, role: user.role });
      setLastUpdated(new Date());
      return true;
    }
    return false;
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOut error', e);
    }
    setAuthUser(null);
  };

  const addRoom = async (room: Omit<Room, "id" | "created_at" | "updated_at">) => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          ...room,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error adding room:', error);
        return;
      }
      
      if (data) {
        setRooms(prev => [...prev, data]);
        setStats(prev => ({ ...prev, totalRooms: prev.totalRooms + 1 }));
      }
    } catch (error) {
      console.error('Unexpected error adding room:', error);
    }
  };

  const updateRoom = async (id: number, updates: Partial<Room>) => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating room:', error);
        return;
      }
      
      if (data) {
        setRooms(prev => prev.map(r => r.id === id ? data : r));
      }
    } catch (error) {
      console.error('Unexpected error updating room:', error);
    }
  };

  const deleteRoom = async (id: number) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting room:', error);
        return;
      }
      
      setRooms(prev => prev.filter(r => r.id !== id));
      setStats(prev => ({ ...prev, totalRooms: prev.totalRooms - 1 }));
    } catch (error) {
      console.error('Unexpected error deleting room:', error);
    }
  };

  const addUser = async (user: Omit<User, "id" | "created_at">) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single();
      
      if (error) {
        console.error('Error adding user:', error);
        return;
      }
      
      if (data) {
        setUsers(prev => [...prev, data]);
        setStats(prev => ({
          ...prev,
          totalUsers: prev.totalUsers + 1,
          activeUsers: user.is_active ? prev.activeUsers + 1 : prev.activeUsers,
        }));
      }
    } catch (error) {
      console.error('Unexpected error adding user:', error);
    }
  };

  const updateUser = async (id: number, updates: Partial<User>) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating user:', error);
        return;
      }
      
      if (data) {
        setUsers(prev => prev.map(u => u.id === id ? data : u));
      }
    } catch (error) {
      console.error('Unexpected error updating user:', error);
    }
  };

  const deleteUser = async (id: number) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) {
        console.error('Error deactivating user:', error);
        return;
      }
      
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: false } : u));
    } catch (error) {
      console.error('Unexpected error deactivating user:', error);
    }
  };

  const assignRFID = (userId: number, cardUid: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              rfid_card: {
                id: Date.now(),
                card_uid: cardUid,
                user_id: userId,
                is_active: true,
                assigned_at: new Date().toISOString(),
              },
            }
          : u
      )
    );
  };

  const deactivateCard = (userId: number) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId && u.rfid_card
          ? { ...u, rfid_card: { ...u.rfid_card, is_active: false } }
          : u
      )
    );
  };

  const addSchedule = async (s: Omit<Schedule, "id" | "created_at" | "room_code" | "room_name" | "faculty_name">) => {
    try {
      const room = rooms.find((r) => r.id === s.room_id);
      const user = users.find((u) => u.id === s.user_id);
      
      const scheduleData = {
        ...s,
        room_code: room?.room_code || "",
        room_name: room?.name || "",
        faculty_name: user?.name || "",
      };
      
      const { data, error } = await supabase
        .from('schedules')
        .insert(scheduleData)
        .select()
        .single();
      
      if (error) {
        console.error('Error adding schedule:', error);
        return;
      }
      
      if (data) {
        setSchedules(prev => [...prev, data]);
      }
    } catch (error) {
      console.error('Unexpected error adding schedule:', error);
    }
  };

  const updateSchedule = async (id: number, updates: Partial<Schedule>) => {
    try {
      const room = updates.room_id ? rooms.find((r) => r.id === updates.room_id) : null;
      const user = updates.user_id ? users.find((u) => u.id === updates.user_id) : null;
      
      const updateData = {
        ...updates,
        ...(room ? { room_code: room.room_code, room_name: room.name } : {}),
        ...(user ? { faculty_name: user.name } : {}),
      };
      
      const { data, error } = await supabase
        .from('schedules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating schedule:', error);
        return;
      }
      
      if (data) {
        setSchedules(prev => prev.map(s => s.id === id ? data : s));
      }
    } catch (error) {
      console.error('Unexpected error updating schedule:', error);
    }
  };

  const deleteSchedule = async (id: number) => {
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting schedule:', error);
        return;
      }
      
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Unexpected error deleting schedule:', error);
    }
  };

  if (!authUser) {
    return <LoginPage />;
  }

  const isAdmin = authUser.role === "admin";

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
      </div>
    }>
      <Routes>
          <Route
            path="/"
            element={
              <Layout
                onLogout={handleLogout}
                currentUser={authUser}
                isPolling={isPolling}
                lastUpdated={lastUpdated}
                onRefresh={fetchRooms}
              />
            }
          >
            <Route
              index
              element={
                <DashboardPage
                  stats={stats}
                  rooms={rooms}
                  schedules={schedules}
                  logs={logs}
                />
              }
            />
            <Route
              path="rooms"
              element={
                <RoomsPage
                  rooms={rooms}
                  onAddRoom={addRoom}
                  onUpdateRoom={updateRoom}
                  onDeleteRoom={deleteRoom}
                  isAdmin={isAdmin}
                />
              }
            />
            {isAdmin && (
              <Route
                path="users"
                element={
                  <UsersPage
                    users={users}
                    onAddUser={addUser}
                    onUpdateUser={updateUser}
                    onDeleteUser={deleteUser}
                    onAssignRFID={assignRFID}
                  />
                }
              />
            )}
            <Route
              path="schedules"
              element={
                <SchedulesPage
                  schedules={schedules}
                  rooms={rooms}
                  users={users}
                  onAddSchedule={addSchedule}
                  onUpdateSchedule={updateSchedule}
                  onDeleteSchedule={deleteSchedule}
                  isAdmin={isAdmin}
                  currentUserId={authUser.id}
                />
              }
            />
            <Route
              path="logs"
              element={
                <LogsPage
                  logs={logs}
                  isAdmin={isAdmin}
                  currentUserId={authUser.id}
                />
              }
            />
            {isAdmin && (
              <>
                <Route
                  path="rfid"
                  element={
                    <RFIDPage
                      users={users}
                      onAssignRFID={assignRFID}
                      onDeactivateCard={deactivateCard}
                    />
                  }
                />
                <Route
                  path="iot"
                  element={
                    <IoTPage
                      rooms={rooms}
                      users={users}
                      isAdmin={isAdmin}
                    />
                  }
                />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
  );
}

export default App;
