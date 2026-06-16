import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getBrandingById } from '@/lib/clients';
import { getStoredPlan, setStoredPlan, ensureTrialStart, getStoredCustomer, setStoredCustomer } from '@/lib/planStore';
import { confirmCheckoutSession, findActiveSubscription } from '@/lib/stripeBilling';
import { PLANS } from '@/lib/plans';
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

  // The permanent demo account is ALWAYS a trial (ignore any stale override) so it always
  // shows the trial → "Choose a plan" experience for prospects.
  const isDemo = session.clientId === 'trialdemo';

  let stored = isDemo ? null : await getStoredPlan(session.clientId);
  let storedCustomer = isDemo ? null : await getStoredCustomer(session.clientId);

  // SELF-HEAL: the live Stripe subscription is the source of truth. If the client has a
  // subscription (or a stored override that might be stale), reconcile the plan + customer
  // id against Stripe so a stale value can't strand them on the wrong plan/screen. We only
  // CORRECT when an active sub is actually found — never downgrade on a (lagging) empty
  // result, which would wrongly revert someone who just subscribed.
  if (!isDemo && (stored || storedCustomer)) {
    const active = await findActiveSubscription(session.clientId);
    if (active?.plan) {
      if (active.plan !== stored?.id) { await setStoredPlan(session.clientId, active.plan); stored = PLANS[active.plan]; }
      if (active.customerId !== storedCustomer) { await setStoredCustomer(session.clientId, active.customerId); storedCustomer = active.customerId; }
    }
  }

  // A paid plan (stored override, self-healed above) overrides the trial.
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
  const manageable = !!storedCustomer;

  return <WorkbookApp branding={branding} trial={trial} manageable={manageable} />;
}
