import { consumeVerifyToken } from '@/lib/accounts';

export const metadata = { title: 'Confirm your email · The Learning Creative' };

const NAVY = '#163446', GREEN = '#009346';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const ok = sp?.token ? !!(await consumeVerifyToken(sp.token)) : false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8 text-center">
        <div className="text-4xl mb-3">{ok ? '✅' : '⚠️'}</div>
        {ok ? (
          <>
            <h1 className="text-lg font-bold" style={{ color: NAVY }}>Email confirmed</h1>
            <p className="text-sm text-gray-500 mt-2">Your account is verified. Sign in to build your branded workbook template.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold" style={{ color: NAVY }}>Link invalid or expired</h1>
            <p className="text-sm text-gray-500 mt-2">This confirmation link is no longer valid. Try registering again, or sign in if you already confirmed.</p>
          </>
        )}
        <a href="/login" className="inline-block mt-5 px-5 py-2.5 rounded-xl font-semibold text-white" style={{ backgroundColor: ok ? GREEN : NAVY }}>
          Go to sign in →
        </a>
      </div>
    </div>
  );
}
