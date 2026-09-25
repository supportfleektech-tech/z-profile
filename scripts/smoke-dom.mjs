/**
 * DOM-level smoke test for the production bundle.
 *
 * No browser binary exists in this sandbox (Playwright's CDN is blocked), so
 * screenshots and visual/responsive checks are impossible. This is the next best
 * thing: it boots the REAL `dist/index.html` bundle inside jsdom and drives it,
 * catching the class of defect `tsc` and `vite build` cannot — runtime crashes,
 * undefined property access, bad hook order, routes that throw when rendered, and
 * RBAC guards that don't actually block.
 *
 * Each persona gets a FRESH jsdom instance so sessions never bleed into each other.
 *
 * Layout is NOT verified: jsdom performs no layout, so this proves "renders without
 * throwing and produces the right DOM" — never "looks right".
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const HTML_PATH = 'dist/index.html';
const ORIGIN = 'http://localhost:5173';
const STORAGE_KEY = 'iprs.v1.workspace';

/** jsdom does not implement these; they are environment noise, not app defects. */
const NOISE = /Not implemented|Could not parse CSS|Could not load|Error: Uncaught\[|scrollTo\(\) method|navigation \(except hash/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadBuild() {
  const html = readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('could not find inlined module bundle');
  const code = m[1];
  if (/^\s*(?:import|export)\s/m.test(code)) throw new Error('bundle has top-level ESM syntax');
  return { markup: html.replace(m[0], ''), code };
}

/** Boot one isolated instance of the app and return handles to drive it. */
function bootApp() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!NOISE.test(e.message)) errors.push(`jsdomError: ${e.message}`); });
  vc.on('error', (...a) => { const s = a.map(String).join(' '); if (!NOISE.test(s)) errors.push(`console.error: ${s}`); });

  const { markup, code } = loadBuild();
  const dom = new JSDOM(markup, { url: `${ORIGIN}/`, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;

  /* ---- polyfill the browser APIs jsdom lacks ---- */
  window.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  window.scrollTo = () => {};
  window.scroll = () => {};
  window.print = () => {};
  window.Element.prototype.scrollIntoView = function () {};
  window.Element.prototype.scrollTo = function () {};
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {}, readText: async () => '' }, configurable: true });

  // Deterministic LOCAL adapter (no backend reachable from jsdom).
  window.fetch = async () => { throw new TypeError('Failed to fetch'); };

  // Capture blob downloads to prove "Download PDF" produces a real file.
  const downloads = [];
  window.URL.createObjectURL = (blob) => {
    const rec = { size: blob?.size ?? 0, type: blob?.type ?? '', head: null };
    downloads.push(rec);
    // Read the leading bytes asynchronously to verify the PDF magic number.
    if (blob?.slice) {
      blob.slice(0, 8).text?.().then((t) => { rec.head = t; }).catch(() => {});
    }
    // Persist to disk so the artifact can be validated by an external PDF parser.
    if (process.env.SMOKE_DUMP_DIR && blob?.arrayBuffer) {
      blob.arrayBuffer().then((buf) => {
        mkdirSync(process.env.SMOKE_DUMP_DIR, { recursive: true });
        const name = rec.filename ?? `download-${downloads.length}.bin`;
        rec.path = `${process.env.SMOKE_DUMP_DIR}/${name}`;
        writeFileSync(rec.path, Buffer.from(buf));
      }).catch(() => {});
    }
    return `blob:mock/${downloads.length}`;
  };
  window.URL.revokeObjectURL = () => {};
  const origClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () {
    if (this.download && downloads.length) {
      const rec = downloads[downloads.length - 1];
      rec.filename = this.download;
      if (process.env.SMOKE_DUMP_DIR && rec.path) rec.path = `${process.env.SMOKE_DUMP_DIR}/${this.download}`;
    }
    return origClick.apply(this, arguments);
  };

  window.addEventListener('error', (e) => { if (!NOISE.test(e.message ?? '')) errors.push(`onerror: ${e.message}`); });
  window.addEventListener('unhandledrejection', (e) => { const s = e.reason?.message ?? String(e.reason); if (!NOISE.test(s)) errors.push(`unhandledrejection: ${s}`); });

  if (!window.document.getElementById('root')) throw new Error('#root missing before eval');
  window.eval(code);

  /* ---- drive helpers ---- */
  const $ = (s) => window.document.querySelector(s);
  const $$ = (s) => [...window.document.querySelectorAll(s)];
  const text = () => window.document.body.textContent ?? '';

  const setInput = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  const buttons = () => $$('button, a[role="button"], [role="menuitem"]');
  const findButton = (label) => buttons().find((b) => (b.textContent ?? '').trim().toLowerCase().includes(label.toLowerCase()));
  const goto = async (hash) => {
    window.location.hash = hash;
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await sleep(260);
  };

  return { window, dom, errors, downloads, $, $$, text, setInput, click, findButton, goto, buttons };
}

const results = [];
const check = (name, cond, detail = '') => {
  const ok = !!cond;
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) throw new Error(`Smoke assertion failed: ${name}`);
};

/* -------------------------------------------------------------------------- */

const PERSONAS = [
  {
    email: 'superadmin@iprs.co.ke', label: 'Super Admin',
    expect: /Platform Control|Super Admin/i,
    routes: ['/dashboard', '/admin', '/settings', '/audit', '/payments', '/providers', '/wallet', '/pricing', '/api-docs', '/analytics', '/cases', '/billing', '/notifications', '/profile', '/report', '/identity-profile'],
    denied: [],
  },
  {
    email: 'admin@iprs.co.ke', label: 'Admin',
    expect: /Operations|Admin Dashboard/i,
    routes: ['/dashboard', '/admin', '/settings', '/audit', '/payments', '/providers', '/wallet', '/pricing', '/api-docs', '/analytics', '/cases', '/billing', '/notifications', '/profile', '/report'],
    denied: [],
  },
  {
    email: 'analyst@iprs.co.ke', label: 'User · Analyst',
    expect: /Workspace|Good (morning|afternoon|evening)/i,
    routes: ['/dashboard', '/search', '/cases', '/wallet', '/billing', '/pricing', '/providers', '/api-docs', '/notifications', '/profile', '/identity-profile', '/report'],
    denied: ['/admin', '/settings', '/audit', '/payments', '/analytics'],
  },
  {
    email: 'viewer@iprs.co.ke', label: 'User · Viewer',
    expect: /Workspace|Good (morning|afternoon|evening)/i,
    routes: ['/dashboard', '/cases', '/wallet', '/billing', '/pricing', '/notifications', '/profile', '/identity-profile', '/report'],
    denied: ['/search', '/admin', '/settings', '/audit', '/payments'],
  },
];

async function loginAs(app, email) {
  const inputs = app.$$('input');
  const emailEl = inputs.find((i) => /email/i.test(i.placeholder ?? '') || i.type === 'email');
  const passEl = inputs.find((i) => i.type === 'password');
  if (!emailEl || !passEl) return false;
  app.setInput(emailEl, email);
  app.setInput(passEl, 'Iprs@2026!');
  await sleep(80);
  const submit = app.findButton('sign in') || app.findButton('log in') || app.$('button[type="submit"]');
  if (!submit) return false;
  app.click(submit);
  await sleep(1600);

  // MFA step, if this account requires it.
  const otp = app.$$('input').find((i) => /code|otp|mfa/i.test(i.placeholder ?? '') || /code|otp/i.test(i.name ?? ''));
  if (otp) {
    app.setInput(otp, '123456');
    await sleep(80);
    const v = app.findButton('verify') || app.findButton('confirm') || app.$('button[type="submit"]');
    if (v) app.click(v);
    await sleep(1600);
  }
  return true;
}

async function main() {
  const persistedPersonas = [];
  for (const p of PERSONAS) {
    console.log(`\n═══ ${p.label} (${p.email}) ═══`);
    const app = bootApp();
    await sleep(1500);

    check(`${p.label}: app mounts with a clean login screen`,
      (app.$('#root')?.childElementCount ?? 0) > 0 && /IPRS|sign in|email/i.test(app.text()) && app.errors.length === 0,
      app.errors.slice(0, 2).join(' | '));

    const ok = await loginAs(app, p.email);
    check(`${p.label}: signed in`, ok);
    if (!ok) { console.log(app.errors.slice(0, 3).join('\n')); continue; }

    const body = app.text();
    check(`${p.label}: tier dashboard rendered without errors`, p.expect.test(body) && app.errors.length === 0,
      `${body.slice(0, 80).replace(/\s+/g, ' ')} ${app.errors.slice(0, 2).join(' | ')}`);

    // Walk every route this persona should reach.
    let fails = 0;
    for (const r of p.routes) {
      const before = app.errors.length;
      await app.goto(r);
      const empty = (app.$('#root')?.childElementCount ?? 0) === 0;
      const threw = /Something went wrong|is not defined|Cannot read propert|Minified React error/i.test(app.text());
      const denied = /Access denied/i.test(app.text());
      if (empty || threw || denied || app.errors.length > before) {
        fails += 1;
        console.log(`   ✗ ${r}${denied ? ' (unexpectedly DENIED)' : ''}${empty ? ' (empty root)' : ''} ${app.errors.slice(before).join(' | ').slice(0, 160)}`);
      }
    }
    check(`${p.label}: ${p.routes.length} reachable routes render clean`, fails === 0, `${fails} failing`);
    check(`${p.label}: route sweep produces no runtime errors`, app.errors.length === 0, app.errors.slice(0, 2).join(' | '));

    // Walk every route this persona must be blocked from.
    let leaks = 0;
    for (const r of p.denied) {
      await app.goto(r);
      if (!/Access denied/i.test(app.text())) {
        leaks += 1;
        console.log(`   ✗ ${r} was NOT blocked — saw: ${app.text().slice(0, 70).replace(/\s+/g, ' ')}`);
      }
    }
    check(`${p.label}: ${p.denied.length} restricted routes blocked`, leaks === 0, `${leaks} leaked`);

    /*
     * Group-level settings authority.
     *
     * Admin may OPEN /settings (it holds settings.view + settings.edit.operational)
     * but must find the platform group read-only, since settings.edit.platform and
     * maintenance.toggle are Super Admin only. This mirrors the backend, which 403s
     * an Admin on POST /api/settings/maintenance.
     */
    if (p.label === 'Admin' || p.label === 'Super Admin') {
      await app.goto('/settings');
      const plat = app.buttons().find((b) => /platform/i.test(b.textContent ?? ''));
      if (plat) {
        app.click(plat);
        await sleep(400);
        const readOnly = /Read only/i.test(app.text());
        const saveBtn = app.buttons().find((b) => /^\s*Save\s*$/i.test(b.textContent ?? ''));
        if (p.label === 'Admin') {
          check('Admin: platform settings group is read-only', readOnly, 'expected a "Read only" badge');
          check('Admin: Save disabled on platform group', !!saveBtn && saveBtn.disabled === true, saveBtn ? `disabled=${saveBtn.disabled}` : 'no Save button');
        } else {
          check('Super Admin: platform settings group is editable', !readOnly, 'unexpected "Read only" badge');
        }
      } else {
        check(`${p.label}: platform group reachable in settings rail`, false, 'no Platform control found');
      }
    }

    if (p.label === 'Super Admin') {
      check('Super Admin: skip link targets the application main landmark',
        app.$('a[href="#main-content"]')?.textContent?.trim() === 'Skip to content' && app.$('main#main-content') !== null);
      check('Super Admin: application exposes exactly one main landmark', app.$$('main').length === 1, String(app.$$('main').length));
      check('Super Admin: error-boundary fallback marker ships in the built bundle',
        loadBuild().code.includes('Something broke on this screen'));

      await app.goto('/api-docs');
      const machineTab = app.findButton('Machine API');
      if (machineTab) app.click(machineTab);
      await sleep(300);
      check('Super Admin: Machine API tab exposes the scoped contract',
        !!machineTab && /Machine API contract/.test(app.text()) && /pricing:read/.test(app.text()) && /401/.test(app.text()));
      check('Super Admin: Machine API tab lists all four public routes',
        ['/api/v1', '/api/v1/pricing', '/api/v1/wallet', '/api/v1/verify'].every((route) => app.text().includes(route)));
      check('Super Admin: API key management tab remains available', !!app.findButtonExact?.('Keys') || app.buttons().some((button) => (button.textContent ?? '').trim().startsWith('Keys')));

      await app.goto('/profile');
      const securityTab = app.$$('[role="tab"]').find((tab) => (tab.textContent ?? '').trim().startsWith('Security'));
      if (securityTab) app.click(securityTab);
      await sleep(300);
      check('Super Admin: session controls render current-device revocation',
        /Your sessions/.test(app.text()) && /Revoke other sessions/.test(app.text()));

      await app.goto('/settings');
      const backupGroup = app.findButton('Backup & Recovery');
      if (backupGroup) app.click(backupGroup);
      await sleep(300);
      check('Super Admin: backup panel exposes export and restore controls',
        /Backend required/.test(app.text()) && /Download backup/.test(app.text()) && /Restore backup/.test(app.text()));
      check('Super Admin: backup restore accepts versioned JSON files',
        app.$('input[type="file"][accept*="application/json"]') !== null);
    }

    if (p.label === 'User · Analyst') {
      await app.goto('/profile');
      const security = app.$$('[role="tab"]').find((tab) => (tab.textContent ?? '').trim().startsWith('Security'));
      if (security) app.click(security);
      await sleep(300);
      check('User · Analyst: self-service session controls render', /Your sessions/.test(app.text()) && /Revoke other sessions/.test(app.text()));
      const notifications = app.$$('[role="tab"]').find((tab) => (tab.textContent ?? '').trim().startsWith('Notifications'));
      if (notifications) app.click(notifications);
      await sleep(300);
      check('User · Analyst: notification channel matrix remains configurable',
        /Delivery matrix/.test(app.text()) && /Webhook/.test(app.text()) && /SMS/.test(app.text()));
    }

    const stored = app.window.localStorage.getItem(STORAGE_KEY);
    persistedPersonas.push({ label: p.label, ok: !!stored && stored.length > 500, size: stored?.length ?? 0 });

    if (app.errors.length) {
      console.log(`   runtime errors (${app.errors.length}):`);
      [...new Set(app.errors)].slice(0, 6).forEach((e) => console.log('     • ' + e.slice(0, 200)));
    }
    app.window.close();
  }
  check('all personas: authenticated state persists', persistedPersonas.every((entry) => entry.ok),
    persistedPersonas.map((entry) => `${entry.label}:${(entry.size / 1024).toFixed(1)}KB`).join(' '));

  /* ------------------- download + PDF proof (one instance) ------------------- */
  console.log('\n═══ Downloads ═══');
  const app = bootApp();
  await sleep(1400);
  await loginAs(app, 'superadmin@iprs.co.ke');
  await app.goto('/report');
  const dl = app.findButton('download pdf') || app.findButton('download');
  if (dl) { app.click(dl); await sleep(1200); }
  check('Download PDF produces a blob', app.downloads.length > 0, app.downloads.map((d) => `${d.filename ?? '?'} ${d.size}B ${d.type}`).join(', '));
  check('downloaded file is named .pdf', app.downloads.some((d) => /\.pdf$/i.test(d.filename ?? '')), app.downloads.map((d) => d.filename).join(', '));
  check('MIME type is application/pdf', app.downloads.some((d) => (d.type || '').includes('pdf')), app.downloads.map((d) => d.type).join(', '));
  await sleep(900); // let the blob text()/arrayBuffer() promises settle
  check('file begins with the %PDF magic bytes', app.downloads.some((d) => (d.head ?? '').startsWith('%PDF')), JSON.stringify(app.downloads.map((d) => d.head)));
  check('PDF is substantively sized (>50 KB)', app.downloads.some((d) => d.size > 50_000), app.downloads.map((d) => `${(d.size / 1024).toFixed(0)} KB`).join(', '));
  if (process.env.SMOKE_DUMP_DIR) {
    const written = app.downloads.filter((d) => d.path);
    check('PDF written to disk for external validation', written.length > 0, written.map((d) => d.path).join(', '));
  }
  if (app.errors.length) console.log('   errors:', [...new Set(app.errors)].slice(0, 4).join(' | ').slice(0, 300));
  app.window.close();

  console.log('\n──────── summary ────────');
  const pass = results.filter((r) => r.ok).length;
  console.log(`PASS ${pass} / FAIL ${results.length - pass}  (${results.length} assertions)`);
  console.log('note: no geometry/responsive assertions — jsdom performs no layout.');
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => { console.error('HARNESS FAILURE:', e); process.exit(2); });
