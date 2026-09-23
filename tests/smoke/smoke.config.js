// Per-app half of the shared smoke suite. smoke.spec.js next to this file is
// byte-identical across the portfolio — the canonical copy lives in
// `jospabloh/acacia-app-standard` → `shared/smoke/`. Change it there and copy
// it out; everything specific to this app belongs here instead.
export default {
  name: 'ArtisKids',
  url: 'https://artiskids.acaciaco.com.mx',

  // Verbatim from this repo's index.html — proves the deploy served THIS app
  // and not a stale or unrelated one.
  title: /ArtisKids/,

  // Every public screen. The mobile tab bar that shares the switcher's corner
  // only exists behind the login, so that collision is not reachable from
  // here; it was checked by hand against the rendered layout instead.
  routes: ['./', './login', './register', './forgot-password', './no-such-page'],

  theme: {
    // Tailwind's `.dark` on <html>.
    kind: 'class',
    root: '[data-theme-switcher]',
  },
};
