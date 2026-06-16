import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getBrandingById } from '@/lib/clients';
import { getStoredPlan } from '@/lib/planStore';
import WorkbookApp from '@/components/WorkbookApp';

export default async function Home() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');
  if (session.isAdmin) redirect('/admin');

  const base = getBrandingById(session.clientId);
  if (!base) redirect('/login');

  // A paid upgrade (recorded by the Stripe webhook) overrides the default plan
  const stored = await getStoredPlan(session.clientId);
  const branding = stored
    ? { ...base, plan: { name: stored.name, downloadsPerMonth: stored.downloadsPerMonth } }
    : base;

  return <WorkbookApp branding={branding} />;
}
