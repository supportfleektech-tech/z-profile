/**
 * Shared jsdom boot harness for the production bundle.
 *
 * No browser binary exists in this environment (Playwright's CDN is blocked), so
 * this boots the real `dist/index.html` inside jsdom instead. That catches what
 * `tsc` and `vite build` structurally cannot — runtime crashes, undefined property
 * access, bad hook order, routes that throw when rendered, RBAC guards that fail to
 * block, and interactive flows that never actually complete.
 *
 * jsdom performs NO layout, so nothing here can assert visual/responsive correctness.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

// Resolve from the repo root so the harness works from any cwd.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML_PATH = path.join(REPO_ROOT, 'dist', 'index.html');
const ORIGIN = 'http://localhost:5173';
export const STORAGE_KEY = 'iprs.v1.workspace';
export const DEMO_PASSWORD = 'Iprs@2026!';

/** jsdom does not implement these; they are environment noise, not app defects. */
const NOISE = /Not implemented|Could not parse CSS|Could not load|scrollTo\(\) method|navigation \(except hash/i;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadBuild() {
  if (!existsSync(HTML_PATH)) {
    throw new Error(`${HTML_PATH} not found — run \`npm run build\` first (or use \`npm run verify\`).`);
  }
  const html = readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('could not find inlined module bundle in dist/index.html');
  const code = m[1];
  if (/^\s*(?:import|export)\s/m.test(code)) throw new Error('bundle has top-level ESM syntax; cannot eval as classic script');
  return { markup: html.replace(m[0], ''), code };
}

/** Boot one isolated instance of the app. Each call is a completely fresh session. */
export function bootApp({ storage } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!NOISE.test(e.message)) errors.push(`jsdomError: ${e.message}`); });
  vc.on('error', (...a) => { const s = a.map(String).join(' '); if (!NOISE.test(s)) errors.push(`console.error: ${s}`); });

  const { markup, code } = loadBuild();
  const dom = new JSDOM(markup, { url: `${ORIGIN}/`, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;

  // Optionally pre-seed localStorage BEFORE the bundle boots, so a second boot can
  // prove that state written by a first session genuinely survives a reload.
  if (storage) {
    for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
  }

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

  // Deterministic LOCAL adapter (no backend is reachable from jsdom).
  window.fetch = async () => { throw new TypeError('Failed to fetch'); };

  // Capture blob downloads to prove exports produce real files.
  const downloads = [];
  window.URL.createObjectURL = (blob) => {
    const rec = { size: blob?.size ?? 0, type: blob?.type ?? '', head: null, path: null };
    downloads.push(rec);
    if (blob?.slice) blob.slice(0, 8).text?.().then((t) => { rec.head = t; }).catch(() => {});
    if (process.env.SMOKE_DUMP_DIR && blob?.arrayBuffer) {
      blob.arrayBuffer().then((buf) => {
        mkdirSync(process.env.SMOKE_DUMP_DIR, { recursive: true });
        rec.path = `${process.env.SMOKE_DUMP_DIR}/${rec.filename ?? `download-${downloads.length}.bin`}`;
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
  /*
   * The bundle is eval'd AFTER the document parses. Module scripts defer but classic
   * ones do not, so rewriting type="module" in place made React run before #root
   * existed and throw error #299 ("Target container is not a DOM element").
   */
  window.eval(code);

  /* ---- drive helpers ---- */
  const $ = (s) => window.document.querySelector(s);
  const $$ = (s) => [...window.document.querySelectorAll(s)];
  const text = () => window.document.body.textContent ?? '';
  const buttons = () => $$('button, a[role="button"], [role="menuitem"], [role="tab"]');
  const findButton = (label) => buttons().find((b) => (b.textContent ?? '').trim().toLowerCase().includes(label.toLowerCase()));
  const findButtons = (label) => buttons().filter((b) => (b.textContent ?? '').trim().toLowerCase().includes(label.toLowerCase()));
  const inputs = () => $$('input, textarea, select');
  const findInput = (re) => inputs().find((i) => re.test(i.placeholder ?? '') || re.test(i.name ?? '') || re.test(i.getAttribute('aria-label') ?? ''));

  /** Set a controlled React input's value the way a real user event would. */
  const setInput = (el, value) => {
    if (!el) throw new Error('setInput: element is null');
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  };

  const click = (el) => {
    if (!el) throw new Error('click: element is null');
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  };

  const goto = async (hash) => {
    window.location.hash = hash;
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await sleep(280);
  };

  /** Poll until `pred` holds or the timeout elapses. Returns whether it succeeded. */
  const waitFor = async (pred, { timeout = 20000, interval = 250, label = 'condition' } = {}) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (pred()) return true; } catch { /* keep polling */ }
      await sleep(interval);
    }
    try { return !!pred(); } catch { return false; }
  };

  const errorCount = () => errors.length;

  /**
   * Scope queries to a subtree.
   *
   * Several screens render a modal ON TOP OF a page that has its own filter inputs and
   * selects. An unscoped `findInput(/name/i)` therefore matches the page's search box
   * rather than the dialog's field, and an unscoped tier `<select>` matches the page
   * filter (which also lists every tier) rather than the create form. Modal/Drawer mark
   * themselves with role="dialog", so scope to it.
   */
  const within = (root) => {
    if (!root) return null;
    const q = (sel) => [...root.querySelectorAll(sel)];
    return {
      root,
      $$: q,
      $: (sel) => root.querySelector(sel),
      inputs: () => q('input, textarea, select'),
      buttons: () => q('button, a[role="button"], [role="menuitem"], [role="tab"]'),
      selects: () => q('select'),
      findInput: (re) => q('input, textarea, select').find((i) => re.test(i.placeholder ?? '') || re.test(i.name ?? '') || re.test(i.getAttribute('aria-label') ?? '')),
      findButton: (label) => q('button, a[role="button"], [role="menuitem"], [role="tab"]').find((b) => (b.textContent ?? '').trim().toLowerCase().includes(label.toLowerCase())),
      findButtonExact: (label) => q('button, a[role="button"], [role="menuitem"], [role="tab"]').find((b) => (b.textContent ?? '').trim().toLowerCase() === label.toLowerCase()),
      findButtons: (label) => q('button, a[role="button"], [role="menuitem"], [role="tab"]').filter((b) => (b.textContent ?? '').trim().toLowerCase().includes(label.toLowerCase())),
      setInput,
      click,
      text: () => root.textContent ?? '',
    };
  };

  /** The topmost open dialog/drawer, scoped. */
  const dialog = () => {
    const all = $$('[role="dialog"]');
    return all.length ? within(all[all.length - 1]) : null;
  };

  /** A control whose full text is exactly `label` — avoids matching the header's wallet chip. */
  const findButtonExact = (label) => buttons().find((b) => (b.textContent ?? '').trim().toLowerCase() === label.toLowerCase());

  /** A tab (role="tab") by exact label. */
  const findTab = (label) => $$('[role="tab"]').find((t) => (t.textContent ?? '').trim().toLowerCase().startsWith(label.toLowerCase()));

  return { window, dom, errors, downloads, $, $$, text, buttons, findButton, findButtonExact, findButtons, findTab, inputs, findInput, setInput, click, goto, waitFor, errorCount, within, dialog };
}

/** Sign in a persona and clear any MFA step. Returns true on success. */
export async function loginAs(app, email, password = DEMO_PASSWORD) {
  const emailEl = app.findInput(/email/i) ?? app.$('input[type="email"]');
  const passEl = app.$('input[type="password"]');
  if (!emailEl || !passEl) return { ok: false, why: 'login inputs not found' };
  app.setInput(emailEl, email);
  app.setInput(passEl, password);
  await sleep(100);
  const submit = app.findButton('sign in') || app.findButton('log in') || app.$('button[type="submit"]');
  if (!submit) return { ok: false, why: 'submit button not found' };
  app.click(submit);
  await sleep(1800);

  // MFA challenge, if this account requires it.
  const otp = app.findInput(/code|otp|mfa/i);
  if (otp) {
    app.setInput(otp, '123456');
    await sleep(100);
    const v = app.findButton('verify') || app.findButton('confirm') || app.$('button[type="submit"]');
    if (v) app.click(v);
    await sleep(1800);
  }
  const stillOnLogin = !!app.$('input[type="password"]') && /sign in/i.test(app.text().slice(0, 600));
  return { ok: !stillOnLogin, why: stillOnLogin ? 'still on login screen' : '' };
}

/* ------------------------------- assertions ------------------------------- */

export const results = [];
export function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  return !!cond;
}

export function summarise(title) {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n──────── ${title} ────────`);
  console.log(`PASS ${pass} / FAIL ${results.length - pass}  (${results.length} assertions)`);
  return results.length - pass;
}
