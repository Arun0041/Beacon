import { api } from "./api";
import { mesh } from "./net";
import { getDeviceId, useNet } from "./store";

/**
 * Data-mule sync: while the mesh works fully offline, the moment any
 * device can reach the portal server it pushes its whole local state
 * (idempotent upserts) and pulls server-authoritative data — triage
 * statuses and the shelter registry — back into the CRDT. Every device
 * plays mule for its neighbourhood.
 */

const INTERVAL = 15000;
let busy = false;

export function startSync() {
  void tick();
  setInterval(() => void tick(), INTERVAL);
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    await api.health();
    const state = useNet.getState();
    const removed = mesh.takeRemoved();
    const [, sosRows, hazardRows, shelterRows] = await Promise.all([
      api.sync({
        deviceId: getDeviceId(),
        sos: state.sos,
        hazards: state.hazards,
        checkins: state.checkins,
        removed,
      }),
      api.sos(),
      api.hazards(),
      api.shelters(),
    ]);
    mesh.mergeFromServer(sosRows, hazardRows, shelterRows);
    useNet.setState({ serverOnline: true, lastSync: Date.now() });
  } catch {
    useNet.setState({ serverOnline: false });
  } finally {
    busy = false;
  }
}
