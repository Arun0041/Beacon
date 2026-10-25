import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Droplets,
  Flashlight,
  HandHeart,
  MapPin,
  ShieldCheck,
  Utensils,
  Siren,
  Stethoscope,
  Car,
  CircleHelp,
  Home as HomeIcon,
} from "lucide-react";
import { mesh } from "../../lib/net";
import { mySos, useNet } from "../../lib/store";
import { CENTRE } from "../../lib/config";
import { fmtAgo } from "../../lib/geo";
import { getLocation } from "../../lib/geo";
import { toast } from "../../lib/toast";
import {
  HELP_CATEGORIES,
  SOS_TAGS,
  SEVERITIES,
  type CheckinRecord,
  type HazardRecord,
  type Severity,
  type SosRecord,
} from "../../lib/types";
import { SevBadge, StatusBadge, hazardMeta } from "../../components/Badge";
import Sheet from "../../components/Sheet";

const HOLD_MS = 1500;

const HELP_ICONS: Record<string, typeof Droplets> = {
  water: Droplets,
  food: Utensils,
  shelter: HomeIcon,
  medical: Stethoscope,
  transport: Car,
  other: CircleHelp,
};

type Draft = {
  id: string;
  kind: "emergency" | "help";
  severity: Severity;
  tags: string[];
  note: string;
  gps: { lat: number; lng: number; acc?: number } | null;
  manual: { lat: number; lng: number } | null;
};

export default function Home() {
  const me = useNet((s) => s.me);
  const sos = useNet((s) => s.sos);
  const hazards = useNet((s) => s.hazards);
  const checkins = useNet((s) => s.checkins);
  const mySosId = useNet((s) => s.mySosId);

  const [prog, setProg] = useState(0);
  const [sosSheet, setSosSheet] = useState(false);
  const [helpSheet, setHelpSheet] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [helpCat, setHelpCat] = useState<string | null>(null);
  const [helpNote, setHelpNote] = useState("");

  const holding = useRef(false);
  const startAt = useRef(0);
  const timer = useRef(0);

  const stopLoop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = 0;
    }
  };

  const startHold = () => {
    if (holding.current) return;
    holding.current = true;
    startAt.current = performance.now();
    navigator.vibrate?.(30);
    // interval not rAF: hold must complete even when the page isn't painting
    timer.current = window.setInterval(() => {
      if (!holding.current) return stopLoop();
      const p = Math.min(1, (performance.now() - startAt.current) / HOLD_MS);
      setProg(p);
      if (p >= 1) {
        holding.current = false;
        stopLoop();
        setProg(0);
        void fireEmergency();
      }
    }, 30);
  };

  const endHold = () => {
    if (!holding.current) return;
    holding.current = false;
    stopLoop();
    setProg(0);
  };

  const mine = mySosId ? sos.find((s) => s.id === mySosId) : undefined;

  async function fireEmergency() {
    const gps = await getLocation();
    const rec = mesh.createSos({
      kind: "emergency",
      lat: gps?.lat ?? CENTRE[0],
      lng: gps?.lng ?? CENTRE[1],
      severity: "critical",
      tags: [],
      note: "",
    });
    setDraft({
      id: rec.id,
      kind: "emergency",
      severity: rec.severity,
      tags: [],
      note: "",
      gps,
      manual: null,
    });
    setSosSheet(true);
    navigator.vibrate?.([90, 60, 90]);
    toast("Emergency broadcast", "Your SOS is live on the mesh. Add details for responders.", "error");
  }

  async function submitHelp() {
    if (!helpCat) return;
    const gps = await getLocation(2500);
    const cat = HELP_CATEGORIES.find((c) => c.id === helpCat);
    mesh.createSos({
      kind: "help",
      lat: gps?.lat ?? CENTRE[0],
      lng: gps?.lng ?? CENTRE[1],
      severity: "medium",
      tags: [helpCat],
      note: [cat?.label, helpNote.trim()].filter(Boolean).join(" — "),
    });
    setHelpSheet(false);
    setHelpCat(null);
    setHelpNote("");
    toast("Help request sent", `${cat?.label} request is on the mesh queue.`, "ok");
  }

  async function checkSafe() {
    const gps = await getLocation(2500);
    mesh.createCheckin(gps?.lat ?? CENTRE[0], gps?.lng ?? CENTRE[1]);
    navigator.vibrate?.(40);
    toast("Marked safe", "Responders and family can see your check-in.", "ok");
  }

  function saveDraft() {
    if (!draft) return;
    const pos = draft.manual ?? draft.gps;
    mesh.updateSos(draft.id, {
      severity: draft.severity,
      tags: draft.tags,
      note: draft.note,
      ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
    });
    setSosSheet(false);
  }

  const feed: Array<{ ts: number; node: React.ReactNode }> = [
    ...sos.map((s) => ({ ts: s.ts, node: <FeedRow key={s.id} sos={s} /> })),
    ...hazards.map((h) => ({ ts: h.ts, node: <FeedRow key={h.id} hazard={h} /> })),
    ...checkins.map((c) => ({ ts: c.ts, node: <SafeRow key={c.deviceId} rec={c} /> })),
  ].sort((a, b) => b.ts - a.ts);

  return (
    <div className="mx-auto h-full max-w-[520px] overflow-y-auto px-4 pb-24">
      {/* greeting */}
      <div className="pt-5">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">
          {me ? `Hi, ${me.name}` : "Beacon"}
        </h1>
        <p className="mt-0.5 text-[13.5px] text-ink2">
          {mine ? "Your request is active — stay where you are." : "Are you or someone nearby in danger?"}
        </p>
      </div>

      {/* active request banner */}
      {mine && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={`mt-4 rounded-2xl border p-4 ${
            mine.kind === "help" ? "border-amberline bg-amberbg" : "border-redline bg-redbg"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[13.5px] font-semibold ${mine.kind === "help" ? "text-amber" : "text-red"}`}>
              {mine.kind === "help" ? "Help request active" : "Emergency SOS active"}
            </span>
            <StatusBadge s={mine.status} />
          </div>
          {mine.note && <p className="mt-1.5 text-[13px] leading-snug text-ink2">{mine.note}</p>}
          <div className="mt-3 flex gap-2">
            <button
              className="btn btn-secondary btn-sm flex-1"
              onClick={() => {
                setDraft({
                  id: mine.id,
                  kind: mine.kind,
                  severity: mine.severity,
                  tags: mine.tags,
                  note: mine.note,
                  gps: null,
                  manual: null,
                });
                setSosSheet(true);
              }}
            >
              Edit details
            </button>
            <button
              className="btn btn-ghost-danger btn-sm flex-1"
              onClick={() => {
                mesh.cancelSos(mine.id);
                mySos.clear();
                toast("Request cancelled", "Removed from the mesh and sync queue.");
              }}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* EMERGENCY — the hero, only red thing on the page */}
      <section className="card mt-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-redbg">
            <Siren size={18} className="text-red" />
          </span>
          <div>
            <h2 className="text-[15.5px] font-semibold text-ink">Emergency</h2>
            <p className="text-[12.5px] text-ink2">Life-threatening · immediate rescue</p>
          </div>
        </div>
        <button
          className="sos-hold btn btn-danger relative mt-4 w-full py-5 text-[17px] font-bold tracking-wide"
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          {prog > 0 && <span className="sos-fill" style={{ transform: `scaleX(${prog})` }} />}
          <span className="relative flex items-center gap-2.5">
            <Siren size={20} />
            {prog > 0 ? "Keep holding…" : "Hold for SOS"}
          </span>
        </button>
        <p className="mt-2.5 text-center text-[12px] text-ink3">
          Shares your location and medical ID with everyone nearby
        </p>
      </section>

      {/* HELP — non-urgent */}
      <section className="card mt-3 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amberbg">
            <HandHeart size={18} className="text-amber" />
          </span>
          <div>
            <h2 className="text-[15.5px] font-semibold text-ink">Need help?</h2>
            <p className="text-[12.5px] text-ink2">Not life-threatening · supplies & assistance</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {HELP_CATEGORIES.map((c) => {
            const Icon = HELP_ICONS[c.id];
            return (
              <button
                key={c.id}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-3 text-[11.5px] font-medium text-ink2 transition-all active:scale-[0.96] hover:border-line2 hover:bg-surface2"
                onClick={() => {
                  setHelpCat(c.id);
                  setHelpSheet(true);
                }}
              >
                <Icon size={19} className="text-ink2" strokeWidth={1.9} />
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* quick actions */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          className="btn border-greenline bg-greenbg text-green hover:bg-greenline/40"
          onClick={() => void checkSafe()}
        >
          <ShieldCheck size={16} />
          I'm safe
        </button>
        <Strobe />
      </div>

      {/* activity */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[14px] font-semibold text-ink">Nearby activity</h3>
          <span className="text-[12px] text-ink3">{feed.length} reports</span>
        </div>
        {feed.length === 0 ? (
          <div className="card p-5 text-center text-[13px] text-ink2">
            Nothing nearby yet. Reports from neighbours appear here as they cross the mesh.
          </div>
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {feed.slice(0, 8).map((f) => f.node)}
          </div>
        )}
      </section>

      {/* emergency detail sheet */}
      <Sheet
        open={sosSheet && !!draft}
        onClose={() => setSosSheet(false)}
        title={draft?.kind === "help" ? "Help request" : "Emergency details"}
        subtitle={
          draft?.kind === "help"
            ? "Already broadcasting — refine it for responders."
            : "Your SOS is already live. Add what rescuers should know."
        }
      >
        {draft && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-[13px] font-medium text-ink2">Severity</div>
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    className="tag-opt"
                    data-on={draft.severity === s}
                    onClick={() => setDraft({ ...draft, severity: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {draft.kind === "emergency" && (
              <div>
                <div className="mb-2 text-[13px] font-medium text-ink2">
                  What is happening? <span className="text-ink3">(tap all that apply)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SOS_TAGS.map((t) => (
                    <button
                      key={t}
                      className="tag-opt"
                      data-on={draft.tags.includes(t)}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          tags: draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t],
                        })
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-[13px] font-medium text-ink2">Note for responders</div>
              <textarea
                className="input min-h-[76px] resize-none"
                placeholder={
                  draft.kind === "help"
                    ? "e.g. 4 adults, one child, corner house near the temple"
                    : "e.g. Trapped in stairwell, leg pinned, can hear rescuers"
                }
                value={draft.note}
                maxLength={280}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium text-ink2">Location</div>
              {draft.manual ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <MapPin size={14} className="text-blue" />
                  <span className="num text-ink2">
                    Pinned {draft.manual.lat.toFixed(5)}, {draft.manual.lng.toFixed(5)}
                  </span>
                  <button
                    className="ml-auto text-[12.5px] font-medium text-blue"
                    onClick={() => setDraft({ ...draft, manual: null })}
                  >
                    Use GPS instead
                  </button>
                </div>
              ) : draft.gps ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <MapPin size={14} className="text-green" />
                  <span className="num text-ink2">
                    GPS {draft.gps.lat.toFixed(5)}, {draft.gps.lng.toFixed(5)}
                  </span>
                  {draft.gps.acc && <span className="num text-[12px] text-ink3">±{Math.round(draft.gps.acc)}m</span>}
                  <button
                    className="ml-auto text-[12.5px] font-medium text-blue"
                    onClick={() => setDraft({ ...draft, manual: { lat: CENTRE[0], lng: CENTRE[1] } })}
                  >
                    Pin manually
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-amber">GPS unavailable on this device</span>
                  <button
                    className="font-medium text-blue"
                    onClick={() => setDraft({ ...draft, manual: { lat: CENTRE[0], lng: CENTRE[1] } })}
                  >
                    Pin on map
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                className="btn btn-ghost-danger flex-1"
                onClick={() => {
                  mesh.cancelSos(draft.id);
                  setSosSheet(false);
                  toast("Request cancelled", "Removed from the mesh.");
                }}
              >
                Cancel request
              </button>
              <button className="btn btn-primary flex-1" onClick={saveDraft}>
                Save details
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* help confirm sheet */}
      <Sheet
        open={helpSheet}
        onClose={() => {
          setHelpSheet(false);
          setHelpCat(null);
        }}
        title="Request assistance"
        subtitle="Goes to volunteers and responders nearby, in order of urgency."
      >
        {helpCat && (() => {
          const cat = HELP_CATEGORIES.find((c) => c.id === helpCat);
          const Icon = HELP_ICONS[helpCat];
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-amberline bg-amberbg px-4 py-3">
                <Icon size={20} className="text-amber" />
                <span className="text-[14.5px] font-semibold text-ink">{cat?.label}</span>
              </div>
              <textarea
                className="input min-h-[76px] resize-none"
                placeholder="Anything responders should know? (optional)"
                value={helpNote}
                maxLength={200}
                onChange={(e) => setHelpNote(e.target.value)}
              />
              <button className="btn btn-primary w-full" onClick={() => void submitHelp()}>
                Send help request
              </button>
              <p className="text-center text-[12px] text-ink3">
                Shares your current location with the mesh
              </p>
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}

function FeedRow({ sos, hazard }: { sos?: SosRecord; hazard?: HazardRecord }) {
  if (sos) {
    const isHelp = sos.kind === "help";
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px]"
          style={{ background: isHelp ? "var(--color-amberbg)" : "var(--color-redbg)" }}
        >
          {isHelp ? <HandHeart size={15} className="text-amber" /> : <Siren size={15} className="text-red" />}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] text-ink">
            <span className="font-semibold">{isHelp ? "Help" : "SOS"}</span>
            <span className="text-ink2"> · {sos.note || sos.tags.join(", ") || "no details"}</span>
          </div>
          <div className="text-[11.5px] text-ink3">
            {sos.origin} · {fmtAgo(sos.ts)}
          </div>
        </div>
        <span className="ml-auto flex-none">
          <SevBadge s={sos.severity} />
        </span>
      </div>
    );
  }
  if (hazard) {
    const meta = hazardMeta[hazard.kind];
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-surface2">
          <AlertTriangle size={15} style={{ color: meta.color }} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] text-ink">
            <span className="font-semibold">{meta.label}</span>
            <span className="text-ink2"> · {hazard.note || "reported"}</span>
          </div>
          <div className="text-[11.5px] text-ink3">
            {hazard.origin} · {fmtAgo(hazard.ts)}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function SafeRow({ rec }: { rec: CheckinRecord }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-greenbg">
        <ShieldCheck size={15} className="text-green" />
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] text-ink">
          <span className="font-semibold text-green">{rec.name} is safe</span>
        </div>
        <div className="text-[11.5px] text-ink3">{fmtAgo(rec.ts)}</div>
      </div>
    </div>
  );
}

/** SOS strobe — full-screen Morse flasher for dark, low-visibility rescue. */
function Strobe() {
  const [on, setOn] = useState(false);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    if (!on) return;
    let stop = false;
    let timer = 0;
    const unit = 220;
    const seq: number[] = [];
    for (const sym of [1, 1, 1, 3, 3, 3, 1, 1, 1]) seq.push(sym, 1);
    let i = 0;
    const step = () => {
      if (stop) return;
      setLit(i % 2 === 0);
      timer = window.setTimeout(step, seq[i] * unit);
      i = (i + 1) % seq.length;
    };
    step();
    let lock: any = null;
    (navigator as any).wakeLock
      ?.request("screen")
      .then((l: any) => {
        lock = l;
      })
      .catch(() => {});
    return () => {
      stop = true;
      clearTimeout(timer);
      lock?.release?.().catch(() => {});
    };
  }, [on]);

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOn(true)}>
        <Flashlight size={16} />
        SOS strobe
      </button>
      {on && (
        <div
          className="fixed inset-0 z-[80] transition-colors duration-100"
          style={{ background: lit ? "#ffffff" : "#050507" }}
          onClick={() => setOn(false)}
          role="button"
          aria-label="Stop strobe"
        >
          {!lit && (
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-medium tracking-[0.2em] text-white/40">
              TAP ANYWHERE TO STOP
            </span>
          )}
        </div>
      )}
    </>
  );
}
