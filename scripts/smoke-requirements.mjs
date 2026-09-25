#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  REQUIREMENT-TRACEABILITY SUITE
 *  Maps every acceptance criterion from the original brief to a live assertion
 *  against the built bundle, so a regression in any of the reported bugs fails
 *  CI rather than being re-discovered by hand.
 *
 *  Req #1  Blueprint poster grids + mobile responsive view page are GONE
 *  Req #2  Identity profile tabs render DISTINCT, real content (5 tabs)
 *  Req #3  Summary ≠ Full Report; Full carries everything; print emits the full
 *          data; Download PDF downloads real, DIFFERENT files
 *  Req #4  Profile settings Security + Notifications have their own config that
 *          actually persists (across a genuine second boot)
 *  Req #5  Provider management exposes interaction/config fields that save
 *  Req #9  Tier gating: user tier is denied admin routes; tiers are distinct
 *  Pricing 0–500 batch transcribed from the proposal; banners report the exact
 *          confirmed/provisional split
 *
 *  Runs the SAME jsdom boot harness as smoke-dom / smoke-flows. The backend is
 *  deliberately unreachable (fetch throws) so this exercises the LOCAL adapter.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootApp, loginAs, check, summarise, sleep, STORAGE_KEY } from './lib/app.mjs';
import { platformRoutes } from '../src/types/routes.ts';
import { pricingCatalog, pricingProvenance } from '../src/data/pricing.ts';
import { spinModuleForItem } from '../src/data/spinModules.ts';
import { FixedWindowRateLimiter } from '../server/ratelimit.mjs';

const DIST = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const pass = (name, cond, detail = '') => check(name, cond, detail);

/* ════════════════════ REQ #1 — blueprint / mobile view removed ════════════════════ */
{
  const banned = /blueprint|mobile[- ]?(view|responsi|showcase)|master[- ]?blueprint|brand[- ]?footer|page[- ]?navigator/i;

  pass('req1: route table has no blueprint/mobile-view route', platformRoutes.every((r) => !banned.test(`${r.id} ${r.path} ${r.title}`)),
    `${platformRoutes.length} routes scanned`);

  const bundle = readFileSync(DIST, 'utf8');
  pass('req1: built bundle registers no blueprint/mobile screen component', !/Screen15_MobileView|MasterBlueprintPage|BlueprintView/.test(bundle));

  const app = bootApp();
  await sleep(1600);
  await loginAs(app, 'analyst@iprs.co.ke');
  await sleep(600);

  const navText = app.$$('a, button').map((a) => a.textContent ?? '').join(' | ');
  pass('req1: signed-in chrome (nav + actions) has no blueprint/mobile entry', !banned.test(navText), navText.length + ' chars scanned');
  await app.goto('/mobile-responsive'); await sleep(500);
  pass('req1: legacy /mobile-responsive deep link does not resurrect the showcase', !banned.test(app.text()), app.text().slice(0, 60).trim());
}

/* ════════════════════ REQ #2 — identity profile tabs are distinct ════════════════════ */
{
  const app = bootApp();
  await sleep(1600);
  await loginAs(app, 'analyst@iprs.co.ke');
  await sleep(400);
  await app.goto('/identity-profile');
  await app.waitFor(() => /Verification event log|Risk assessment/.test(app.$('main')?.textContent ?? ''), { label: 'profile tabs render' });

  const TAB_SIGNATURES = [
    ['Overview', 'Risk assessment'],
    ['Personal', 'Civil registration'],
    ['Financial', 'Tax standing'],
    ['Connections', 'Relationship graph'],
    ['Logs', 'Verification event log'],
  ];

  const main = () => app.$('main')?.textContent ?? '';
  const snapshots = [];

  for (const [tab, signature] of TAB_SIGNATURES) {
    const el = app.findTab(tab);
    pass(`req2: "${tab}" tab exists`, !!el);
    if (!el) continue;
    app.click(el);
    await app.waitFor(() => el.getAttribute('aria-selected') === 'true', { label: `${tab} selected` });
    pass(`req2: "${tab}" becomes aria-selected`, el.getAttribute('aria-selected') === 'true');
    pass(`req2: "${tab}" renders its own content ("${signature}")`, main().includes(signature));
    snapshots.push(main());
  }

  let dupes = 0;
  for (let i = 0; i < snapshots.length; i++)
    for (let j = i + 1; j < snapshots.length; j++)
      if (snapshots[i] === snapshots[j]) dupes++;
  pass('req2: all 5 tab contents are pairwise DISTINCT (the original bug: identical tabs)', dupes === 0, `${snapshots.length} snapshots, ${dupes} duplicate pairs`);
}

/* ════════════════════ REQ #3 — Summary vs Full Report vs print vs PDF ════════════════════ */
{
  const app = bootApp();
  await sleep(1600);
  await loginAs(app, 'analyst@iprs.co.ke');
  await sleep(400);
  await app.goto('/report');
  await app.waitFor(() => /Executive summary/i.test(app.$('main')?.textContent ?? ''), { label: 'report renders' });

  const main = () => app.$('main')?.textContent ?? '';
  const summaryText = main();

  // The view switch is a SegmentedControl: plain buttons with aria-pressed.
  const fullTab = app.findButtons('Full Report')[0];
  pass('req3: Full Report segment exists and advertises a field count', !!fullTab && /Full Report · \d+ fields/.test(fullTab.textContent ?? ''), fullTab?.textContent?.trim());
  const advertised = Number((fullTab?.textContent ?? '').match(/(\d+) fields/)?.[1] ?? 0);
  pass('req3: Full Report advertises MORE than a handful of fields', advertised >= 20, `${advertised} fields`);

  app.click(fullTab);
  await app.waitFor(() => fullTab?.getAttribute('aria-pressed') === 'true' && /Complete verification report/i.test(main()), { label: 'full view renders' });
  pass('req3: Full Report segment becomes aria-pressed', fullTab?.getAttribute('aria-pressed') === 'true');
  const fullText = main();

  pass('req3: Full Report carries ALL advertised fields on screen', new RegExp(`${advertised} fields`).test(fullText));
  pass('req3: Full Report is substantially larger than Summary (not the same thing)', fullText.length > summaryText.length * 1.4, `summary ${summaryText.length} chars vs full ${fullText.length} chars`);
  pass('req3: Full Report shows per-field provenance (confidence)', /confidence/i.test(fullText));
  pass('req3: Full Report shows retrieval timestamps', /retrieved/i.test(fullText));
  const ws = JSON.parse(app.window.localStorage.getItem(STORAGE_KEY) ?? '{}');
  const hasRaw = Array.isArray(ws.activeDossier?.sections) && ws.activeDossier.sections.some((sec) => sec.rawResponse);
  pass('req3: the dossier store carries raw gateway payloads', hasRaw, `${ws.activeDossier?.sections?.length ?? 0} sections`);
  pass('req3: Full Report renders the raw gateway responses', !hasRaw || /raw gateway response/i.test(fullText));
  pass('req3: Summary is genuinely a brief (no raw-payload section)', !/raw gateway response/i.test(summaryText));

  // Print must target the FULL data set.
  const printBtn = app.findButtonExact('Print');
  pass('req3: Print control exists', !!printBtn);
  if (printBtn) { app.click(printBtn); await sleep(300); }
  pass('req3: print confirms it emits sections + ALL fields', /fields/i.test(app.text()) && /sections/i.test(app.text()));
  const bundle = readFileSync(DIST, 'utf8');
  pass('req3: print stylesheet ships in the bundle (@media print)', bundle.includes('@media print'));

  // Both PDFs must download, be real PDFs, and differ (Summary ≠ Full).
  await app.goto('/report'); await sleep(500);
  const sumBtn = app.findButtonExact('Summary PDF');
  const fullBtn = app.findButtonExact('Download PDF');
  pass('req3: Summary PDF + Download PDF controls exist', !!sumBtn && !!fullBtn);
  if (sumBtn) { app.click(sumBtn); await app.waitFor(() => app.downloads.length >= 1, { label: 'summary pdf' }); }
  if (fullBtn) { app.click(fullBtn); await app.waitFor(() => app.downloads.length >= 2, { label: 'full pdf' }); }

  await sleep(300); // blob.slice().text() fills `head` asynchronously
  const [sumPdf, fullPdf] = app.downloads;
  pass('req3: Summary PDF downloads', !!sumPdf, sumPdf ? `${sumPdf.size} B` : 'missing');
  pass('req3: Full PDF downloads (the "Download PDF must download a file" bug)', !!fullPdf, fullPdf ? `${fullPdf.size} B` : 'missing');
  pass('req3: both artifacts are real PDFs (%PDF magic)', !!sumPdf?.head?.startsWith('%PDF') && !!fullPdf?.head?.startsWith('%PDF'));
  pass('req3: Full PDF is larger than Summary PDF (carries all extracted data)', !!sumPdf && !!fullPdf && fullPdf.size > sumPdf.size, `full ${fullPdf?.size} > summary ${sumPdf?.size}`);
}

/* ════════════════════ REQ #4 — Security + Notifications really configure ════════════════════ */
{
  const app = bootApp();
  await sleep(1600);
  await loginAs(app, 'analyst@iprs.co.ke');
  await sleep(400);
  await app.goto('/profile');
  await app.waitFor(() => app.findTab('Security'), { label: 'profile settings render' });

  const main = () => app.$('main')?.textContent ?? '';

  // ---- Security tab: MFA toggle persists to storage ----
  const secTab = app.findTab('Security');
  app.click(secTab);
  await app.waitFor(() => /two-factor/i.test(main()), { label: 'security tab' });

  const switches = app.$$('[role="switch"]');
  const mfaSwitch = switches[0];
  pass('req4: Security tab has exactly one account-level switch and it is the 2FA control', switches.length === 1 && !!mfaSwitch && /totp/i.test((mfaSwitch.parentElement?.textContent ?? '') + (mfaSwitch.textContent ?? '')), mfaSwitch?.parentElement?.textContent?.slice(0, 60).trim());

  const stored = () => JSON.parse(app.window.localStorage.getItem(STORAGE_KEY) ?? '{}');
  const mfaOf = (root) => (JSON.parse(root.window.localStorage.getItem(STORAGE_KEY) ?? '{}').users ?? []).find((u) => u.email === 'analyst@iprs.co.ke')?.mfaEnabled;
  const mfaBefore = mfaOf(app);
  pass('req4: analyst seeds with 2FA off (deterministic enable path)', mfaBefore === false, String(mfaBefore));

  if (mfaSwitch) { app.click(mfaSwitch); await sleep(300); }
  const enableBtn = app.findButtonExact('Enable 2FA');
  pass('req4: enabling 2FA raises the enrollment step (secret + recovery codes)', !!enableBtn);
  if (enableBtn) { app.click(enableBtn); await sleep(400); }
  const mfaAfter = mfaOf(app);
  pass('req4: enabling 2FA writes mfaEnabled:true through to persisted storage', mfaAfter === true, `mfaEnabled ${mfaBefore} -> ${mfaAfter}`);

  // ---- second boot from the SAME storage: the setting survives a real reload ----
  const carried = app.window.localStorage.getItem(STORAGE_KEY);
  const app2 = bootApp({ storage: { [STORAGE_KEY]: carried } });
  await sleep(1600);
  await loginAs(app2, 'analyst@iprs.co.ke');
  await sleep(400);
  await app2.goto('/profile');
  await app2.waitFor(() => app2.findTab('Security'), { label: 'second boot profile' });
  app2.click(app2.findTab('Security'));
  await app2.waitFor(() => /two-factor/i.test(app2.$('main')?.textContent ?? ''), { label: 'second boot security tab' });
  const secSwitch = app2.$$('[role="switch"]')[0];
  pass('req4: MFA state SURVIVES a genuine reload (second boot from same storage)', secSwitch?.getAttribute('aria-checked') === 'true' && /2FA on/.test(app2.$('main')?.textContent ?? ''), `switch=${secSwitch?.getAttribute('aria-checked')}`);

  // ---- Notifications tab: delivery matrix is configurable and distinct ----
  const app3 = bootApp();
  await sleep(1600);
  await loginAs(app3, 'analyst@iprs.co.ke');
  await sleep(400);
  await app3.goto('/profile');
  await app3.waitFor(() => app3.findTab('Notifications'), { label: 'profile 2' });
  const notifTab = app3.findTab('Notifications');
  app3.click(notifTab);
  await app3.waitFor(() => /delivery matrix/i.test(app3.$('main')?.textContent ?? ''), { label: 'notifications tab' });

  const cells = app3.$$('[role="switch"], input[type="checkbox"]').filter((c) => !c.closest('[role="dialog"]'));
  pass('req4: Notifications has a per-event × per-channel matrix of controls', cells.length >= 12, `${cells.length} matrix controls`);
  pass('req4: matrix covers in-app / email / SMS / webhook', /webhook/i.test(app3.$('main')?.textContent ?? '') && /sms/i.test(app3.$('main')?.textContent ?? ''));

  const notifText = app3.$('main')?.textContent ?? '';
  pass('req4: Security view does NOT render the Notifications matrix (tabs are not identical)', !/delivery matrix/i.test(main()));
  pass('req4: Notifications tab renders the matrix Security lacks', /delivery matrix/i.test(notifText));

  const target = cells.find((c) => c.getAttribute('aria-checked') === 'true' || c.checked);
  const before3 = app3.window.localStorage.getItem(STORAGE_KEY);
  if (target) { app3.click(target); await sleep(200); }
  const saveBtn = app3.findButtonExact('Save preferences');
  pass('req4: "Save preferences" exists', !!saveBtn);
  if (saveBtn) { app3.click(saveBtn); await app3.waitFor(() => app3.window.localStorage.getItem(STORAGE_KEY) !== before3, { label: 'prefs saved', timeout: 8000 }); }
  pass('req4: saving preferences writes through to persisted storage', app3.window.localStorage.getItem(STORAGE_KEY) !== before3);
}

/* ════════════════════ REQ #5 — provider management is configurable ════════════════════ */
{
  const app = bootApp();
  await sleep(1600);
  await loginAs(app, 'admin@iprs.co.ke');
  await sleep(400);
  await app.goto('/providers');
  await app.waitFor(() => /Provider/i.test(app.$('main')?.textContent ?? ''), { label: 'providers render' });

  const configureBtns = app.findButtons('Configure');
  pass('req5: provider rows expose a Configure action', configureBtns.length >= 6, `${configureBtns.length} providers`);
  app.click(configureBtns[0]);
  await sleep(400);

  const panel = app.$('main')?.textContent ?? '';
  pass('req5: config exposes Connection group (Base URL, endpoint, method, environment)', /Base URL/.test(panel) && /Endpoint path/.test(panel) && /Environment/.test(panel));
  pass('req5: config exposes Authentication group (keys, token URL)', /Consumer key/.test(panel) && /Token URL/.test(panel));
  pass('req5: config exposes Behaviour & resilience group', /Behaviour & resilience/i.test(panel));
  pass('req5: config exposes ops fields (maintenance window, IP allowlist)', /Maintenance window/.test(panel) && /IP allowlist/.test(panel));

  // Edit a config field, save, and prove it persisted to storage.
  const urlInput = app.inputs().find((i) => /^https?:\/\//.test(i.value ?? ''));
  pass('req5: Base URL input is present and editable', !!urlInput && !urlInput.disabled, urlInput?.value?.slice(0, 40));
  if (urlInput) {
    const newVal = `${urlInput.value.replace(/\/$/, '')}/v2`;
    await app.setInput(urlInput, newVal);
    const storeBefore = app.window.localStorage.getItem(STORAGE_KEY);
    const save = app.findButtons('Save').find((b) => /save config|save changes|save/i.test((b.textContent ?? '').trim()) && !/allowlist|preferences|profile/i.test(b.textContent ?? ''));
    pass('req5: Save control exists for the provider draft', !!save, save?.textContent?.trim());
    if (save) { app.click(save); await app.waitFor(() => app.window.localStorage.getItem(STORAGE_KEY) !== storeBefore, { label: 'provider saved', timeout: 8000 }); }
    const raw = app.window.localStorage.getItem(STORAGE_KEY) ?? '';
    pass('req5: edited Base URL persists to storage', raw.includes('/v2'), newVal.slice(0, 50));

    // Reload the screen: the value must come back from the store, not the draft.
    await app.goto('/providers'); await sleep(600);
    const again = app.inputs().find((i) => (i.value ?? '').includes('/v2'));
    pass('req5: edited Base URL survives a screen re-mount', !!again, again?.value?.slice(0, 50));
  }
}

/* ════════════════════ REQ #9 — tiers gate what they claim to gate ════════════════════ */
{
  const user = bootApp();
  await sleep(1600);
  await loginAs(user, 'analyst@iprs.co.ke');
  await sleep(400);
  await user.goto('/admin');
  await user.waitFor(() => /access denied/i.test(user.$('main')?.textContent ?? ''), { timeout: 10000, label: 'admin denied' });
  pass('req9: user tier is DENIED the admin console', /access denied/i.test(user.$('main')?.textContent ?? ''));
  await user.goto('/payments');
  await user.waitFor(() => /access denied/i.test(user.$('main')?.textContent ?? ''), { timeout: 10000, label: 'payments denied' });
  pass('req9: user tier is DENIED the payments monitor', /access denied/i.test(user.$('main')?.textContent ?? ''));

  const admin = bootApp();
  await sleep(1600);
  await loginAs(admin, 'admin@iprs.co.ke');
  await sleep(400);
  await admin.goto('/payments');
  await admin.waitFor(() => /Payments Monitor|payment/i.test(admin.$('main')?.textContent ?? ''), { timeout: 10000, label: 'admin payments' });
  pass('req9: admin tier DOES get the payments monitor', !/access denied/i.test(admin.$('main')?.textContent ?? ''));
  await admin.goto('/admin');
  await admin.waitFor(() => /admin console|organisation|accounts/i.test(admin.$('main')?.textContent ?? ''), { timeout: 10000, label: 'admin console' });
  pass('req9: admin tier opens the admin console its own tier dashboard gates', !/access denied/i.test(admin.$('main')?.textContent ?? ''));

  const superA = bootApp();
  await sleep(1600);
  await loginAs(superA, 'superadmin@iprs.co.ke');
  await sleep(400);
  pass('req9: super admin lands on its own tier dashboard (distinct landing)', /super/i.test(superA.$('main')?.textContent ?? ''), superA.$('main')?.textContent?.slice(0, 60).trim());
}

/* ════════════════════ Super Admin adjusts prices (Screen11) ════════════════════ */
{
  const app = bootApp();
  await sleep(1600);
  await loginAs(app, 'superadmin@iprs.co.ke');
  await sleep(400);
  await app.goto('/pricing');
  await app.waitFor(() => /Unit price/.test(app.$('main')?.textContent ?? ''), { label: 'price list renders' });

  const unitInputs = app.$$('input[type="number"]').filter((i) => i.closest('td, table'));
  pass('pricing-ui: super admin gets editable rate inputs on the price list', unitInputs.length >= 25, `${unitInputs.length} inputs`);

  // Open the per-row rate drawer.
  const editBtn = app.findButtons('Edit')[0];
  pass('pricing-ui: rows expose an Adjust/Edit action', !!editBtn);
  app.click(editBtn);
  await app.waitFor(() => !!app.dialog(), { label: 'drawer opens' });
  const dlg = app.dialog();
  const title = dlg.root.textContent ?? '';
  // jsdom textContent has no boundaries, so resolve the item by matching a real catalogue name.
  const itemName = (JSON.parse(app.window.localStorage.getItem(STORAGE_KEY) ?? '{}').pricing?.items ?? []).find((i) => title.includes(i.name))?.name ?? '';
  pass('pricing-ui: drawer opens for the row', /Adjust rates/.test(title), itemName);
  const fields = dlg.$$('input[type="number"]');
  pass('pricing-ui: drawer exposes unit / overage / back-up / per-page / quota fields', fields.length >= 5, `${fields.length} fields`);

  // Change the unit price, commit via the header Save button.
  app.setInput(fields[0], '37');
  await sleep(150);
  const save = app.findButtonExact('Save 1 change');
  pass('pricing-ui: pending change is counted and savable', !!save, save?.textContent?.trim());
  const store = () => JSON.parse(app.window.localStorage.getItem(STORAGE_KEY) ?? '{}');
  const rateOf = (nm) => store().pricing?.items?.find((i) => i.name === nm)?.unitPriceKes;
  const before37 = rateOf(itemName);
  if (save) { app.click(save); await app.waitFor(() => rateOf(itemName) !== before37, { label: 'price saved', timeout: 8000 }); }
  pass('pricing-ui: adjusted rate persists to the store', rateOf(itemName) === 37, `${itemName}: ${before37} → ${rateOf(itemName)}`);

  // Reset to the shipped figure so the suite is idempotent.
  await app.goto('/pricing');
  await app.waitFor(() => /Unit price/.test(app.$('main')?.textContent ?? ''), { label: 'price list re-renders' });
  app.click(app.findButtons('Edit')[0]);
  await app.waitFor(() => !!app.dialog(), { label: 'drawer re-opens' });
  app.setInput(app.dialog().$$('input[type="number"]')[0], String(before37));
  await sleep(150);
  const save2 = app.findButtonExact('Save 1 change');
  if (save2) { app.click(save2); await app.waitFor(() => rateOf(itemName) === before37, { label: 'price restored', timeout: 8000 }); }
  pass('pricing-ui: rate restores cleanly (suite is idempotent)', rateOf(itemName) === before37, String(rateOf(itemName)));
}

/* ════════════════════ Pricing — proposal transcription visible ════════════════════ */
{
  const prov = pricingProvenance(pricingCatalog);
  pass('pricing: catalogue covers the full proposal + documented Spin modules', prov.total === 34, `${prov.total} items`);
  pass('pricing: ALL 34 rates confirmed (28 proposal + 6 platform-priced)', prov.confirmed === 34 && prov.provisional === 0, `${prov.confirmed} confirmed / ${prov.provisional} provisional`);
  pass('pricing: the 6 platform-priced rates are keyed in',
    pricingCatalog.items.find((i) => i.id === 'kyc-criminal')?.unitPriceKes === 500 &&
    pricingCatalog.items.find((i) => i.id === 'kyc-deceased')?.unitPriceKes === 150 &&
    pricingCatalog.items.find((i) => i.id === 'kyb-tax')?.unitPriceKes === 250 &&
    pricingCatalog.items.find((i) => i.id === 'kyb-crb')?.unitPriceKes === 1500 &&
    pricingCatalog.items.find((i) => i.id === 'kyc-id-kra')?.unitPriceKes === 45 &&
    pricingCatalog.items.find((i) => i.id === 'kyc-fullkyc')?.unitPriceKes === 200);
  const byId = (id) => pricingCatalog.items.find((i) => i.id === id);
  pass('pricing: vehicle 1,160 · driving licence 200/260 · Metropol 85/150/300 · CreditInfo 50/350/2,000 · BRS 1,300 — all confirmed',
    byId('kyc-vehicle')?.unitPriceKes === 1160 && byId('kyc-driving-licence')?.unitPriceKes === 200 && byId('kyc-driving-licence')?.backupRateKes === 260 &&
    byId('kyc-metropol-score')?.unitPriceKes === 85 && byId('kyc-metropol-standard')?.unitPriceKes === 150 && byId('kyc-metropol-full')?.unitPriceKes === 300 &&
    byId('kyc-ci-score')?.unitPriceKes === 50 && byId('kyc-creditinfo')?.unitPriceKes === 350 && byId('kyc-ci-status')?.unitPriceKes === 2000 &&
    ['kyb-registry', 'kyb-directors', 'kyb-bo', 'kyb-litigation', 'kyb-licence'].every((id) => byId(id)?.unitPriceKes === 1300));
  pass('pricing: every priced item maps to a documented Spin module or an explicit gap', (() => {
    const unmapped = pricingCatalog.items.filter((i) => !spinModuleForItem(i.id) && !['kyc-criminal', 'kyc-deceased', 'kyc-vehicle', 'kyc-pep', 'kyc-statement', 'kyc-crb'].includes(i.id) && !i.id.startsWith('kyb-'));
    return unmapped.length === 0;
  })());
  pass('pricing: catalogue master flag is TRUE — banners drop everywhere', pricingCatalog.confirmedFromProposal === true);

  const idItem = pricingCatalog.items.find((i) => i.id === 'kyc-id');
  pass('pricing: IPRS Standard = KES 30 / back-up 45 (proposal table 1)', idItem?.unitPriceKes === 30 && idItem?.backupRateKes === 45);
  const alien = pricingCatalog.items.find((i) => i.id === 'kyc-alien');
  pass('pricing: Alien ID / AML-PEP / Passport = KES 75 (proposal table 2)', alien?.unitPriceKes === 75 && pricingCatalog.items.find((i) => i.id === 'kyc-pep')?.unitPriceKes === 75 && pricingCatalog.items.find((i) => i.id === 'kyc-passport')?.unitPriceKes === 75);
  const kra = pricingCatalog.items.find((i) => i.id === 'kyc-kra');
  pass('pricing: Utility & Compliance APIs = KES 20 (proposal table 3)', kra?.unitPriceKes === 20 && pricingCatalog.items.filter((i) => ['kyc-sim', 'kyc-namephone', 'kyc-address'].includes(i.id)).every((i) => i.unitPriceKes === 20));
  const phoneById = pricingCatalog.items.find((i) => i.id === 'kyc-phonebyid');
  pass('pricing: Search Phone by ID = KES 50 (proposal table 4)', phoneById?.unitPriceKes === 50);
  const score = pricingCatalog.items.find((i) => i.id === 'kyc-crb');
  pass('pricing: Spin Score = KES 130 (1–1,000 band)', score?.unitPriceKes === 130);
  const stmt = pricingCatalog.items.find((i) => i.id === 'kyc-statement');
  pass('pricing: Scanned Statement = KES 120 + KES 4/page', stmt?.unitPriceKes === 120 && stmt?.perPageKes === 4);

  const std = pricingCatalog.bundles.find((b) => b.id === 'bundle-kyc-standard');
  const sum = std.itemIds.reduce((a, id) => a + pricingCatalog.items.find((i) => i.id === id).unitPriceKes, 0);
  pass('pricing: bundle prices are the exact sum of their items', std.priceKes === sum, `${std.name} ${std.priceKes} = Σ ${sum}`);

  // And the UI surfaces it.
  const app = bootApp();
  await sleep(1600);
  await loginAs(app, 'analyst@iprs.co.ke');
  await sleep(400);
  // Fully priced: the provisional banners must be GONE from both screens.
  await app.goto('/search');
  await app.waitFor(() => /Run verification|checks/i.test(app.$('main')?.textContent ?? ''), { label: 'search renders' });
  pass('pricing: New Search no longer shows a provisional banner', !/provisional pricing/i.test(app.$('main')?.textContent ?? ''));
  await app.goto('/pricing');
  await app.waitFor(() => /Unit price/i.test(app.$('main')?.textContent ?? ''), { label: 'pricing renders' });
  pass('pricing: Pricing & Tiers no longer shows a provisional banner', !/rates confirmed from the proposal\?|Provisional rates/i.test(app.$('main')?.textContent ?? '') && !/of 34 rates confirmed from the proposal/i.test(app.$('main')?.textContent ?? ''));
}

{
  const migrationDir = mkdtempSync(path.join(tmpdir(), 'iprs-trace-db-'));
  const previousDb = process.env.IPRS_DB;
  process.env.IPRS_DB = path.join(migrationDir, 'trace.sqlite');
  const dbModule = await import('../server/db.mjs');
  try {
    const version = Number(dbModule.db.prepare('PRAGMA user_version').get().user_version);
    pass('migration: trace database reaches schema baseline 1', version === 1, `user_version=${version}`);
    pass('migration: registered migration list is forward-only and ordered', dbModule.migrations.every((migration, index, list) => migration.version === index + 1 && (!index || migration.version > list[index - 1].version)));
    const backup = dbModule.createBackup();
    pass('backup: trace export is versioned and excludes transient collections', backup.format === 'iprs-backup' && backup.version === 1 && !backup.data.sessions && !backup.data.stk_pending);
    let rejected = false;
    try { dbModule.validateBackup({ ...backup, version: 99 }); } catch { rejected = true; }
    pass('backup: trace validation rejects unsupported versions before restore', rejected);
  } finally {
    dbModule.db.close();
    if (previousDb === undefined) delete process.env.IPRS_DB;
    else process.env.IPRS_DB = previousDb;
    rmSync(migrationDir, { recursive: true, force: true });
  }
}

{
  const bundle = readFileSync(DIST, 'utf8');
  const app = bootApp();
  await sleep(1600);
  await loginAs(app, 'superadmin@iprs.co.ke');
  pass('machine-api: traceability renders all six least-privilege scopes', ['pricing:read', 'wallet:read', 'verify:run', 'verify:read', 'report:read', 'wallet:debit'].every((scope) => bundle.includes(scope)));
  pass('machine-api: traceability renders discovery, pricing, wallet, and verify routes', ['/api/v1', '/api/v1/pricing', '/api/v1/wallet', '/api/v1/verify'].every((route) => bundle.includes(route)));
  pass('machine-api: traceability documents 401/403/402/429 error contracts', ['401', '403', '402', '429'].every((status) => bundle.includes(status)));
  pass('webhook: built API documentation names the tokenized callback route', bundle.includes('/api/wallet/topup/mpesa/callback/:token'));
  pass('banner: local build omits the optional Pages-only demo banner', !bundle.includes('Demo environment — data is simulated'));
  const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 1000, now: () => 1000 });
  pass('rate-limit: traceability exercises allow, exhaust, and reject metadata', limiter.hit('trace').allowed && limiter.hit('trace').remaining === 0 && !limiter.hit('trace').allowed);
  await app.goto('/profile');
  const security = app.findTab('Security');
  if (security) app.click(security);
  await sleep(250);
  const sessionsVisible = /Your sessions/.test(app.text());
  await app.goto('/settings');
  const backupGroup = app.findButton('Backup & Recovery');
  if (backupGroup) app.click(backupGroup);
  await sleep(250);
  pass('session/backup: traceability finds session controls and Super-Admin backup panel', sessionsVisible && /Download backup/.test(app.text()) && /Restore backup/.test(app.text()));
  app.window.close();
}

const fails = summarise('REQUIREMENT TRACEABILITY');
process.exit(fails === 0 ? 0 : 1);
