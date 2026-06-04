const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/villa/Downloads/RoomFind-master/RoomFind-master/server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*, rfid_cards(id, card_uid, user_id, is_active, assigned_at)');
  if (userError) {
    console.error("Error fetching users:", userError);
  } else {
    console.log("=== USERS IN DATABASE ===");
    console.log(JSON.stringify(users, null, 2));
  }
}

run();
