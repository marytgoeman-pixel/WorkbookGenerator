import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { clientIds, displayNameForId } from '@/lib/clients';
import { getStats, getTryStats, analyticsConfigured } from '@/lib/analytics';
import LogoutButton from '@/components/LogoutButton';
import ResetTrialButton from '@/components/ResetTrialButton';

function fmt(ts: number | null): string {
  if (!ts) return '—';
  // Always show Central Time (handles CST/CDT automatically) so timestamps are consistent.
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  }) + ' CT';
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  const configured = analyticsConfigured();
  const stats = configured ? await getStats(clientIds()) : [];
  const tryStats = configured ? await getTryStats() : { opens: 0, downloads: 0, recent: [] };
  const totalDownloads = stats.reduce((n, s) => n + s.downloads, 0);
  const totalLogins = stats.reduce((n, s) => n + s.logins, 0);
  const totalAi = stats.reduce((n, s) => n + s.ais, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">Logins, downloads &amp; AI credits per client</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {!configured && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-4 py-3 text-sm">
            <strong>Analytics database not connected.</strong> Add an Upstash Redis (KV) integration in Vercel
            and redeploy. Until then, counts won&apos;t be recorded. (Env vars: <code>KV_REST_API_URL</code> /
            <code>KV_REST_API_TOKEN</code>, or the Upstash equivalents.)
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl font-bold text-gray-900">{totalDownloads}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Total downloads</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl font-bold text-gray-900">{totalAi}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">AI credits used</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl font-bold text-gray-900">{totalLogins}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Total logins</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="text-3xl font-bold text-gray-900">{stats.length}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Clients</div>
          </div>
        </div>

        {/* Per-client */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3">Client</th>
                <th className="text-right px-5 py-3">Downloads</th>
                <th className="text-right px-5 py-3">AI credits</th>
                <th className="text-right px-5 py-3">Logins</th>
                <th className="text-left px-5 py-3">Last seen</th>
                <th className="text-right px-5 py-3">Trial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-gray-400">No data yet.</td></tr>
              ) : stats.map((s) => (
                <tr key={s.clientId}>
                  <td className="px-5 py-3 font-medium text-gray-800">{displayNameForId(s.clientId)}</td>
                  <td className="px-5 py-3 text-right font-semibold" style={{ color: '#E04927' }}>{s.downloads}</td>
                  <td className="px-5 py-3 text-right font-semibold" style={{ color: '#009346' }}>{s.ais}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{s.logins}</td>
                  <td className="px-5 py-3 text-gray-500">{fmt(s.lastSeen)}</td>
                  <td className="px-5 py-3 text-right"><ResetTrialButton clientId={s.clientId} name={displayNameForId(s.clientId)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Try Me — public demo (anonymous: time + approximate location only) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-800">Try Me — public demo</h2>
            <div className="text-sm text-gray-500">
              <span className="font-semibold text-gray-800">{tryStats.opens}</span> opens ·{' '}
              <span className="font-semibold" style={{ color: '#E04927' }}>{tryStats.downloads}</span> downloads
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3">Anonymous (no login) — shown by time and approximate location.</p>
          {tryStats.recent.length === 0 ? (
            <p className="text-sm text-gray-400">No demo activity yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {tryStats.recent.map((e, i) => (
                <li key={i} className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${e.event === 'download' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {e.event === 'download' ? 'download' : 'opened'}
                  </span>
                  <span className="text-gray-500">{fmt(e.ts)}</span>
                  {e.title && <span className="text-gray-700 truncate">· {e.title}</span>}
                  <span className="text-gray-400 truncate">· 📍 {e.loc || 'unknown location'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        {stats.map((s) => s.recent.length > 0 && (
          <div key={s.clientId} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">{displayNameForId(s.clientId)} — recent activity</h2>
            <ul className="space-y-1 text-sm">
              {s.recent.map((e, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${e.type === 'download' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                    {e.type}
                  </span>
                  <span className="text-gray-500">{fmt(e.ts)}</span>
                  {e.title && <span className="text-gray-700 truncate">· {e.title}</span>}
                  {e.loc && <span className="text-gray-400 truncate">· 📍 {e.loc}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>
    </div>
  );
}
