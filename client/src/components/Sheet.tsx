import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

export default function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClose}
          />
          <motion.div
            className="absolute bottom-0 left-1/2 max-h-[88dvh] w-full max-w-[520px] -translate-x-1/2 overflow-y-auto rounded-t-[24px] border-t border-line bg-surface px-5 pb-9 pt-3 shadow-[0_-12px_48px_rgba(16,24,40,0.22)]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduce
                ? { duration: 0.15, ease: "easeOut" }
                : { duration: 0.36, ease: [0.32, 0.72, 0, 1] }
            }
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line2" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink2">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface2 text-ink2 transition-colors hover:text-ink"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
