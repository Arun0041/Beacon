import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { dismiss, getToasts, subscribeToasts } from "../lib/toast";
import { CircleCheck, CircleX, Info } from "lucide-react";

/** Mount once at the app root; call toast() from anywhere. */
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[70] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", duration: 0.45, bounce: 0.18 }}
            onClick={() => dismiss(t.id)}
            role="status"
            className="pointer-events-auto flex w-full max-w-[400px] items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left shadow-[0_12px_32px_rgba(16,24,40,0.18)]"
          >
            <span className="mt-0.5 flex-none">
              {t.variant === "ok" ? (
                <CircleCheck size={17} className="text-green" />
              ) : t.variant === "error" ? (
                <CircleX size={17} className="text-red" />
              ) : (
                <Info size={17} className="text-blue" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold leading-snug text-ink">{t.title}</span>
              {t.description && (
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink2">{t.description}</span>
              )}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
