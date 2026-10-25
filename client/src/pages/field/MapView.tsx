import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Crosshair } from "lucide-react";
import { mesh } from "../../lib/net";
import { useNet } from "../../lib/store";
import { CENTRE } from "../../lib/config";
import { fmtAgo, fmtTime } from "../../lib/geo";
import { hazardMeta, severityColor } from "../../components/Badge";
import MapCanvas, { type MapMarker } from "../../components/MapCanvas";
import Sheet from "../../components/Sheet";
import { toast } from "../../lib/toast";
import type { HazardKind } from "../../lib/types";

const KINDS: HazardKind[] = ["flood", "fire", "rubble", "other"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default function MapView() {
  const sos = useNet((s) => s.sos);
  const hazards = useNet((s) => s.hazards);
  const shelters = useNet((s) => s.shelters);

  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [pickKind, setPickKind] = useState<HazardKind | null>(null);
  const [placing, setPlacing] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [note, setNote] = useState("");

  const watchId = useRef<number | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setMyLoc({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const markers: MapMarker[] = [
    ...sos.map<MapMarker>((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      html:
        s.kind === "help"
          ? `<div class="mk mk-help" style="background: ${hazardMeta.flood.color}"></div>`
          : `<div class="mk ${s.severity === "critical" ? "mk-critical" : ""}" style="background: ${severityColor[s.severity]}"></div>`,
      popup:
        `<b>${s.kind === "help" ? "Help" : "SOS"} · ${esc(s.severity)}</b> · ${esc(s.status)}<br/>` +
        (s.note ? `${esc(s.note)}<br/>` : "") +
        `<span style="color:#98a2b3">${esc(s.origin)} · ${fmtAgo(s.ts)}</span>`,
    })),
    ...hazards.map<MapMarker>((h) => ({
      id: h.id,
      lat: h.lat,
      lng: h.lng,
      html: `<div class="mk mk-help" style="background: ${hazardMeta[h.kind]?.color ?? "#6b7280"}"></div>`,
      popup:
        `<b>${esc(hazardMeta[h.kind]?.label ?? "Hazard")}</b><br/>` +
        (h.note ? `${esc(h.note)}<br/>` : "") +
        `<span style="color:#98a2b3">${esc(h.origin)} · ${fmtAgo(h.ts)}</span>`,
    })),
    ...shelters.map<MapMarker>((sh) => ({
      id: sh.id,
      lat: sh.lat,
      lng: sh.lng,
      html: `<div class="mk-shelter">+</div>`,
      popup: `<b>Shelter · ${esc(sh.name)}</b><br/>Capacity ${sh.capacity}` + (sh.contact ? `<br/><span style="color:#98a2b3">${esc(sh.contact)}</span>` : ""),
    })),
  ];

  function confirmHazard() {
    if (!pickKind || !pin) return;
    mesh.createHazard(pickKind, pin.lat, pin.lng, note.trim());
    toast("Hazard reported", "Everyone on the mesh sees it instantly.", "ok");
    setPickKind(null);
    setPin(null);
    setNote("");
  }

  return (
    <div className={`relative h-full w-full ${placing ? "pick-mode" : ""}`}>
      <MapCanvas
        center={CENTRE}
        zoom={15}
        markers={markers}
        myLoc={myLoc}
        onMapClick={(lat, lng) => {
          if (placing && pickKind) setPin({ lat, lng });
        }}
      />

      {/* legend */}
      <div className="card absolute bottom-[86px] left-3 z-30 space-y-1.5 rounded-xl px-3 py-2.5">
        <Legend color={severityColor.critical} label="SOS emergency" round />
        <Legend color="#d97706" label="Help request" />
        <Legend color={hazardMeta.flood.color} label="Hazard" />
        <Legend color="#059669" label="Shelter" shelter />
      </div>

      {placing && (
        <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-amberline bg-amberbg px-4 py-2 shadow-sm">
          <span className="text-[12.5px] font-medium text-amber">Tap the map to place the hazard</span>
          <button
            className="text-[12px] font-medium text-ink2 underline"
            onClick={() => {
              setPlacing(false);
              setPickKind(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {!placing && (
        <button
          className="btn btn-secondary absolute bottom-[86px] right-3 z-30 shadow-[0_6px_20px_rgba(16,24,40,0.14)]"
          onClick={() => setPickKind("flood")}
        >
          <AlertTriangle size={15} className="text-amber" />
          Report hazard
        </button>
      )}

      <Sheet open={!!pickKind && !pin} onClose={() => setPickKind(null)} title="Report a hazard" subtitle="Warns everyone nearby and reroutes safe paths.">
        <div className="grid grid-cols-2 gap-2.5">
          {KINDS.map((k) => {
            const meta = hazardMeta[k];
            return (
              <button
                key={k}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-all active:scale-[0.97] hover:border-line2 hover:bg-surface2"
                onClick={() => {
                  setPickKind(k);
                  setPlacing(true);
                }}
              >
                <AlertTriangle size={17} style={{ color: meta.color }} />
                <span className="text-[14px] font-medium text-ink">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet
        open={!!pin}
        onClose={() => {
          setPin(null);
          setPlacing(false);
          setPickKind(null);
        }}
        title={pickKind ? `${hazardMeta[pickKind].label} hazard` : "Confirm"}
        subtitle="Check the position, add a short note, then broadcast."
      >
        {pin && pickKind && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[13px]">
              <Crosshair size={14} className="text-blue" />
              <span className="num text-ink2">
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </span>
            </div>
            <input
              className="input"
              placeholder="Short note (optional)"
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2.5">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setPin(null);
                  setPlacing(true);
                }}
              >
                Reposition
              </button>
              <button className="btn btn-primary flex-1" onClick={confirmHazard}>
                Broadcast
              </button>
            </div>
            <p className="text-center text-[12px] text-ink3">
              Broadcasts at {fmtTime(Date.now())} to all linked peers
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Legend({ color, label, round, shelter }: { color: string; label: string; round?: boolean; shelter?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] font-medium text-ink2">
      {shelter ? (
        <span className="mk-shelter" style={{ width: 12, height: 12 }}>
          +
        </span>
      ) : (
        <span className={`mk ${round ? "" : "mk-help"}`} style={{ background: color, width: 11, height: 11 }} />
      )}
      {label}
    </div>
  );
}
