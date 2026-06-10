import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getBrandingById } from '@/lib/clients';
import WorkbookApp from '@/components/WorkbookApp';

export default async function Home() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');

  const branding = getBrandingById(session.clientId);
  if (!branding) redirect('/login');

  return <WorkbookApp branding={branding} />;
}
