-- Supabase / PostgreSQL schema to restore application tables
-- Use in Supabase SQL editor or psql. Adjust ownership/roles as needed.

-- enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin','faculty','student');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE room_status AS ENUM ('available','occupied','maintenance');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE access_action AS ENUM ('check_in','check_out');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- users
CREATE TABLE IF NOT EXISTS users (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'faculty',
  department text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- rfid_cards (one-to-one with users via user_id)
CREATE TABLE IF NOT EXISTS rfid_cards (
  id bigserial PRIMARY KEY,
  card_uid text NOT NULL UNIQUE,
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz
);

-- rooms
CREATE TABLE IF NOT EXISTS rooms (
  id bigserial PRIMARY KEY,
  room_code text NOT NULL UNIQUE,
  name text NOT NULL,
  building text NOT NULL,
  floor integer,
  capacity integer,
  status room_status NOT NULL DEFAULT 'available',
  current_user_id bigint REFERENCES users(id),
  current_user_name text,
  features jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- schedules
CREATE TABLE IF NOT EXISTS schedules (
  id bigserial PRIMARY KEY,
  room_id bigint REFERENCES rooms(id) ON DELETE SET NULL,
  room_code text,
  room_name text,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  faculty_name text,
  subject text,
  section text,
  day_of_week text,
  time_start time,
  time_end time,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- access_logs
CREATE TABLE IF NOT EXISTS access_logs (
  id bigserial PRIMARY KEY,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  user_name text,
  room_id bigint REFERENCES rooms(id) ON DELETE SET NULL,
  room_code text,
  room_name text,

  card_uid text,
  action access_action NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- helpful indexes
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_schedules_room_id ON schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_accesslogs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_accesslogs_room_id ON access_logs(room_id);

-- Notes:
-- - `features` stored as JSONB so you can keep arrays or structured data (e.g. ["Projector","AC"]).
-- - Adjust `bigserial` -> `serial` if you prefer 32-bit ids.
-- - You may want to add additional constraints or RLS policies per your Supabase setup.

-- ==========================
-- Seed data (idempotent)
-- ==========================

-- Sample rooms
INSERT INTO rooms (room_code, name, building, floor, capacity, status, features)
VALUES
  ('CS-101', 'Computer Lab 1', 'Science Bldg', 1, 40, 'available', '["Projector","AC","Computers"]'::jsonb),
  ('CS-102', 'Computer Lab 2', 'Science Bldg', 1, 40, 'available', '["Projector","AC"]'::jsonb),
  ('LEC-201', 'Lecture Hall A', 'Main Bldg', 2, 80, 'occupied', '["Projector","AC","Whiteboard"]'::jsonb),
  ('LIB-301', 'Study Room 1', 'Library', 3, 10, 'available', '["Whiteboard"]'::jsonb)
ON CONFLICT (room_code) DO NOTHING;

-- Sample faculty users
INSERT INTO users (name, email, role, department, is_active)
VALUES
  ('Dr. Maria Santos', 'm.santos@university.edu', 'faculty', 'Computer Science', TRUE),
  ('Prof. Juan Reyes', 'j.reyes@university.edu', 'faculty', 'Engineering', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Sample schedule (assumes rooms/users above have ids starting at 1)
INSERT INTO schedules (room_id, user_id, subject, section, day_of_week, time_start, time_end)
VALUES
  (1, 1, 'Intro to Programming', 'CS-1A', 'Monday', '08:00', '10:00');

