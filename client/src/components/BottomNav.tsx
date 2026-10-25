import { BookOpen, MapPin, MessageSquare, Siren, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", icon: Siren, label: "Home", end: true },
  { to: "/map", icon: MapPin, label: "Map" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/wiki", icon: BookOpen, label: "Guides" },
  { to: "/profile", icon: UserRound, label: "Profile" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[520px] pb-[max(env(safe-area-inset-bottom),4px)] pt-1.5">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-medium transition-colors ${
                isActive ? "text-blue" : "text-ink3 hover:text-ink2"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={21} strokeWidth={isActive ? 2.3 : 1.9} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
