import 'server-only';

// Sends the "Request access" inquiry via Resend's HTTP API (no SDK dependency — just fetch).
// Safe no-op (returns false) when RESEND_API_KEY isn't configured, so the UI can fall back
// to opening the visitor's mail app and a missing key never blocks a prospect.
export interface Inquiry {
  name: string;
  email: string;
  company?: string;
  plan?: string;
  message?: string;
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

const esc = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendInquiryEmail(i: Inquiry): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const to = process.env.INQUIRY_TO || 'mary@thelearningcreative.com';
  // Until a domain is verified in Resend, the onboarding sender works (delivering to the
  // account owner's address). Override with a verified address via INQUIRY_FROM.
  const from = process.env.INQUIRY_FROM || 'Workbook Inquiries <onboarding@resend.dev>';
  const html =
    `<h2>New workbook access request</h2>` +
    `<p><b>Name:</b> ${esc(i.name)}</p>` +
    `<p><b>Email:</b> ${esc(i.email)}</p>` +
    `<p><b>Company / brand:</b> ${esc(i.company || '—')}</p>` +
    `<p><b>Plan interested in:</b> ${esc(i.plan || '—')}</p>` +
    `<p><b>What they’d use it for:</b><br>${esc(i.message || '—').replace(/\n/g, '<br>')}</p>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: i.email, // replying goes straight to the prospect
        subject: `Workbook access request from ${i.name || 'a prospect'}`,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
