import { redirect } from 'next/navigation';
import { getBrandingById } from '@/lib/clients';
import TryMeApp from '@/components/TryMeApp';

export const metadata = {
  title: 'Try it free · The Learning Creative',
  description: 'Build a branded, truly fillable workbook in your browser — no signup.',
};

// Public Try Me sandbox, branded as The Learning Creative.
export default function TryPage() {
  const branding = getBrandingById('thelearningcreative');
  if (!branding) redirect('/login');
  return <TryMeApp branding={branding} />;
}
