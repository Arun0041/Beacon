import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { useNet } from "../../lib/store";
import { CENTRE } from "../../lib/config";
import { fmtCoord } from "../../lib/geo";
import { toast } from "../../lib/toast";
import type { ShelterRecord } from "../../lib/types";

export default function Shelters() {
  const liveTick = useNet((s) => s.liveTick);
  const [rows, setRows] = useState<ShelterRecord[]>([]);
  const [form, setForm] = useState({
    name: "",
    capacity: "",
    lat: String(CENTRE[0]),
    lng: String(CENTRE[1]),
    contact: "",
  });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRows(await api.shelters());
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

  async function add() {
    if (!form.name.trim() || !isFinite(Number(form.lat)) || !isFinite(Number(form.lng))) return;
    setBusy(true);
    try {
      await api.addShelter({
        name: form.name.trim(),
        capacity: Number(form.capacity) || 0,
        lat: Number(form.lat),
        lng: Number(form.lng),
        contact: form.contact.trim(),
      });
      toast("Shelter registered", "Reaches every phone at the next mule sync.", "ok");
      setForm({ name: "", capacity: "", lat: String(CENTRE[0]), lng: String(CENTRE[1]), contact: "" });
      void refresh();
    } catch {
      toast("Could not register shelter", "Check the fields and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  const totalCapacity = rows.reduce((n, r) => n + (r.capacity || 0), 0);

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-5">
      <div className="flex items-center gap-3">
        <h1 className="text-[18px] font-semibold tracking-tight text-dink">Shelters</h1>
        <span className="text-[12px] text-dink3">
          {rows.length} sites · {totalCapacity} places
        </span>
      </div>
      <p className="mt-1 text-[13px] text-dink2">
        Registered shelters propagate to every phone — victims see them on the offline map.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border border-dline bg-dpanel">
          <div className="border-b border-dline px-4 py-2.5">
            <span className="text-[13px] font-medium text-dink">Registered sites</span>
          </div>
          <div className="divide-y divide-dline">
            {rows.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-dink2">
                No shelters yet — register the first site.
              </div>
            ) : (
              rows.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="mk-shelter flex-none">+</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-dink">{s.name}</div>
                    <div className="num mt-0.5 text-[11px] text-dink3">
                      {fmtCoord(s.lat)}, {fmtCoord(s.lng)}
                      {s.contact ? ` · ${s.contact}` : ""}
                    </div>
                  </div>
                  <span className="num flex-none text-[13px] font-medium text-dink">
                    {s.capacity} <span className="text-[11px] font-normal text-dink3">places</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-dline bg-dpanel">
          <div className="flex items-center gap-2 border-b border-dline px-4 py-2.5">
            <Plus size={14} className="text-dgreen" />
            <span className="text-[13px] font-medium text-dink">Register a shelter</span>
          </div>
          <div className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-dink2">Name</span>
              <input
                className="cmd-input w-full"
                placeholder="e.g. Government School, Model Town"
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-dink2">Capacity</span>
                <input
                  className="cmd-input num w-full"
                  placeholder="200"
                  inputMode="numeric"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value.replace(/\D/g, "") })}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-dink2">Contact</span>
                <input
                  className="cmd-input w-full"
                  placeholder="desk / phone"
                  value={form.contact}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-dink2">Latitude</span>
                <input
                  className="cmd-input num w-full"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-dink2">Longitude</span>
                <input
                  className="cmd-input num w-full"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                />
              </label>
            </div>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dgreen/50 bg-dgreenbg px-3 py-2 text-[12.5px] font-semibold text-dgreen transition-colors hover:brightness-125"
              disabled={busy || !form.name.trim()}
              onClick={() => void add()}
            >
              <MapPin size={13} />
              {busy ? "Registering…" : "Register shelter"}
            </button>
            <p className="text-center text-[11px] text-dink3">
              Appears on field maps at the next mule sync
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
