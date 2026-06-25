const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/villa/Downloads/RoomFind-master/RoomFind-master/server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Querypg_tables to see row security
  console.log("Checking RLS status of tables...");
  const { data: tables, error } = await supabase.rpc('get_tables_rls');
  
  if (error) {
    // If RPC doesn't exist, we can run a raw SQL query using a custom query if allowed,
    // or just fetch from pg_catalog using an RPC or a custom function if one exists,
    // or we can just try to fetch a record to see if it's there.
    console.log("RPC get_tables_rls not found. Querying using an ad-hoc query if possible.");
    
    // Let's do a direct select on a table that has policy info if accessible, or just write SQL statements for the user to run.
  }
  
  // Let's print out if we can execute raw sql.
  // Wait, let's write a SQL statement to query pg_tables directly using supabase client!
  // Actually, standard supabase-js client doesn't allow raw SQL queries directly unless there's a custom function.
  // But we can check if they have any RLS policies by trying to insert/select using the anon key.
}
run();
