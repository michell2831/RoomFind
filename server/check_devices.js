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
  const { data: devices, error: devError } = await supabase.from('devices').select('*');
  if (devError) {
    console.error("Error fetching devices:", devError);
  } else {
    console.log("=== DEVICES IN DATABASE ===");
    console.log(JSON.stringify(devices, null, 2));
  }

  const { data: rooms, error: roomError } = await supabase.from('rooms').select('*');
  if (roomError) {
    console.error("Error fetching rooms:", roomError);
  } else {
    console.log("\n=== ROOMS IN DATABASE ===");
    console.log(rooms.map(r => ({ id: r.id, room_code: r.room_code, name: r.name })));
  }
}

run();
