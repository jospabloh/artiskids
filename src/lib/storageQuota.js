// Client-side mirror of base44/functions/content/_storageQuota.ts's two
// numbers, for the Mi cuenta storage meter -- a member is allowed to know
// their own limit. Enforcement never happens here; if this drifts from the
// server file, the meter just shows a wrong percentage, nothing breaks.
export const TRIAL_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB
export const PAID_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export function quotaBytesFor(billingStatus) {
  if (billingStatus === "trial") return TRIAL_QUOTA_BYTES;
  if (billingStatus === "active") return PAID_QUOTA_BYTES;
  return 0;
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
