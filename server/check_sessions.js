const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching active room sessions...");
  const { data: sessions, error: sessionErr } = await supabase
    .from('room_sessions')
    .select('*')
    .eq('status', 'active');
  
  if (sessionErr) {
    console.error("Error fetching sessions:", sessionErr);
  } else {
    console.log("=== ACTIVE ROOM SESSIONS ===");
    console.log(sessions);
  }

  console.log("\nFetching rooms...");
  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('id, room_code, name, status, current_user_id, current_user_name');
  
  if (roomErr) {
    console.error("Error fetching rooms:", roomErr);
  } else {
    console.log("=== ROOMS ===");
    console.log(rooms);
  }
}

run();
