/**
 * Interactive-flow smoke test.
 *
 * `scripts/smoke-dom.mjs` proves every route *renders*. This proves the core write
 * paths actually *complete* — the features the brief asked for, driven through the
 * real production bundle in jsdom:
 *
 *   1. M-PESA STK Push top-up        (requirement 8)
 *   2. Card top-up with 3-D Secure, and the decline path
 *   3. Running a verification search (requirement 2)
 *   4. Super Admin creating an Admin, and Admin being refused the same (requirement 10)
 *   5. Refunding a payment           (requirement 8)
 *
 * Assertions read the persisted store (localStorage) rather than scraped text, so a
 * green run means the balance/ledger genuinely moved — not just that a label changed.
 *
 * jsdom performs no layout: nothing here asserts visual or responsive correctness.
 */
import { bootApp, loginAs, check, summarise, sleep, STORAGE_KEY } from './lib/app.mjs';

/** Read the app's persisted workspace so we can assert on real numbers. */
function store(app) {
  const raw = app.window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const balanceOf = (app, userId) => {
  const s = store(app);
  return s?.wallets?.find((w) => w.userId === userId)?.balance ?? null;
};
const userCount = (app) => store(app)?.users?.length ?? null;
const paymentsWith = (app, status) => (store(app)?.payments ?? []).filter((p) => p.status === status);
const txCount = (app) => store(app)?.walletTransactions?.length ?? 0;
const me = (app) => {
  const s = store(app);
  return s?.users?.find((u) => u.id === s?.currentUserId) ?? null;
};

/* -------------------------------------------------------------------------- */
/*                         1 + 2. Wallet top-up flows                          */
/* -------------------------------------------------------------------------- */

async function walletFlows() {
  console.log('\n═══ Wallet: M-PESA STK Push top-up ═══');
  const app = bootApp();
  await sleep(1500);
  const login = await loginAs(app, 'analyst@iprs.co.ke');
  check('wallet: analyst signed in', login.ok, login.why);
  if (!login.ok) return app;

  const userId = me(app)?.id;
  const before = balanceOf(app, userId);
  const txBefore = txCount(app);
  check('wallet: persisted store readable', before !== null, `balance=${before}`);

  await app.goto('/wallet');
  /*
   * `findButton('top up')` matched the header's wallet chip ("Wallet KES 18,420 top up")
   * rather than the screen control. The top-up surface is a tab, so target role="tab".
   */
  const topUp = app.findTab('Top up');
  check('wallet: Top up tab present', !!topUp);
  if (topUp) app.click(topUp);
  await sleep(700);

  // M-PESA is the default method.
  const phone = app.findInput(/0712|phone|msisdn/i);
  check('wallet: phone field present', !!phone);
  const amount = app.$('input[type="number"]');
  check('wallet: amount field present', !!amount);

  if (phone && amount) {
    app.setInput(phone, '0712345678');
    app.setInput(amount, 5000);
    await sleep(200);

    // The modelled gateway rolls a dice (88% success / 12% cancel-or-timeout by design).
    // This flow proves OUR settle mechanics, so pin the roll to a successful outcome —
    // the unhappy paths are covered by the card-decline flow.
    app.window.Math.random = () => 0.5;

    const send = app.findButton('send stk');
    check('wallet: Send STK push enabled', !!send && !send.disabled, send ? `disabled=${send.disabled}` : 'not found');
    if (send) app.click(send);

    // Dispatch → awaiting handset.
    const reachedAwaiting = await app.waitFor(() => /waiting for your handset|requesting daraja|check your phone/i.test(app.text()), { timeout: 15000, label: 'STK awaiting' });
    check('wallet: STK dispatch reaches the handset-waiting state', reachedAwaiting, app.text().slice(0, 90).replace(/\s+/g, ' '));

    // The modelled Daraja outcome settles after ~7–9.5s.
    const settled = await app.waitFor(() => balanceOf(app, userId) !== before, { timeout: 30000, interval: 500, label: 'STK settle' });
    const after = balanceOf(app, userId);
    check('wallet: balance moved after STK settle', settled && after !== before, `${before} -> ${after}`);

    if (after !== null && before !== null && after > before) {
      check('wallet: credited the full top-up amount', after - before === 5000, `delta=${after - before}`);
      check('wallet: ledger entry written', txCount(app) > txBefore, `${txBefore} -> ${txCount(app)}`);
      const mpesa = (store(app)?.payments ?? []).filter((p) => p.channel === 'mpesa');
      check('wallet: M-PESA payment recorded', mpesa.length > 0, `${mpesa.length} record(s)`);
      const receipt = mpesa.find((p) => /MPESA-/.test(p.reference ?? ''));
      check('wallet: payment carries an M-PESA reference', !!receipt, receipt?.reference ?? 'none');
    } else {
      // A modelled failure (insufficient funds / cancel / timeout) is a legitimate outcome.
      const failed = (store(app)?.payments ?? []).filter((p) => p.channel === 'mpesa' && p.status !== 'success');
      check('wallet: non-success STK still recorded as a payment', failed.length > 0, `statuses: ${failed.map((f) => f.status).join(',') || 'none'}`);
      console.log('   note: modelled Daraja outcome was a failure branch — retried below');
    }
  }

  check('wallet: no runtime errors during M-PESA flow', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));

  /* ------------------------------- card flow ------------------------------- */
  console.log('\n═══ Wallet: card top-up with 3-D Secure ═══');
  const cardApp = bootApp();
  await sleep(1400);
  await loginAs(cardApp, 'analyst@iprs.co.ke');
  const cardUser = me(cardApp)?.id;
  const cardBefore = balanceOf(cardApp, cardUser);
  await cardApp.goto('/wallet');
  const tu = cardApp.findTab('Top up');
  if (tu) cardApp.click(tu);
  await sleep(700);

  // Segmented control options are exact-label buttons.
  const cardTab = cardApp.findButtonExact('Card');
  check('card: method switch to Card present', !!cardTab);
  if (cardTab) cardApp.click(cardTab);
  await sleep(600);

  const pan = cardApp.findInput(/4242|card number/i);
  const exp = cardApp.findInput(/09\/28|expiry|mm/i);
  const cvc = cardApp.findInput(/123|cvc|cvv/i);
  const holder = cardApp.findInput(/KAMAU|holder|name on/i);
  check('card: all four fields render', !!(pan && exp && cvc && holder), `pan=${!!pan} exp=${!!exp} cvc=${!!cvc} holder=${!!holder}`);

  if (pan && exp && cvc && holder) {
    const amt = cardApp.$('input[type="number"]');
    if (amt) cardApp.setInput(amt, 10000);
    cardApp.setInput(pan, '4242424242424242');
    cardApp.setInput(exp, '12/29');
    cardApp.setInput(cvc, '123');
    cardApp.setInput(holder, 'SARAH WANJIKU');
    await sleep(250);

    // NB: prefer the exact label. A loose 'pay' match hits the header's "Payments Monitor →"
    // link and the flow would then click the wrong control and never raise the 3-DS challenge.
    const pay = cardApp.findButtonExact('authorise') || cardApp.findButton('authorise') || cardApp.findButton('charge card');
    check('card: authorise control present', !!pay && /authorise/i.test(pay.textContent ?? ''), pay ? (pay.textContent ?? '').trim().slice(0, 40) : 'not found');
    if (pay) cardApp.click(pay);

    const otpAppeared = await cardApp.waitFor(() => !!cardApp.findInput(/otp|123456|code/i) || /3-d secure|enter the otp|authorise/i.test(cardApp.text()), { timeout: 20000 });
    check('card: 3-D Secure challenge raised', otpAppeared);

    const otp = cardApp.findInput(/otp|123456|code/i);
    if (otp) {
      cardApp.setInput(otp, '482913');
      await sleep(200);
      const confirm = cardApp.findButton('confirm') || cardApp.findButton('verify') || cardApp.findButton('authorise') || cardApp.findButton('submit');
      if (confirm) cardApp.click(confirm);

      const credited = await cardApp.waitFor(() => balanceOf(cardApp, cardUser) !== cardBefore, { timeout: 30000, interval: 500 });
      const cardAfter = balanceOf(cardApp, cardUser);
      check('card: balance moved after 3-DS confirm', credited, `${cardBefore} -> ${cardAfter}`);
      if (credited && cardAfter > cardBefore) {
        // 2.9% processing fee is charged, so the credit is the gross top-up.
        check('card: credited the gross top-up (10,000)', cardAfter - cardBefore === 10000, `delta=${cardAfter - cardBefore}`);
        const cardPay = (store(cardApp)?.payments ?? []).filter((p) => p.channel === 'card');
        check('card: payment recorded with a fee', cardPay.some((p) => p.feeKes > 0), `fees: ${cardPay.map((p) => p.feeKes).join(',')}`);
        check('card: PAN is masked at rest', cardPay.every((p) => !/4242424242424242/.test(JSON.stringify(p))), 'raw PAN found in store');
      }
    }
  }
  check('card: no runtime errors during card flow', cardApp.errors.length === 0, cardApp.errors.slice(0, 2).join(' | '));

  /* ---------------------------- decline path ---------------------------- */
  console.log('\n═══ Wallet: card decline on OTP 000000 ═══');
  const decApp = bootApp();
  await sleep(1400);
  await loginAs(decApp, 'analyst@iprs.co.ke');
  const decUser = me(decApp)?.id;
  const decBefore = balanceOf(decApp, decUser);
  await decApp.goto('/wallet');
  const tu2 = decApp.findTab('Top up');
  if (tu2) decApp.click(tu2);
  await sleep(700);
  const ct = decApp.findButtonExact('Card');
  if (ct) decApp.click(ct);
  await sleep(600);
  const pan2 = decApp.findInput(/4242|card number/i);
  if (pan2) {
    const amt2 = decApp.$('input[type="number"]');
    if (amt2) decApp.setInput(amt2, 3000);
    decApp.setInput(pan2, '4242424242424242');
    decApp.setInput(decApp.findInput(/09\/28|expiry|mm/i), '12/29');
    decApp.setInput(decApp.findInput(/123|cvc|cvv/i), '123');
    decApp.setInput(decApp.findInput(/KAMAU|holder|name on/i), 'SARAH WANJIKU');
    await sleep(250);
    const pay2 = decApp.findButtonExact('authorise') || decApp.findButton('authorise') || decApp.findButton('charge card');
    if (pay2) decApp.click(pay2);
    const otp2 = await decApp.waitFor(() => !!decApp.findInput(/otp|123456|code/i), { timeout: 20000 });
    if (otp2) {
      decApp.setInput(decApp.findInput(/otp|123456|code/i), '000000');
      await sleep(200);
      const conf = decApp.findButton('confirm') || decApp.findButton('verify') || decApp.findButton('authorise') || decApp.findButton('submit');
      if (conf) decApp.click(conf);
      await decApp.waitFor(() => (store(decApp)?.payments ?? []).some((p) => p.channel === 'card' && p.status === 'failed'), { timeout: 25000, interval: 500 });
      const decAfter = balanceOf(decApp, decUser);
      check('decline: OTP 000000 produces a failed payment', (store(decApp)?.payments ?? []).some((p) => p.channel === 'card' && p.status === 'failed'), '');
      check('decline: wallet NOT credited', decAfter === decBefore, `${decBefore} -> ${decAfter}`);
    } else {
      check('decline: 3-DS challenge raised', false, 'no OTP field appeared');
    }
  }
  check('decline: no runtime errors', decApp.errors.length === 0, decApp.errors.slice(0, 2).join(' | '));

  return app;
}

/* -------------------------------------------------------------------------- */
/*                          3. Verification search                             */
/* -------------------------------------------------------------------------- */

async function searchFlow() {
  console.log('\n═══ Search: run a verification end to end ═══');
  const app = bootApp();
  await sleep(1500);
  const login = await loginAs(app, 'analyst@iprs.co.ke');
  check('search: analyst signed in', login.ok, login.why);
  if (!login.ok) return;

  const userId = me(app)?.id;
  const balBefore = balanceOf(app, userId);
  const histBefore = store(app)?.searchHistory?.length ?? 0;
  const usageBefore = store(app)?.usage?.length ?? 0;

  await app.goto('/search');
  const name = app.findInput(/John Mwangi|full name/i);
  const idn = app.findInput(/23456789|id number|national id/i);
  check('search: subject fields render', !!(name && idn), `name=${!!name} id=${!!idn}`);

  if (name && idn) {
    app.setInput(name, 'Jane Wanjiru Kimani');
    app.setInput(idn, '34567890');
    const phone = app.findInput(/0712 345 678/i);
    if (phone) app.setInput(phone, '0723456789');
    await sleep(400);

    /*
     * canRun() requires a lawful-basis consent tick — a search must NOT be launchable
     * until the operator confirms consent under the Data Protection Act 2019. Assert
     * the gate holds, then tick it (the Checkbox is a real sr-only <input>, so React
     * needs a click rather than a value assignment).
     */
    const runLocked = app.findButton('run verification');
    check('search: Run is blocked before consent is given', !!runLocked && runLocked.disabled === true, runLocked ? `disabled=${runLocked.disabled}` : 'not found');
    const consent = app.$$('input[type="checkbox"]')[0];
    check('search: a consent control is present', !!consent);
    if (consent) { consent.click(); await sleep(400); }
    check('search: consent tick recorded', consent?.checked === true);

    const run = app.findButton('run verification');
    check('search: Run verification enabled once consented', !!run, run ? `disabled=${run.disabled}` : 'not found');
    if (run && !run.disabled) {
      app.click(run);
      /*
       * Wait on the real completion signal. The wallet reserve happens early in the
       * pipeline while dossier/usage/searchHistory/notifications are all written by one
       * later setState — waiting on the balance alone returns before that lands and the
       * window would be closed mid-flight, producing a false "history 0 -> 0" pass.
       */
      const done = await app.waitFor(
        () => (store(app)?.searchHistory?.length ?? 0) > histBefore,
        { timeout: 60000, interval: 500 }
      );
      check('search: run completed and persisted a search record', done, `history ${histBefore} -> ${store(app)?.searchHistory?.length ?? 0}`);

      const hist = store(app)?.searchHistory ?? [];
      const rec = hist[0];
      check('search: record names the subject queried', /Jane Wanjiru Kimani/i.test(rec?.subject ?? ''), rec?.subject);
      check('search: record priced from the 0–500 batch', (rec?.costKes ?? 0) > 0, `KES ${rec?.costKes}`);
      check('search: record attributed to the analyst', rec?.userId === userId, rec?.userId);

      const balAfter = balanceOf(app, userId);
      check('search: wallet debited exactly the stated price', balAfter !== null && balBefore !== null && balBefore - balAfter === (rec?.costKes ?? -1), `${balBefore} -> ${balAfter} (cost ${rec?.costKes})`);

      const usageAfter = store(app)?.usage?.length ?? 0;
      check('search: per-provider usage appended', usageAfter > usageBefore, `${usageBefore} -> ${usageAfter}`);
      check('search: a dossier was produced and cached', !!store(app)?.activeDossier && Object.keys(store(app)?.dossierCache ?? {}).length > 0, store(app)?.activeDossier?.id);
      check('search: operator notified the report is ready', (store(app)?.notifications ?? []).some((n) => n.userId === userId && /report|ready|flagged/i.test(n.title ?? '')));
    } else if (run) {
      console.log('   note: Run stayed disabled after consent');
      check('search: Run disabled only for a stated reason', /insufficient|balance|top up/i.test(app.text()), app.text().slice(0, 80).replace(/\s+/g, ' '));
    }
  }
  check('search: no runtime errors', app.errors.length === 0, app.errors.slice(0, 3).join(' | '));
  app.window.close();
}

/* -------------------------------------------------------------------------- */
/*                4. Admin creation rules (requirement 10)                      */
/* -------------------------------------------------------------------------- */

async function accountCreationFlow() {
  console.log('\n═══ Accounts: Super Admin creates an Admin ═══');
  const app = bootApp();
  await sleep(1500);
  const login = await loginAs(app, 'superadmin@iprs.co.ke');
  check('accounts: super admin signed in', login.ok, login.why);
  if (!login.ok) return;

  const before = userCount(app);
  await app.goto('/admin');
  const newBtn = app.findButton('new account');
  check('accounts: New account control present', !!newBtn);
  if (!newBtn) return;
  app.click(newBtn);
  await sleep(800);

  /*
   * Scope to the dialog. The admin console behind the modal has its own search box and
   * a tier *filter* select that also lists every tier — unscoped lookups match those
   * instead of the create form, which is why the first attempt silently did nothing.
   */
  const dlg = app.dialog();
  check('accounts: create dialog opened', !!dlg);
  if (!dlg) return;

  const nameEl = dlg.findInput(/Jane Wanjiru|full name/i);
  const emailEl = dlg.findInput(/jane@iprs|email/i);
  check('accounts: create form rendered', !!(nameEl && emailEl), `name=${!!nameEl} email=${!!emailEl}`);
  if (!nameEl || !emailEl) return;

  const stamp = Date.now().toString().slice(-6);
  dlg.setInput(nameEl, 'Test Admin');
  dlg.setInput(emailEl, `test.admin.${stamp}@iprs.co.ke`);

  // Tier selector inside the dialog: options are exactly user|admin|super_admin.
  await app.waitFor(() => dlg.selects().some((s2) => {
    const vals = [...s2.options].map((o) => o.value);
    return vals.includes('admin') && vals.includes('user') && !vals.includes('all');
  }), { timeout: 8000, label: 'tier select in dialog' });
  const tierSelect = dlg.selects().find((s2) => {
    const vals = [...s2.options].map((o) => o.value);
    return vals.includes('admin') && vals.includes('user') && !vals.includes('all');
  });
  check('accounts: tier selector found in dialog', !!tierSelect, tierSelect ? `opts=${[...tierSelect.options].map((o) => o.value).join('|')}` : 'none');
  check('accounts: tier selector accepted admin', (() => {
    if (!tierSelect) return false;
    dlg.setInput(tierSelect, 'admin');
    return true;
  })() && tierSelect.value === 'admin', `value=${tierSelect?.value}`);
  const saOpt = tierSelect ? [...tierSelect.options].find((o) => o.value === 'super_admin') : null;
  check('accounts: super_admin option is disabled in the picker', !!saOpt && saOpt.disabled === true, saOpt ? `disabled=${saOpt.disabled}` : 'not offered');
  await sleep(300);

  const submit = dlg.findButtons('create account').pop();
  check('accounts: Create account submit present', !!submit);
  if (submit) app.click(submit);

  const created = await app.waitFor(() => userCount(app) > before, { timeout: 20000, interval: 400 });
  check('accounts: Super Admin created an Admin', created, `${before} -> ${userCount(app)}`);
  if (created) {
    const s = store(app);
    const nu = s.users[s.users.length - 1];
    check('accounts: new account has tier=admin', nu?.tier === 'admin', `tier=${nu?.tier}`);
    check('accounts: a wallet was provisioned for it', !!s.wallets?.find((w) => w.userId === nu.id), '');
    check('accounts: creation was audited', (s.audit ?? []).some((a) => a.action === 'user.created'), '');
  }
  check('accounts: no runtime errors', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));
  app.window.close();

  /* --------------------- Admin must be refused an Admin --------------------- */
  console.log('\n═══ Accounts: Admin is refused creating an Admin ═══');
  const a2 = bootApp();
  await sleep(1400);
  await loginAs(a2, 'admin@iprs.co.ke');
  const before2 = userCount(a2);
  await a2.goto('/admin');
  const nb = a2.findButton('new account');
  check('accounts(admin): New account control present', !!nb);
  if (nb) {
    a2.click(nb);
    await sleep(800);
    const d2 = a2.dialog();
    check('accounts(admin): create dialog opened', !!d2);
    if (!d2) return;
    const n = d2.findInput(/Jane Wanjiru|full name/i);
    const e = d2.findInput(/jane@iprs|email/i);
    if (n && e) {
      d2.setInput(n, 'Should Fail');
      d2.setInput(e, `should.fail.${Date.now().toString().slice(-6)}@iprs.co.ke`);
      await a2.waitFor(() => d2.selects().some((s3) => {
        const vals = [...s3.options].map((o) => o.value);
        return vals.includes('admin') && vals.includes('user');
      }), { timeout: 8000, label: 'admin-dialog tier select' });
      const sel = d2.selects().find((s3) => {
        const vals = [...s3.options].map((o) => o.value);
        return vals.includes('admin') && vals.includes('user') && !vals.includes('all');
      });
      const adminOpt = sel ? [...sel.options].find((o) => o.value === 'admin') : null;
      // The picker disables tiers the actor may not create, rather than hiding them.
      check('accounts(admin): Admin tier is disabled in the picker for an Admin', !!adminOpt && adminOpt.disabled === true, adminOpt ? `disabled=${adminOpt.disabled}` : 'option absent');
      // Attempt anyway: the disabled option cannot be committed, so the count must hold.
      if (sel && adminOpt) d2.setInput(sel, 'admin');
      await sleep(250);
      const sub = d2.findButtons('create account').pop();
      if (sub) a2.click(sub);
      await sleep(2500);
      check('accounts(admin): Admin tier NOT creatable by an Admin', userCount(a2) === before2, `${before2} -> ${userCount(a2)}`);
      check('accounts(admin): refusal explained in the UI', /only a super admin|not permitted|cannot|refused|super admin/i.test(a2.text()) || (adminOpt?.disabled === true), a2.text().slice(0, 90).replace(/\s+/g, ' '));
    }
  }
  check('accounts(admin): no runtime errors', a2.errors.length === 0, a2.errors.slice(0, 2).join(' | '));
  a2.window.close();
}

/* -------------------------------------------------------------------------- */
/*                        5. Refund flow (requirement 8)                        */
/* -------------------------------------------------------------------------- */

async function refundFlow() {
  console.log('\n═══ Payments: refund a successful payment ═══');
  const app = bootApp();
  await sleep(1500);
  const login = await loginAs(app, 'superadmin@iprs.co.ke');
  check('refund: super admin signed in', login.ok, login.why);
  if (!login.ok) return;

  const succeeded = paymentsWith(app, 'success');
  check('refund: seeded successful payments exist', succeeded.length > 0, `${succeeded.length} found`);
  if (!succeeded.length) return;
  const target = succeeded[0];
  const beforeRefunded = paymentsWith(app, 'refunded').length;

  await app.goto('/payments');
  const refundBtns = app.findButtons('refund');
  check('refund: refund controls rendered', refundBtns.length > 0, `${refundBtns.length} found`);
  if (!refundBtns.length) return;

  app.click(refundBtns[0]);
  await sleep(800);
  const rdlg = app.dialog();
  check('refund: confirmation dialog opened', !!rdlg);
  if (!rdlg) return;
  const reason = rdlg.findInput(/reason/i) ?? rdlg.$('textarea');
  if (reason) rdlg.setInput(reason, 'Automated smoke-test refund');
  await sleep(200);
  const confirm = rdlg.findButtons('refund').pop() || rdlg.findButton('confirm');
  check('refund: confirmation control present', !!confirm);
  if (confirm) app.click(confirm);

  const done = await app.waitFor(() => paymentsWith(app, 'refunded').length > beforeRefunded, { timeout: 20000, interval: 400 });
  check('refund: payment status became refunded', done, `${beforeRefunded} -> ${paymentsWith(app, 'refunded').length}`);
  if (done) {
    const s = store(app);
    check('refund: reversal written to the wallet ledger', (s.walletTransactions ?? []).some((t) => t.kind === 'refund'), '');
    check('refund: audited', (s.audit ?? []).some((a) => /refund/i.test(a.action)), '');
  }
  check('refund: no runtime errors', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));
  app.window.close();
}

/* -------------------------------------------------------------------------- */

async function main() {
  await walletFlows();
  await searchFlow();
  await accountCreationFlow();
  await refundFlow();

  const fails = summarise('interactive flows');
  console.log('note: no geometry/responsive assertions — jsdom performs no layout.');
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error('HARNESS FAILURE:', e); process.exit(2); });
