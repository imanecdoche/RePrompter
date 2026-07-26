import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface PremoSession {
  code: string;
  isPaired: boolean;
  state: any;
  lastUpdated: number;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory store for PREMO pairing sessions
const premoSessions: Record<string, PremoSession> = {};

// Clean up idle sessions (older than 2 hours) every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const code in premoSessions) {
    if (now - premoSessions[code].lastUpdated > 2 * 60 * 60 * 1000) {
      delete premoSessions[code];
    }
  }
}, 10 * 60 * 1000);

// API Endpoints for PREMO
app.post("/api/premo/register", (req, res) => {
  let code = "";
  let attempts = 0;
  
  // Generate unique 4-digit numeric code
  while (attempts < 50) {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    if (!premoSessions[code]) break;
    attempts++;
  }

  premoSessions[code] = {
    code,
    isPaired: false,
    state: null,
    lastUpdated: Date.now()
  };

  res.json({ success: true, code });
});

app.post("/api/premo/pair", (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: "Code required" });
  }

  const session = premoSessions[code];
  if (!session) {
    return res.status(404).json({ success: false, error: "Kode pairing salah atau tidak aktif." });
  }

  if (session.isPaired) {
    return res.status(400).json({ success: false, error: "Sesi ini sudah terhubung dengan monitor lain." });
  }

  session.isPaired = true;
  session.lastUpdated = Date.now();

  res.json({ success: true });
});

app.post("/api/premo/update/:code", (req, res) => {
  const { code } = req.params;
  const { state } = req.body;

  const session = premoSessions[code];
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesi tidak ditemukan." });
  }

  session.state = state;
  session.lastUpdated = Date.now();

  res.json({ success: true });
});

app.get("/api/premo/poll/:code", (req, res) => {
  const { code } = req.params;
  const session = premoSessions[code];
  
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesi tidak ditemukan atau diputus." });
  }

  session.lastUpdated = Date.now();

  res.json({
    success: true,
    isPaired: session.isPaired,
    state: session.state
  });
});

app.post("/api/premo/disconnect/:code", (req, res) => {
  const { code } = req.params;
  if (premoSessions[code]) {
    delete premoSessions[code];
  }
  res.json({ success: true });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
