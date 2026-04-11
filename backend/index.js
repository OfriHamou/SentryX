const express = require("express");
const cors = require("cors");
const { Readable } = require("stream");

const app = express();
const PORT = process.env.PORT || 3001;

// Jetson control bridge
const JETSON_BASE_URL =
  process.env.JETSON_BASE_URL || "http://192.168.1.247:5000";

// Jetson video bridge
const JETSON_VIDEO_URL =
  process.env.JETSON_VIDEO_URL || "http://192.168.1.247:5001";

// Jetson detection bridge
const JETSON_DETECTION_URL =
  process.env.JETSON_DETECTION_URL || "http://192.168.1.247:5002";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

async function forwardJson(res, url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Failed reaching Jetson bridge",
      details: String(error),
    });
  }
}

// Backend health
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "backend" });
});

// Backend -> Jetson bridge -> ROS motor move
app.post("/api/robot/move", async (req, res) => {
  try {
    const { speed, rotation } = req.body;

    if (typeof speed !== "number" || typeof rotation !== "number") {
      return res.status(400).json({
        ok: false,
        error: "speed and rotation must be numbers",
      });
    }

    return forwardJson(res, `${JETSON_BASE_URL}/api/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed, rotation }),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Failed reaching Jetson bridge",
      details: String(error),
    });
  }
});

// Backend -> Jetson bridge stop
app.post("/api/robot/stop", async (req, res) => {
  return forwardJson(res, `${JETSON_BASE_URL}/api/stop`, {
    method: "POST",
  });
});

// Backend -> Jetson bridge health
app.get("/api/robot/health", async (req, res) => {
  return forwardJson(res, `${JETSON_BASE_URL}/health`);
});

// Backend -> Jetson bridge battery
app.get("/api/robot/battery", async (req, res) => {
  return forwardJson(res, `${JETSON_BASE_URL}/api/battery`);
});

// Backend -> Jetson video bridge (MJPEG proxy)
app.get("/api/robot/video", async (req, res) => {
  try {
    const response = await fetch(`${JETSON_VIDEO_URL}/video_feed`);

    if (!response.ok || !response.body) {
      return res.status(502).json({
        ok: false,
        error: "Failed to open robot video stream",
      });
    }

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
        "multipart/x-mixed-replace; boundary=frame"
    );

    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Failed reaching Jetson video bridge",
      details: String(error),
    });
  }
});

app.get("/api/robot/events", async (req, res) => {
  return forwardJson(res, `${JETSON_DETECTION_URL}/events`);
});

app.get("/api/robot/events/latest", async (req, res) => {
  return forwardJson(res, `${JETSON_DETECTION_URL}/latest_event`);
});

app.get("/api/robot/events/image/:filename", async (req, res) => {
  try {
    const response = await fetch(
      `${JETSON_DETECTION_URL}/image/${encodeURIComponent(req.params.filename)}`
    );

    if (!response.ok || !response.body) {
      return res.status(404).json({
        ok: false,
        error: "Event image not found",
      });
    }

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "image/jpeg"
    );

    const { Readable } = require("stream");
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Failed reaching Jetson detection bridge",
      details: String(error),
    });
  }
});

app.get("/api/robot/detection/health", async (req, res) => {
  return forwardJson(res, `${JETSON_DETECTION_URL}/health`);
});

app.get("/api/robot/detection/status", async (req, res) => {
  return forwardJson(res, `${JETSON_DETECTION_URL}/status`);
});

app.listen(PORT, () => {
  console.log(`Backend: http://localhost:${PORT}`);
  console.log(`Jetson control bridge: ${JETSON_BASE_URL}`);
  console.log(`Jetson video bridge: ${JETSON_VIDEO_URL}`);
});