import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BatteryMedium, Gauge, HeartPulse, Signal, Smartphone, Vibrate, Wifi, WifiOff } from "lucide-react";
import { setIdentity } from "../../lib/net";
import { getDeviceId, setShakeSos, useNet } from "../../lib/store";
import { BLOOD_TYPES, getICE, saveICE, type ICE } from "../../lib/ice";
import { canInstall, promptInstall } from "../../lib/pwa";
import { toast } from "../../lib/toast";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-[46px] flex-none rounded-full transition-colors ${
        on ? "bg-green" : "bg-line2"
      }`}
    >
      <span
        className="absolute top-1/2 h-[20px] w-[20px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-150 ease-out"
        style={{ left: on ? 23 : 3 }}
      />
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink3">{children}</h2>;
}

export default function Profile() {
  const navigate = useNavigate();
  const me = useNet((s) => s.me);
  const shake = useNet((s) => s.shakeSos);
  const conn = useNet((s) => s.conn);
  const peers = useNet((s) => s.peers);
  const battery = useNet((s) => s.battery);
  const serverOnline = useNet((s) => s.serverOnline);
  const lastSync = useNet((s) => s.lastSync);

  const [callsign, setCallsign] = useState(me?.name ?? "");
  const [ice, setIce] = useState<ICE>(() => getICE());
  const [confirmReset, setConfirmReset] = useState(false);
  const [installable, setInstallable] = useState(canInstall());

  useEffect(() => {
    const iv = setInterval(() => setInstallable(canInstall()), 2000);
    return () => clearInterval(iv);
  }, []);

  async function enableShake(next: boolean) {
    if (next) {
      const dme = (window as any).DeviceMotionEvent;
      if (dme?.requestPermission) {
        try {
          const res = await dme.requestPermission();
          if (res !== "granted") {
            toast("Motion permission denied", "Shake-to-SOS needs motion access.", "error");
            return;
          }
        } catch {
          /* non-blocking */
        }
      }
    }
    setShakeSos(next);
    toast(
      next ? "Shake-to-SOS armed" : "Shake-to-SOS off",
      next ? "Three firm shakes broadcast an emergency SOS." : "SOS only from the button.",
      next ? "ok" : "info",
    );
  }

  return (
    <div className="mx-auto h-full max-w-[520px] overflow-y-auto px-4 pb-24">
      <div className="pt-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Profile</h1>
      </div>

      {/* identity */}
      <section className="mt-4">
        <SectionTitle>Callsign</SectionTitle>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-bluebg text-[16px] font-semibold text-blue ring-1 ring-blueline">
            {(me?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <input
            className="input flex-1"
            value={callsign}
            maxLength={20}
            placeholder="Your name on the mesh"
            onChange={(e) => setCallsign(e.target.value)}
          />
          <button
            className="btn btn-primary btn-sm flex-none"
            disabled={!callsign.trim() || callsign.trim() === me?.name}
            onClick={() => {
              setIdentity(callsign.trim());
              toast("Callsign updated", "Announced to every linked peer.", "ok");
            }}
          >
            Save
          </button>
        </div>
      </section>

      {/* medical ID */}
      <section className="mt-6">
        <SectionTitle>Medical ID</SectionTitle>
        <div className="card p-4">
          <div className="flex items-start gap-2.5">
            <HeartPulse size={16} className="mt-0.5 flex-none text-red" />
            <p className="text-[12.5px] leading-relaxed text-ink2">
              Attached to every emergency SOS so responders can help even if you cannot speak.
              Stored only on this device.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink2">Blood type</span>
              <select
                className="input"
                value={ice.blood || "—"}
                onChange={(e) => setIce({ ...ice, blood: e.target.value })}
              >
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink2">Emergency contact</span>
              <input
                className="input"
                placeholder="Name"
                value={ice.contact}
                maxLength={40}
                onChange={(e) => setIce({ ...ice, contact: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink2">Contact phone</span>
              <input
                className="input num"
                placeholder="10-digit number"
                inputMode="tel"
                value={ice.phone}
                maxLength={15}
                onChange={(e) => setIce({ ...ice, phone: e.target.value.replace(/[^\d+ ]/g, "") })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink2">Allergies</span>
              <input
                className="input"
                placeholder="e.g. penicillin"
                value={ice.allergies}
                maxLength={80}
                onChange={(e) => setIce({ ...ice, allergies: e.target.value })}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-ink2">Medical conditions</span>
            <input
              className="input"
              placeholder="e.g. diabetic, asthmatic"
              value={ice.conditions}
              maxLength={80}
              onChange={(e) => setIce({ ...ice, conditions: e.target.value })}
            />
          </label>
          <button
            className="btn btn-primary mt-4 w-full"
            onClick={() => {
              saveICE(ice);
              toast("Medical card saved", "It rides along with every SOS.", "ok");
            }}
          >
            Save medical card
          </button>
        </div>
      </section>

      {/* emergency behaviour */}
      <section className="mt-6">
        <SectionTitle>Emergency behaviour</SectionTitle>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface2">
            <Vibrate size={18} className="text-ink2" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-ink">Shake-to-SOS</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink2">
              Three firm shakes broadcast an emergency SOS, hands-free.
            </p>
          </div>
          <Toggle on={shake} onChange={(v) => void enableShake(v)} label="Shake to SOS" />
        </div>
      </section>

      {/* device status — battery/signal live here now, not on the SOS page */}
      <section className="mt-6">
        <SectionTitle>Device status</SectionTitle>
        <div className="card divide-y divide-line">
          <div className="flex items-center gap-3 px-4 py-3">
            <Signal size={16} className="text-ink2" />
            <span className="text-[13.5px] text-ink">Mesh link</span>
            <span className="ml-auto flex items-center gap-1.5 text-[13px] font-medium text-ink2">
              <span className={`dot ${conn === "online" ? "dot-ok" : "dot-bad"}`} />
              {conn === "online" ? `${peers.length} peer${peers.length === 1 ? "" : "s"}` : "Scanning"}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            {serverOnline ? <Wifi size={16} className="text-green" /> : <WifiOff size={16} className="text-ink3" />}
            <span className="text-[13.5px] text-ink">Server sync (data mule)</span>
            <span className="ml-auto text-[13px] font-medium text-ink2">
              {serverOnline && lastSync
                ? new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
                : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <BatteryMedium size={16} className="text-ink2" />
            <span className="text-[13.5px] text-ink">Battery</span>
            <span className={`num ml-auto text-[13px] font-medium ${battery !== null && battery < 20 ? "text-red" : "text-ink2"}`}>
              {battery !== null ? `${battery}%` : "—"}
            </span>
          </div>
        </div>
      </section>

      {/* responders */}
      <section className="mt-6">
        <SectionTitle>Responders</SectionTitle>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-ink">
            <Gauge size={18} className="text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-ink">Command console</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink2">
              Live incident map, dispatch queue, shelter registry — for rescue teams.
            </p>
          </div>
          <button className="btn btn-primary btn-sm flex-none" onClick={() => navigate("/dashboard")}>
            Open
          </button>
        </div>
      </section>

      {/* app */}
      <section className="mt-6">
        <SectionTitle>App</SectionTitle>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface2">
            <Smartphone size={18} className="text-ink2" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-ink">Install Beacon</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink2">
              Home-screen app that opens full-screen and works offline.
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm flex-none"
            disabled={!installable}
            onClick={async () => {
              const done = await promptInstall();
              if (done) toast("Beacon installed", "Launch it from your home screen.", "ok");
            }}
          >
            Install
          </button>
        </div>
      </section>

      <section className="mt-6 flex items-center justify-between rounded-xl border border-line px-4 py-3">
        <span className="num text-[12px] text-ink3">
          Device {getDeviceId().slice(0, 8)} · Beacon v0.5
        </span>
        <button
          className={`btn btn-sm ${confirmReset ? "btn-danger" : "btn-secondary"}`}
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              setTimeout(() => setConfirmReset(false), 3000);
              return;
            }
            localStorage.clear();
            indexedDB.deleteDatabase("lifeline-mesh");
            location.reload();
          }}
        >
          {confirmReset ? "Tap again to wipe" : "Reset device"}
        </button>
      </section>
    </div>
  );
}
