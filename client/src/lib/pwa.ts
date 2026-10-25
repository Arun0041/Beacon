/* PWA install capture — must be imported before the browser fires
 * beforeinstallprompt (main.tsx imports it at module scope). */

let deferred: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferred = e;
  });
}

export function canInstall(): boolean {
  return !!deferred;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  return choice?.outcome === "accepted";
}
