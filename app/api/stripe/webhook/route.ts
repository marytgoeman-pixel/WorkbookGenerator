import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripeBilling';
import { setStoredPlan, setStoredCustomer } from '@/lib/planStore';
import { isPlanId, PlanId } from '@/lib/plans';

const customerId = (c: string | { id: string } | null | undefined): string | null =>
  typeof c === 'string' ? c : c?.id ?? null;

export const runtime = 'nodejs';

// Stripe calls this after payment events. Verifies the signature, then flips the
// client's plan in the override store so their cap updates automatically.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const sig = req.headers.get('stripe-signature') || '';
  const raw = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session;
      const clientId = s.metadata?.clientId;
      const plan = s.metadata?.plan;
      const cust = customerId(s.customer);
      if (clientId && cust) await setStoredCustomer(clientId, cust);
      if (clientId && isPlanId(plan)) await setStoredPlan(clientId, plan);
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const clientId = sub.metadata?.clientId;
      const plan = sub.metadata?.plan;
      const cust = customerId(sub.customer);
      if (clientId && cust) await setStoredCustomer(clientId, cust);
      if (clientId && isPlanId(plan) && (sub.status === 'active' || sub.status === 'trialing')) {
        await setStoredPlan(clientId, plan);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const clientId = sub.metadata?.clientId;
      const cust = customerId(sub.customer);
      if (clientId) {
        // Don't blindly downgrade — the client may still have ANOTHER active subscription
        // (e.g. they cancelled a duplicate). Reflect a remaining active sub's plan if present.
        let nextPlan: PlanId = 'starter'; // truly lapsed → back to Starter
        if (cust) {
          try {
            const actives = await stripe.subscriptions.list({ customer: cust, status: 'active', limit: 10 });
            const other = actives.data.find(
              (x) => x.id !== sub.id && x.metadata?.clientId === clientId && isPlanId(x.metadata?.plan),
            );
            if (other && isPlanId(other.metadata?.plan)) nextPlan = other.metadata.plan as PlanId;
          } catch { /* fall back to starter */ }
        }
        await setStoredPlan(clientId, nextPlan);
      }
    }
  } catch (e) {
    console.error('Stripe webhook handling failed:', e);
  }

  return NextResponse.json({ received: true });
}
