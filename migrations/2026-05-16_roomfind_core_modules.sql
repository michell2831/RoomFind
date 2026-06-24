-- RoomFind core modules migration
-- Adds schedules fields, room_sessions table, and access_logs audit columns with RLS enabled.

-- Schedules: ensure faculty_id and start/end time columns exist
ALTER TABLE IF EXISTS schedules
  ADD COLUMN IF NOT EXISTS faculty_id bigint REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS schedules
  ADD COLUMN IF NOT EXISTS start_time time;

ALTER TABLE IF EXISTS schedules
  ADD COLUMN IF NOT EXISTS end_time time;

-- Backfill new schedule columns from legacy fields when present
UPDATE schedules
SET
  faculty_id = COALESCE(faculty_id, user_id),
  start_time = COALESCE(start_time, time_start),
  end_time = COALESCE(end_time, time_end)
WHERE (faculty_id IS NULL OR start_time IS NULL OR end_time IS NULL);

DO $$ BEGIN
  ALTER TABLE schedules
    ADD CONSTRAINT schedules_time_window_chk_v2 CHECK (start_time < end_time);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Room sessions: track active/timed out/completed room usage
CREATE TABLE IF NOT EXISTS room_sessions (
  id bigserial PRIMARY KEY,
  room_id bigint REFERENCES rooms(id) ON DELETE CASCADE,
  faculty_id bigint REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_motion_detected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('active','timed_out','completed'))
);

CREATE INDEX IF NOT EXISTS idx_room_sessions_room_id ON room_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_status ON room_sessions(status);

-- Access logs: ensure audit fields exist
ALTER TABLE IF EXISTS access_logs
  ADD COLUMN IF NOT EXISTS access_result text NOT NULL DEFAULT 'granted';

ALTER TABLE IF EXISTS access_logs
  ADD COLUMN IF NOT EXISTS deny_reason text;

-- Enable RLS
ALTER TABLE IF EXISTS schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS room_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_logs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for authenticated users
DO $$ BEGIN
  CREATE POLICY "schedules_read_authenticated" ON schedules
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "schedules_write_authenticated" ON schedules
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "schedules_update_authenticated" ON schedules
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "schedules_delete_authenticated" ON schedules
    FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "room_sessions_read_authenticated" ON room_sessions
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "access_logs_read_authenticated" ON access_logs
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
