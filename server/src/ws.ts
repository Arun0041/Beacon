import { WebSocketServer, WebSocket } from "ws";
import { bus } from "./events.js";

/**
 * Two WebSocket endpoints on the same HTTP server:
 *
 *   /ws/mesh — peer signalling + presence for the browser mesh.
 *              Phones exchange SDP offers/answers/ICE candidates here,
 *              then all application traffic flows P2P over DataChannels.
 *              This server never touches mesh payloads.
 *
 *   /ws/live — server push for the responder dashboard (REST changes).
 */

type Client = { ws: WebSocket; name: string };
const meshClients = new Map<string, Client>();
const liveClients = new Set<WebSocket>();

export const meshWss = new WebSocketServer({ noServer: true });
export const liveWss = new WebSocketServer({ noServer: true });

function broadcastPeers() {
  for (const [id, client] of meshClients) {
    const peers = [...meshClients]
      .filter(([other]) => other !== id)
      .map(([other, c]) => ({ id: other, name: c.name }));
    send(client.ws, { t: "peers", peers });
  }
}

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

meshWss.on("connection", (ws) => {
  let peerId: string | null = null;

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.t === "hello" && typeof msg.id === "string") {
      const id: string = msg.id;
      if (peerId && meshClients.has(peerId)) meshClients.delete(peerId);
      peerId = id;
      meshClients.set(id, { ws, name: String(msg.name ?? "device") });
      broadcastPeers();
      return;
    }
    if (msg.t === "signal" && peerId) {
      const target = meshClients.get(String(msg.to));
      if (target) send(target.ws, { t: "signal", from: peerId, data: msg.data });
    }
  });

  ws.on("close", () => {
    if (peerId) {
      meshClients.delete(peerId);
      broadcastPeers();
    }
  });
});

liveWss.on("connection", (ws) => {
  liveClients.add(ws);
  ws.on("close", () => liveClients.delete(ws));
});

bus.on("event", (evt: unknown) => {
  for (const ws of liveClients) send(ws, evt);
});
