/**
 * Toast store — Sonner-style API: mount <Toaster/> once, call toast() anywhere.
 * Toasts enter/exit through the same edge (spatial consistency), use CSS-ish
 * spring timing via Motion, and auto-dismiss. Interruptible by design.
 */

export type ToastVariant = "ok" | "error" | "info";
export type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 1;

function emit() {
  for (const l of listeners) l();
}

export function toast(title: string, description?: string, variant: ToastVariant = "info") {
  const item: ToastItem = { id: seq++, title, description, variant };
  items = [...items, item];
  emit();
  setTimeout(() => dismiss(item.id), 4500);
  return item.id;
}

export function dismiss(id: number) {
  if (items.some((t) => t.id === id)) {
    items = items.filter((t) => t.id !== id);
    emit();
  }
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return items;
}
