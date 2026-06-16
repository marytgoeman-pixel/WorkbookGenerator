import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getBrandingById } from '@/lib/clients';
import { getStoredPlan, ensureTrialStart } from '@/lib/planStore';
import WorkbookApp, { TrialInfo } from '@/components/WorkbookApp';

const TRIAL_DAYS = 7;

export default async function Home() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');
  if (session.isAdmin) redirect('/admin');

  const base = getBrandingById(session.clientId);
  if (!base) redirect('/login');

  // A paid upgrade (recorded by the Stripe webhook) overrides everything, incl. the trial.
  const stored = await getStoredPlan(session.clientId);
  let branding = base;
  let trial: TrialInfo = null;

  if (stored) {
    branding = { ...base, plan: { name: stored.name, downloadsPerMonth: stored.downloadsPerMonth } };
  } else if (base.plan?.trial) {
    const start = await ensureTrialStart(session.clientId);
    const msLeft = start + TRIAL_DAYS * 86400000 - Date.now();
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
    trial = { state: msLeft > 0 ? 'active' : 'expired', daysLeft };
  }

  return <WorkbookApp branding={branding} trial={trial} />;
}
