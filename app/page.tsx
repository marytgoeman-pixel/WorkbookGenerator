import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getBrandingById } from '@/lib/clients';
import { getStoredPlan, setStoredPlan, ensureTrialStart, getStoredCustomer, setStoredCustomer } from '@/lib/planStore';
import { confirmCheckoutSession, findActiveSubscription } from '@/lib/stripeBilling';
import WorkbookApp, { TrialInfo } from '@/components/WorkbookApp';

const TRIAL_DAYS = 7;

export default async function Home({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');
  if (session.isAdmin) redirect('/admin');

  const base = getBrandingById(session.clientId);
  if (!base) redirect('/login');

  // Returning from Stripe Checkout: confirm the session directly and activate the plan
  // immediately (doesn't rely on the webhook landing first).
  const sp = await searchParams;
  if (sp?.upgraded && sp.upgraded.startsWith('cs_')) {
    const confirmed = await confirmCheckoutSession(sp.upgraded);
    if (confirmed && confirmed.clientId === session.clientId) {
      await setStoredPlan(confirmed.clientId, confirmed.plan);
      if (confirmed.customerId) await setStoredCustomer(confirmed.clientId, confirmed.customerId);
    }
  }

  // A paid upgrade (confirmed above or recorded by the webhook) overrides everything, incl. the trial.
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

  // A subscriber (has a stored Stripe customer) manages their plan via the Customer Portal
  // instead of buying again through Checkout — prevents creating a duplicate subscription.
  let storedCustomer = await getStoredCustomer(session.clientId);
  // Backfill the customer id for subscribers who paid before we tracked it, so they get
  // the "Manage" (portal) experience instead of being offered Checkout again.
  if (!storedCustomer && stored) {
    const active = await findActiveSubscription(session.clientId);
    if (active) {
      await setStoredCustomer(session.clientId, active.customerId);
      storedCustomer = active.customerId;
    }
  }
  const manageable = !!storedCustomer;

  return <WorkbookApp branding={branding} trial={trial} manageable={manageable} />;
}
