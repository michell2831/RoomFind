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
  console.log("Updating admin email from email@example.com to admin@university.edu...");
  const { data, error } = await supabase
    .from('users')
    .update({ email: 'admin@university.edu' })
    .eq('email', 'email@example.com')
    .select();

  if (error) {
    console.error("Error updating email:", error);
  } else {
    console.log("Success! Updated database user details:", data);
  }
}

run();
