# SentryX Auto Patrol

Autonomous obstacle-avoidance patrol mode for SentryX robot using Yahboom's TensorFlow object detection.

## Overview

Auto Patrol enables the SentryX robot to navigate autonomously by:
1. Reading from the existing video stream (video_bridge)
2. Running real-time object detection using TensorFlow
3. Detecting obstacles in the forward path
4. Performing basic avoidance maneuvers (stop → reverse → turn → continue)
5. Alternating left/right turns on each obstacle

The implementation preserves the existing manual joystick control and motor architecture. Manual mode and Auto Patrol mode are mutually exclusive.

## Architecture

### Components

- **web_bridge.py** (port 5000): Motor control gateway
  - Added `/api/mode/*` endpoints for mode management
  - Added `/api/autonomy/*` endpoints for autonomous movement
  - Watchdog timer prevents stalled autonomous mode

- **autopatrol_bridge.py** (port 5003): Autonomous patrol service
  - Reads MJPEG frames from video_bridge
  - Runs TensorFlow inference
  - Implements patrol loop
  - Sends movement commands to web_bridge

- **object_detector.py**: TensorFlow-based object detector
  - Loads Yahboom COCO model
  - Persistent session (one per detector instance)
  - Returns normalized detections

### Data Flow

```
Frontend (Control.tsx)
  ↓
Backend (Express.js)
  ↓
autopatrol_bridge.py (patrol logic)
  ├─→ video_bridge.py (MJPEG frames)
  ├─→ object_detector.py (TensorFlow inference)
  └─→ web_bridge.py (motor commands)
```

## Modes

### Manual Mode (Default)

- Joystick enabled
- Speed controls enabled
- `/api/move` accepts movement commands
- Stop button returns to manual mode

### Auto Patrol Mode

- Joystick disabled (returns HTTP 409)
- Speed controls disabled
- `/api/autonomy/*` endpoints accept movement only
- Stop button or manual stop endpoint returns to manual mode
- Auto-stops if no commands received for ~1 second (watchdog)

## Obstacle Detection Rules

A detection is treated as a forward obstacle when ALL of:
- Confidence score ≥ 0.50
- Object center within horizontal range [0.20, 0.80]
- Object bottom (ymax) ≥ 0.50 (lower half of image)
- Bounding box area ≥ 0.08 (large enough to indicate closeness)

**Two consecutive detections required** before triggering avoidance (reduces false positives).

## Avoidance Behavior

When an obstacle is detected:
1. Stop motors
2. Reverse for 0.45 seconds at -0.30 speed
3. Stop motors
4. Turn for 0.70 seconds at ±0.65 rotation (alternates left/right)
5. Stop motors
6. Resume forward at 0.35 speed

The turn direction alternates:
- First obstacle: turn left (rotation = -0.65)
- Second obstacle: turn right (rotation = +0.65)
- Third obstacle: turn left
- And so on...

## Important Limitations

**The Yahboom TensorFlow model cannot detect:**
- Plain walls
- Glass surfaces
- Ledges or drops
- Reflective surfaces
- Dark environments with poor lighting

**The model detects common objects** in the COCO dataset: people, chairs, tables, bottles, doors, windows, etc.

**Implications:**
- Auto Patrol may collide with plain walls
- Not suitable for edge detection or cliff avoidance
- Best used in environments with recognizable objects
- Always supervise the robot, especially on elevated surfaces

## API Endpoints

### Mode Management (web_bridge.py)

```http
GET  /api/mode              # Get current mode
POST /api/mode/manual       # Switch to manual (stops motors first)
POST /api/mode/auto         # Switch to auto (stops motors first)
```

### Autonomous Movement (web_bridge.py)

```http
POST /api/autonomy/move     # Move (only in auto mode)
POST /api/autonomy/stop     # Stop (updates watchdog timer)
```

Request body for `/api/autonomy/move`:
```json
{
  "speed": 0.35,      // [-1..1]
  "rotation": 0.0     // [-1..1]
}
```

### Auto Patrol Service (autopatrol_bridge.py)

```http
GET  /health                # Service health
GET  /status                # Detailed status (JSON)
POST /start                 # Start patrol
POST /stop                  # Stop patrol
```

Status response:
```json
{
  "ok": true,
  "active": true,
  "mode": "auto",
  "state": "forward",
  "model_loaded": true,
  "stream_connected": true,
  "obstacle_detected": false,
  "last_action": "forward",
  "last_detection": {
    "name": "chair",
    "score": 0.81
  },
  "last_error": null
}
```

### Backend Proxy Routes

```http
GET  /api/robot/autopatrol/health
GET  /api/robot/autopatrol/status
POST /api/robot/autopatrol/start    (requires control:write)
POST /api/robot/autopatrol/stop     (requires control:write)
```

## Environment Variables

### autopatrol_bridge.py

```bash
YAHBOOM_OBJECT_MODEL_PATH=/path/to/model.pb        # TensorFlow model
YAHBOOM_COCO_LABEL_PATH=/path/to/labels.txt        # COCO label map
```

### Backend

```bash
JETSON_AUTOPATROL_URL=http://sentryx-jetson:5003   # autopatrol_bridge endpoint
```

## Systemd Service

Install the service:
```bash
sudo cp robot/jetson_bridge/autopatrol-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable autopatrol-bridge
sudo systemctl start autopatrol-bridge
```

The service:
- Starts automatically at boot (but Auto Patrol remains inactive)
- After reboot: mode=manual, auto_patrol_active=false, motors=stopped
- Depends on web_bridge.service and video_bridge.service

View logs:
```bash
journalctl -u autopatrol-bridge -f
```

## Development & Testing

### Prerequisites
- Yahboom TensorFlow model and label files installed
- video_bridge.py running on port 5001
- web_bridge.py running on port 5000

### Testing with Wheels Raised

Always test with wheels raised from the floor first:

1. **Manual mode preservation**
   - Joystick still works ✓
   
2. **Mode switching**
   - Start Auto Patrol disables joystick ✓
   - Manual movement returns HTTP 409 during Auto Patrol ✓
   
3. **Forward movement**
   - Clear path causes slow forward movement ✓
   
4. **Obstacle avoidance**
   - Large object in front triggers: stop → reverse → turn → forward ✓
   - Second obstacle turns opposite direction ✓
   
5. **Interruption**
   - Stop button interrupts reverse/turn immediately ✓
   
6. **Failure modes**
   - Video stream shutdown stops robot ✓
   - Killing autopatrol process causes watchdog stop ✓
   - Return to manual restores joystick ✓
   
7. **Persistence**
   - Reboot leaves robot in manual mode, stopped ✓

## Code Structure

```
robot/jetson_bridge/
├── detectors/
│   └── object_detector.py      # YahboomObjectDetector class
├── scripts/
│   ├── web_bridge.py           # Modified with mode/autonomy endpoints
│   ├── autopatrol_bridge.py    # Auto Patrol service (new)
│   └── ...
├── autopatrol-bridge.service   # Systemd service file
└── ...

backend/src/
├── controllers/
│   └── RobotController.ts      # Added autopatrol methods
├── routes/
│   └── robotRoutes.ts          # Added autopatrol routes
└── ...

frontend/customer-app/src/
├── api/
│   └── robot.ts                # Added autopatrol API functions
├── hooks/robot/
│   ├── useAutoPatrol.ts        # Auto Patrol control hook
│   └── useAutoPatrolStatus.ts  # Status polling hook
├── components/control/
│   └── QuickActions.tsx        # Updated with Auto Patrol buttons
├── pages/
│   └── Control.tsx             # Updated mode display
└── ...
```

## Performance Tuning

### Constants in autopatrol_bridge.py

```python
FORWARD_SPEED = 0.35          # Slow forward movement
REVERSE_SPEED = -0.30         # Reverse speed
TURN_ROTATION = 0.65          # Turn magnitude
REVERSE_SECONDS = 0.45        # Reverse duration
TURN_SECONDS = 0.70           # Turn duration
INFERENCE_INTERVAL_SECONDS = 0.25  # ~4 FPS detection
```

### Obstacle Detection Tuning

In `object_detector.py`:
```python
OBSTACLE_SCORE_THRESHOLD = 0.50         # Min confidence
OBSTACLE_CENTER_MIN/MAX = 0.20, 0.80    # Horizontal range
OBSTACLE_YMAX_MIN = 0.50                # Vertical position
OBSTACLE_AREA_MIN = 0.08                # Min size
```

Adjust these constants to fine-tune detection sensitivity.

## Troubleshooting

### Auto Patrol won't start
- Check model files exist and paths are correct
- Verify video_bridge.py is running
- Check logs: `journalctl -u autopatrol-bridge`

### Robot doesn't move during Auto Patrol
- Verify web_bridge.py is running
- Check motors via manual control first
- Check webserver logs for 409 errors

### Too many false obstacles
- Increase `OBSTACLE_SCORE_THRESHOLD`
- Increase `OBSTACLE_AREA_MIN`
- Increase `CONSECUTIVE_OBSTACLE_THRESHOLD`

### Too slow to detect real obstacles
- Decrease `INFERENCE_INTERVAL_SECONDS`
- Decrease `CONSECUTIVE_OBSTACLE_THRESHOLD`

### Robot gets stuck in loops
- Adjust turn duration or angle
- Check lighting conditions

## Future Enhancements

- Real SLAM/mapping for persistent navigation
- Depth camera for accurate distance estimation
- Refined obstacle classification
- Docking station return
- Scheduled patrols
- Custom waypoint navigation
