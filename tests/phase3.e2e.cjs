// PHASE 3 E2E: first-run tutorial played for real (highlight + required clicks), resume after quitting
// mid-tutorial, skip during the tutorial, replay from settings, and no prompt for non-first runs.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || 'shots';
const URL = process.argv[3] || 'http://localhost:4173/';
require('fs').mkdirSync(OUT, { recursive: true });

async function run(name, ctxOpts) {
  const b = await chromium.launch();
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage();
  const errors = [], steps = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `${OUT}/${name}-p3-${n}.png` }); };
  const tap = (id) => p.getByTestId(id).click();
  const see = (id, t = 5000) => p.getByTestId(id).waitFor({ timeout: t });
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-p3-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const stepLabel = async () => { await p.waitForTimeout(200); return p.getByTestId('tut-step').innerText(); };
  // Press "다음" (finishing the typewriter first if needed) until the overlay asks for an action or the step changes.
  const nextUntilWait = async (max = 12) => {
    await p.waitForTimeout(150); // let a just-clicked action advance the line first
    const startLabel = await p.getByTestId('tut-step').innerText().catch(() => '');
    for (let i = 0; i < max; i++) {
      const now = await p.getByTestId('tut-step').innerText().catch(() => '');
      if (i > 0 && now !== startLabel) return; // stop at a step boundary
      if (await p.getByTestId('tut-waiting').isVisible().catch(() => false)) return;
      if (!(await p.getByTestId('tutorial-overlay').isVisible().catch(() => false))) return;
      await tap('tut-box'); // completes typing
      const next = p.getByTestId('tut-next');
      if (await next.isVisible().catch(() => false)) await next.click();
      await p.waitForTimeout(60);
    }
  };
  // A click outside the highlight must be blocked by the shield.
  const blockedClick = async (testid) => {
    const before = await p.locator('[data-testid^="screen-"]').first().getAttribute('data-testid');
    await p.getByTestId(testid).click({ force: true, timeout: 1500 }).catch(() => {});
    await p.waitForTimeout(150);
    return before === await p.locator('[data-testid^="screen-"]').first().getAttribute('data-testid');
  };

  await p.goto(URL); await see('screen-title');
  await step('first run: new game offers the tutorial', async () => { await tap('btn-new-game'); await see('tut-start'); await shot('00-prompt'); await tap('tut-start'); await see('tutorial-overlay'); });
  await step('STEP 1 shows secretary + dialogue UI', async () => {
    assert((await stepLabel()).startsWith('STEP 1 / 10'), await stepLabel());
    await p.waitForTimeout(400); await shot('01-step1');
  });
  await step('menu is blocked while Aila is talking', async () => assert(await blockedClick('nav-research'), 'click went through'));
  await step('STEP 2: highlights main UI areas', async () => {
    await nextUntilWait(5); // through step 1 -> into step 2
    assert((await stepLabel()).startsWith('STEP 2'), await stepLabel());
    await see('tut-hole'); await shot('02-step2-topbar');
  });
  await step('STEP 3: player must click a resource (popover opens)', async () => {
    await nextUntilWait(); assert((await stepLabel()).startsWith('STEP 3'), await stepLabel());
    await nextUntilWait(); await see('tut-waiting'); await shot('03-await-resource');
    await tap('res-food'); await see('res-pop');
  });
  await step('quit mid-tutorial (reload) and continue -> resumes at STEP 3', async () => {
    await p.waitForTimeout(300);
    await p.reload(); await see('screen-title');
    // autosaves happen on each completed step; step 3 started, so resume at step 3
    await tap('btn-continue'); await see('tutorial-overlay');
    assert((await stepLabel()).startsWith('STEP 3'), 'resumed at ' + await stepLabel());
  });
  await step('STEP 3 -> 4: click resource, then navigate to facilities via highlighted menu', async () => {
    await nextUntilWait(); await tap('res-power'); await nextUntilWait();
    assert((await stepLabel()).startsWith('STEP 4'), await stepLabel());
    await tap('nav-facilities'); await see('screen-facilities'); await shot('04-facilities');
  });
  await step('STEP 5: back -> research', async () => {
    await nextUntilWait(); assert((await stepLabel()).startsWith('STEP 5'), await stepLabel());
    await tap('back'); await see('screen-main'); await nextUntilWait(); await tap('nav-research'); await see('screen-research');
  });
  await step('STEP 6: squad, select a member', async () => {
    await nextUntilWait(); assert((await stepLabel()).startsWith('STEP 6'), await stepLabel());
    await tap('back'); await nextUntilWait(); await tap('nav-squad'); await see('screen-squad');
    await nextUntilWait(); await tap('card-ling'); await nextUntilWait(1);
    await shot('06-char-detail');
  });
  await step('STEP 7: expedition prep, choose 3 members (signal)', async () => {
    await nextUntilWait(); assert((await stepLabel()).startsWith('STEP 7'), await stepLabel());
    await tap('back'); await nextUntilWait(); await tap('nav-expeditionPrep'); await see('screen-expeditionPrep');
    await nextUntilWait(); await see('tut-waiting');
    await tap('pick-shion_shirayuko'); await tap('pick-james_harold'); await tap('pick-miley_sneaker');
    await p.waitForTimeout(200); await shot('07-party');
  });
  await step('STEP 8: training map opens with chosen party, no expedition created', async () => {
    await nextUntilWait(); await see('screen-expeditionMap');
    assert((await stepLabel()).startsWith('STEP 8'), await stepLabel());
    const party = (await p.locator('.party-mini').allInnerTexts()).join('|');
    assert(party.includes('시온') && party.includes('제임스') && party.includes('마일리'), party);
    await nextUntilWait(); await tap('node-n0'); await nextUntilWait(); await tap('btn-enter'); await see('screen-battle');
  });
  await step('STEP 9: battle explanation', async () => {
    assert((await stepLabel()).startsWith('STEP 9'), await stepLabel());
    await shot('09-battle');
  });
  await step('STEP 10: returns to main and completes', async () => {
    await nextUntilWait(); await see('screen-main');
    assert((await stepLabel()).startsWith('STEP 10'), await stepLabel());
    await shot('10-end');
    await nextUntilWait();
    await p.getByTestId('tutorial-overlay').waitFor({ state: 'detached', timeout: 3000 });
  });
  await step('after completion: reload + continue has no tutorial', async () => {
    await p.waitForTimeout(300); await p.reload(); await tap('btn-continue'); await see('screen-main');
    await p.waitForTimeout(400);
    assert(!(await p.getByTestId('tutorial-overlay').isVisible().catch(() => false)), 'tutorial still active');
  });
  await step('replay from settings, then skip mid-way with confirmation', async () => {
    await tap('nav-settings'); await tap('replay-tutorial'); await see('tutorial-overlay');
    await tap('tut-skip'); await tap('confirm');
    await p.getByTestId('tutorial-overlay').waitFor({ state: 'detached', timeout: 3000 });
  });
  await step('not a first run any more: new game does not offer the tutorial', async () => {
    await tap('nav-title'); await tap('confirm'); await tap('btn-new-game'); await see('screen-main');
    await p.waitForTimeout(300);
    assert(!(await p.getByTestId('tut-start').isVisible().catch(() => false)), 'prompt shown again');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
