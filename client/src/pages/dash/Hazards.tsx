import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useNet } from "../../lib/store";
import { fmtAgo, fmtCoord } from "../../lib/geo";
import { hazardMeta } from "../../components/Badge";
import type { HazardRecord } from "../../lib/types";

export default function Hazards() {
  const liveTick = useNet((s) => s.liveTick);
  const [rows, setRows] = useState<HazardRecord[]>([]);

  const refresh = useCallback(async () => {
    try {
      setRows(await api.hazards());
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

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-5">
      <div className="flex items-center gap-3">
        <h1 className="text-[18px] font-semibold tracking-tight text-dink">Hazards</h1>
        <span className="text-[12px] text-dink3">{rows.length} reported</span>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dline bg-dpanel p-8 text-center text-[13px] text-dink2">
          No hazard reports synced yet.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((h) => {
            const color = hazardMeta[h.kind]?.color ?? "#9aa1ad";
            return (
              <div key={h.id} className="rounded-xl border border-dline bg-dpanel p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full border px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{ color, borderColor: `${color}66` }}
                  >
                    {hazardMeta[h.kind]?.label ?? "Hazard"}
                  </span>
                  <span className="num ml-auto text-[11px] text-dink3">{fmtAgo(h.ts)}</span>
                </div>
                <p className="mt-2.5 min-h-[2.6em] text-[13px] leading-relaxed text-dink">
                  {h.note || "No description."}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="num text-[11px] text-dink3">
                    {fmtCoord(h.lat)}, {fmtCoord(h.lng)}
                  </span>
                  <span className="text-[11px] text-dink3">{h.origin}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
