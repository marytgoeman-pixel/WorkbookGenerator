// Simple feature flags (client-safe — no 'server-only'). Flip and redeploy to change behavior.

// Self-serve sign-ups (the /register flow). When false, new self-serve trial accounts are
// paused: /register shows a "paused" notice and /api/register rejects new accounts. Existing
// client logins and the public Try Me sandbox (/try) are unaffected.
// To re-open sign-ups: set this to true and redeploy.
export const SIGNUPS_OPEN = false;
