const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/villa/Downloads/RoomFind-master/RoomFind-master/server/.env' });
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;

// Read anon key from root .env
const rootEnv = fs.readFileSync('c:/Users/villa/Downloads/RoomFind-master/RoomFind-master/.env', 'utf8');
const anonKeyMatch = rootEnv.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const anonKey = anonKeyMatch ? anonKeyMatch[1].trim() : null;

if (!supabaseUrl || !anonKey) {
  console.error("Missing Supabase configuration", { supabaseUrl, hasAnonKey: !!anonKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  console.log("Using URL:", supabaseUrl);
  console.log("Querying users table using Anon Key...");
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*, rfid_cards(id, card_uid, user_id, is_active, assigned_at)');
  
  if (userError) {
    console.error("Error fetching users:", userError);
  } else {
    console.log("=== USERS LOADED ===");
    console.log("Count:", users ? users.length : 0);
    console.log(JSON.stringify(users, null, 2));
  }
}

run();
