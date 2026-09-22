// Storage quota per family, keyed by Family.billing_status. Not a secret --
// a member is allowed to know their own limit -- so src/lib/storageQuota.js
// mirrors these same two numbers for the client-side meter on Mi cuenta. If
// the numbers ever diverge, the meter shows a wrong percentage but nothing
// breaks: enforcement only ever happens here, server-side.
export const TRIAL_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB
export const PAID_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export function quotaBytesFor(billingStatus: string | undefined): number {
  if (billingStatus === "trial") return TRIAL_QUOTA_BYTES;
  if (billingStatus === "active") return PAID_QUOTA_BYTES;
  // view_only/suspended already can't reach createDrawing (canWrite's
  // billing_status gate), so 0 here is unreachable, not a real limit.
  return 0;
}
