// Layout scan: overlapping controls, horizontal overflow, clipped text and
// controls covered by fixed bars / the theme switcher, per screen, at phone,
// tablet and desktop sizes, in Chromium. Every /api/ request is answered
// locally (nothing reaches Base44).
//
// Usage: node scripts/layout-scan.mjs [--width 320,390,768,834,1024,1440] [--shots dir]
// Exits 1 when something is found. Needs a Playwright Chromium.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const SIZES = (argOf('--width') || '320x700,390x844,768x1024,834x1194,1024x768,1024x1366,1440x900')
  .split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h: h || 900 }; });
const SHOTS = argOf('--shots');
const THEMES = (argOf('--themes') || 'light,dark').split(',');

const C = '2026-09-01T12:00:00.000000';
const ME0 = { id: 'u1', email: 'familiar.con.correo.largo@example.invalid', full_name: 'Familiar Prueba', role: 'user', family_id: 'f1', family_role: 'family_admin' };
const ME = { ...ME0 };
const DB = {
  Drawing: ['Mi casa con jardín y el sol', 'Dragón', 'Arcoíris gigante de colores', 'Gato'].map((t, i) => ({ id: `d${i}`, family_id: 'f1', title: t, creator_name: 'Sofía Alejandra', album: i % 2 ? 'Vacaciones de verano' : '', drawn_date: '2026-08-1' + i, image_file_uri: 'x', created_date: C })),
  Child: [{ id: 'k1', name: 'Sofía', family_id: 'f1' }, { id: 'k2', name: 'Mateo', family_id: 'f1' }],
  Parent: [{ id: 'p1', name: 'Mamá', family_id: 'f1' }],
  Relative: [{ id: 'r1', name: 'Abuela Carmen', family_id: 'f1' }],
  Comment: [{ id: 'c1', drawing_id: 'd0', author_name: 'Abuela Carmen', text: 'Qué bonito dibujo, mi vida. '.repeat(4), created_date: C }],
  Reaction: [{ id: 'x1', drawing_id: 'd0', author_name: 'Mamá', emoji: '❤️', created_date: C }],
  Family: [{ id: 'f1', name: 'Familia Mochi', join_code: 'ABCD-EFGH', billing_status: 'trial', trial_end_at: '2026-10-20T00:00:00Z', storage_used_bytes: 7335213 }],
};
const SVG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#fcd"/></svg>');

async function mock(ctx) {
  await ctx.route((u) => u.pathname.startsWith('/api/') || /socket\.io/.test(u.href), async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname;
    const json = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
    if (/socket\.io/.test(url.href)) return route.abort();
    if (p.includes('public-settings')) return json({ id: 'mock', public_settings: {} });
    if (p.endsWith('/entities/User/me')) return json(ME);
    let m = p.match(/\/entities\/(\w+)(?:\/(\w+))?$/);
    if (m) {
      const rows = DB[m[1]] || [];
      if (req.method() !== 'GET') return json({ id: 'mock' });
      if (m[2]) return json(rows.find((r) => r.id === m[2]) || rows[0] || {});
      return json(rows);
    }
    m = p.match(/\/functions\/(\w+)/);
    if (m) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch { /* */ }
      const a = body.action;
      if (a === 'imageUrls') return json({ urls: Object.fromEntries((body.ids || []).map((i) => [i, SVG])) });
      if (a === 'listMembers') return json({ members: [
        { id: 'u1', email: ME.email, family_role: 'family_admin' },
        { id: 'u2', email: 'otro.familiar.muy.largo@example.invalid', family_role: 'member' },
        { id: 'u3', email: 'admin2@example.invalid', family_role: 'family_admin' }] });
      if (a === 'listSessions') return json({ sessions: [{ id: 's1', device: 'Chrome en iPad', status: 'active' }, { id: 's2', device: 'Safari en iPhone', status: 'passive' }] });
      if (a === 'listJoinRequests') return json({ requests: [{ id: 'j1', email: 'solicitante.largo@example.invalid' }] });
      if (a === 'joinRequestStatus') return json({ pending: { family_name: 'Familia Pérez' } });
      return json({ ok: true });
    }
    return json({ ok: true });
  });
}

const ONLY = argOf('--only');
const SCREENS_ALL = [
  ['/login', false], ['/register', false], ['/forgot-password', false], ['/reset-password', false],
  ['/bienvenida', true], ['/', true], ['/subir', true], ['/dibujo/d0', true], ['/familia', true],
  ['/cuenta', true], ['/permisos', true], ['/soporte', true], ['/acerca', true], ['/no-existe', true],
];
const SCREENS = ONLY ? SCREENS_ALL.filter(([p]) => ONLY.split(',').includes(p)) : SCREENS_ALL;

// Runs in the page.
function analyse(W) {
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [tabindex]:not([tabindex="-1"])';
  const name = (el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`;
  const vis = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    return !el.closest('[aria-hidden="true"]');
  };
  const els = [...document.querySelectorAll(SEL)].filter(vis);
  const out = { overlap: [], overflow: [], clipped: [], covered: [], wrapped: [] };
  const items = els.filter((e) => !(e.tagName === 'INPUT' && ['checkbox', 'radio', 'file'].includes(e.type)));
  const pinned = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n; } return null; };
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  // Pinned boxes (headers, tab bar, theme switcher), in viewport coordinates.
  const pins = [...new Set([...document.querySelectorAll('body *')].filter(vis).map(pinned).filter(Boolean))]
    .filter((n) => getComputedStyle(n).pointerEvents !== 'none' && !n.closest('[data-sonner-toaster]') && !n.closest('[role=dialog]'));
  // Can a scrolling element E be moved clear of a pinned box F? (doc coords vs viewport coords)
  const clearable = (E, F) => (E.bottom - F.top <= maxScroll) || (E.top - F.bottom >= 0);
  const doc = (r) => ({ top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right });
  const inter = (A, B) => ({ w: Math.min(A.right, B.right) - Math.max(A.left, B.left), h: Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.contains(b) || b.contains(a)) continue;
    const pa = pinned(a), pb = pinned(b);
    if (pa && pb && (pa === pb)) { /* same pinned bar: compare in place */ }
    else if (pa && !pb) continue; else if (pb && !pa) continue; // handled against pin boxes below
    const { w, h } = inter(a.getBoundingClientRect(), b.getBoundingClientRect());
    if (w > 2 && h > 2) out.overlap.push(`${name(a)} x ${name(b)} (${Math.round(w)}x${Math.round(h)})`);
  }
  // Scrolling controls vs pinned boxes: only a problem if they cannot be scrolled clear.
  for (const el of items) {
    if (pinned(el)) continue;
    const r = el.getBoundingClientRect(); const D = doc(r);
    for (const F of pins) {
      if (F.contains(el)) continue;
      const fr = F.getBoundingClientRect();
      if (fr.width < 2 || fr.height < 2) continue;
      const { w } = inter(r, fr);
      if (w <= 2) continue;
      if (clearable(D, fr)) continue;
      out.covered.push(`${name(el)} behind ${name(F)} (always)`);
    }
  }
  // Pinned vs pinned (e.g. theme switcher over the tab bar controls).
  const pinnedItems = items.filter(pinned);
  for (let i = 0; i < pinnedItems.length; i++) for (let j = i + 1; j < pinnedItems.length; j++) {
    const a = pinnedItems[i], b = pinnedItems[j];
    if (pinned(a) === pinned(b) || a.contains(b) || b.contains(a)) continue;
    const { w, h } = inter(a.getBoundingClientRect(), b.getBoundingClientRect());
    if (w > 2 && h > 2) out.overlap.push(`${name(a)} x ${name(b)} (${Math.round(w)}x${Math.round(h)})`);
  }
  // A short single-line label (nav item, button) that wrapped onto two lines.
  for (const el of items) {
    if (!['A', 'BUTTON'].includes(el.tagName)) continue;
    const t = (el.textContent || '').trim();
    const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    const inner = el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (t && t.length <= 18 && inner > lh * 1.6 && cs.display.includes('flex') && cs.flexDirection === 'row') out.wrapped.push(`${name(el)} h=${Math.round(inner)}`);
  }
  const de = document.documentElement;
  if (de.scrollWidth > W + 1) out.overflow.push(`page ${de.scrollWidth}>${W}`);
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[data-theme-switcher]')) { out.overflow.push(`${name(el)} right=${Math.round(r.right)}`); }
    const cs = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && el.children.length === 0 && el.textContent.trim()) out.clipped.push(`${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
  }
  return out;
}

const server = await createServer({ server: { port: 5301, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--disable-dev-shm-usage'] });
let browser;
if (SHOTS) await mkdir(SHOTS, { recursive: true });
let bad = 0;
try {
  for (const { w, h } of SIZES) for (const theme of THEMES) {
    browser = await launch();
    const touch = w < 1024 || h > w;
    for (const [path, authed] of SCREENS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: w < 700, locale: 'es-MX' });
      await ctx.addInitScript(([t, a]) => { if (a) localStorage.setItem('base44_access_token', 'tok'); localStorage.setItem('theme', t); }, [theme, authed]);
      await mock(ctx);
      const pg = await ctx.newPage();
      ME.family_id = path === '/bienvenida' ? '' : 'f1';
      await pg.goto(base + path); await pg.waitForLoadState('networkidle').catch(() => {}); await pg.waitForTimeout(path === "/cuenta" ? 1500 : 500);
      const states = [['', null]];
      if (path === '/') states.push(['expanded-switcher', async () => { await pg.locator('[data-theme-switcher] button').first().click(); await pg.waitForTimeout(400); }]);
      for (const [label, act] of states) {
        if (act) await act();
        const r = await pg.evaluate(analyse, w);
        const full = false;
        const r2 = r; await pg.evaluate(() => window.scrollTo(0, 0));
        const merged = Object.fromEntries(Object.keys(r).map((k) => [k, [...new Set([...r[k], ...r2[k]])]]));
        const n = Object.values(merged).flat().length;
        const tag = `${w}x${h} ${theme} ${path}${label ? ' ' + label : ''}`;
        if (n) { bad++; console.log(`FAIL ${tag}\n  ` + Object.entries(merged).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join(' | ')}`).join('\n  ')); }
        if (SHOTS && (n || theme === 'light')) await pg.screenshot({ path: `${SHOTS}/${w}x${h}-${theme}-${path.replace(/\W+/g, '_')}${label}.png`, fullPage: false });
        if (act) await pg.keyboard.press('Escape');
      }
      await ctx.close();
    }
    await browser.close();
  }
} finally { await server.close(); }
console.log(bad ? `\n${bad} screen states with problems` : '\nNo overlaps, overflow or covered controls');
process.exit(bad ? 1 : 0);
