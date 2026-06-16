'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Admin: re-arm a client's free trial (clears plan override, restarts the 7 days,
// zeroes download counts) so it can be demoed fresh.
export default function ResetTrialButton({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    if (busy) return;
    if (!confirm(`Reset ${name} to a fresh 7-day trial (1 download)? This clears their plan and download history.`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/reset-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      if (res.ok) { setDone(true); router.refresh(); setTimeout(() => setDone(false), 2500); }
      else alert('Reset failed.');
    } catch {
      alert('Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={reset} disabled={busy}
      className="text-xs font-medium rounded-lg px-2.5 py-1 border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 transition-colors">
      {busy ? '…' : done ? '✓ Reset' : '↺ Reset trial'}
    </button>
  );
}
