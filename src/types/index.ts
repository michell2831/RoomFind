export type UserRole = "admin" | "faculty" | "student";
export type RoomStatus = "available" | "occupied" | "maintenance";
export type AccessAction = "check_in" | "check_out";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
  rfid_card?: RFIDCard;
  created_at: string;
}

export interface Room {
  id: number;
  room_code: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  status: RoomStatus;
  current_user_id?: number;
  current_user_name?: string;
  features?: string[];
  created_at: string;
  updated_at: string;
}

export interface RFIDCard {
  id: number;
  card_uid: string;
  user_id: number;
  is_active: boolean;
  assigned_at: string;
}

export interface Schedule {
  id: number;
  room_id: number;
  room_code: string;
  room_name: string;
  faculty_id: number;
  user_id?: number;
  faculty_name: string;
  subject: string;
  section: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  time_start?: string;
  time_end?: string;
  date?: string;
  created_at: string;
}

export interface RoomSession {
  id: number;
  room_id: number;
  faculty_id: number;
  started_at: string;
  last_motion_detected_at: string;
  status: "active" | "timed_out" | "completed";
}

export interface AccessLog {
  id: number;
  user_id: number | null;
  user_name: string;
  room_id: number | null;
  room_code: string;
  room_name: string;
  card_uid: string;
  action: AccessAction;
  access_result?: "granted" | "denied";
  deny_reason?: string | null;
  timestamp: string;
}

export interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  maintenanceRooms: number;
  totalUsers: number;
  activeUsers: number;
  todayCheckIns: number;
  activeSchedules: number;
}

export interface Device {
  id: number;
  device_uid: string;
  room_id: number | null;
  room_name?: string;
  room_code?: string;
  is_active: boolean;
  last_seen: string | null;
  wifi_ssid?: string;
  wifi_password?: string;
  status: 'online' | 'offline';
}
