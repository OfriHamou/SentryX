const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// Jetson bridge base URL
// Better later: move robot IP to .env because it can change
const JETSON_BASE_URL =
  process.env.JETSON_BASE_URL || "http://192.168.7.132:5000";

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

app.listen(PORT, () => {
  console.log(`Backend: http://localhost:${PORT}`);
  console.log(`Jetson bridge: ${JETSON_BASE_URL}`);
});