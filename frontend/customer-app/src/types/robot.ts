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
}

export interface MoveInput {
    speed: number;
    rotation: number;
}