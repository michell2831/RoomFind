const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// We read from the root .env file which has the VITE_SUPABASE_ANON_KEY, or we can just hardcode the key for testing
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0Z2dsd2JhYXJmb29veWl0eWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDQ4OTQsImV4cCI6MjA5MTMyMDg5NH0.SAD88CyrFcEx2mYedXQpq2gcQEJ3Wy0AkNgnHyIo4WA";

const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  console.log("Querying devices table with anonymous key...");
  const { data: devices, error: devError } = await supabase.from('devices').select('id, device_uid');
  if (devError) {
    console.error("Error fetching devices with anon key:", devError);
  } else {
    console.log("=== DEVICES ACCESSED WITH ANON KEY ===");
    console.log(JSON.stringify(devices, null, 2));
  }
}

run();
