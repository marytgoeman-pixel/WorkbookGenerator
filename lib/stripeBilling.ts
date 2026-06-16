import 'server-only';
import Stripe from 'stripe';
import { PlanId } from './plans';

// Lazy Stripe client from STRIPE_SECRET_KEY. When absent, billing is a safe no-op
// and the UI falls back to the email-request path.
let stripe: Stripe | null = null;
let initialized = false;

export function getStripe(): Stripe | null {
  if (initialized) return stripe;
  initialized = true;
  const k = process.env.STRIPE_SECRET_KEY;
  stripe = k ? new Stripe(k) : null;
  return stripe;
}

export function stripeConfigured(): boolean {
  return !!getStripe();
}

export type BillingInterval = 'monthly' | 'annual';

// Price IDs come from env, one per plan/interval, e.g. STRIPE_PRICE_PRO_MONTHLY.
export function priceIdFor(plan: PlanId, interval: BillingInterval): string | undefined {
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`];
}

export async function createCheckoutUrl(opts: {
  clientId: string;
  plan: PlanId;
  interval: BillingInterval;
  origin: string;
  email?: string;
}): Promise<string | null> {
  const s = getStripe();
  let price = priceIdFor(opts.plan, opts.interval);
  if (!s || !price) return null;
  // Accept either a price ID (price_…) or a product ID (prod_…); resolve a product to its default price.
  if (price.startsWith('prod_')) {
    const product = await s.products.retrieve(price);
    const dp = product.default_price;
    const resolved = typeof dp === 'string' ? dp : dp?.id;
    if (!resolved) return null;
    price = resolved;
  }
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    client_reference_id: opts.clientId,
    customer_email: opts.email,
    metadata: { clientId: opts.clientId, plan: opts.plan },
    subscription_data: { metadata: { clientId: opts.clientId, plan: opts.plan } },
    allow_promotion_codes: true,
    success_url: `${opts.origin}/?upgraded=1`,
    cancel_url: `${opts.origin}/`,
  });
  return session.url;
}
