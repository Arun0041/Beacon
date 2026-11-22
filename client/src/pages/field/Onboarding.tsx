import { useState } from "react";
import { motion } from "motion/react";
import { setIdentity } from "../../lib/net";
import { ensureIdentity } from "../../lib/identity";

export default function Onboarding() {
  const [name, setName] = useState("");
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [starting, setStarting] = useState(false);

  const join = async () => {
    if (!name.trim() || !locationAllowed || !privacyAccepted || starting) return;
    setStarting(true);
    await ensureIdentity();
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => undefined,
        () => undefined,
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
      );
    }
    setIdentity(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg p-4 sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="card w-full max-w-[400px] p-6"
      >
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-red">
            <span className="h-3 w-3 rounded-full bg-white" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-ink">Beacon</span>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tight text-ink">
          What should people call you?
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink2">
          Your callsign appears on SOS beacons, help requests and chat messages across the mesh. It
          never leaves the neighbourhood network.
        </p>

        <input
          className="input mt-5"
          placeholder="e.g. Amar"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void join();
          }}
          autoFocus
        />

        <label className="mt-4 flex gap-3 text-[13px] leading-relaxed text-ink2">
          <input
            type="checkbox"
            checked={locationAllowed}
            onChange={(e) => setLocationAllowed(e.target.checked)}
          />
          Share location only when an SOS, help request, check-in, or live sharing is explicitly
          enabled.
        </label>

        <label className="mt-3 flex gap-3 text-[13px] leading-relaxed text-ink2">
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.target.checked)}
          />
          I accept that my callsign and medical details may be shared as described in this app.
        </label>

        <button
          className="btn btn-primary mt-4 w-full"
          disabled={!name.trim() || !locationAllowed || !privacyAccepted || starting}
          onClick={() => void join()}
        >
          Join the mesh
        </button>
        <p className="mt-3 text-center text-[12px] text-ink3">
          No account · no internet · works offline
        </p>
      </motion.div>
    </div>
  );
}
