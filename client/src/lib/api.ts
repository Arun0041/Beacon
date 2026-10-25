import type { CheckinRecord, HazardRecord, ShelterRecord, SosRecord, SosStatus } from "./types";

async function jfetch<T>(input: string, init?: RequestInit & { timeout?: number }): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init?.timeout ?? 6000);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const post = (body: unknown, timeout?: number) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  timeout,
});

export type Stats = {
  open: number;
  critical: number;
  emergencies: number;
  helpRequests: number;
  byStatus: Record<string, number>;
  hazards: number;
  devices: number;
  safe: number;
  shelters: number;
  lastSync: string | null;
};

export type ClusterInfo = {
  id: number;
  size: number;
  centroid: { lat: number; lng: number };
  radius: number;
  severities: Record<string, number>;
};

export const api = {
  health: () => jfetch<{ ok: boolean }>("/api/health", { timeout: 2500 }),
  sync: (body: {
    deviceId: string;
    sos: SosRecord[];
    hazards: HazardRecord[];
    checkins: CheckinRecord[];
    removed: string[];
  }) => jfetch<{ ok: boolean; pushed: number }>("/api/sync", post(body, 8000)),
  sos: (status?: string) =>
    jfetch<SosRecord[]>(`/api/sos${status ? `?status=${status}` : ""}`),
  setStatus: (id: string, status: SosStatus) =>
    jfetch<SosRecord>(`/api/sos/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  hazards: () => jfetch<HazardRecord[]>("/api/hazards"),
  shelters: () => jfetch<ShelterRecord[]>("/api/shelters"),
  addShelter: (body: Omit<ShelterRecord, "id"> & { id?: string }) =>
    jfetch<{ ok: boolean }>("/api/shelters", post(body, 6000)),
  cluster: (eps: number, minPts: number) =>
    jfetch<{ eps: number; minPts: number; total: number; clusters: ClusterInfo[] }>(
      `/api/cluster?eps=${eps}&minPts=${minPts}`,
    ),
  stats: () => jfetch<Stats>("/api/stats"),
};
