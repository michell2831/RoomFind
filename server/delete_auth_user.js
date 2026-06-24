const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const emailToDelete = 'hamskirty@gmail.com';

async function run() {
  console.log(`Searching for auth user: ${emailToDelete}...`);
  
  // List users in Auth to find the ID
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("Error listing auth users:", listError);
    process.exit(1);
  }
  
  const targetUser = users.find(u => u.email === emailToDelete);
  
  if (!targetUser) {
    console.log(`User ${emailToDelete} not found in Supabase Auth.`);
  } else {
    console.log(`Found user ID: ${targetUser.id}. Deleting...`);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUser.id);
    
    if (deleteError) {
      console.error("Error deleting user from Auth:", deleteError);
    } else {
      console.log(`Successfully deleted ${emailToDelete} from Supabase Auth.`);
    }
  }

  // Also clean up any partial record in public.users table just in case
  const { error: dbDeleteError } = await supabase
    .from('users')
    .delete()
    .eq('email', emailToDelete);

  if (dbDeleteError) {
    console.error("Error deleting from public.users table:", dbDeleteError);
  } else {
    console.log(`Cleaned up database users table for ${emailToDelete}.`);
  }
}

run();
