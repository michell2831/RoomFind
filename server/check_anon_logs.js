const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error: userError } = await supabase.from('users').select('*');
  if (userError) {
    console.error("Error fetching users:", userError);
  } else {
    console.log(`\n=== USERS IN DATABASE (${users.length} rows) ===`);
    console.log(JSON.stringify(users, null, 2));
  }
}

run();
