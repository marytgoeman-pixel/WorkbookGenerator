import { useEffect } from 'react';

// Pings the server on mount, every ~45s, and on tab-close so the admin can see how long
// a session lasted (start → last ping). The scope (which client, or the public Try Me)
// is derived server-side from the session cookie, so this hook needs no arguments.
export function useSessionHeartbeat() {
  useEffect(() => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const url = '/api/track-session';
    const send = (final?: boolean) => {
      const body = JSON.stringify({ id });
      if (final && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    };
    send();
    const iv = setInterval(() => send(), 45000);
    const onVis = () => { if (document.visibilityState === 'hidden') send(true); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', () => send(true));
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}
