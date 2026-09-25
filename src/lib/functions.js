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
    // A 5xx is never a router rejection, even with an {error} body: its text
    // is not something the user can act on.
    const status = err?.response?.status;
    // The server refused a token issued before the user's session cutoff
    // (someone closed their sessions). Only a fresh login fixes that, so end
    // this one instead of retrying with a token that will never work again.
    if (status === 401 && err?.response?.data?.error === "session revoked") {
      base44.auth.logout();
    }
    const routerMessage = status && status < 500 ? err?.response?.data?.error : undefined;
    const message = routerMessage || err.message || "Algo salió mal";
    throw Object.assign(new Error(message), { status, isRouterError: Boolean(routerMessage) });
  }
}
