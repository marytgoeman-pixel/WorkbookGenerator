// Shared plan catalog. The download cap per plan lives here; Stripe price IDs are
// read from env at checkout time (STRIPE_PRICE_<PLAN>_<INTERVAL>).
export type PlanId = 'starter' | 'pro' | 'agency' | 'enterprise';

export interface PlanDef {
  id: PlanId;
  name: string;
  downloadsPerMonth: number | null; // null = unlimited
}

export const PLANS: Record<PlanId, PlanDef> = {
  starter: { id: 'starter', name: 'Starter', downloadsPerMonth: 2 },
  pro: { id: 'pro', name: 'Pro', downloadsPerMonth: 4 },
  agency: { id: 'agency', name: 'Agency', downloadsPerMonth: null },
  enterprise: { id: 'enterprise', name: 'Enterprise', downloadsPerMonth: null },
};

export function isPlanId(x: unknown): x is PlanId {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(PLANS, x);
}
