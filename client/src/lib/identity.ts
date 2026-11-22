import { openDB } from "idb";
import { createIdentity, seedFromBase64, seedToBase64, type BeaconIdentity } from "@beacon/crypto";

const DB_NAME = "beacon-identity";
const STORE_NAME = "keys";
const SEED_KEY = "device-seed";

let identityPromise: Promise<BeaconIdentity> | null = null;

async function openIdentityDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export function ensureIdentity(): Promise<BeaconIdentity> {
  if (!identityPromise) {
    identityPromise = (async () => {
      const db = await openIdentityDb();
      const stored = await db.get(STORE_NAME, SEED_KEY);
      const seed = typeof stored === "string" ? seedFromBase64(stored) : undefined;
      const identity = createIdentity(seed);
      await db.put(STORE_NAME, seedToBase64(identity.seed), SEED_KEY);
      localStorage.setItem("ll.device", identity.deviceId);
      return identity;
    })();
  }
  return identityPromise;
}
