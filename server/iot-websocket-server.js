/*
 * IoT WebSocket Server for Room Find App
 * Handles communication with ESP32 devices and forwards events to the web app
 * 
 * Run with: node iot-websocket-server.js
 * Make sure to install dependencies: npm install ws @supabase/supabase-js dotenv
 */

require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(express.json({ limit: '32kb' }));

// CORS middleware for frontend polling
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-iot-token, Authorization');
    res.header('Access-Control-Max-Age', '3600');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasValidSupabaseConfig = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('your-supabase-url') &&
  /^https?:\/\//i.test(supabaseUrl)
);

if (!hasValidSupabaseConfig) {
  console.error("❌ CRITICAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY missing or invalid in server/.env");
  console.error("Running in DEGRADED mode: WebSocket stays up, but device auth/RFID validation will fail.");
}

const supabase = hasValidSupabaseConfig
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;
const facultyOnlyAccess = String(process.env.FACULTY_ONLY_ACCESS || 'false').toLowerCase() === 'true';
const iotDeviceToken = process.env.IOT_DEVICE_TOKEN || '';
const requireIotToken = String(process.env.IOT_REQUIRE_TOKEN || 'true').toLowerCase() === 'true';
const ROOM_SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const ROOM_SESSION_CHECK_INTERVAL_MS = 60 * 1000;

let latestScanResult = null;

function secureEquals(a, b) {
  const aBuf = Buffer.from(String(a || ''), 'utf8');
  const bBuf = Buffer.from(String(b || ''), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getTokenFromRequest(req) {
  const headerToken = req.get('x-iot-token') || '';
  if (headerToken) return headerToken;
  const authHeader = req.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function isAuthorizedIotRequest(req) {
  if (!requireIotToken) return true;
  if (!iotDeviceToken) return false;
  const providedToken = getTokenFromRequest(req);
  return secureEquals(providedToken, iotDeviceToken);
}

function normalizeCardUid(rawUid) {
  return String(rawUid || '').trim().toUpperCase();
}

// Store connected devices and web clients
const devices = new Map();
const webClients = new Set();

// Device registry
const registeredDevices = new Map();

console.log('🚀 IoT WebSocket Server starting on port 8082...');

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientId = generateClientId();
  let deviceInfo = null;
  
  console.log(`📡 New connection from ${req.socket.remoteAddress}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 Received:`, data.type);

      switch (data.type) {
        case 'device_register':
          const dbRoomId = await handleDeviceRegistration(ws, data, clientId);
          if (dbRoomId !== null) {
            deviceInfo = { deviceId: data.deviceId, deviceType: data.deviceType, roomId: dbRoomId };
            devices.set(clientId, { ws, deviceInfo });
          }
          break;

        case 'rfid_scan':
          // Pass the ws instance so we can send a direct response back to the ESP32
          handleRFIDScan(data, ws);
          break;


        case 'ping':
          handlePing(ws, data);
          break;

        case 'pong':
          handlePong(ws, data);
          break;

        default:
          console.log(`❓ Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`🔌 Connection closed: ${clientId}`);
    
    if (deviceInfo) {
      devices.delete(clientId);
      registeredDevices.delete(deviceInfo.deviceId);
      console.log(`📱 Device ${deviceInfo.deviceId} disconnected`);
      
      // Notify web clients about device disconnection
      const disconnectMessage = {
        type: 'device_disconnected',
        deviceId: deviceInfo.deviceId,
        timestamp: Date.now()
      };
      broadcastToWebClients(disconnectMessage);
    } else {
      webClients.delete(ws);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  // Add to clients list
  devices.set(clientId, { ws, deviceInfo });
});

async function handleDeviceRegistration(ws, data, clientId) {
  if (!supabase) {
    const fallbackRoomId = Number(data.roomId) || null;
    if (fallbackRoomId === null) {
      ws.send(JSON.stringify({ type: 'registration_failed', reason: 'Server missing Supabase config and no roomId provided' }));
      ws.close();
      return null;
    }

    const device = {
      id: data.deviceId,
      type: data.deviceType,
      roomId: fallbackRoomId,
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'online'
    };

    registeredDevices.set(data.deviceId, device);
    ws.send(JSON.stringify({
      type: 'registration_confirmed',
      deviceId: data.deviceId,
      roomId: fallbackRoomId,
      timestamp: Date.now()
    }));
    broadcastToWebClients({ type: 'device_connected', device, timestamp: Date.now() });
    return fallbackRoomId;
  }

  // Validate against DB
  const { data: deviceData, error } = await supabase
    .from('devices')
    .select('room_id, is_active')
    .eq('device_uid', data.deviceId)
    .single();
    
  if (error || !deviceData || !deviceData.is_active) {
    console.log(`❌ Unauthorized device connection attempt: ${data.deviceId}`);
    ws.send(JSON.stringify({ type: 'registration_failed', reason: 'Unauthorized or inactive device' }));
    ws.close();
    return null;
  }

  const dbRoomId = deviceData.room_id;

  const device = {
    id: data.deviceId,
    type: data.deviceType,
    roomId: dbRoomId,
    connectedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online'
  };

  registeredDevices.set(data.deviceId, device);
  
  console.log(`📱 Device registered: ${data.deviceId} (${data.deviceType}) mapped to room ${dbRoomId}`);
  
  // Update last_seen in DB
  await supabase.from('devices').update({ last_seen: new Date().toISOString() }).eq('device_uid', data.deviceId);
  
  // Send registration confirmation
  const response = {
    type: 'registration_confirmed',
    deviceId: data.deviceId,
    roomId: dbRoomId,
    timestamp: Date.now()
  };
  
  ws.send(JSON.stringify(response));
  
  // Notify web clients about new device
  const deviceMessage = {
    type: 'device_connected',
    device: device,
    timestamp: Date.now()
  };
  
  broadcastToWebClients(deviceMessage);
  
  return dbRoomId;
}

function toDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeString(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
}

async function upsertActiveRoomSession({ roomId, facultyId }) {
  if (!supabase) return null;
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from('room_sessions')
    .select('*')
    .eq('room_id', roomId)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    const { data: updated } = await supabase
      .from('room_sessions')
      .update({
        faculty_id: facultyId,
        last_motion_detected_at: nowIso,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    return updated || existing;
  }

  const { data: inserted } = await supabase
    .from('room_sessions')
    .insert({
      room_id: roomId,
      faculty_id: facultyId,
      started_at: nowIso,
      last_motion_detected_at: nowIso,
      status: 'active',
    })
    .select('*')
    .single();

  return inserted || null;
}

async function touchRoomSessionMotion(roomId) {
  if (!supabase) return null;
  const nowIso = new Date().toISOString();

  const { data } = await supabase
    .from('room_sessions')
    .update({ last_motion_detected_at: nowIso })
    .eq('room_id', roomId)
    .eq('status', 'active')
    .select('*');

  return data || null;
}

async function closeRoomSession(sessionId, status) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('room_sessions')
    .update({ status })
    .eq('id', sessionId)
    .select('*');

  return data || null;
}

async function markRoomVacant(roomId) {
  if (!supabase) return null;
  return await supabase
    .from('rooms')
    .update({
      status: 'available',
      current_user_id: null,
      current_user_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId);
}

async function resolveRoomIdForDevice(deviceId, fallbackRoomId = null) {
  const mapped = registeredDevices.get(deviceId);
  if (mapped?.roomId) return Number(mapped.roomId);
  if (fallbackRoomId) return Number(fallbackRoomId);
  if (!supabase) return null;

  const { data } = await supabase
    .from('devices')
    .select('room_id')
    .eq('device_uid', deviceId)
    .single();

  return data?.room_id ? Number(data.room_id) : null;
}

async function logScanResult(payload) {
  if (!supabase) return null;

  const scanEntry = {
    card_uid: payload.cardUid,
    user_id: payload.userId,
    room_id: payload.roomId,
    device_id: payload.deviceId,
    status: payload.success ? 'success' : 'denied',
    message: payload.message,
    source: payload.source || 'websocket',
    scanned_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('scan_logs').insert(scanEntry);
  if (error) {
    console.warn('⚠️ scan_logs insert failed (table may not exist yet):', error.message);
  }
}

async function evaluateRFIDScan({ cardUid, deviceId, action = 'check_in', roomId, source = 'websocket' }) {
  const normalizedUid = normalizeCardUid(cardUid);

  if (!supabase) {
    return {
      success: false,
      code: 'SERVER_NOT_CONFIGURED',
      message: 'Server not configured: missing Supabase env',
      cardUid: normalizedUid,
      roomId,
      user: null,
    };
  }

  // 1) Identify card by UID
  const { data: cardRecord, error: cardLookupError } = await supabase
    .from('rfid_cards')
    .select('id, user_id, is_active')
    .eq('card_uid', normalizedUid)
    .maybeSingle();

  let validationStatus = 'unregistered';
  if (cardRecord && cardRecord.is_active && !cardRecord.user_id) validationStatus = 'registered_unassigned';
  if (cardRecord && cardRecord.user_id) validationStatus = 'already_assigned';
  if (cardRecord && !cardRecord.is_active) validationStatus = 'inactive';

  broadcastToWebClients({
    type: 'rfid_scan_detected',
    card_uid: normalizedUid,
    room_id: roomId,
    validation_status: validationStatus,
    assigned_user_id: cardRecord?.user_id || null,
    timestamp: new Date().toISOString()
  });

  if (cardLookupError || !cardRecord || !cardRecord.is_active) {
    return {
      success: false,
      code: 'UNKNOWN_CARD',
      message: 'Unknown or inactive card',
      cardUid: normalizedUid,
      roomId,
      user: null,
    };
  }

  if (!cardRecord.user_id) {
    return {
      success: false,
      code: 'UNASSIGNED_CARD',
      message: 'Card is registered but not assigned',
      cardUid: normalizedUid,
      roomId,
      user: null,
    };
  }

  // Reject duplicate active assignments for the same user.
  const { data: sameUserCards } = await supabase
    .from('rfid_cards')
    .select('id')
    .eq('user_id', cardRecord.user_id)
    .eq('is_active', true);

  if (Array.isArray(sameUserCards) && sameUserCards.length > 1) {
    return {
      success: false,
      code: 'DUPLICATE_ASSIGNMENT',
      message: 'Duplicate active card assignments found for user',
      cardUid: normalizedUid,
      roomId,
      user: null,
    };
  }

  // 2) Identify user
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, name, role, is_active')
    .eq('id', cardRecord.user_id)
    .single();

  if (userError || !userData || !userData.is_active) {
    return {
      success: false,
      code: 'USER_INACTIVE',
      message: 'Inactive or missing user account',
      cardUid: normalizedUid,
      roomId,
      user: null,
    };
  }

  // 3) Enforce faculty role (and optional admin override only when configured)
  const adminOverride = userData.role === 'admin' && !facultyOnlyAccess;
  if (!adminOverride && userData.role !== 'faculty') {
    return {
      success: false,
      code: 'ROLE_NOT_ALLOWED',
      message: 'Only faculty can access with RFID',
      cardUid: normalizedUid,
      roomId,
      user: userData,
    };
  }

  // 3.5) Dynamically determine action (check-in vs check-out)
  const { data: roomState } = await supabase
    .from('rooms')
    .select('status, current_user_id')
    .eq('id', roomId)
    .single();

  let determinedAction = action;
  if (roomState && roomState.status === 'occupied' && Number(roomState.current_user_id) === Number(userData.id)) {
    determinedAction = 'check_out';
  } else {
    determinedAction = 'check_in';
  }

  // 4) Validate faculty-room assignment and schedule by day/time (Bypassed if checking out)
  let scheduleStart = '';
  let scheduleEnd = '';
  if (!adminOverride && determinedAction === 'check_in') {
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const currentDateStr = toDateString(new Date());
    const currentTime = toTimeString(new Date());
    let schedules = null;
    let scheduleError = null;

    const assignmentQuery = await supabase
      .from('schedules')
      .select('id')
      .eq('room_id', roomId)
      .eq('faculty_id', userData.id);

    const assignmentFallback = assignmentQuery.error
      ? await supabase
        .from('schedules')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userData.id)
      : null;

    const assigned = assignmentQuery.data?.length || assignmentFallback?.data?.length;
    if (!assigned) {
      return {
        success: false,
        code: 'ROOM_ASSIGNMENT_MISSING',
        message: 'Faculty not assigned to this room',
        cardUid: normalizedUid,
        roomId,
        user: userData,
      };
    }

    const primaryScheduleQuery = await supabase
      .from('schedules')
      .select('start_time, end_time, date')
      .eq('faculty_id', userData.id)
      .eq('room_id', roomId)
      .eq('day_of_week', currentDay);

    if (!primaryScheduleQuery.error) {
      schedules = primaryScheduleQuery.data || [];
    } else {
      const fallbackScheduleQuery = await supabase
        .from('schedules')
        .select('time_start, time_end, date')
        .eq('user_id', userData.id)
        .eq('room_id', roomId)
        .eq('day_of_week', currentDay);

      scheduleError = fallbackScheduleQuery.error;
      schedules = (fallbackScheduleQuery.data || []).map((row) => ({
        start_time: row.time_start,
        end_time: row.time_end,
        date: row.date,
      }));
    }

    if (scheduleError) {
      return {
        success: false,
        code: 'SCHEDULE_LOOKUP_FAILED',
        message: 'Schedule lookup failed',
        cardUid: normalizedUid,
        roomId,
        user: userData,
      };
    }

    const matchingSchedule = (schedules || []).find((s) => {
      if (s.date && s.date !== currentDateStr) return false;
      const startTime = s.start_time || s.time_start;
      const endTime = s.end_time || s.time_end;
      if (!startTime || !endTime) return false;
      const currentMin = timeToMinutes(currentTime);
      const startMin = timeToMinutes(startTime);
      const endMin = timeToMinutes(endTime);
      return currentMin >= startMin && currentMin <= endMin;
    });
    if (!matchingSchedule) {
      return {
        success: false,
        code: 'NOT_SCHEDULED',
        message: 'Not scheduled for this room',
        cardUid: normalizedUid,
        roomId,
        user: userData,
      };
    }

    scheduleStart = matchingSchedule.start_time || matchingSchedule.time_start || '';
    scheduleEnd = matchingSchedule.end_time || matchingSchedule.time_end || '';
  }

  // 5) Log success and room occupancy update
  const { data: roomData } = await supabase
    .from('rooms')
    .select('room_code, name')
    .eq('id', roomId)
    .single();

  const accessLog = await logAccessAttempt({
    userId: userData.id,
    userName: userData.name,
    roomId,
    cardUid: normalizedUid,
    action: determinedAction,
    granted: true,
    reason: adminOverride ? 'Admin Override' : (determinedAction === 'check_out' ? 'Check Out' : 'Schedule Match'),
  }, roomData || null);

  await supabase.from('rooms').update({
    status: determinedAction === 'check_in' ? 'occupied' : 'available',
    current_user_id: determinedAction === 'check_in' ? userData.id : null,
    current_user_name: determinedAction === 'check_in' ? userData.name : null,
    updated_at: new Date().toISOString(),
  }).eq('id', roomId);

  if (determinedAction === 'check_in') {
    await upsertActiveRoomSession({ roomId, facultyId: userData.id });
  } else if (determinedAction === 'check_out') {
    const { data: activeSession } = await supabase
      .from('room_sessions')
      .select('id')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .maybeSingle();

    if (activeSession?.id) {
      await closeRoomSession(activeSession.id, 'completed');
      await markRoomVacant(roomId);
    }
  }

  return {
    success: true,
    code: determinedAction === 'check_out' ? 'CHECKED_OUT' : 'ACCESS_GRANTED',
    message: determinedAction === 'check_out' ? 'Checked Out Successfully' : 'Access Granted',
    cardUid: normalizedUid,
    roomId,
    user: userData,
    scheduleStart,
    scheduleEnd,
    accessLog,
    roomData,
    action: determinedAction,
  };
}

async function handleRFIDScan(data, ws) {
  const deviceId = String(data?.deviceId || '');
  const action = data?.data?.action || 'check_in';
  const rawCardId = data?.card_id || data?.cardUid || data?.data?.card_id || data?.data?.card_uid || data?.data?.cardUid;
  const normalizedUid = normalizeCardUid(rawCardId);
  const requestedRoomId = data?.room_id || data?.roomId || data?.data?.room_id || data?.data?.roomId || null;
  const roomId = await resolveRoomIdForDevice(deviceId, requestedRoomId);

  if (!deviceId || !normalizedUid || !roomId) {
    sendAccessResponse(ws, deviceId, 'DENIED', 'Access Denied: Invalid Time');
    return;
  }

  const result = await evaluateRFIDScan({
    cardUid: normalizedUid,
    deviceId,
    action,
    roomId,
    source: 'websocket',
  });

  latestScanResult = {
    success: result.success,
    code: result.code,
    message: result.message,
    user: result.user ? { id: result.user.id, name: result.user.name, role: result.user.role } : null,
    card_uid: normalizedUid,
    room_id: roomId,
    device_id: deviceId,
    timestamp: new Date().toISOString(),
  };

  await logScanResult({
    cardUid: normalizedUid,
    userId: result.user?.id || null,
    roomId,
    deviceId,
    success: result.success,
    message: result.message,
    source: 'websocket',
  });

  if (result.success) {
    sendAccessResponse(ws, deviceId, 'SUCCESS', result.message, {
      userName: result.user?.name || '',
      scheduleStart: result.scheduleStart || '',
      scheduleEnd: result.scheduleEnd || '',
      action: result.action || action,
    });

    broadcastToWebClients({
      type: result.action === 'check_out' ? 'access_checked_out' : 'access_granted',
      user: result.user,
      log: result.accessLog || {
        user_id: result.user?.id,
        user_name: result.user?.name,
        room_id: roomId,
        room_code: result.roomData?.room_code || '',
        room_name: result.roomData?.name || '',
        card_uid: normalizedUid,
        action: result.action || action,
      },
      timestamp: new Date().toISOString(),
    });
  } else {
    sendAccessResponse(ws, deviceId, 'DENIED', 'Access Denied: Invalid Time', {
      userName: result.user?.name || 'Unknown',
    });

    await logAccessAttempt({
      userId: result.user?.id || null,
      userName: result.user?.name || 'Unknown',
      roomId,
      cardUid: normalizedUid,
      action: result.action || action,
      granted: false,
      reason: result.message,
    });

    if (result.code === 'UNKNOWN_CARD') {
      broadcastToWebClients({
        type: 'unknown_card',
        cardUid: normalizedUid,
        timestamp: new Date().toISOString(),
      });
    }

    broadcastToWebClients({
      type: 'access_denied',
      card_uid: normalizedUid,
      user_name: result.user?.name || 'Unknown',
      room_id: roomId,
      reason: result.message,
      timestamp: new Date().toISOString(),
    });
  }

  if (registeredDevices.has(deviceId)) {
    const device = registeredDevices.get(deviceId);
    device.lastSeen = new Date().toISOString();
  }
}

async function logAccessAttempt(payload, roomData = null) {
  if (!supabase) return null;

  const roomInfo =
    roomData ||
    (await supabase.from('rooms').select('room_code, name').eq('id', payload.roomId).single()).data ||
    null;

  const logEntry = {
    user_id: payload.userId,
    user_name: payload.userName || 'Unknown',
    room_id: payload.roomId,
    room_code: roomInfo ? roomInfo.room_code : '',
    room_name: roomInfo ? roomInfo.name : '',
    card_uid: payload.cardUid,
    action: payload.action || 'check_in',
    access_result: payload.granted ? 'granted' : 'denied',
    deny_reason: payload.granted ? null : payload.reason,
  };

  const { data: inserted, error } = await supabase
    .from('access_logs')
    .insert(logEntry)
    .select('*')
    .single();

  if (!error) return inserted;

  console.warn('⚠️ Extended access log insert failed, retrying basic format:', error.message);
  const fallbackEntry = {
    user_id: payload.userId,
    user_name: payload.userName || (payload.granted ? 'Unknown' : `Denied: ${payload.reason}`),
    room_id: payload.roomId,
    room_code: roomInfo ? roomInfo.room_code : '',
    room_name: roomInfo ? roomInfo.name : '',
    card_uid: payload.cardUid,
    action: payload.action || 'check_in',
  };

  const { data: fallbackInserted, error: fallbackError } = await supabase
    .from('access_logs')
    .insert(fallbackEntry)
    .select('*')
    .single();

  if (fallbackError) {
    console.error('❌ Failed to log access attempt:', fallbackError.message);
    return null;
  }

  return fallbackInserted;
}

function sendAccessResponse(ws, deviceId, status, message, meta = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'access_response',
      deviceId: deviceId,
      status: status,
      message: message,
      ...meta,
      timestamp: Date.now()
    }));
  }
}


function handlePing(ws, data) {
  const response = {
    type: 'pong',
    deviceId: data.deviceId,
    timestamp: Date.now()
  };
  ws.send(JSON.stringify(response));
}

function handlePong(ws, data) {
  if (registeredDevices.has(data.deviceId)) {
    const device = registeredDevices.get(data.deviceId);
    device.lastSeen = new Date().toISOString();
  }
}

function broadcastToWebClients(message) {
  const messageStr = JSON.stringify(message);
  let delivered = 0;
  
  // Send to all connected web clients
  devices.forEach((client) => {
    // Basic check: if no deviceInfo, we assume it's a web dashboard client
    if (!client.deviceInfo && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
      delivered += 1;
    }
  });

  if (message?.type === 'rfid_scan_detected') {
    console.log(`📨 rfid_scan_detected delivered to ${delivered} web client(s)`);
  }
}

function generateClientId() {
  return Math.random().toString(36).substr(2, 9);
}

// Health check for devices
setInterval(() => {
  const now = Date.now();
  
  registeredDevices.forEach((device, deviceId) => {
    const lastSeen = new Date(device.lastSeen).getTime();
    const timeDiff = now - lastSeen;
    
    // Mark device as offline if no response for 2 minutes
    if (timeDiff > 120000 && device.status === 'online') {
      device.status = 'offline';
      console.log(`⚠️  Device ${deviceId} marked as offline`);
      
      const offlineMessage = {
        type: 'device_status_changed',
        deviceId: deviceId,
        status: 'offline',
        timestamp: now
      };
      
      broadcastToWebClients(offlineMessage);
    }
  });
}, 30000); // Check every 30 seconds

function sendTimeoutAlertToDevice(roomId, reason) {
  let alerted = false;
  devices.forEach((client) => {
    if (client.deviceInfo && Number(client.deviceInfo.roomId) === Number(roomId) && client.deviceInfo.deviceType === 'rfid_reader') {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'auto_timeout',
          deviceId: client.deviceInfo.deviceId,
          status: 'TIMEOUT',
          message: reason,
          timestamp: Date.now()
        }));
        alerted = true;
        console.log(`🔊 Sent auto_timeout alert to device ${client.deviceInfo.deviceId} for room ${roomId}`);
      }
    }
  });
  return alerted;
}

// Room session timeout and schedule expiry
setInterval(async () => {
  if (!supabase) return;

  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentTime = toTimeString(now);

  const { data: sessions, error } = await supabase
    .from('room_sessions')
    .select('*')
    .eq('status', 'active');

  if (error || !sessions) return;

  for (const session of sessions) {


    const { data: schedules } = await supabase
      .from('schedules')
      .select('end_time, time_end')
      .eq('room_id', session.room_id)
      .eq('faculty_id', session.faculty_id)
      .eq('day_of_week', currentDay);

    const endTime = schedules?.[0]?.end_time || schedules?.[0]?.time_end;
    if (endTime) {
      const currentMin = timeToMinutes(currentTime);
      const endMin = timeToMinutes(endTime);
      if (currentMin > endMin) {
        sendTimeoutAlertToDevice(session.room_id, 'Schedule Ended');
        await closeRoomSession(session.id, 'completed');
        await markRoomVacant(session.room_id);
      }
    }
  }
}, ROOM_SESSION_CHECK_INTERVAL_MS);

// REST API for device status
app.get('/api/devices', (req, res) => {
  const deviceList = Array.from(registeredDevices.values());
  res.json({
    devices: deviceList,
    total: deviceList.length,
    online: deviceList.filter(d => d.status === 'online').length
  });
});

app.post('/scan-rfid', async (req, res) => {
  if (!isAuthorizedIotRequest(req)) {
    return res.status(403).json({
      success: false,
      code: 'UNAUTHORIZED_DEVICE',
      message: 'Device token is missing or invalid',
    });
  }

  const rawUid = req.body?.card_uid || req.body?.card_id;
  const deviceId = String(req.body?.device_id || req.body?.deviceId || '');
  const action = String(req.body?.action || 'check_in');
  const requestedRoomId = req.body?.room_id || req.body?.roomId || null;
  const cardUid = normalizeCardUid(rawUid);

  if (!cardUid || !deviceId) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_PAYLOAD',
      message: 'card_uid and device_id are required',
    });
  }

  const roomId = await resolveRoomIdForDevice(deviceId, requestedRoomId);
  if (!roomId) {
    return res.status(400).json({
      success: false,
      code: 'UNKNOWN_DEVICE_ROOM',
      message: 'Unable to resolve room for this device',
      card_uid: cardUid,
      device_id: deviceId,
    });
  }

  const result = await evaluateRFIDScan({
    cardUid,
    deviceId,
    action,
    roomId,
    source: 'rest',
  });

  latestScanResult = {
    success: result.success,
    code: result.code,
    message: result.message,
    user: result.user ? { id: result.user.id, name: result.user.name, role: result.user.role } : null,
    card_uid: cardUid,
    room_id: roomId,
    device_id: deviceId,
    timestamp: new Date().toISOString(),
  };

  await logScanResult({
    cardUid,
    userId: result.user?.id || null,
    roomId,
    deviceId,
    success: result.success,
    message: result.message,
    source: 'rest',
  });

  if (result.success) {
    broadcastToWebClients({
      type: 'access_granted',
      user: result.user,
      log: result.accessLog || null,
      timestamp: new Date().toISOString(),
    });
  } else {
    await logAccessAttempt({
      userId: result.user?.id || null,
      userName: result.user?.name || 'Unknown',
      roomId,
      cardUid,
      action,
      granted: false,
      reason: result.message,
    });

    if (result.code === 'UNKNOWN_CARD') {
      broadcastToWebClients({
        type: 'unknown_card',
        cardUid,
        timestamp: new Date().toISOString(),
      });
    }

    broadcastToWebClients({
      type: 'access_denied',
      card_uid: cardUid,
      user_name: result.user?.name || 'Unknown',
      room_id: roomId,
      reason: result.message,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    success: result.success,
    code: result.code,
    message: result.message,
    card_uid: cardUid,
    room_id: roomId,
    device_id: deviceId,
    user: result.user ? { id: result.user.id, name: result.user.name, role: result.user.role } : null,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/scan-results/latest', async (req, res) => {
  if (latestScanResult) {
    return res.json({ success: true, data: latestScanResult });
  }

  if (!supabase) {
    return res.json({ success: true, data: null });
  }

  const { data, error } = await supabase
    .from('scan_logs')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: data || null });
});

app.get('/api/scan-results', async (req, res) => {
  if (!supabase) {
    return res.json({ success: true, data: [] });
  }

  const limit = Math.min(Number(req.query.limit || 20), 100);
  const { data, error } = await supabase
    .from('scan_logs')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: data || [] });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedDevices: registeredDevices.size,
    uptime: process.uptime()
  });
});

// Serve static files (for development)
app.use(express.static('public'));

server.listen(8082, () => {
  console.log('IoT WebSocket Server is running on port 8082');
  console.log('Health check: http://localhost:8082/api/health');
  console.log('Device list: http://localhost:8082/api/devices');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  wss.clients.forEach((ws) => {
    ws.close();
  });
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
