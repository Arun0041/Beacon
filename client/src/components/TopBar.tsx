import { Link } from "react-router-dom";
import { Gauge } from "lucide-react";
import { useNet } from "../lib/store";

/** Minimal citizen header — identity left, console link + status dot + avatar right.
 * Battery/signal details live on the Profile page, not here. */
export default function TopBar() {
  const me = useNet((s) => s.me);
  const conn = useNet((s) => s.conn);
  const serverOnline = useNet((s) => s.serverOnline);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[520px] items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-red">
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="text-[15.5px] font-bold tracking-tight text-ink">Beacon</span>
        </Link>

        <div className="ml-auto flex items-center gap-2.5">
          <span
            className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink3"
            title={
              conn === "online"
                ? serverOnline
                  ? "Mesh linked · server syncing"
                  : "Mesh linked · no server"
                : "Looking for nearby devices"
            }
          >
            <span className={`dot ${conn === "online" ? (serverOnline ? "dot-ok" : "dot-warn") : "dot-bad"}`} />
            {conn === "online" ? "Linked" : "Scanning"}
          </span>
          <Link
            to="/dashboard"
            aria-label="Command console"
            title="Responder command console"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-surface2 hover:text-ink"
          >
            <Gauge size={17} />
          </Link>
          <Link
            to="/profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bluebg text-[13px] font-semibold text-blue ring-1 ring-blueline"
            aria-label="Profile"
          >
            {(me?.name ?? "?").slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </div>
    </header>
  );
}
