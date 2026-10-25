import { create } from "zustand";
import type { ChatMessage, CheckinRecord, HazardRecord, PeerInfo, ShelterRecord, SosRecord } from "./types";

export type Me = { id: string; name: string };

export type TickerItem = { id: string; ts: number; text: string; color: string };

export type NetState = {
  me: Me | null;
  conn: "connecting" | "online" | "offline";
  peers: PeerInfo[];
  battery: number | null;
  serverOnline: boolean;
  lastSync: number | null;
  sos: SosRecord[];
  hazards: HazardRecord[];
  messages: ChatMessage[];
  checkins: CheckinRecord[];
  shelters: ShelterRecord[];
  mySosId: string | null;
  liveTick: number;
  ticker: TickerItem[];
  shakeSos: boolean;
};

const meKey = "ll.me";
const deviceKey = "ll.device";
const mySosKey = "ll.mySosId";

function loadMe(): Me | null {
  try {
    const raw = localStorage.getItem(meKey);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

export function getDeviceId(): string {
  let id = localStorage.getItem(deviceKey);
  if (!id) {
    id = crypto.randomUUID?.() ?? `dev-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(deviceKey, id);
  }
  return id;
}

export function saveMe(name: string): Me {
  const me: Me = { id: getDeviceId(), name };
  localStorage.setItem(meKey, JSON.stringify(me));
  useNet.setState({ me });
  return me;
}

export const mySos = {
  get: () => localStorage.getItem(mySosKey),
  set: (id: string) => {
    localStorage.setItem(mySosKey, id);
    useNet.setState({ mySosId: id });
  },
  clear: () => {
    localStorage.removeItem(mySosKey);
    useNet.setState({ mySosId: null });
  },
};

export function setShakeSos(on: boolean) {
  localStorage.setItem("beacon.shake", on ? "1" : "0");
  useNet.setState({ shakeSos: on });
}

export const useNet = create<NetState>()(() => ({
  me: loadMe(),
  conn: "connecting",
  peers: [],
  battery: null,
  serverOnline: false,
  lastSync: null,
  sos: [],
  hazards: [],
  messages: [],
  checkins: [],
  shelters: [],
  mySosId: localStorage.getItem(mySosKey),
  liveTick: 0,
  ticker: [],
  shakeSos: localStorage.getItem("beacon.shake") === "1",
}));
