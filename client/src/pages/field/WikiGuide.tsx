import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, PhoneCall } from "lucide-react";
import { EMERGENCY_NUMBER, GUIDES } from "../../data/wiki";

function Metronome() {
  const [on, setOn] = useState(false);
  const [tick, setTick] = useState(false);

  useEffect(() => {
    if (!on) return;
    const period = Math.round(60000 / 110);
    const iv = setInterval(() => {
      setTick((t) => !t);
      navigator.vibrate?.(20);
    }, period);
    return () => clearInterval(iv);
  }, [on]);

  return (
    <div className="card mt-4 flex items-center gap-4 p-4">
      <div
        className="h-11 w-11 flex-none rounded-full bg-red transition-transform duration-100"
        style={{ transform: tick ? "scale(0.82)" : "scale(1.05)" }}
      />
      <div>
        <div className="text-[13.5px] font-semibold text-ink">Compression metronome</div>
        <div className="num mt-0.5 text-[12.5px] text-ink2">110 BPM — push on every pulse</div>
      </div>
      <button className={`btn btn-sm ml-auto ${on ? "btn-secondary" : "btn-danger"}`} onClick={() => setOn(!on)}>
        {on ? "Stop" : "Start"}
      </button>
    </div>
  );
}

export default function WikiGuide() {
  const { slug } = useParams();
  const guide = GUIDES.find((g) => g.slug === slug);

  if (!guide) {
    return (
      <div className="mx-auto h-full max-w-[520px] overflow-y-auto px-4 pb-24">
        <p className="mt-10 text-center text-sm text-ink2">Guide not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-[520px] overflow-y-auto px-4 pb-24">
      <Link to="/wiki" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink2 hover:text-ink">
        <ChevronLeft size={15} />
        All guides
      </Link>

      <h1 className="mt-3 text-[24px] font-semibold tracking-tight text-ink">{guide.title}</h1>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">{guide.summary}</p>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-redline bg-redbg p-3.5">
        <PhoneCall size={18} className="flex-none text-red" />
        <div className="text-[13px] leading-snug text-ink">
          If any mobile signal exists, call <span className="font-semibold">{EMERGENCY_NUMBER}</span> —
          it reaches the nearest working tower.
        </div>
        <a href={`tel:${EMERGENCY_NUMBER}`} className="btn btn-danger btn-sm ml-auto flex-none">
          Call
        </a>
      </div>

      {guide.slug === "cpr" && <Metronome />}

      <div className="mt-6 space-y-7">
        {guide.sections.map((sec) => (
          <section key={sec.h}>
            <h2 className="mb-2.5 text-[16px] font-semibold text-ink">{sec.h}</h2>
            <ol className="space-y-2.5">
              {sec.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-ink">
                  <span className="num mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-surface2 text-[11.5px] font-semibold text-ink2">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <p className="mt-9 border-t border-line pt-4 text-[12px] leading-relaxed text-ink3">
        These guides support, but do not replace, certified first-aid training. When responders
        arrive, follow their instructions.
      </p>
    </div>
  );
}
