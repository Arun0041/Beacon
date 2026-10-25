import { ChevronRight, Droplets, HeartPulse, HousePlus, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { GUIDES } from "../../data/wiki";

const ICONS = {
  cpr: HeartPulse,
  bleeding: Droplets,
  earthquake: HousePlus,
  flood: Waves,
} as const;

export default function Wiki() {
  return (
    <div className="mx-auto h-full max-w-[520px] overflow-y-auto px-4 pb-24">
      <div className="pt-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Survival guides</h1>
        <p className="mt-0.5 text-[13.5px] text-ink2">
          Cached on this device — available with zero connectivity.
        </p>
      </div>
      <div className="mt-4 space-y-2.5">
        {GUIDES.map((g) => {
          const Icon = ICONS[g.slug as keyof typeof ICONS] ?? HeartPulse;
          return (
            <Link
              key={g.slug}
              to={`/wiki/${g.slug}`}
              className="card flex items-center gap-3.5 p-4 transition-colors hover:border-line2"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-redbg">
                <Icon size={20} className="text-red" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-ink">{g.title}</span>
                <span className="mt-0.5 block truncate text-[13px] text-ink2">{g.summary}</span>
              </span>
              <span className="flex-none text-[12px] text-ink3">{g.minutes} min</span>
              <ChevronRight size={16} className="flex-none text-ink3" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
