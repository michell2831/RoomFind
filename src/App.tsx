import { Suspense, useState, useEffect } from "react";
import { supabase, createTempClient } from "./lib/supabase";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Layout from "./components/layout/Layout";
import DashboardPage from "./pages/DashboardPage";
import RoomsPage from "./pages/RoomsPage";
import UsersPage from "./pages/UsersPage";
import SchedulesPage from "./pages/SchedulesPage";
import LogsPage from "./pages/LogsPage";
import RFIDPage from "./pages/RFIDPage";
import DevicesPage from "./pages/DevicesPage";
import NotFoundPage from "./pages/NotFoundPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import { Toaster } from "./components/ui/sonner";
import { Room, User, Schedule, DashboardStats, AccessLog, RFIDCard, Device, RoomSession, Notification } from "./types";
import iotService, { IoTEvent, RFIDScanEvent } from "./services/iotService";
import { toast } from "sonner";
import { CheckCircle2, Copy } from "lucide-react";

const DEMO_USERS = [
  { id: 3, email: "admin@university.edu", password: "admin123", name: "Admin User", role: "admin" as const },
  { id: 1, email: "m.santos@university.edu", password: "faculty123", name: "Dr. Maria Santos", role: "faculty" as const },
];

function App() {
  const [authUser, setAuthUser] = useState<{ id: number; name: string; email: string; role: "admin" | "faculty" | "student"; mustChangePassword?: boolean } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [roomSessions, setRoomSessions] = useState<RoomSession[]>([]);
  const [accessDeniedModal, setAccessDeniedModal] = useState<{ title: string; message: string } | null>(null);
  const [userCreationSuccess, setUserCreationSuccess] = useState<{ email: string; password: string; name: string } | null>(null);
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

  // Reactively calculate dashboard stats whenever data arrays change
  useEffect(() => {
    const todayStr = new Date().toDateString();
    const todayTaps = logs.filter(log => new Date(log.timestamp).toDateString() === todayStr).length;

    setStats({
      totalRooms: rooms.length,
      availableRooms: rooms.filter((r) => r.status === "available").length,
      occupiedRooms: rooms.filter((r) => r.status === "occupied").length,
      maintenanceRooms: rooms.filter((r) => r.status === "maintenance").length,
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.is_active).length,
      todayCheckIns: todayTaps,
      activeSchedules: schedules.length,
    });
  }, [rooms, users, logs, schedules]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isInitialAuthCheck, setIsInitialAuthCheck] = useState(true);
  const [accessDeniedGate, setAccessDeniedGate] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Sync notifications with specific admin user on mount/auth state change
  useEffect(() => {
    if (authUser && authUser.role === 'admin') {
      const stored = localStorage.getItem(`roomfind_notifications_${authUser.email}`);
      setNotifications(stored ? JSON.parse(stored) : []);
    } else {
      setNotifications([]);
    }
  }, [authUser]);

  const addNotification = (type: Notification['type'], title: string, message: string) => {
    if (!authUser || authUser.role !== 'admin') return;

    const newNotif: Notification = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 100);
      localStorage.setItem(`roomfind_notifications_${authUser.email}`, JSON.stringify(updated));
      return updated;
    });
  };

  const markNotificationAsRead = (id: string) => {
    if (!authUser || authUser.role !== 'admin') return;
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem(`roomfind_notifications_${authUser.email}`, JSON.stringify(updated));
      return updated;
    });
  };

  const markAllNotificationsAsRead = () => {
    if (!authUser || authUser.role !== 'admin') return;
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem(`roomfind_notifications_${authUser.email}`, JSON.stringify(updated));
      return updated;
    });
  };

  const clearNotification = (id: string) => {
    if (!authUser || authUser.role !== 'admin') return;
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      localStorage.setItem(`roomfind_notifications_${authUser.email}`, JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllNotifications = () => {
    if (!authUser || authUser.role !== 'admin') return;
    setNotifications([]);
    localStorage.removeItem(`roomfind_notifications_${authUser.email}`);
  };

  const normalizeUserWithCard = (rawUser: any): User => {
    const cards = Array.isArray(rawUser?.rfid_cards) ? rawUser.rfid_cards : [];
    const activeCard = cards.find((card: any) => card?.is_active) || cards[0];
    const normalizedCard: RFIDCard | undefined = activeCard
      ? {
        id: Number(activeCard.id),
        card_uid: String(activeCard.card_uid || ""),
        user_id: Number(activeCard.user_id),
        is_active: Boolean(activeCard.is_active),
        assigned_at: String(activeCard.assigned_at || new Date().toISOString()),
      }
      : undefined;

    return {
      ...(rawUser as User),
      rfid_card: normalizedCard,
    };
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const isSupabaseAuthLockRaceError = (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as any).message)
          : String(error || "");

    return (
      message.includes("lock:") &&
      message.includes("was released because another request stole it")
    );
  };

  const runWithLockRetry = async <T,>(
    operation: () => Promise<T>,
    maxAttempts = 3
  ): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const shouldRetry =
          isSupabaseAuthLockRaceError(error) && attempt < maxAttempts;

        if (!shouldRetry) {
          throw error;
        }

        await delay(120 * attempt);
      }
    }

    throw lastError;
  };

  const fetchRooms = async () => {
    try {
      setIsPolling(true);
      const { data, error } = await runWithLockRetry(async () =>
        await supabase.from('rooms').select('*')
      );
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
      const { data, error } = await runWithLockRetry(async () =>
        await supabase
          .from('users')
          .select('*, rfid_cards(id, card_uid, user_id, is_active, assigned_at)')
      );
      if (error) {
        console.error('supabase fetch users error:', error);
        alert(`Error fetching users: ${error.message}`);
      }
      if (data) {
        const normalizedUsers = (data as any[]).map(normalizeUserWithCard);
        setUsers(normalizedUsers);
      }
    } catch (e) {
      console.error('fetchUsers unexpected error', e);
      alert('Unexpected error occurred while fetching users');
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await runWithLockRetry(async () =>
        await supabase.from('schedules').select('*')
      );
      if (error) {
        console.error('supabase fetch schedules error:', error);
        alert(`Error fetching schedules: ${error.message}`);
      }
      if (data) {
        const normalized = (data as any[]).map((row) => ({
          ...row,
          faculty_id: row.faculty_id ?? row.user_id,
          start_time: row.start_time ?? row.time_start,
          end_time: row.end_time ?? row.time_end,
        }));
        setSchedules(normalized as Schedule[]);
      }
    } catch (e) {
      console.error('fetchSchedules unexpected error', e);
      alert('Unexpected error occurred while fetching schedules');
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await runWithLockRetry(async () =>
        await supabase.from('access_logs').select('*')
      );
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

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select(`
          *,
          rooms (
            name,
            room_code
          )
        `);
      
      if (error) throw error;
      
      if (data) {
        const formattedDevices = data.map(d => ({
          ...d,
          room_name: d.rooms?.name,
          room_code: d.rooms?.room_code,
          status: d.last_seen && (new Date().getTime() - new Date(d.last_seen).getTime() < 60000) ? 'online' : 'offline'
        }));
        
        setDevices((prevDevices) => {
          if (prevDevices && prevDevices.length > 0) {
            formattedDevices.forEach(newDev => {
              const oldDev = prevDevices.find(d => d.id === newDev.id);
              if (oldDev && oldDev.status !== newDev.status) {
                const roomName = newDev.room_name || `Room ${newDev.room_code || 'unknown'}`;
                addNotification(
                  'device_status',
                  `Device ${newDev.status === 'online' ? 'Online' : 'Offline'}`,
                  `Device for ${roomName} is now ${newDev.status}`
                );
              }
            });
          }
          return formattedDevices as Device[];
        });
      }
    } catch (e) {
      console.error('fetchDevices error', e);
    }
  };

  const fetchRoomSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('room_sessions')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        console.error('supabase fetch room_sessions error:', error);
        return;
      }

      if (data) {
        setRoomSessions(data as RoomSession[]);
      }
    } catch (e) {
      console.error('fetchRoomSessions unexpected error', e);
    }
  };

  const updateDevice = async (id: number, updates: Partial<Device>) => {
    try {
      const { error } = await supabase
        .from('devices')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success("Device settings updated successfully");
      fetchDevices();

      // Find the device and send command to trigger configuration update
      const dev = devices.find(d => d.id === id);
      if (dev) {
        const ssid = updates.hasOwnProperty('wifi_ssid') ? updates.wifi_ssid : dev.wifi_ssid;
        const password = updates.hasOwnProperty('wifi_password') ? updates.wifi_password : dev.wifi_password;
        const roomId = updates.hasOwnProperty('room_id') ? (updates.room_id ? String(updates.room_id) : "") : (dev.room_id ? String(dev.room_id) : "");
        
        iotService.sendCommand(dev.device_uid, {
          action: "wifi_update",
          ssid: ssid || "",
          password: password || "",
          roomId: roomId
        });
      }
    } catch (e: any) {
      toast.error(`Update failed: ${e.message}`);
    }
  };

  useEffect(() => {
    // initial fetch of data
    fetchRooms();
    fetchUsers();
    fetchSchedules();
    fetchLogs();
    fetchDevices();
    fetchRoomSessions();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth: read current session and subscribe to changes
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const fetchUserData = async (email: string) => {
      try {
        // Add small delay to avoid lock contention in React Strict Mode
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!mounted) return;

        // Get auth user metadata
        const { data: authData } = await supabase.auth.getUser();
        const mustChangePassword = authData.user?.user_metadata?.must_change_password === true;

        let { data: dbUser, error } = await supabase
          .from('users')
          .select('role, name, id, department')
          .eq('email', email)
          .maybeSingle();

        if (error) {
          console.error("fetchUserData database query error:", error);
        }

        // Self-healing: If user is authenticated in Supabase Auth but has no entry in public.users table,
        // we dynamically create it using their authentication metadata.
        if (!dbUser && authData.user && mounted) {
          console.log("Profile missing in public.users table. Attempting self-healing insertion...");
          const userMetadata = authData.user.user_metadata || {};
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
              name: userMetadata.name || email.split('@')[0],
              email,
              department: userMetadata.department || 'General',
              role: 'student',
              is_active: true
            })
            .select('role, name, id, department')
            .maybeSingle();

          if (!insertError && newUser) {
            dbUser = newUser;
          } else {
            console.error("Self-healing insertion failed:", insertError);
          }
        }

        if (dbUser && mounted) {
          const userData = {
            id: dbUser.id || 0,
            name: dbUser.name || email || "",
            email: email || "",
            role: (dbUser.role as "admin" | "faculty" | "student") || "student",
            department: dbUser.department || "",
            mustChangePassword,
          };
          setAuthUser(userData);
          localStorage.setItem('roomfind_user', JSON.stringify(userData));
          // refresh data on sign in
          fetchRooms();
          fetchUsers();
          fetchSchedules();
          fetchLogs();
          fetchDevices();
          fetchRoomSessions();
        } else if (mounted) {
          // Force sign out if not found
          setAuthUser(null);
          localStorage.removeItem('roomfind_user');
          await supabase.auth.signOut().catch(e => console.error('signOut error', e));
        }
      } catch (e) {
        console.error('fetchUserData error', e);
        if (mounted) setAuthUser(null);
      }
    };

    const init = async () => {
      try {
        // 1. Try to load from localStorage first (for demo/persisted users)
        const storedUser = localStorage.getItem('roomfind_user');
        if (mounted && storedUser) {
          try {
            setAuthUser(JSON.parse(storedUser));
          } catch (e) {
            console.error('Error parsing stored user', e);
          }
        }

        // 2. Check Supabase session
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (mounted && session && session.user) {
          await fetchUserData(session.user.email || "");
        }
      } catch (e) {
        console.error('auth init error', e);
      } finally {
        if (mounted) setIsInitialAuthCheck(false);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        // Clear any pending timeouts
        if (timeoutId) clearTimeout(timeoutId);

        // Debounce the user data fetch to avoid rapid successive calls
        timeoutId = setTimeout(() => {
          fetchUserData(session.user.email || "");
        }, 50);
      } else if (event === 'SIGNED_OUT') {
        if (timeoutId) clearTimeout(timeoutId);
        if (mounted) {
          setAuthUser(null);
          localStorage.removeItem('roomfind_user');
        }
      }
    });

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (sub && typeof sub.subscription?.unsubscribe === 'function') {
        sub.subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authUser) return;

    iotService.startScanPolling(1500);
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
      fetchRoomSessions();
      fetchDevices();
    }, 5000);
    return () => clearInterval(interval);
  }, [authUser, rooms]);

  // IoT Event Handling
  useEffect(() => {
    if (!authUser) return;

    // Handle Access Granted from Backend
    const unsubscribeGranted = iotService.subscribe('access_granted', async (event: IoTEvent) => {
      fetchRooms();
      fetchLogs();
      fetchRoomSessions();

      const payload = event as any;
      const user = payload.user;
      const log = payload.log;
      const roomName = log?.room_name || `Room ${log?.room_code || 'unknown'}`;
      const userName = user?.name || log?.user_name || "Someone";
      addNotification(
        'access_granted',
        'Access Granted',
        `${userName} checked in to ${roomName}`
      );
    });

    // Handle Access Checked Out from Backend
    const unsubscribeCheckedOut = iotService.subscribe('access_checked_out', async (event: IoTEvent) => {
      fetchRooms();
      fetchLogs();
      fetchRoomSessions();

      const payload = event as any;
      const user = payload.user;
      const log = payload.log;
      const roomName = log?.room_name || `Room ${log?.room_code || 'unknown'}`;
      const userName = user?.name || log?.user_name || "Someone";
      addNotification(
        'access_checked_out',
        'Access Checked Out',
        `${userName} checked out of ${roomName}`
      );
    });

    // Handle Access Denied from Backend
    const unsubscribeDenied = iotService.subscribe('access_denied', async (event: IoTEvent) => {
      fetchRooms();
      fetchLogs();
      fetchRoomSessions();

      const data = event as any;
      const userName = String(data.user_name || "Unknown");

      if (accessDeniedGate) {
        if (userName !== "Unknown") {
          setAccessDeniedModal({
            title: "Access denied",
            message: `Card ${data.card_uid} is registered to ${userName}. Reason: ${data.reason}`,
          });
        } else {
          setAccessDeniedModal({
            title: "Access denied",
            message: `Unregistered card detected: ${data.card_uid}. Reason: ${data.reason}`,
          });
        }
      }

      // Generate notification
      const room = rooms.find(r => r.id === data.room_id);
      const roomName = room ? room.name : `Room ${data.room_id || 'unknown'}`;
      const msg = userName !== "Unknown"
        ? `Access denied for ${userName} at ${roomName}: ${data.reason}`
        : `Access denied (unregistered card ${data.card_uid}) at ${roomName}: ${data.reason}`;
      addNotification(
        'access_denied',
        'Access Denied',
        msg
      );
    });

    const unsubscribeScanResult = iotService.subscribe('scan_result', async (event: IoTEvent) => {
      fetchRooms();
      fetchLogs();
      fetchRoomSessions();
    });

    return () => {
      unsubscribeGranted();
      unsubscribeCheckedOut();
      unsubscribeDenied();
      unsubscribeScanResult();
      iotService.stopScanPolling();
    };
  }, [authUser, users, rooms, accessDeniedGate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setAccessDeniedGate(Boolean(detail?.enabled));
      if (!detail?.enabled) {
        setAccessDeniedModal(null);
      }
    };
    window.addEventListener("rfid-access-denied-gate", handler as EventListener);
    return () => window.removeEventListener("rfid-access-denied-gate", handler as EventListener);
  }, []);

  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    const user = DEMO_USERS.find((u) => u.email === email && u.password === password);
    if (user) {
      const userData = { id: user.id, name: user.name, email: user.email, role: user.role };
      setAuthUser(userData);
      localStorage.setItem('roomfind_user', JSON.stringify(userData));
      setLastUpdated(new Date());
      return true;
    }
    return false;
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('roomfind_user');
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
      // 1. Generate a unique temporary password based on their name
      const firstName = user.name.split(' ')[0].toLowerCase();
      const tempPassword = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}2026!`;

      // 2. Create the user in Supabase Auth
      // Note: This requires the Admin to have appropriate permissions or use a service role via an edge function.
      // For this implementation, we assume the Admin is using the Supabase client with sufficient privileges 
      // or we are simulating the creation for the UI.
      const tempClient = createTempClient();
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: user.email,
        password: tempPassword,
        options: {
          data: {
            must_change_password: true,
            full_name: user.name,
            role: user.role
          }
        }
      });

      if (authError) {
        console.error('Error creating auth account:', authError);
        toast.error(`Auth Error: ${authError.message}`);
        return;
      }

      // 3. Create the user record in the 'users' table
      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single();

      if (error) {
        console.error('Error adding user to database:', error);
        toast.error(`Database Error: ${error.message}`);
        return;
      }

      if (data) {
        setUsers(prev => [...prev, data]);
        setStats(prev => ({
          ...prev,
          totalUsers: prev.totalUsers + 1,
          activeUsers: user.is_active ? prev.activeUsers + 1 : prev.activeUsers,
        }));

        // 4. Show success modal with the temporary password
        setUserCreationSuccess({ name: user.name, email: user.email, password: tempPassword });
      }
    } catch (error) {
      console.error('Unexpected error adding user:', error);
      toast.error("An unexpected error occurred while adding the user.");
    }
  };

  const updateUser = async (id: any, updates: Partial<User>) => {
    try {
      // Ensure we treat the ID correctly (convert to number if possible)
      const numericId = typeof id === 'string' && /^\d+$/.test(id) ? parseInt(id, 10) : id;
      
      const targetUser = users.find(u => u.id == numericId);
      if (targetUser && targetUser.role === 'admin' && updates.role === 'faculty') {
        toast.error("Cannot demote an Administrator account to Faculty");
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', numericId)
        .select();

      if (error) {
        console.error('Error updating user:', error);
        toast.error(`Update Failed: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const updatedUser = data[0];
        // Use loose equality (==) to match IDs regardless of string/number type
        setUsers(prev => prev.map(u => u.id == numericId ? { ...updatedUser, rfid_card: u.rfid_card } : u));
        toast.success("User updated successfully!");
      } else {
        toast.error("Update Failed: User record not found.");
      }
    } catch (error) {
      console.error('Unexpected error updating user:', error);
      toast.error("An unexpected error occurred while updating the user.");
    }
  };

  const deleteUser = async (id: number) => {
    try {
      const targetUser = users.find(u => u.id === id);
      if (targetUser && targetUser.role === 'admin') {
        toast.error("Cannot delete Administrator accounts");
        return;
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting user:', error);
        toast.error(`Failed to delete user: ${error.message}`);
        return;
      }

      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success("User deleted successfully!");
    } catch (error) {
      console.error('Unexpected error deleting user:', error);
      toast.error("An unexpected error occurred while deleting the user.");
    }
  };

  const assignRFID = async (userId: number, cardUid: string) => {
    try {
      const normalizedUid = cardUid.trim().toUpperCase();
      const { data: existingCard, error: existingCardError } = await supabase
        .from('rfid_cards')
        .select('id, card_uid, user_id, is_active, assigned_at')
        .eq('card_uid', normalizedUid)
        .maybeSingle();

      if (existingCardError) {
        console.error('Error checking RFID card:', existingCardError);
        throw new Error(`Failed to check RFID card: ${existingCardError.message}`);
      }

      if (existingCard && existingCard.user_id && Number(existingCard.user_id) !== Number(userId)) {
        const otherUser = users.find((u) => u.id === Number(existingCard.user_id));
        const otherUserName = otherUser ? otherUser.name : `User ID ${existingCard.user_id}`;
        throw new Error(`This RFID card is already assigned to ${otherUserName} (Status: ${existingCard.is_active ? 'Active' : 'Inactive'}). You must delete or unassign it first.`);
      }

      const { error: deactivateError } = await supabase
        .from('rfid_cards')
        .update({ is_active: false })
        .eq('user_id', userId)
        .neq('id', existingCard?.id ?? 0);

      if (deactivateError) {
        console.error('Error deactivating existing RFID cards:', deactivateError);
      }

      const assignPayload = {
        user_id: userId,
        is_active: true,
        assigned_at: new Date().toISOString(),
      };

      const { data, error } = existingCard
        ? await supabase
          .from('rfid_cards')
          .update(assignPayload)
          .eq('id', existingCard.id)
          .select('id, card_uid, user_id, is_active, assigned_at')
          .single()
        : await supabase
          .from('rfid_cards')
          .insert({ card_uid: normalizedUid, ...assignPayload })
          .select('id, card_uid, user_id, is_active, assigned_at')
          .single();

      if (error || !data) {
        console.error('Error assigning RFID card:', error);
        throw new Error(`Failed to assign RFID card: ${error?.message || 'Unknown error'}`);
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
              ...u,
              rfid_card: data as RFIDCard,
            }
            : u
        )
      );
    } catch (error) {
      console.error('Unexpected error assigning RFID:', error);
      alert('Unexpected error occurred while assigning RFID card');
    }
  };

  const deactivateCard = async (userId: number) => {
    try {
      const { error } = await supabase
        .from('rfid_cards')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (error) {
        console.error('Error deactivating RFID card:', error);
        alert(`Failed to deactivate card: ${error.message}`);
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId && u.rfid_card
            ? { ...u, rfid_card: { ...u.rfid_card, is_active: false } }
            : u
        )
      );
    } catch (error) {
      console.error('Unexpected error deactivating RFID:', error);
      alert('Unexpected error occurred while deactivating RFID card');
    }
  };

  const deleteCard = async (userId: number) => {
    try {
      const { error } = await supabase
        .from('rfid_cards')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting RFID card:', error);
        alert(`Failed to delete card: ${error.message}`);
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, rfid_card: undefined }
            : u
        )
      );
      toast.success("Card unassigned successfully!");
    } catch (error) {
      console.error('Unexpected error deleting RFID:', error);
      alert('Unexpected error occurred while deleting RFID card');
    }
  };

  const activateCard = async (userId: number) => {
    try {
      const { error } = await supabase
        .from('rfid_cards')
        .update({ is_active: true })
        .eq('user_id', userId);

      if (error) {
        console.error('Error activating RFID card:', error);
        alert(`Failed to activate card: ${error.message}`);
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId && u.rfid_card
            ? { ...u, rfid_card: { ...u.rfid_card, is_active: true } }
            : u
        )
      );
    } catch (error) {
      console.error('Unexpected error activating RFID:', error);
      alert('Unexpected error occurred while activating RFID card');
    }
  };

  const validateScheduleData = (
    scheduleId: number | undefined,
    roomId: number,
    facultyId: number,
    subject: string,
    section: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    date: string | null
  ) => {
    if (!roomId || roomId === 0) {
      throw new Error("Please select a valid room.");
    }
    if (!facultyId || facultyId === 0) {
      throw new Error("Please select a faculty member.");
    }
    if (!subject || !subject.trim()) {
      throw new Error("Subject name is required.");
    }
    if (!section || !section.trim()) {
      throw new Error("Section is required.");
    }
    if (!startTime || !endTime) {
      throw new Error("Start time and end time are required.");
    }

    const cleanTime = (t: string) => String(t || '').slice(0, 5);
    const newStart = cleanTime(startTime);
    const newEnd = cleanTime(endTime);

    if (newStart >= newEnd) {
      throw new Error("Invalid schedule time: start time must be earlier than end time. Equal start and end times are not allowed.");
    }

    const getWeekdayFromDateString = (dateStr: string) => {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return days[d.getDay()];
      }
      return "";
    };

    // Check overlap with existing schedules in state
    for (const existing of schedules) {
      if (scheduleId !== undefined && existing.id === scheduleId) continue;

      // Check day/date conflict
      let daysConflict = false;
      const dateA = date || null;
      const dateB = existing.date || null;
      const dayOfWeekA = dayOfWeek;
      const dayOfWeekB = existing.day_of_week;

      if (!dateA && !dateB) {
        // Both recurring weekly
        daysConflict = dayOfWeekA === dayOfWeekB;
      } else if (dateA && dateB) {
        // Both specific calendar dates
        daysConflict = dateA === dateB;
      } else {
        // One is recurring weekly, the other is a specific calendar date
        const specDate = dateA || dateB;
        const recDay = dateA ? dayOfWeekB : dayOfWeekA;
        if (specDate) {
          const specDayOfWeek = getWeekdayFromDateString(specDate);
          daysConflict = specDayOfWeek === recDay;
        }
      }

      if (!daysConflict) continue;

      // Check time overlap — block exact adjacency (end == start) too
      const existStart = cleanTime(existing.start_time ?? existing.time_start ?? '');
      const existEnd = cleanTime(existing.end_time ?? existing.time_end ?? '');

      if (newStart < existEnd && existStart < newEnd) {
        const isRoomConflict = Number(existing.room_id) === Number(roomId);
        const isFacultyConflict = Number(existing.faculty_id ?? existing.user_id) === Number(facultyId);
        const isSectionConflict = existing.section && section &&
          existing.section.trim().toLowerCase() === section.trim().toLowerCase();

        if (isRoomConflict) {
          throw new Error(`Room conflict: The room ${existing.room_code} is already booked for ${existing.subject} (${existing.section}) at this time (${existStart} - ${existEnd}).`);
        }
        if (isFacultyConflict) {
          throw new Error(`Faculty conflict: ${existing.faculty_name || 'Faculty'} is already scheduled for ${existing.subject} in room ${existing.room_code} at this time (${existStart} - ${existEnd}).`);
        }
        if (isSectionConflict) {
          throw new Error(`Section conflict: Section ${section} already has a class scheduled (${existing.subject}) in room ${existing.room_code} at this time (${existStart} - ${existEnd}).`);
        }
      }
      // Block same end-time as another schedule's start-time (adjacent conflict)
      if (newStart === existEnd || newEnd === existStart) {
        const isRoomConflict = Number(existing.room_id) === Number(roomId);
        const isFacultyConflict = Number(existing.faculty_id ?? existing.user_id) === Number(facultyId);
        const isSectionConflict = existing.section && section &&
          existing.section.trim().toLowerCase() === section.trim().toLowerCase();

        if (isRoomConflict) {
          throw new Error(`Room conflict: Cannot create a schedule that starts or ends at the exact same time as another booking in ${existing.room_code} (${existStart} - ${existEnd}). Please leave a gap between schedules.`);
        }
        if (isFacultyConflict) {
          throw new Error(`Faculty conflict: ${existing.faculty_name || 'Faculty'} has a back-to-back schedule conflict. Please leave a gap between classes (${existStart} - ${existEnd}).`);
        }
        if (isSectionConflict) {
          throw new Error(`Section conflict: Section ${section} has a back-to-back schedule conflict. Please leave a gap between classes (${existStart} - ${existEnd}).`);
        }
      }
    }
  };

  const addSchedule = async (s: Omit<Schedule, "id" | "created_at" | "room_code" | "room_name" | "faculty_name">) => {
    // Run shared validation
    validateScheduleData(
      undefined,
      s.room_id || 0,
      s.faculty_id || 0,
      s.subject || '',
      s.section || '',
      s.day_of_week || '',
      s.start_time || '',
      s.end_time || '',
      s.date || null
    );

    const room = rooms.find((r) => r.id === s.room_id);
    const user = users.find((u) => u.id === s.faculty_id);

    const scheduleData = {
      ...s,
      date: s.date || null,
      room_code: room?.room_code || "",
      room_name: room?.name || "",
      faculty_name: user?.name || "",
      time_start: s.start_time,
      time_end: s.end_time,
    };

    const { data, error } = await supabase
      .from('schedules')
      .insert(scheduleData)
      .select()
      .single();

    if (error) {
      console.error('Error adding schedule:', error);
      throw error;
    }

    if (data) {
      setSchedules(prev => [...prev, data]);
      return data;
    }
  };

  const updateSchedule = async (id: number, updates: Partial<Schedule>) => {
    const currentSchedule = schedules.find((schedule) => schedule.id === id);
    if (!currentSchedule) {
      throw new Error("Schedule not found");
    }

    const proposedRoomId = updates.room_id !== undefined ? updates.room_id : currentSchedule.room_id;
    const proposedFacultyId = updates.faculty_id !== undefined ? updates.faculty_id : (currentSchedule.faculty_id ?? currentSchedule.user_id);
    const proposedSubject = updates.subject !== undefined ? updates.subject : currentSchedule.subject;
    const proposedSection = updates.section !== undefined ? updates.section : currentSchedule.section;
    const proposedDayOfWeek = updates.day_of_week !== undefined ? updates.day_of_week : currentSchedule.day_of_week;
    const proposedStart = updates.start_time ?? currentSchedule.start_time ?? currentSchedule.time_start;
    const proposedEnd = updates.end_time ?? currentSchedule.end_time ?? currentSchedule.time_end;
    const proposedDate = updates.hasOwnProperty('date') ? updates.date : currentSchedule.date;

    // Run shared validation
    validateScheduleData(
      id,
      proposedRoomId || 0,
      proposedFacultyId || 0,
      proposedSubject || '',
      proposedSection || '',
      proposedDayOfWeek || '',
      proposedStart || '',
      proposedEnd || '',
      proposedDate || null
    );

    const room = updates.room_id ? rooms.find((r) => r.id === updates.room_id) : null;
    const user = updates.faculty_id ? users.find((u) => u.id === updates.faculty_id) : null;

    const updateData = {
      ...updates,
      ...(updates.hasOwnProperty('date') ? { date: updates.date || null } : {}),
      ...(room ? { room_code: room.room_code, room_name: room.name } : {}),
      ...(user ? { faculty_name: user.name } : {}),
      ...(updates.start_time ? { time_start: updates.start_time } : {}),
      ...(updates.end_time ? { time_end: updates.end_time } : {}),
    };

    const { data, error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }

    if (data) {
      setSchedules(prev => prev.map(s => s.id === id ? data : s));
      return data;
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

  if (isInitialAuthCheck) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = authUser?.role === "admin";

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
      </div>
    }>
      <Toaster position="top-right" expand={false} richColors />
      {accessDeniedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold text-sm">{accessDeniedModal.title}</h3>
              <button onClick={() => setAccessDeniedModal(null)} className="text-[#94A3B8] hover:text-white">
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-[#94A3B8] text-sm">{accessDeniedModal.message}</p>
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={() => setAccessDeniedModal(null)}
                className="w-full bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {userCreationSuccess && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0F1729] rounded-2xl border border-[#00D4AA]/30 w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#00D4AA]/10 px-6 py-6 text-center border-b border-[#00D4AA]/20">
              <div className="w-16 h-16 bg-[#00D4AA]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-[#00D4AA] w-8 h-8" />
              </div>
              <h3 className="text-[#00D4AA] font-bold text-xl mb-1">User Created!</h3>
              <p className="text-[#94A3B8] text-xs">Account has been successfully registered.</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <p className="text-[#94A3B8] text-[10px] uppercase tracking-widest font-bold">Account Name</p>
                <p className="text-white font-medium">{userCreationSuccess.name}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[#94A3B8] text-[10px] uppercase tracking-widest font-bold">Email Address</p>
                <p className="text-white font-mono text-sm">{userCreationSuccess.email}</p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10 mt-2">
                <p className="text-[#94A3B8] text-[10px] uppercase tracking-widest font-bold mb-2">Temporary Password</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#00D4AA] font-mono text-lg font-bold tracking-wider">{userCreationSuccess.password}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(userCreationSuccess.password);
                      toast.success("Password copied to clipboard!");
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg text-[#94A3B8] hover:text-white transition-colors"
                    title="Copy Password"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <p className="text-red-400/80 text-[10px] italic leading-tight">
                * Important: The user will be required to change this password on their first login.
              </p>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setUserCreationSuccess(null)}
                className="w-full bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-bold py-3 rounded-xl text-sm transition-all shadow-lg hover:shadow-[#00D4AA]/20"
              >
                Close & Continue
              </button>
            </div>
          </div>
        </div>
      )}
      <Routes>
        <Route
          path="/login"
          element={authUser ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
        />
        <Route
          path="/reset-password"
          element={<ResetPasswordPage />}
        />

        <Route element={<ProtectedRoute currentUser={authUser} />}>
          <Route
            path="/"
            element={
              <Layout
                onLogout={handleLogout}
                currentUser={authUser!}
                isPolling={isPolling}
                lastUpdated={lastUpdated}
                onRefresh={fetchRooms}
                notifications={notifications}
                onMarkNotificationAsRead={markNotificationAsRead}
                onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
                onClearNotification={clearNotification}
                onClearAllNotifications={clearAllNotifications}
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
                  currentUser={authUser}
                  roomSessions={roomSessions}
                />
              }
            />
            <Route
              path="rooms"
              element={
                <RoomsPage
                  rooms={rooms}
                  devices={devices}
                  schedules={schedules}
                  onAddRoom={addRoom}
                  onUpdateRoom={updateRoom}
                  onDeleteRoom={deleteRoom}
                  isAdmin={isAdmin}
                />
              }
            />
            <Route
              path="schedules"
              element={
                <SchedulesPage
                  schedules={schedules}
                  rooms={rooms}
                  users={users}
                  roomSessions={roomSessions}
                  onAddSchedule={addSchedule}
                  onUpdateSchedule={updateSchedule}
                  onDeleteSchedule={deleteSchedule}
                  isAdmin={isAdmin}
                  currentUserId={authUser?.id || 0}
                />
              }
            />

            {/* Faculty & Admin access only */}
            <Route element={<ProtectedRoute currentUser={authUser} allowedRoles={["admin", "faculty"]} />}>
              <Route
                path="logs"
                element={
                  <LogsPage
                    logs={logs}
                    isAdmin={isAdmin}
                    currentUserId={authUser?.id || 0}
                  />
                }
              />
            </Route>

            {/* Admin access only */}
            <Route element={<ProtectedRoute currentUser={authUser} allowedRoles={["admin"]} />}>
              <Route
                path="users"
                element={
                  <UsersPage
                    users={users}
                    schedules={schedules}
                    onAddUser={addUser}
                    onUpdateUser={updateUser}
                    onDeleteUser={deleteUser}
                    onAssignRFID={assignRFID}
                  />
                }
              />
              <Route
                path="rfid"
                element={
                  <RFIDPage
                    users={users}
                    onAssignRFID={assignRFID}
                    onDeactivateCard={deactivateCard}
                    onActivateCard={activateCard}
                    onDeleteCard={deleteCard}
                  />
                }
              />
              <Route
                path="devices"
                element={
                  <DevicesPage
                    devices={devices}
                    rooms={rooms}
                    onUpdateDevice={updateDevice}
                  />
                }
              />
            </Route>
          </Route>
        </Route>

        {/* Dedicated Change Password Route */}
        <Route element={<ProtectedRoute currentUser={authUser} isChangePasswordPage={true} />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
