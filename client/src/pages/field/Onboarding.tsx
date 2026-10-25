import { useState } from "react";
import { motion } from "motion/react";
import { setIdentity } from "../../lib/net";

export default function Onboarding() {
  const [name, setName] = useState("");

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
          Your callsign appears on SOS beacons, help requests and chat messages across the
          mesh. It never leaves the neighbourhood network.
        </p>

        <input
          className="input mt-5"
          placeholder="e.g. Amar"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) setIdentity(name.trim());
          }}
          autoFocus
        />

        <button
          className="btn btn-primary mt-4 w-full"
          disabled={!name.trim()}
          onClick={() => setIdentity(name.trim())}
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
