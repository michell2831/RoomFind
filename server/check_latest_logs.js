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
  console.log("Fetching latest 5 scan logs...");
  const { data: scanLogs, error: scanErr } = await supabase
    .from('scan_logs')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(5);

  if (scanErr) {
    console.error("Error scan_logs:", scanErr.message);
  } else {
    console.log("=== LATEST SCAN LOGS ===");
    console.log(scanLogs);
  }

  console.log("\nFetching latest 5 access logs...");
  const { data: accessLogs, error: accessErr } = await supabase
    .from('access_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (accessErr) {
    console.error("Error access_logs:", accessErr.message);
  } else {
    console.log("=== LATEST ACCESS LOGS ===");
    console.log(accessLogs);
  }
}

run();
