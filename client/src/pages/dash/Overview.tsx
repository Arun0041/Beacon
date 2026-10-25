import { useCallback, useEffect, useState } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { api, type ClusterInfo, type Stats } from "../../lib/api";
import { useNet } from "../../lib/store";
import { CENTRE } from "../../lib/config";
import { fmtTime } from "../../lib/geo";
import { hazardMeta, severityColor } from "../../components/Badge";
import MapCanvas, { type MapMarker } from "../../components/MapCanvas";
import type { HazardRecord, Severity, SosRecord, ShelterRecord } from "../../lib/types";

const EPS_OPTIONS = [100, 150, 250];
const SEV_KEYS: Severity[] = ["critical", "high", "medium", "low"];

const severityDark: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#60a5fa",
  low: "#9aa1ad",
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="num hidden text-[13.5px] font-medium text-dink2 lg:block">
      {now.toLocaleTimeString([], { hour12: false })}
    </span>
  );
}

function Count({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      setDisplay(value);
      return;
    }
    const controls = animate(mv.get(), value, {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    mv.set(value);
    return () => controls.stop();
  }, [value, mv, reduce]);

  return <span className="num">{display}</span>;
}

export default function Overview() {
  const liveTick = useNet((s) => s.liveTick);
  const serverOnline = useNet((s) => s.serverOnline);
  const ticker = useNet((s) => s.ticker);

  const [stats, setStats] = useState<Stats | null>(null);
  const [openSos, setOpenSos] = useState<SosRecord[]>([]);
  const [hazards, setHazards] = useState<HazardRecord[]>([]);
  const [shelters, setShelters] = useState<ShelterRecord[]>([]);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [eps, setEps] = useState(150);
  const [selCluster, setSelCluster] = useState<number | null>(null);
  const [view, setView] = useState<{ center: [number, number]; zoom?: number } | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const [st, sos, hz, cl, sh] = await Promise.all([
        api.stats(),
        api.sos("open"),
        api.hazards(),
        api.cluster(eps, 3),
        api.shelters(),
      ]);
      setStats(st);
      setOpenSos(sos);
      setHazards(hz);
      setClusters(cl.clusters);
      setShelters(sh);
      useNet.setState({ serverOnline: true });
    } catch {
      useNet.setState({ serverOnline: false });
    }
  }, [eps]);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 10000);
    return () => clearInterval(iv);
  }, [refresh, liveTick]);

  const markers: MapMarker[] = [
    ...openSos.map<MapMarker>((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      html:
        s.kind === "help"
          ? `<div class="mk mk-help" style="background: #f59e0b"></div>`
          : `<div class="mk ${s.severity === "critical" ? "mk-critical" : ""}" style="background: ${severityColor[s.severity]}"></div>`,
      popup: `<b>${s.kind === "help" ? "Help" : "SOS"} · ${s.severity}</b><br/>${s.note ? s.note + "<br/>" : ""}${s.origin} · ${fmtTime(s.ts)}`,
    })),
    ...hazards.map<MapMarker>((h) => ({
      id: h.id,
      lat: h.lat,
      lng: h.lng,
      html: `<div class="mk mk-help" style="background: ${hazardMeta[h.kind]?.color ?? "#9aa1ad"}"></div>`,
      popup: `<b>${hazardMeta[h.kind]?.label ?? "Hazard"}</b><br/>${h.note ? h.note + "<br/>" : ""}${h.origin} · ${fmtTime(h.ts)}`,
    })),
    ...shelters.map<MapMarker>((sh) => ({
      id: sh.id,
      lat: sh.lat,
      lng: sh.lng,
      html: `<div class="mk-shelter">+</div>`,
      popup: `<b>Shelter · ${sh.name}</b><br/>Capacity ${sh.capacity}<br/><span style="color:#9aa1ad">${sh.contact}</span>`,
    })),
  ];

  const circles = clusters.map((c) => ({
    lat: c.centroid.lat,
    lng: c.centroid.lng,
    radiusM: c.radius + 40,
    color: selCluster === c.id ? "#ffffff" : "#ef4444",
    fillOpacity: selCluster === c.id ? 0.14 : 0.07,
    label: String(c.size),
  }));

  const priority = openSos
    .filter((s) => s.kind === "emergency" && (s.severity === "critical" || s.severity === "high"))
    .sort((a, b) => (a.severity === b.severity ? a.ts - b.ts : a.severity === "critical" ? -1 : 1))
    .slice(0, 20);

  async function ack(id: string) {
    try {
      await api.setStatus(id, "acknowledged");
      void refresh();
    } catch {
      /* surfaced on next poll */
    }
  }

  const tickerItems = ticker.length > 0 ? ticker : [{ id: "idle", ts: Date.now(), color: "#626b7a", text: "Awaiting mesh traffic" }];
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div className="flex h-full flex-col">
      {/* header row */}
      <div className="flex min-h-[60px] flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-dline px-6 py-3">
        <h1 className="text-[18px] font-semibold tracking-tight text-dink">Operations board</h1>
        <span
          className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            serverOnline ? "border-dline text-dgreen" : "border-dline text-dink3"
          }`}
        >
          <span className={`dot ${serverOnline ? "dot-ok" : "dot-bad"}`} />
          {serverOnline ? "Server linked" : "Server unreachable"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-1.5 md:flex">
            <span className="text-[11.5px] text-dink3">Cluster radius</span>
            {EPS_OPTIONS.map((e) => (
              <button
                key={e}
                className={`num rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors ${
                  eps === e
                    ? "border-dred/60 bg-dredbg text-dred"
                    : "border-dline text-dink2 hover:text-dink"
                }`}
                onClick={() => setEps(e)}
              >
                {e}m
              </button>
            ))}
          </div>
          <Clock />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {/* KPI strip — type, not tiles */}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <Kpi label="Open emergencies" value={stats ? <Count value={stats.emergencies} /> : <Skel w={26} />} big color="#ef4444" />
          <Kpi label="Critical" value={stats ? <Count value={stats.critical} /> : <Skel w={18} />} color="#ef4444" />
          <Kpi label="Help requests" value={stats ? <Count value={stats.helpRequests} /> : <Skel w={18} />} color="#f59e0b" />
          <Kpi label="Safe check-ins" value={stats ? <Count value={stats.safe} /> : <Skel w={18} />} color="#34d399" />
          <Kpi label="Hazards" value={stats ? <Count value={stats.hazards} /> : <Skel w={18} />} />
          <Kpi label="Shelters" value={stats ? <Count value={stats.shelters} /> : <Skel w={18} />} />
          <Kpi label="Devices seen" value={stats ? <Count value={stats.devices} /> : <Skel w={18} />} />
          <Kpi
            label="Last mule sync"
            value={stats?.lastSync ? fmtTime(new Date(stats.lastSync).getTime()) : "—"}
            color="#34d399"
          />
        </div>

        {/* map + queue */}
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-xl border border-dline bg-dpanel">
            <div className="flex items-center justify-between border-b border-dline px-4 py-2.5">
              <span className="text-[13px] font-medium text-dink">Incident map</span>
              <span className="text-[11.5px] text-dink3">
                {clusters.length} cluster{clusters.length === 1 ? "" : "s"} at {eps}m
              </span>
            </div>
            <div className="h-[420px]">
              <MapCanvas center={CENTRE} zoom={13} theme="dark" view={view} markers={markers} circles={circles} />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-dline bg-dpanel">
            <div className="flex items-center justify-between border-b border-dline px-4 py-2.5">
              <span className="text-[13px] font-medium text-dink">Dispatch queue</span>
              <span className="text-[11.5px] text-dink3">{priority.length} critical & high</span>
            </div>
            <div className="max-h-[420px] divide-y divide-dline overflow-y-auto">
              {priority.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-dink2">No critical emergencies open.</div>
              ) : (
                priority.map((s) => (
                  <div key={s.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="dot" style={{ background: severityDark[s.severity] }} />
                      <span className="text-[12px] font-medium uppercase text-dink">{s.severity}</span>
                      <span className="num ml-auto text-[11px] text-dink3">{fmtTime(s.ts)}</span>
                    </div>
                    {s.note && <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-dink2">{s.note}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="num text-[11px] text-dink3">
                        {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                      </span>
                      {s.ice && (
                        <span className="rounded border border-dred/50 bg-dredbg px-1.5 py-0.5 text-[10px] font-medium text-dred">
                          ICE
                        </span>
                      )}
                      <button
                        className="ml-auto rounded-md border border-dline px-2 py-0.5 text-[11px] font-medium text-dink2 transition-colors hover:border-dink3 hover:text-dink"
                        onClick={() => ack(s.id)}
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* sector density */}
        <div className="mt-4 overflow-hidden rounded-xl border border-dline bg-dpanel">
          <div className="border-b border-dline px-4 py-2.5">
            <span className="text-[13px] font-medium text-dink">Sector density</span>
            <span className="ml-3 text-[11.5px] text-dink3">DBSCAN clusters of open requests · click to fly</span>
          </div>
          <div className="grid gap-px bg-dline sm:grid-cols-2 lg:grid-cols-4">
            {clusters.length === 0 ? (
              <div className="bg-dpanel p-5 text-center text-[12.5px] text-dink2 sm:col-span-2 lg:col-span-4">
                No clusters form at {eps}m right now.
              </div>
            ) : (
              clusters.slice(0, 8).map((c, i) => {
                const total = SEV_KEYS.reduce((n, k) => n + (c.severities[k] ?? 0), 0) || 1;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelCluster(c.id);
                      setView({ center: [c.centroid.lat, c.centroid.lng], zoom: 15 });
                    }}
                    className={`bg-dpanel px-4 py-3 text-left transition-colors ${
                      selCluster === c.id ? "bg-dpanel2" : "hover:bg-dpanel2/60"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="num text-[20px] font-semibold text-dink">{c.size}</span>
                      <span className="text-[11.5px] text-dink3">people</span>
                      <span className="num ml-auto text-[11px] text-dink3">r {Math.round(c.radius)}m</span>
                    </div>
                    <div className="mt-2 flex h-[5px] w-full overflow-hidden rounded-full bg-dbg">
                      {SEV_KEYS.map((k) => {
                        const n = c.severities[k] ?? 0;
                        if (!n) return null;
                        return (
                          <span key={k} style={{ width: `${(n / total) * 100}%`, background: severityDark[k] }} />
                        );
                      })}
                    </div>
                    <div className="num mt-1.5 text-[10.5px] text-dink3">
                      {c.centroid.lat.toFixed(4)}, {c.centroid.lng.toFixed(4)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* dispatch ticker */}
      <div className="ticker relative flex h-9 flex-none items-center overflow-hidden border-t border-dline bg-dpanel">
        <span className="z-10 flex h-full flex-none items-center bg-dred px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white">
          Live dispatch
        </span>
        <div className="ticker-track items-center gap-10 whitespace-nowrap px-6">
          {doubled.map((t, i) => (
            <span key={i} className="flex items-center gap-2 text-[11.5px] text-dink2">
              <span className="dot" style={{ background: t.color }} />
              {t.text}
              <span className="num text-dink3">{fmtTime(t.ts)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
  big?: boolean;
}) {
  return (
    <div>
      <div className="text-[11.5px] text-dink3">{label}</div>
      <div
        className={`font-semibold tracking-tight text-dink ${big ? "text-[28px]" : "text-[20px]"}`}
        style={color && !big ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Skel({ w }: { w: number }) {
  return <span className="skel inline-block h-[20px] align-middle" style={{ width: w }} />;
}
