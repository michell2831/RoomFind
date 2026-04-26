import { Room, User, AccessLog } from '@/types';

export interface IoTEvent {
  type: 'rfid_scan' | 'room_sensor' | 'door_status' | 'occupancy_change';
  timestamp: string;
  data: any;
}

export interface RFIDScanEvent {
  card_uid: string;
  room_id?: number;
  action: 'check_in' | 'check_out';
  user_id?: number;
}

export interface RoomSensorEvent {
  room_id: number;
  occupancy: boolean;
  temperature?: number;
  humidity?: number;
  door_open: boolean;
}

export interface DoorStatusEvent {
  room_id: number;
  status: 'open' | 'closed' | 'forced_open';
  timestamp: string;
}

class IoTService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventListeners: Map<string, ((event: IoTEvent) => void)[]> = new Map();

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // Connect to WebSocket server (you'll need to set this up)
      this.ws = new WebSocket(process.env.VITE_IOT_WS_URL || 'ws://localhost:8080');
      
      this.ws.onopen = () => {
        console.log('IoT WebSocket connected');
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
        console.log('IoT WebSocket disconnected');
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
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleEvent(event: IoTEvent) {
    console.log('IoT Event received:', event);
    
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

  // Simulate room sensor data for testing
  public simulateRoomSensor(roomId: number, occupancy: boolean, doorOpen: boolean) {
    const event: IoTEvent = {
      type: 'room_sensor',
      timestamp: new Date().toISOString(),
      data: {
        room_id: roomId,
        occupancy: occupancy,
        door_open: doorOpen,
        temperature: 22 + Math.random() * 5,
        humidity: 40 + Math.random() * 20
      } as RoomSensorEvent
    };

    this.handleEvent(event);
  }

  public disconnect() {
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
