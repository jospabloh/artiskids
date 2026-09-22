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
    // isRouterError tells the caller which kind it got: true means the
    // router itself ran and rejected the request for a reason a user can
    // act on (bad join code, already has a family); false means the call
    // never reached router logic at all (function not deployed, network
    // failure, a 500) -- that class must never be shown as raw text, per
    // the app standard's "no dead ends" rule (Module 10) generalized to
    // every backend call, not just login. Callers branch on it: an
    // isRouterError message is safe to show inline, anything else needs
    // the support-escape-hatch treatment instead.
    const routerMessage = err?.response?.data?.error;
    const message = routerMessage || err.message || "Algo salió mal";
    throw Object.assign(new Error(message), { status: err?.response?.status, isRouterError: Boolean(routerMessage) });
  }
}
