import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { pool } from "./db.js";
import { api } from "./routes/api.js";
import { meshWss, liveWss } from "./ws.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api", api);

/* Serve the built client — one Node process acts as the "portal":
 * API + WebSocket signalling + static app, reachable at http://<lan-ip>:8787 */
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, "../../client/dist"),
  path.resolve(here, "../client/dist"),
];
const publicDir = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
if (publicDir) {
  app.use(express.static(publicDir));
  app.get(/^\/(?!api|ws).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) =>
    res.status(200).send("LifeLine API running. Build the client (npm run build) to serve the app."),
  );
}

const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/ws/mesh") meshWss.handleUpgrade(req, socket, head, (ws) => meshWss.emit("connection", ws, req));
  else if (pathname === "/ws/live") liveWss.handleUpgrade(req, socket, head, (ws) => liveWss.emit("connection", ws, req));
  else socket.destroy();
});

async function main() {
  await pool.query("SELECT 1");
  server.listen(config.port, () => {
    console.log(`[lifeline] listening on http://0.0.0.0:${config.port}`);
  });
}

main().catch((err) => {
  console.error("[lifeline] failed to start:", err.message);
  console.error("Is Postgres running? Try: docker compose up -d db");
  process.exit(1);
});
