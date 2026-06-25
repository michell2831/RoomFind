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
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  console.log(`Checking schedules for today: ${today}`);
  
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('day_of_week', today);
    
  if (error) {
    console.error("Error fetching schedules:", error.message);
  } else {
    console.log("=== TODAY'S SCHEDULES ===");
    console.log(schedules);
  }
}

run();
