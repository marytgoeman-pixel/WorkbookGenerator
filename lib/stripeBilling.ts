import 'server-only';
import Stripe from 'stripe';
import { PlanId, isPlanId } from './plans';

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
    success_url: `${opts.origin}/?upgraded={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/`,
  });
  return session.url;
}

// Verify a completed Checkout Session on return (uses the same key that created it,
// so it works regardless of webhook timing/environment). Returns who to upgrade.
export async function confirmCheckoutSession(sessionId: string): Promise<{ clientId: string; plan: PlanId; customerId: string | null } | null> {
  const s = getStripe();
  if (!s || !sessionId.startsWith('cs_')) return null;
  try {
    const session = await s.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    const clientId = session.metadata?.clientId;
    const plan = session.metadata?.plan;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    if (paid && clientId && isPlanId(plan)) return { clientId, plan, customerId };
  } catch {
    /* ignore */
  }
  return null;
}

// Find the client's existing ACTIVE subscription by the clientId we stamp on subscription
// metadata at checkout. Used to prevent creating a duplicate subscription on "upgrade"
// (which would double-charge) and to backfill the customer id for older subscribers.
export async function findActiveSubscription(
  clientId: string,
): Promise<{ subscriptionId: string; customerId: string; plan: PlanId | null } | null> {
  const s = getStripe();
  if (!s) return null;
  try {
    const res = await s.subscriptions.search({
      query: `status:'active' AND metadata['clientId']:'${clientId}'`,
      limit: 1,
    });
    const sub = res.data[0];
    if (!sub) return null;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
    if (!customerId) return null;
    const planMeta = sub.metadata?.plan;
    return { subscriptionId: sub.id, customerId, plan: isPlanId(planMeta) ? planMeta : null };
  } catch {
    return null;
  }
}

// Open the Stripe Customer Portal so an existing subscriber can change/cancel their plan
// (edits the existing subscription — no double charge). Returns null if not configured.
// opts.flow === 'update' deep-links straight to the plan-picker for their active
// subscription, so "Change" lands on the Update-subscription page (not the portal home).
export async function createPortalUrl(
  customerId: string,
  origin: string,
  opts?: { flow?: 'update' },
): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;
  try {
    const params: Stripe.BillingPortal.SessionCreateParams = { customer: customerId, return_url: origin };
    if (opts?.flow === 'update') {
      const subs = await s.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
      const subId = subs.data[0]?.id;
      if (subId) {
        params.flow_data = {
          type: 'subscription_update',
          subscription_update: { subscription: subId },
        };
      }
    }
    const portal = await s.billingPortal.sessions.create(params);
    return portal.url;
  } catch {
    return null;
  }
}
