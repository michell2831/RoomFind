-- =====================================================================
-- ROOMFIND DATABASE COMPLETE SETUP & SCHEMA RESTORE SCRIPT
-- =====================================================================
-- Description: Wipes, creates, indexes, secures, and seeds the entire 
-- RoomFind IoT Access Control system. 
-- 
-- Instructions: 
-- 1. Copy the entire contents of this file.
-- 2. Paste it in your Supabase SQL Editor (https://supabase.com).
-- 3. Click "RUN" to fully initialize your new backend!
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Clean Cleanup: Drop tables in correct dependency order
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS access_logs CASCADE;
DROP TABLE IF EXISTS scan_logs CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS rfid_cards CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS room_status CASCADE;
DROP TYPE IF EXISTS access_action CASCADE;

-- ---------------------------------------------------------------------
-- 2. Create Enums
-- ---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'faculty', 'student');
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance');
CREATE TYPE access_action AS ENUM ('check_in', 'check_out');

-- ---------------------------------------------------------------------
-- 3. Create Tables
-- ---------------------------------------------------------------------

-- Users table
CREATE TABLE users (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'faculty',
  department text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RFID Cards table
CREATE TABLE rfid_cards (
  id bigserial PRIMARY KEY,
  card_uid text NOT NULL UNIQUE,
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz DEFAULT now()
);

-- Rooms table
CREATE TABLE rooms (
  id bigserial PRIMARY KEY,
  room_code text NOT NULL UNIQUE,
  name text NOT NULL,
  building text NOT NULL,
  floor integer,
  capacity integer,
  status room_status NOT NULL DEFAULT 'available',
  current_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  current_user_name text,
  features jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Devices table
CREATE TABLE devices (
  id bigserial PRIMARY KEY,
  device_uid text NOT NULL UNIQUE,
  room_id bigint REFERENCES rooms(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_seen timestamptz
);

-- Schedules table
CREATE TABLE schedules (
  id bigserial PRIMARY KEY,
  room_id bigint REFERENCES rooms(id) ON DELETE SET NULL,
  room_code text,
  room_name text,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  faculty_name text,
  subject text,
  section text,
  day_of_week text NOT NULL,
  time_start time NOT NULL,
  time_end time NOT NULL,
  CONSTRAINT schedules_time_window_chk CHECK (time_start < time_end),
  CONSTRAINT schedules_day_of_week_chk CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Scan Logs table
CREATE TABLE scan_logs (
  id bigserial PRIMARY KEY,
  card_uid text NOT NULL,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  room_id bigint REFERENCES rooms(id) ON DELETE SET NULL,
  device_id text,
  status text NOT NULL,
  message text,
  source text NOT NULL DEFAULT 'websocket',
  scanned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_logs_status_chk CHECK (status IN ('success','denied'))
);

-- Access Logs table
CREATE TABLE access_logs (
  id bigserial PRIMARY KEY,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  user_name text,
  room_id bigint REFERENCES rooms(id) ON DELETE SET NULL,
  room_code text,
  room_name text,
  card_uid text,
  action access_action NOT NULL,
  access_result text NOT NULL DEFAULT 'granted',
  deny_reason text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. Create Constraints & Indexes
-- ---------------------------------------------------------------------

-- STRICT CARD-TO-USER CONSTRAINT: Mapped users can have at most ONE active card
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfid_cards_active_user_unique
ON rfid_cards(user_id)
WHERE user_id IS NOT NULL AND is_active = true;

-- Query performance indexing
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_schedules_room_id ON schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_accesslogs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_accesslogs_room_id ON access_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_scanlogs_scanned_at ON scan_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanlogs_user_id ON scan_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_scanlogs_card_uid ON scan_logs(card_uid);

-- ---------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Configuration
-- ---------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfid_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Create Policies for Authenticated Web Portal Users (React Application)
-- Allow authenticated users to perform reads on all modules
CREATE POLICY "Allow authenticated select on users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated select on rfid_cards" ON rfid_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated select on schedules" ON schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated select on scan_logs" ON scan_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated select on access_logs" ON access_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated select on devices" ON devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated select on rooms" ON rooms FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to perform additions, edits, and deletions
CREATE POLICY "Allow authenticated write on schedules" ON schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write on rfid_cards" ON rfid_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write on users" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write on rooms" ON rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write on devices" ON devices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Note: No policies are defined for the 'anon' role, blocking unauthenticated public client-side access.
-- The Node.js WebSocket backend connects using the Service Role Key, automatically bypassing RLS checks.

-- ---------------------------------------------------------------------
-- 6. Clean Seed Mock Data
-- ---------------------------------------------------------------------

-- Sample Users
INSERT INTO users (id, name, email, role, department, is_active)
VALUES
  (1, 'Dr. Maria Santos', 'm.santos@university.edu', 'faculty', 'Computer Science', TRUE),
  (2, 'Prof. Juan Reyes', 'j.reyes@university.edu', 'faculty', 'Engineering', TRUE),
  (3, 'Full Name', 'admin@university.edu', 'admin', 'Administration', TRUE),
  (4, 'Maria Example', 'maria@gmail.com', 'faculty', 'Information Technology', TRUE),
  (5, 'Royet Kaman', 'royet@gmail.com', 'faculty', 'Information Technology', TRUE),
  (6, 'QA Professor', 'qa.professor@university.edu', 'faculty', 'QA Engineering', TRUE),
  (7, 'Juan Dela Cruz', 'juan.delacruz@university.edu', 'student', 'BSIT 3-A', TRUE),
  (8, 'Maria Santos', 'maria.santos@university.edu', 'student', 'BSCS 2-B', TRUE);

-- Set bigserial sequence generator value to prevent identity collisions on insert
SELECT setval('users_id_seq', 8);

-- Sample RFID Cards (matched user_id)
INSERT INTO rfid_cards (id, card_uid, user_id, is_active, assigned_at)
VALUES
  (1, 'DA9DD635', 1, TRUE, now() - INTERVAL '30 days'),
  (2, '3A4F24E1', 5, TRUE, now() - INTERVAL '1 day');

SELECT setval('rfid_cards_id_seq', 2);

-- Sample Rooms
INSERT INTO rooms (id, room_code, name, building, floor, capacity, status, features)
VALUES
  (1, 'CS-101', 'Computer Lab 1', 'Science Building', 1, 40, 'available', '["Projector", "AC", "Computers"]'::jsonb),
  (2, 'CS-102', 'Computer Lab 2', 'Science Building', 1, 40, 'available', '["Projector", "AC"]'::jsonb),
  (3, 'LEC-201', 'Lecture Hall A', 'Main Building', 2, 80, 'available', '["Projector", "AC", "Whiteboard"]'::jsonb),
  (4, 'LIB-301', 'Study Room 1', 'Library Building', 3, 10, 'available', '["Whiteboard"]'::jsonb);

SELECT setval('rooms_id_seq', 4);

-- Registered IoT Devices (linked to rooms)
INSERT INTO devices (id, device_uid, room_id, is_active, last_seen)
VALUES
  (1, 'DEV-CS101', 1, TRUE, now()),
  (2, 'DEV-CS102', 2, TRUE, now());

SELECT setval('devices_id_seq', 2);

-- Sample Room Schedules
INSERT INTO schedules (id, room_id, room_code, room_name, user_id, faculty_name, subject, section, day_of_week, time_start, time_end)
VALUES
  (1, 1, 'CS-101', 'Computer Lab 1', 1, 'Dr. Maria Santos', 'Introduction to Programming', 'CS-1A', 'Monday', '08:00:00', '12:00:00'),
  (2, 2, 'CS-102', 'Computer Lab 2', 2, 'Prof. Juan Reyes', 'Engineering Math', 'EE-2B', 'Tuesday', '10:00:00', '13:00:00'),
  (3, 1, 'CS-101', 'Computer Lab 1', 5, 'Royet Kaman', 'IoT Access Systems', 'BSIT-3C', 'Wednesday', '14:00:00', '17:00:00');

SELECT setval('schedules_id_seq', 3);

-- Sample Demo Access Log Trail
INSERT INTO access_logs (id, user_id, user_name, room_id, room_code, room_name, card_uid, action, access_result, timestamp)
VALUES
  (1, 1, 'Dr. Maria Santos', 1, 'CS-101', 'Computer Lab 1', 'DA9DD635', 'check_in', 'granted', now() - INTERVAL '2 hours'),
  (2, 1, 'Dr. Maria Santos', 1, 'CS-101', 'Computer Lab 1', 'DA9DD635', 'check_out', 'granted', now() - INTERVAL '1 hour');

SELECT setval('access_logs_id_seq', 2);

-- Sample Demo Scan Log Trial
INSERT INTO scan_logs (id, card_uid, user_id, room_id, device_id, status, message, scanned_at)
VALUES
  (1, 'DA9DD635', 1, 1, 'DEV-CS101', 'success', 'Access granted - Schedule active', now() - INTERVAL '2 hours'),
  (2, 'DA9DD635', 1, 1, 'DEV-CS101', 'success', 'Access granted - Checkout success', now() - INTERVAL '1 hour'),
  (3, 'FFFFFFFF', NULL, 1, 'DEV-CS101', 'denied', 'Card not registered', now() - INTERVAL '30 minutes');

SELECT setval('scan_logs_id_seq', 3);
