export interface Detection {
  x: number;
  y: number;
  w: number;
  h: number;
  is_known: boolean;
  name: string;
  confidence: number;
}

export type BatteryLevel =
  | 'Battery_High'
  | 'Battery_Medium'
  | 'Battery_Low'
  | 'Battery_Empty';

export interface BatteryStatus {
  ok: boolean;
  voltage: number;
  status: BatteryLevel;
  source: string;
}

export interface DetectionStatus {
    ok: boolean;
    camera_opened: boolean;
    faces_detected: number;
    detections: Detection[];
    last_event_id: string | null;
    last_detection_time: string | null;
}

export interface RobotEvent {
    id: string;
    type: string;
    is_alert: boolean;
    timestamp: string;
    image_filename?: string;
    detections?: Detection[];
    source?: string;
    status?: string;
}

export interface MoveInput {
    speed: number;
    rotation: number;
}

export type RobotControlMode = 'manual' | 'auto';

export interface ControlModeStatus {
    ok: boolean;
    mode: RobotControlMode;
}

export interface AvoidanceStatus {
    ok: boolean;
    enabled: boolean;
    mode: 'MANUAL' | 'AUTO';
    state: 'IDLE' | 'FORWARD' | 'BLOCKED' | 'REVERSING' | 'TURNING' | 'PAUSED' | 'ERROR';
    blocked_probability: number | null;
    free_probability: number | null;
    blocked_frames: number;
    last_action: string | null;
    last_turn_direction: 'left' | 'right' | null;
    stream_connected: boolean;
    model_loaded: boolean;
    last_frame_time: string | null;
    error: string | null;
}

export interface AvoidanceHealth {
    ok: boolean;
    service_running: boolean;
    stream_connected: boolean;
    model_loaded: boolean;
    ros_motor_service_available: boolean;
    enabled: boolean;
    state: AvoidanceStatus['state'];
}