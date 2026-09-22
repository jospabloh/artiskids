import { base44 } from "@/api/base44Client";

// Every Safe function router (family/content/support/session) takes a flat
// body: { action, ...params } -- see base44/functions/*/entry.ts's own
// comment on why (shared/session/useSessionManager.js's call shape forced
// the convention, and the rest followed it for consistency).
export async function callFunction(name, action, params = {}) {
  try {
    const res = await base44.functions.invoke(name, { action, ...params });
    return res?.data;
  } catch (err) {
    // Router errors come back as {error: "message"} in the response body
    // (axios shape: err.response.data.error) -- surface that plain string
    // to the caller instead of axios's own generic "Request failed" text.
    const message = err?.response?.data?.error || err.message || "Algo salió mal";
    throw Object.assign(new Error(message), { status: err?.response?.status });
  }
}
