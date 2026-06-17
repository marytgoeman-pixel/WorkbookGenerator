import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getBrandingById } from '@/lib/clients';
import { getAccountById } from '@/lib/accounts';
import { getBrandingOverride, mergeBranding } from '@/lib/brandStore';
import TemplateBuilder from '@/components/TemplateBuilder';

export const metadata = { title: 'Build your template · The Learning Creative' };

// The template builder — used by self-serve accounts AND managed clients (who edit a
// template override on top of their base branding).
export default async function SetupPage() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');
  if (session.isAdmin) redirect('/admin');

  const managed = getBrandingById(session.clientId);
  if (managed) {
    const ov = await getBrandingOverride(session.clientId);
    return <TemplateBuilder initial={mergeBranding(managed, ov)} managed />;
  }
  const acct = await getAccountById(session.clientId);
  if (!acct) redirect('/login');
  return <TemplateBuilder initial={acct.branding} />;
}
