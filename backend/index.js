const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Your Jetson bridge address (Jetson runs the bridge) //to do -> env variable, jetson ip can change 
const JETSON_BASE_URL = process.env.JETSON_BASE_URL || "http://192.168.1.247:5000";

// quick check endpoint
app.get("/health", (req, res) => res.json({ ok: true }));

// Milestone endpoint: Node -> Jetson bridge
app.post("/api/robot/move", async (req, res) => {
  try {
    const { speed, rotation } = req.body;

    // Validate input early (MVC controller responsibility)
    if (typeof speed !== "number" || typeof rotation !== "number") {
      return res.status(400).json({ error: "speed and rotation must be numbers" });
    }

    // Forward to Jetson bridge API
    const r = await fetch(`${JETSON_BASE_URL}/api/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed, rotation }),
    });

    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Failed reaching Jetson bridge", details: String(e) });
  }
});

app.listen(3001, () => console.log("Backend: http://localhost:3001"));
