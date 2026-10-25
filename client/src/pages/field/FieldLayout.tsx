import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import { mesh } from "../../lib/net";
import { useNet } from "../../lib/store";
import { CENTRE } from "../../lib/config";
import { getLocation } from "../../lib/geo";
import { toast } from "../../lib/toast";
import Onboarding from "./Onboarding";

export default function FieldLayout() {
  const me = useNet((s) => s.me);
  const shake = useNet((s) => s.shakeSos);
  const navigate = useNavigate();
  const firing = useRef(false);

  // Shake-to-SOS: three strong acceleration spikes within 1.6 s.
  useEffect(() => {
    if (!shake) return;

    let spikes = 0;
    let firstAt = 0;

    const fire = async () => {
      if (firing.current || useNet.getState().mySosId) return; // one active beacon
      firing.current = true;
      const gps = await getLocation(2500);
      mesh.createSos({
        kind: "emergency",
        lat: gps?.lat ?? CENTRE[0],
        lng: gps?.lng ?? CENTRE[1],
        severity: "critical",
        tags: [],
        note: "",
      });
      navigator.vibrate?.([120, 60, 120]);
      toast("SOS broadcasting", "Detected by shake — open SOS to add details.", "error");
      navigate("/");
      setTimeout(() => {
        firing.current = false;
      }, 5000);
    };

    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (mag < 30) return;
      const now = Date.now();
      if (now - firstAt > 1600) spikes = 0;
      if (spikes === 0) firstAt = now;
      spikes += 1;
      if (spikes >= 3) {
        spikes = 0;
        void fire();
      }
    };

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [shake, navigate]);

  return (
    <div className="flex h-dvh flex-col bg-bg text-ink">
      <TopBar />
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
      <BottomNav />
      {!me && <Onboarding />}
    </div>
  );
}
