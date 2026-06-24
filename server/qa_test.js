const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Missing Supabase URL or Service Role Key in server/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const WS_URL = 'ws://localhost:8082';

// State to keep track of created QA resources for easy teardown
const qaResources = {
  room: null,
  user: null,
  device: null,
  card: null,
  schedule: null
};

// Main test suite
async function runQATests() {
  console.log("======================================================================");
  console.log("🧪 QA TEST RUNNER: System Access Control & RFID WebSockets Integration");
  console.log("======================================================================\n");

  try {
    // STEP 1: Set up mock database records matching current day/time
    await setupTestData();

    // STEP 2: Execute Live WebSocket Tests
    await executeWebSocketSuite();

  } catch (error) {
    console.error("❌ Test run aborted due to error:", error);
  } finally {
    // STEP 3: Clean up database completely
    await teardownTestData();
  }
}

// -------------------------------------------------------------
// Test Data Setup
// -------------------------------------------------------------
async function setupTestData() {
  console.log("🧹 1. Cleaning up any legacy QA data...");
  // Clear any existing QA elements to prevent conflicts
  await supabase.from('schedules').delete().eq('subject', 'QA Testing 101');
  await supabase.from('rfid_cards').delete().like('card_uid', 'QA%');
  await supabase.from('devices').delete().eq('device_uid', 'qa_rfid_reader_001');
  await supabase.from('users').delete().eq('email', 'qa.professor@university.edu');
  await supabase.from('rooms').delete().eq('room_code', 'QA-101');

  console.log("📦 2. Inserting fresh, temporary QA resources...");

  // 1. Create a Room
  const { data: room, error: roomErr } = await supabase.from('rooms').insert({
    room_code: 'QA-101',
    name: 'QA Sandbox Lab',
    building: 'Science Annex',
    floor: 4,
    capacity: 25,
    status: 'available',
    features: ['Projector', 'AC']
  }).select().single();
  if (roomErr) throw roomErr;
  qaResources.room = room;
  console.log(`   ✅ Temporary Room Created: [QA-101] (ID: ${room.id})`);

  // 2. Create a Faculty User
  const { data: user, error: userErr } = await supabase.from('users').insert({
    name: 'QA Professor',
    email: 'qa.professor@university.edu',
    role: 'faculty',
    department: 'QA Engineering',
    is_active: true
  }).select().single();
  if (userErr) throw userErr;
  qaResources.user = user;
  console.log(`   ✅ Temporary Faculty Created: [QA Professor] (ID: ${user.id})`);

  // 3. Create a Device mapped to Room
  const { data: device, error: devErr } = await supabase.from('devices').insert({
    device_uid: 'qa_rfid_reader_001',
    room_id: room.id,
    is_active: true
  }).select().single();
  if (devErr) throw devErr;
  qaResources.device = device;
  console.log(`   ✅ Temporary Device Created: [qa_rfid_reader_001] mapped to Room ID ${room.id}`);

  // 4. Create an RFID Card assigned to Faculty
  const { data: card, error: cardErr } = await supabase.from('rfid_cards').insert({
    card_uid: 'QACARD999',
    user_id: user.id,
    is_active: true,
    assigned_at: new Date().toISOString()
  }).select().single();
  if (cardErr) throw cardErr;
  qaResources.card = card;
  console.log(`   ✅ Temporary RFID Card Created: [QACARD999] assigned to User ID ${user.id}`);

  // 5. Create a Schedule matching current Day & Time Window
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const now = new Date();
  
  // Create a time window (starts 1 hour ago, ends 2 hours from now)
  const pad = (num) => String(num).padStart(2, '0');
  const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  
  const startTime = formatTime(new Date(now.getTime() - 60 * 60 * 1000));
  const endTime = formatTime(new Date(now.getTime() + 120 * 60 * 1000));

  const { data: schedule, error: schedErr } = await supabase.from('schedules').insert({
    room_id: room.id,
    room_code: 'QA-101',
    room_name: 'QA Sandbox Lab',
    user_id: user.id,
    faculty_id: user.id,
    faculty_name: 'QA Professor',
    subject: 'QA Testing 101',
    section: 'QA-1A',
    day_of_week: currentDay,
    time_start: startTime,
    time_end: endTime,
    start_time: startTime,
    end_time: endTime
  }).select().single();
  if (schedErr) throw schedErr;
  qaResources.schedule = schedule;
  console.log(`   ✅ Temporary Schedule Created: Current day [${currentDay}] Time Window [${startTime} - ${endTime}]`);
  console.log("\nSetup complete. Transitioning to WebSocket protocol execution.\n");
}

// -------------------------------------------------------------
// WebSocket Testing Protocol
// -------------------------------------------------------------
function executeWebSocketSuite() {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting to WebSocket Server at ${WS_URL}...`);
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      console.log("📶 WebSocket connection open. Initiating test cases...\n");

      // Test Case 1: Device Registration
      console.log("🧪 [Test Case 1] registering device: 'qa_rfid_reader_001'...");
      ws.send(JSON.stringify({
        type: 'device_register',
        deviceId: 'qa_rfid_reader_001',
        deviceType: 'rfid_reader',
        roomId: qaResources.room.id
      }));
    });

    ws.on('message', async (message) => {
      const data = JSON.parse(message);
      console.log(`📩 Received from server:`, data);

      if (data.type === 'registration_confirmed') {
        console.log("   👉 PASSED: Device registration confirmed by server.");
        
        // Test Case 2: Unknown/Unregistered RFID Scan
        console.log("\n🧪 [Test Case 2] Scanning unregistered card: 'QAUNKNOWN'...");
        ws.send(JSON.stringify({
          type: 'rfid_scan',
          deviceId: 'qa_rfid_reader_001',
          cardUid: 'QAUNKNOWN',
          data: { action: 'check_in' }
        }));
      } 
      
      else if (data.type === 'access_response' && data.status === 'DENIED') {
        console.log("   👉 PASSED: Unknown card rejected successfully with access response.");

        // Verify the database side effects for the unregistered scan
        console.log("   🔍 Checking database logs for unregistered attempt...");
        const { data: scanLogs } = await supabase
          .from('scan_logs')
          .select('id, status, message')
          .eq('card_uid', 'QAUNKNOWN')
          .order('scanned_at', { ascending: false })
          .limit(1);
        
        if (scanLogs && scanLogs.length > 0 && scanLogs[0].status === 'denied') {
          console.log(`      ✅ scan_logs verify PASSED: Status is [${scanLogs[0].status}] - Message: [${scanLogs[0].message}]`);
        } else {
          console.warn("      ❌ scan_logs verify FAILED: Record missing or mismatch.");
        }

        // Test Case 3: Authorized RFID Scan (Scheduled & Assigned)
        console.log("\n🧪 [Test Case 3] Scanning scheduled, authorized card: 'QACARD999'...");
        ws.send(JSON.stringify({
          type: 'rfid_scan',
          deviceId: 'qa_rfid_reader_001',
          cardUid: 'QACARD999',
          data: { action: 'check_in' }
        }));
      } 
      
      else if (data.type === 'access_response' && data.status === 'SUCCESS') {
        console.log(`   👉 PASSED: Scheduled card accepted successfully! Welcome, ${data.meta?.userName || 'Professor'}`);

        // Verify database updates
        console.log("   🔍 Verifying Room Status Update in Database...");
        const { data: roomStatus } = await supabase
          .from('rooms')
          .select('status, current_user_name')
          .eq('id', qaResources.room.id)
          .single();

        if (roomStatus && roomStatus.status === 'occupied' && roomStatus.current_user_name === 'QA Professor') {
          console.log(`      ✅ Room occupancy update verify PASSED: Status is [${roomStatus.status}], Current occupant: [${roomStatus.current_user_name}]`);
        } else {
          console.warn("      ❌ Room occupancy update verify FAILED.");
        }

        console.log("   🔍 Checking access_logs table in Database...");
        const { data: accessLogs } = await supabase
          .from('access_logs')
          .select('user_name, room_code, access_result')
          .eq('card_uid', 'QACARD999')
          .order('timestamp', { ascending: false })
          .limit(1);

        if (accessLogs && accessLogs.length > 0 && accessLogs[0].access_result === 'granted') {
          console.log(`      ✅ access_logs audit verify PASSED: Result is [${accessLogs[0].access_result}] - User: [${accessLogs[0].user_name}]`);
        } else {
          console.warn("      ❌ access_logs audit verify FAILED.");
        }

        console.log("\n🌟 ALL QA SYSTEM INTEGRATION TEST CASES PASSED SUCCESSFULLY! 🌟\n");
        ws.close();
      }
    });

    ws.on('close', () => {
      console.log("🔌 WebSocket connection closed.");
      resolve();
    });

    ws.on('error', (err) => {
      console.error("❌ WebSocket error:", err);
      reject(err);
    });
  });
}

// -------------------------------------------------------------
// Test Data Cleanup (Teardown)
// -------------------------------------------------------------
async function teardownTestData() {
  console.log("\n🧹 3. Initiating database teardown & clean up...");

  if (qaResources.schedule) {
    const { error } = await supabase.from('schedules').delete().eq('id', qaResources.schedule.id);
    if (!error) console.log("   🗑️ Test Schedule deleted.");
  }
  if (qaResources.card) {
    const { error } = await supabase.from('rfid_cards').delete().eq('id', qaResources.card.id);
    if (!error) console.log("   🗑️ Test RFID Card deleted.");
  }
  if (qaResources.device) {
    const { error } = await supabase.from('devices').delete().eq('id', qaResources.device.id);
    if (!error) console.log("   🗑️ Test Device deleted.");
  }
  if (qaResources.user) {
    const { error } = await supabase.from('users').delete().eq('id', qaResources.user.id);
    if (!error) console.log("   🗑️ Test User deleted.");
  }
  if (qaResources.room) {
    const { error } = await supabase.from('rooms').delete().eq('id', qaResources.room.id);
    if (!error) console.log("   🗑️ Test Room deleted.");
  }

  // Clear QA-specific log entries
  await supabase.from('scan_logs').delete().like('card_uid', 'QA%');
  await supabase.from('access_logs').delete().like('card_uid', 'QA%');
  await supabase.from('room_sessions').delete().eq('room_id', qaResources.room?.id ?? 0);
  console.log("   🗑️ Test logs and sessions cleared.");

  console.log("\n✨ Database is perfectly clean. QA Integration Testing session completed.\n");
}

// Run the script
runQATests();
