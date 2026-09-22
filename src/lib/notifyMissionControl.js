// Mission Control's public lead ingest -- CORS-open, secret optional (see
// jospabloh/acacia-mission-control's api/ingest/lead.js and its .env.example:
// "Optional: unset, the endpoint accepts any caller, same as today"). Built
// for exactly this: any portfolio frontend posting a lead straight from the
// browser, no server hop needed.
//
// Call this wherever a customer hits a fatal (non-router) backend error, so
// a human finds out even if they never tap the WhatsApp/correo escape
// hatch. The in-app Soporte ticket path can't be the signal of record for
// this class of failure -- it goes through the same backend functions that
// might be the very thing that's down.
//
// Fire-and-forget on purpose -- a failed notification must never cost the
// customer anything, the same rule Module 8 applies to every other
// ticket-notification path in the portfolio.
export async function notifyMissionControl({ user, message }) {
  try {
    await fetch("https://control.acaciaco.com.mx/api/ingest/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "artiskids.acaciaco.com.mx",
        app_interest: "artiskids",
        type: "soporte",
        name: user?.full_name || user?.email || "Usuario de ArtisKids",
        email: user?.email,
        message,
      }),
    });
  } catch {
    // Best-effort -- see the comment above this function.
  }
}
