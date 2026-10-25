import type { HazardKind, RequestKind, Severity, SosStatus } from "../lib/types";

export const severityColor: Record<Severity, string> = {
  critical: "#dc2626",
  high: "#d97706",
  medium: "#2563eb",
  low: "#98a2b3",
};

const sevStyle: Record<Severity, string> = {
  critical: "bg-redbg text-red border-redline",
  high: "bg-amberbg text-amber border-amberline",
  medium: "bg-bluebg text-blue border-blueline",
  low: "bg-surface2 text-ink2 border-line2",
};

export function SevBadge({ s }: { s: Severity }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sevStyle[s]}`}>
      {s}
    </span>
  );
}

export function KindBadge({ kind }: { kind: RequestKind }) {
  return kind === "help" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-amberline bg-amberbg px-2 py-0.5 text-[11px] font-semibold text-amber">
      Help
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-redline bg-redbg px-2 py-0.5 text-[11px] font-semibold text-red">
      SOS
    </span>
  );
}

const statusColor: Record<SosStatus, string> = {
  open: "#dc2626",
  acknowledged: "#d97706",
  dispatched: "#2563eb",
  rescued: "#059669",
};

export function StatusBadge({ s }: { s: SosStatus }) {
  return (
    <span className="chip">
      <span className="dot" style={{ background: statusColor[s] }} />
      {s}
    </span>
  );
}

export const hazardMeta: Record<
  HazardKind,
  { color: string; label: string }
> = {
  flood: { color: "#2563eb", label: "Flood" },
  fire: { color: "#d97706", label: "Fire" },
  rubble: { color: "#6b7280", label: "Rubble" },
  other: { color: "#475467", label: "Other" },
};
