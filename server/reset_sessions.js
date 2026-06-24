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
  console.log("Resetting active room sessions...");
  
  // 1. Update active room sessions to 'completed'
  const { data: updatedSessions, error: sessionErr } = await supabase
    .from('room_sessions')
    .update({ status: 'completed' })
    .eq('status', 'active')
    .select('*');
  
  if (sessionErr) {
    console.error("Error resetting sessions:", sessionErr.message);
  } else {
    console.log(`Successfully completed ${updatedSessions ? updatedSessions.length : 0} active sessions.`);
  }

  // 2. Set all rooms to 'available' and clear current user details
  console.log("Resetting room statuses to available...");
  const { data: updatedRooms, error: roomErr } = await supabase
    .from('rooms')
    .update({
      status: 'available',
      current_user_id: null,
      current_user_name: null,
      updated_at: new Date().toISOString()
    })
    .neq('status', 'available') // only update occupied rooms
    .select('id, room_code, status');

  if (roomErr) {
    console.error("Error resetting rooms:", roomErr.message);
  } else {
    console.log(`Successfully reset ${updatedRooms ? updatedRooms.length : 0} rooms to available.`);
  }

  console.log("Database reset completed successfully!");
}

run();
