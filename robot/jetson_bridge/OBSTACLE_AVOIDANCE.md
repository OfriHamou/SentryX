# SentryX Obstacle Avoidance V1

## Overview

SentryX obstacle avoidance keeps the existing architecture:

```text
Frontend/application
    -> Backend
    -> Robot-side HTTP bridges
    -> ROS services
    -> JetBot Mini hardware
```

New robot-side bridge:

```text
robot/jetson_bridge/scripts/obstacle_avoidance_bridge.py
```

It does **not** open a second direct camera session. It consumes the existing MJPEG stream from:

```text
http://127.0.0.1:5001/video_feed
```

## Reused assets and patterns

- Reused `web_bridge.py` motor path and dead-zone behavior via `jetson_bridge/motor_control.py`
- Reused `detection_bridge.py` background-worker and reconnect-style error handling
- Reused `video_bridge.py` as the only direct Jetson camera owner

## Yahboom adaptation

The service is now adapted to the Yahboom "Automatic avoid" object-detection flow:

- TensorFlow frozen graph (`frozen_inference_graph.pb`)
- COCO label map (`mscoco_label_map.pbtxt`, optional but recommended)
- MJPEG frames consumed from `video_bridge` (`http://127.0.0.1:5001/video_feed`)

Default inference mode:

```text
AVOIDANCE_INFERENCE_MODE=object_detection
```

If the configured detection graph is missing or cannot be loaded, `/status` and `/health` report the failure and autonomous driving does not start.

## Control modes

Allowed modes:

```text
manual
auto
```

Ownership rule:

- `manual`: joystick movement allowed, avoidance movement blocked
- `auto`: avoidance movement allowed, joystick movement rejected by `web_bridge.py`
- `POST /api/robot/stop`: always allowed and also pauses avoidance for safety

## Robot-side APIs

### Web bridge

- `GET /api/control-mode`
- `POST /api/control-mode`

### Avoidance bridge (default port `5003`)

- `POST /start`
- `POST /stop`
- `POST /pause`
- `POST /resume`
- `GET /status`
- `GET /health`

### Backend proxies

- `GET /api/robot/control-mode`
- `POST /api/robot/control-mode`
- `GET /api/robot/avoidance/health`
- `GET /api/robot/avoidance/status`
- `POST /api/robot/avoidance/start`
- `POST /api/robot/avoidance/stop`
- `POST /api/robot/avoidance/pause`
- `POST /api/robot/avoidance/resume`

## State machine

```text
IDLE -> FORWARD -> BLOCKED -> REVERSING -> TURNING -> FORWARD
```

Additional states:

- `PAUSED`
- `ERROR`

Defaults:

- blocked threshold: `0.75`
- blocked confirmation frames: `3`
- stop delay: `0.2`
- reverse duration: `0.5`
- turn duration: `0.7`

## Environment variables

### Backend

```text
JETSON_BASE_URL=http://sentryx-jetson:5000
JETSON_VIDEO_URL=http://sentryx-jetson:5001
JETSON_DETECTION_URL=http://sentryx-jetson:5002
JETSON_AVOIDANCE_URL=http://sentryx-jetson:5003
JETSON_REQUEST_TIMEOUT_MS=5000
```

### Robot service

```text
WEB_BRIDGE_URL=http://127.0.0.1:5000
VIDEO_STREAM_URL=http://127.0.0.1:5001/video_feed
AVOIDANCE_PORT=5003
AVOIDANCE_INFERENCE_MODE=object_detection
AVOIDANCE_DETECTION_MODEL_PATH=/absolute/path/to/frozen_inference_graph.pb
AVOIDANCE_LABEL_MAP_PATH=/absolute/path/to/mscoco_label_map.pbtxt
AVOIDANCE_DETECTION_MIN_SCORE=0.5
AVOIDANCE_OBSTACLE_CLASS_IDS=1,2,3,4,6,8,13,14,15,16,17,18,19,20,21,44,47,51,62,64,67,72,73,77,78,79,80,81,82,84,85,86,87,88,89,90
AVOIDANCE_OBSTACLE_MIN_BOX_AREA=0.04
AVOIDANCE_OBSTACLE_CENTER_X_MIN=0.25
AVOIDANCE_OBSTACLE_CENTER_X_MAX=0.75
AVOIDANCE_OBSTACLE_CENTER_Y_MIN=0.20
AVOIDANCE_OBSTACLE_CENTER_Y_MAX=1.00
AVOIDANCE_BLOCKED_THRESHOLD=0.75
AVOIDANCE_BLOCKED_CONFIRMATION_FRAMES=3
AVOIDANCE_FORWARD_SPEED=0.35
AVOIDANCE_REVERSE_SPEED=-0.3
AVOIDANCE_TURN_SPEED=0.45
AVOIDANCE_STOP_DELAY_SECONDS=0.2
AVOIDANCE_REVERSE_DURATION_SECONDS=0.5
AVOIDANCE_TURN_DURATION_SECONDS=0.7
AVOIDANCE_TURN_DURATION_INCREMENT_SECONDS=0.15
AVOIDANCE_MAX_TURN_DURATION_SECONDS=1.2
AVOIDANCE_STREAM_TIMEOUT_SECONDS=5
AVOIDANCE_STREAM_RETRY_DELAY_SECONDS=0.5
AVOIDANCE_LOOP_SLEEP_SECONDS=0.05
AVOIDANCE_FORWARD_REFRESH_SECONDS=1.0
```

Legacy compatibility mode is still available if you later provide a Yahboom blocked/free classifier:

```text
AVOIDANCE_INFERENCE_MODE=blocked_free
AVOIDANCE_MODEL_PATH=/absolute/path/to/blocked_free_model.pth
AVOIDANCE_MODEL_DEVICE=cpu
```

## Install and run

### Backend

```powershell
cd backend
npm install
npm run build
npm test
```

### Customer app

```powershell
cd frontend\customer-app
npm install
npm run build
```

### Robot Python tests

```powershell
cd robot
python -m unittest jetson_bridge.scripts.test_obstacle_avoidance
```

### Start robot services manually

```powershell
cd robot
python jetson_bridge\scripts\web_bridge.py
python jetson_bridge\scripts\video_bridge.py
python jetson_bridge\scripts\detection_bridge.py
python jetson_bridge\scripts\obstacle_avoidance_bridge.py
```

## systemd installation

On the Jetson:

```bash
sudo cp robot/jetson_bridge/systemd/obstacle-avoidance-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable obstacle-avoidance-bridge.service
sudo systemctl start obstacle-avoidance-bridge.service
sudo systemctl restart obstacle-avoidance-bridge.service
sudo systemctl status obstacle-avoidance-bridge.service
```

The service starts in a safe idle state. It does **not** start robot motion on boot.
The shipped service file sources ROS (`/opt/ros/melodic/setup.bash`) and, if present, `/home/jetson/workspace/catkin_ws/devel/setup.bash` before launching Python.

## Physical-robot validation steps

These steps require the JetBot Mini:

1. Confirm manual joystick still drives normally in `manual` mode.
2. Switch to `auto` and confirm joystick requests receive `409` while stop still works.
3. Verify the robot starts from a stop, drives forward, and avoids a visible obstacle.
4. Disconnect the video bridge and confirm the robot stops and reports stream failure.
5. Temporarily point `AVOIDANCE_DETECTION_MODEL_PATH` at a missing file and confirm start is rejected.

## Safety limitations

This is **camera-based object-detection avoidance only**. It is not equivalent to LiDAR, ultrasonic, ToF, SLAM, mapping, or navigation.

Known limitations:

- transparent obstacles
- low obstacles below the camera field of view
- poor lighting
- unusual wall/floor textures
- stairs and drop-offs
- camera latency
- model quality depends on the object-detection model provided on the Jetson
