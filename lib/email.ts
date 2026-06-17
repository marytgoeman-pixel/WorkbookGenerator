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

// Sends an email-confirmation link to a new self-serve registrant.
export async function sendVerifyEmail(to: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.INQUIRY_FROM || 'The Learning Creative <onboarding@resend.dev>';
  const html =
    `<h2>Confirm your email</h2>` +
    `<p>Welcome! Confirm your email to start building your branded, fillable workbook template.</p>` +
    `<p><a href="${esc(link)}" style="background:#163446;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Confirm my email</a></p>` +
    `<p style="color:#6b7280;font-size:13px">Or paste this link into your browser:<br>${esc(link)}</p>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: 'Confirm your email — The Learning Creative', html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Sends a password-reset link.
export async function sendResetEmail(to: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.INQUIRY_FROM || 'The Learning Creative <onboarding@resend.dev>';
  const html =
    `<h2>Reset your password</h2>` +
    `<p>Click below to set a new password. This link expires in 1 hour.</p>` +
    `<p><a href="${esc(link)}" style="background:#163446;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Set a new password</a></p>` +
    `<p style="color:#6b7280;font-size:13px">If you didn't request this, you can ignore this email.<br>Or paste this link: ${esc(link)}</p>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: 'Reset your password — The Learning Creative', html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
