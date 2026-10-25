import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useNet } from "../../lib/store";
import { fmtAgo, fmtCoord } from "../../lib/geo";
import {
  SEVERITIES,
  STATUSES,
  type RequestKind,
  type Severity,
  type SosRecord,
  type SosStatus,
} from "../../lib/types";

const severityDark: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#60a5fa",
  low: "#9aa1ad",
};

function statusAccent(s: SosStatus): string {
  switch (s) {
    case "open":
      return "#ef4444";
    case "acknowledged":
      return "#f59e0b";
    case "dispatched":
      return "#60a5fa";
    case "rescued":
      return "#34d399";
  }
}

type KindFilter = "all" | RequestKind;

const KIND_TABS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "emergency", label: "Emergencies" },
  { id: "help", label: "Help" },
];

export default function SosTable() {
  const liveTick = useNet((s) => s.liveTick);
  const [rows, setRows] = useState<SosRecord[]>([]);
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<SosStatus | "all">("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");

  const refresh = useCallback(async () => {
    try {
      setRows(await api.sos());
      useNet.setState({ serverOnline: true });
    } catch {
      useNet.setState({ serverOnline: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 10000);
    return () => clearInterval(iv);
  }, [refresh, liveTick]);

  const filtered = rows.filter(
    (r) =>
      (kind === "all" || r.kind === kind) &&
      (status === "all" || r.status === status) &&
      (severity === "all" || r.severity === severity),
  );

  async function changeStatus(id: string, s: SosStatus) {
    try {
      await api.setStatus(id, s);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: s } : r)));
    } catch {
      void refresh();
    }
  }

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[18px] font-semibold tracking-tight text-dink">Requests</h1>
        <span className="text-[12px] text-dink3">
          {filtered.length} of {rows.length}
        </span>

        {/* kind tabs */}
        <div className="ml-2 flex rounded-lg border border-dline p-0.5">
          {KIND_TABS.map((t) => (
            <button
              key={t.id}
              className={`rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors ${
                kind === t.id ? "bg-dpanel2 text-dink" : "text-dink2 hover:text-dink"
              }`}
              onClick={() => setKind(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              className={`rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                status === s
                  ? "border-dred/60 bg-dredbg text-dred"
                  : "border-dline text-dink2 hover:text-dink"
              }`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
          <select
            className="cmd-input"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity | "all")}
          >
            <option value="all">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-dline bg-dpanel">
        <table className="w-full min-w-[920px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-dline">
              {["Time", "Kind", "Severity", "Note", "Needs", "Location", "Origin", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-[12px] font-normal text-dink3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-dink2">
                  No requests match this filter.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-dline/60 last:border-0 hover:bg-dpanel2/50">
                <td className="num whitespace-nowrap px-4 py-3 text-[12px] text-dink2">
                  {new Date(r.ts).toLocaleTimeString([], { hour12: false })}
                  <div className="text-[10.5px] text-dink3">{fmtAgo(r.ts)}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                      r.kind === "help"
                        ? "border-damber/50 bg-damber/10 text-damber"
                        : "border-dred/50 bg-dredbg text-dred"
                    }`}
                  >
                    {r.kind === "help" ? "HELP" : "SOS"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="dot" style={{ background: severityDark[r.severity] }} />
                    <span className="text-[12.5px] text-dink2">{r.severity}</span>
                  </div>
                </td>
                <td className="max-w-[230px] px-4 py-3">
                  <div className="truncate text-dink">{r.note || "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    {r.ice && (
                      <span
                        className="rounded border border-dred/50 bg-dredbg px-1.5 py-0.5 text-[10px] font-medium text-dred"
                        title={[
                          r.ice.blood && r.ice.blood !== "—" ? `Blood ${r.ice.blood}` : "",
                          r.ice.allergies ? `Allergies: ${r.ice.allergies}` : "",
                          r.ice.conditions || "",
                          r.ice.contact ? `${r.ice.contact} ${r.ice.phone}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      >
                        ICE
                      </span>
                    )}
                    {r.tags.length === 0 && !r.ice && <span className="text-dink3">—</span>}
                    {r.tags.map((t) => (
                      <span key={t} className="rounded border border-dline px-1.5 py-0.5 text-[10.5px] text-dink2">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="num whitespace-nowrap px-4 py-3 text-[12px] text-dink2">
                  {fmtCoord(r.lat)}, {fmtCoord(r.lng)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-dink2">{r.origin}</td>
                <td className="px-4 py-3">
                  <select
                    className="cmd-input border-l-[3px]"
                    style={{ borderLeftColor: statusAccent(r.status) }}
                    value={r.status}
                    onChange={(e) => void changeStatus(r.id, e.target.value as SosStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
