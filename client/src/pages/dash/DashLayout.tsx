import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { AlertTriangle, LayoutGrid, ListChecks, Siren, Tent } from "lucide-react";
import { api } from "../../lib/api";
import { useNet, type TickerItem } from "../../lib/store";

const nav = [
  { to: "/dashboard", icon: LayoutGrid, label: "Board", end: true },
  { to: "/dashboard/sos", icon: ListChecks, label: "Requests" },
  { to: "/dashboard/hazards", icon: AlertTriangle, label: "Hazards" },
  { to: "/dashboard/shelters", icon: Tent, label: "Shelters" },
];

const sevColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#60a5fa",
  low: "#9aa1ad",
};

function describeEvent(evt: any): TickerItem | null {
  const ts = Date.now();
  const id = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
  const ll = (lat: unknown, lng: unknown) => `${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)}`;
  switch (evt?.type) {
    case "sos.new":
      return {
        id,
        ts,
        color: sevColor[evt.severity] ?? "#ef4444",
        text: `${evt.kind === "help" ? "HELP" : "SOS"} ${String(evt.severity ?? "").toUpperCase()} · ${ll(evt.lat, evt.lng)} · ${evt.origin ?? "unknown"}`,
      };
    case "hazard.new":
      return {
        id,
        ts,
        color: "#f59e0b",
        text: `HAZARD ${String(evt.kind ?? "").toUpperCase()} · ${ll(evt.lat, evt.lng)} · ${evt.origin ?? "unknown"}`,
      };
    case "sos.status":
      return {
        id,
        ts,
        color: "#60a5fa",
        text: `STATUS → ${String(evt.status ?? "").toUpperCase()} · ${String(evt.id).slice(0, 8)}`,
      };
    case "sync":
      return {
        id,
        ts,
        color: "#34d399",
        text: `MULE SYNC · ${String(evt.deviceId ?? "").slice(0, 8).toUpperCase()} · +${evt.pushed ?? 0} pushed`,
      };
    case "checkin":
      return { id, ts, color: "#34d399", text: `SAFE CHECK-IN · ${evt.name ?? "anonymous"}` };
    case "shelter.new":
      return { id, ts, color: "#34d399", text: `SHELTER REGISTERED · ${evt.name ?? ""}` };
    case "sos.removed":
      return { id, ts, color: "#9aa1ad", text: "REQUEST CANCELLED BY DEVICE" };
    default:
      return null;
  }
}

export default function DashLayout() {
  const [live, setLive] = useState(false);

  useEffect(() => {
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/live`;
    let ws: WebSocket | null = null;
    let closed = false;
    let timer: number | undefined;

    const connect = () => {
      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }
      ws.onopen = () => setLive(true);
      ws.onmessage = (e) => {
        useNet.setState((s) => ({ liveTick: s.liveTick + 1 }));
        try {
          const item = describeEvent(JSON.parse(e.data));
          if (item) useNet.setState((s) => ({ ticker: [item, ...s.ticker].slice(0, 40) }));
        } catch {
          /* malformed event */
        }
      };
      ws.onclose = () => {
        setLive(false);
        if (!closed) timer = window.setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, []);

  // seed the ticker with recent requests so it never starts empty
  useEffect(() => {
    api
      .sos()
      .then((rows) => {
        const seed = rows.slice(0, 8).map((r) => ({
          id: r.id,
          ts: r.ts,
          color: sevColor[r.severity] ?? "#9aa1ad",
          text: `${r.kind === "help" ? "HELP" : "SOS"} ${r.severity.toUpperCase()} · ${r.lat.toFixed(3)}, ${r.lng.toFixed(3)} · ${r.origin}`,
        }));
        if (seed.length) useNet.setState((s) => (s.ticker.length ? s : { ticker: seed }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="cmd flex h-dvh">
      {/* labelled sidebar */}
      <aside className="hidden w-[216px] flex-none flex-col border-r border-dline bg-dpanel md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-dred">
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <div>
            <div className="text-[14.5px] font-semibold tracking-tight text-dink">Beacon</div>
            <div className="text-[11px] text-dink3">Command centre</div>
          </div>
        </div>

        <nav className="mt-1 space-y-0.5 px-3">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  isActive ? "bg-dpanel2 text-dink" : "text-dink2 hover:bg-dpanel2/60 hover:text-dink"
                }`
              }
            >
              <Icon size={16} strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 px-5 pb-5">
          <div className="flex items-center gap-2 text-[12px] text-dink2">
            <span className={`dot ${live ? "dot-live" : "dot-bad"}`} />
            {live ? "Live feed connected" : "Live feed offline"}
          </div>
          <Link to="/" className="flex items-center gap-2 text-[13px] font-medium text-dink2 transition-colors hover:text-dink">
            <Siren size={15} className="text-dred" />
            Open field app
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {/* mobile top nav */}
        <div className="flex items-center gap-2 border-b border-dline bg-dpanel px-4 py-3 md:hidden">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-dred">
            <span className="h-2 w-2 rounded-full bg-white" />
          </span>
          <span className="text-[13.5px] font-semibold text-dink">Beacon Command</span>
          <nav className="ml-auto flex gap-1">
            {nav.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={label}
                className={({ isActive }) =>
                  `rounded-lg p-2 ${isActive ? "bg-dpanel2 text-dred" : "text-dink2"}`
                }
              >
                <Icon size={17} />
              </NavLink>
            ))}
            <Link to="/" className="rounded-lg p-2 text-dink2" aria-label="Field app">
              <Siren size={17} className="text-dred" />
            </Link>
          </nav>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
