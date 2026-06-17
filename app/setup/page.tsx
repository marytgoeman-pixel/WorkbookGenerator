import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getAccountById } from '@/lib/accounts';
import TemplateBuilder from '@/components/TemplateBuilder';

export const metadata = { title: 'Build your template · The Learning Creative' };

// The self-serve template builder. Only self-serve accounts (id "u_…") use it.
export default async function SetupPage() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');
  if (!session.clientId.startsWith('u_')) redirect('/');
  const acct = await getAccountById(session.clientId);
  if (!acct) redirect('/login');
  return <TemplateBuilder initial={acct.branding} />;
}
