import { Room, User, AccessLog } from '@/types';

export interface IoTEvent {
  type: 'rfid_scan' | 'occupancy_change' | 'access_granted' | 'access_checked_out' | 'access_denied' | 'unknown_card' | 'rfid_scan_detected' | 'scan_result' | 'wifi_scan_results';
  timestamp: string;
  data: any;
}

export interface RFIDScanEvent {
  card_uid: string;
  room_id?: number;
  action: 'check_in' | 'check_out';
  user_id?: number;
}

export interface AccessGrantedEvent {
  user: User;
  log: AccessLog;
  timestamp: string;
}

export interface AccessDeniedEvent {
  card_uid: string;
  user_name: string;
  room_id: number;
  reason: string;
  timestamp: string;
}

class IoTService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventListeners: Map<string, ((event: IoTEvent) => void)[]> = new Map();
  private scanPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastScanTimestamp: string | null = null;
  private scanPollRefCount = 0;

  constructor() {
    this.connect();
  }

  public async fetchLatestScanResult() {
    const baseUrl = import.meta.env.VITE_IOT_API_BASE_URL || 'http://localhost:8082';
    const response = await fetch(`${baseUrl}/api/scan-results/latest`);
    if (!response.ok) {
      throw new Error(`Failed to fetch scan result: ${response.status}`);
    }

    const payload = await response.json();
    return payload?.data || null;
  }

  public startScanPolling(intervalMs = 2000) {
    this.scanPollRefCount++;
    if (this.scanPollTimer) return;

    this.scanPollTimer = setInterval(async () => {
      try {
        const latest = await this.fetchLatestScanResult();
        if (!latest) return;

        const timestamp = latest.timestamp || latest.scanned_at || null;
        if (!timestamp || timestamp === this.lastScanTimestamp) return;
        this.lastScanTimestamp = timestamp;

        this.handleEvent({
          type: 'scan_result',
          timestamp,
          data: latest,
        });
      } catch (error) {
        console.warn('Scan polling failed:', error);
      }
    }, intervalMs);
  }

  public stopScanPolling() {
    if (this.scanPollRefCount > 0) {
      this.scanPollRefCount--;
    }
    
    if (this.scanPollRefCount === 0 && this.scanPollTimer) {
      clearInterval(this.scanPollTimer);
      this.scanPollTimer = null;
    }
  }

  private connect() {
    try {
      // Connect to WebSocket server (you'll need to set this up)
      this.ws = new WebSocket(import.meta.env.VITE_IOT_WS_URL || 'ws://localhost:8082');

      this.ws.onopen = () => {
        // connected — no log
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const iotEvent: IoTEvent = JSON.parse(event.data);
          this.handleEvent(iotEvent);
        } catch (error) {
          console.error('Error parsing IoT event:', error);
        }
      };

      this.ws.onclose = () => {
        // disconnected — no log
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('IoT WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to IoT WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectDelay *= 2;
        // reconnecting — no log
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleEvent(event: IoTEvent) {
    // event received — no log

    // Notify all listeners for this event type
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in IoT event listener:', error);
      }
    });

    // Also notify general event listeners
    const generalListeners = this.eventListeners.get('*') || [];
    generalListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in general IoT event listener:', error);
      }
    });
  }

  // Subscribe to specific IoT events
  public subscribe(eventType: string, callback: (event: IoTEvent) => void) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  // Send command to IoT device
  public sendCommand(deviceId: string, command: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'command',
        deviceId,
        command,
        timestamp: new Date().toISOString()
      }));
    } else {
      console.warn('WebSocket not connected, cannot send command');
    }
  }

  // Simulate RFID scan for testing
  public simulateRFIDScan(cardUid: string, roomId: number, action: 'check_in' | 'check_out') {
    const event: IoTEvent = {
      type: 'rfid_scan',
      timestamp: new Date().toISOString(),
      data: {
        card_uid: cardUid,
        room_id: roomId,
        action: action
      } as RFIDScanEvent
    };

    this.handleEvent(event);
  }



  public disconnect() {
    this.stopScanPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public getConnectionStatus() {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}

// Singleton instance
export const iotService = new IoTService();
export default iotService;
