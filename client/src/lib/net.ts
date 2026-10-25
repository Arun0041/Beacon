import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  getDeviceId,
  mySos,
  saveMe,
  useNet,
  type Me,
} from "./store";
import { uid } from "./uid";
import { getICE } from "./ice";
import type {
  Channel,
  ChatMessage,
  CheckinRecord,
  HazardRecord,
  PeerInfo,
  ShelterRecord,
  SosRecord,
} from "./types";

/**
 * LifeLine mesh engine.
 *
 * One Y.Doc holds every replicated collection (SOS, hazards, chat).
 * Peers discover each other through the portal's WebSocket signalling
 * server, then exchange Yjs updates directly over WebRTC DataChannels —
 * the server never sees application payloads. Updates received from one
 * peer are rebroadcast to the others (epidemic gossip); Yjs state vectors
 * make re-delivery idempotent, so no manual dedup is needed.
 */

const FRAME_YJS = 0x01;

/* ---------------- identity ---------------- */

function myName(): string {
  return useNet.getState().me?.name ?? "";
}

export function announce(): void {
  mesh.hello();
}

/* ---------------- mesh ---------------- */

class Mesh {
  doc = new Y.Doc();
  sos: Y.Map<SosRecord> = this.doc.getMap("sos");
  hazards: Y.Map<HazardRecord> = this.doc.getMap("hazards");
  messages: Y.Array<ChatMessage> = this.doc.getArray("messages");
  checkins: Y.Map<CheckinRecord> = this.doc.getMap("checkins");
  shelters: Y.Map<ShelterRecord> = this.doc.getMap("shelters");

  private ws: WebSocket | null = null;
  private backoff = 1000;
  private reconnectTimer: number | null = null;
  private pcs = new Map<string, RTCPeerConnection>();
  private channels = new Map<string, RTCDataChannel>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private removedIds: string[] = [];

  constructor() {
    new IndexeddbPersistence("lifeline-mesh", this.doc);
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      this.rebuild();
      for (const [peerId, ch] of this.channels) {
        if (peerId === origin) continue;
        this.sendYjs(peerId, ch, update);
      }
    });
    this.rebuild();
  }

  /* ----- local replicas ----- */

  private rebuild() {
    useNet.setState({
      sos: [...this.sos.values()] as SosRecord[],
      hazards: [...this.hazards.values()] as HazardRecord[],
      messages: [...this.messages] as ChatMessage[],
      checkins: [...this.checkins.values()] as CheckinRecord[],
      shelters: [...this.shelters.values()] as ShelterRecord[],
    });
  }

  listSos(): SosRecord[] {
    return [...this.sos.values()] as SosRecord[];
  }
  listHazards(): HazardRecord[] {
    return [...this.hazards.values()] as HazardRecord[];
  }
  listCheckins(): CheckinRecord[] {
    return [...this.checkins.values()] as CheckinRecord[];
  }
  takeRemoved(): string[] {
    const out = this.removedIds;
    this.removedIds = [];
    return out;
  }

  /* ----- mutations (local-first, gossip automatic) ----- */

  createSos(input: {
    kind: "emergency" | "help";
    lat: number;
    lng: number;
    severity: SosRecord["severity"];
    tags: string[];
    note: string;
  }): SosRecord {
    const rec: SosRecord = {
      id: uid(),
      ...input,
      ts: Date.now(),
      origin: myName() || "anonymous",
      status: "open",
      ice: input.kind === "emergency" ? getICE() : null,
    };
    this.sos.set(rec.id, rec);
    mySos.set(rec.id);
    return rec;
  }

  updateSos(id: string, patch: Partial<SosRecord>) {
    const cur = this.sos.get(id);
    if (cur) this.sos.set(id, { ...cur, ...patch });
  }

  cancelSos(id: string) {
    this.sos.delete(id);
    this.removedIds.push(id);
    if (mySos.get() === id) mySos.clear();
  }

  createHazard(kind: HazardRecord["kind"], lat: number, lng: number, note: string) {
    const rec: HazardRecord = {
      id: uid(),
      kind,
      lat,
      lng,
      note,
      origin: myName() || "anonymous",
      ts: Date.now(),
    };
    this.hazards.set(rec.id, rec);
    return rec;
  }

  sendMessage(ch: Channel, text: string) {
    const msg: ChatMessage = { id: uid(), ch, from: myName() || "anonymous", text, ts: Date.now() };
    this.messages.push([msg]);
    return msg;
  }

  createCheckin(lat: number, lng: number) {
    const rec: CheckinRecord = {
      deviceId: getDeviceId(),
      name: myName() || "anonymous",
      lat,
      lng,
      ts: Date.now(),
    };
    this.checkins.set(rec.deviceId, rec);
    return rec;
  }

  hasCheckedIn(): boolean {
    return this.checkins.has(getDeviceId());
  }

  /* ----- server reconciliation (data-mule sync) ----- */

  mergeFromServer(sosRows: SosRecord[], hazardRows: HazardRecord[], shelterRows: ShelterRecord[]) {
    for (const row of sosRows) {
      const local = this.sos.get(row.id);
      if (!local) {
        this.sos.set(row.id, row);
      } else if (local.status !== row.status) {
        // Command centre is the authority for triage status.
        this.sos.set(row.id, { ...local, status: row.status });
      }
    }
    for (const row of hazardRows) {
      if (!this.hazards.has(row.id)) this.hazards.set(row.id, row);
    }
    for (const row of shelterRows) {
      this.shelters.set(row.id, row);
    }
  }

  /* ----- signalling ----- */

  hello() {
    // Register/refresh presence on the signalling server (identity changes too).
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "hello", id: getDeviceId(), name: myName() }));
    }
  }

  connect() {
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/mesh`;
    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.backoff = 1000;
      useNet.setState({ conn: "online" });
      announce();
    };
    this.ws.onmessage = (e) => {
      let m: { t: string; peers?: PeerInfo[]; from?: string; data?: unknown };
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === "peers" && m.peers) this.syncPeers(m.peers);
      else if (m.t === "signal" && m.from) void this.onSignal(m.from, m.data);
    };
    this.ws.onclose = () => {
      useNet.setState({ conn: "offline", peers: [] });
      this.teardownPeers();
      this.scheduleReconnect();
    };
    this.ws.onerror = () => this.ws?.close();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, 5000);
  }

  private signal(to: string, data: unknown) {
    this.ws?.send(JSON.stringify({ t: "signal", to, data }));
  }

  /** Deterministic initiator: the lexicographically smaller id dials. */
  private syncPeers(peers: PeerInfo[]) {
    useNet.setState({ peers });
    const live = new Set(peers.map((p) => p.id));
    for (const id of [...this.pcs.keys()]) {
      if (!live.has(id)) this.dropPeer(id);
    }
    for (const p of peers) {
      if (!this.pcs.has(p.id) && getDeviceId() < p.id) this.dial(p.id);
    }
  }

  private dial(peerId: string) {
    const pc = this.newPeer(peerId);
    const dc = pc.createDataChannel("mesh");
    this.wireChannel(peerId, dc);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal(peerId, { candidate: e.candidate.toJSON() });
    };
    pc.createOffer()
      .then((o) => pc.setLocalDescription(o))
      .then(() => this.signal(peerId, { sdp: pc.localDescription?.toJSON() }))
      .catch(() => this.dropPeer(peerId));
  }

  private newPeer(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pcs.set(peerId, pc);
    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        this.dropPeer(peerId);
      }
    };
    return pc;
  }

  private async onSignal(from: string, data: any) {
    try {
      let pc = this.pcs.get(from);
      if (data?.sdp) {
        if (!pc) {
          pc = this.newPeer(from);
          pc.ondatachannel = (e) => this.wireChannel(from, e.channel);
          pc.onicecandidate = (e) => {
            if (e.candidate) this.signal(from, { candidate: e.candidate.toJSON() });
          };
        }
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.signal(from, { sdp: pc.localDescription?.toJSON() });
        }
        for (const c of this.pendingCandidates.get(from) ?? []) {
          await pc.addIceCandidate(c).catch(() => {});
        }
        this.pendingCandidates.delete(from);
      } else if (data?.candidate) {
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(data.candidate).catch(() => {});
        } else {
          const q = this.pendingCandidates.get(from) ?? [];
          q.push(data.candidate);
          this.pendingCandidates.set(from, q);
        }
      }
    } catch {
      this.dropPeer(from);
    }
  }

  private dropPeer(peerId: string) {
    this.channels.delete(peerId);
    const pc = this.pcs.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.ondatachannel = null;
      try {
        pc.close();
      } catch {
        /* already closed */
      }
    }
    this.pcs.delete(peerId);
    this.pendingCandidates.delete(peerId);
  }

  private teardownPeers() {
    for (const id of [...this.pcs.keys()]) this.dropPeer(id);
    this.channels.clear();
  }

  private wireChannel(peerId: string, dc: RTCDataChannel) {
    dc.onopen = () => {
      this.channels.set(peerId, dc);
      // Full-state exchange on connect; Yjs dedupes on the receiver.
      this.sendYjs(peerId, dc, Y.encodeStateAsUpdate(this.doc));
    };
    dc.onmessage = (e) => {
      const buf = new Uint8Array(e.data);
      if (buf[0] === FRAME_YJS) {
        Y.applyUpdate(this.doc, buf.slice(1), peerId);
      }
    };
    dc.onclose = () => {
      this.channels.delete(peerId);
    };
  }

  private sendYjs(peerId: string, dc: RTCDataChannel, update: Uint8Array) {
    if (dc.readyState !== "open") return;
    const frame = new Uint8Array(update.length + 1);
    frame[0] = FRAME_YJS;
    frame.set(update, 1);
    try {
      dc.send(frame);
    } catch {
      this.dropPeer(peerId);
    }
  }

  /* ----- presence extras ----- */

  async watchBattery() {
    const nav = navigator as Navigator & { getBattery?: () => Promise<any> };
    if (!nav.getBattery) return;
    try {
      const b = await nav.getBattery();
      const update = () => useNet.setState({ battery: Math.round(b.level * 100) });
      update();
      b.addEventListener("levelchange", update);
    } catch {
      /* unsupported */
    }
  }
}

export const mesh = new Mesh();

export function startNet() {
  mesh.connect();
  void mesh.watchBattery();
}

export function setIdentity(name: string): Me {
  const me = saveMe(name);
  announce();
  return me;
}
