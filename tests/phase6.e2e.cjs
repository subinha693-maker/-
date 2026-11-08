// PHASE 6 E2E: start an expedition, explore a generated map node by node through branching paths,
// resolve every kind of node event, save/load mid-run (no re-roll/duplicate), clear the boss,
// return, and see the next difficulty unlocked. Also checks battle retreat = expedition failure.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || 'shots';
const URL = (process.argv[3] || 'http://localhost:4173/') + '?e2e';
require('fs').mkdirSync(OUT, { recursive: true });

async function run(name, ctxOpts) {
  const b = await chromium.launch();
  const p = await (await b.newContext(ctxOpts)).newPage();
  const errors = [], steps = [], seen = new Set();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (n) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${name}-p6-${n}.png` }); };
  const tap = (id) => p.getByTestId(id).click();
  const see = (id, t = 5000) => p.getByTestId(id).waitFor({ timeout: t });
  const visible = (sel) => p.locator(sel).first().isVisible().catch(() => false);
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-p6-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };

  /** Takes one node: picks a reachable node (alternating branch), enters, resolves whatever happens. */
  const advanceOne = async (i) => {
    const reach = p.locator('.map-node.reach');
    const n = await reach.count(); assert(n > 0, 'no reachable node');
    const node = reach.nth(i % n);
    const type = await node.getAttribute('data-type'); seen.add(type);
    await node.click(); await tap('btn-enter');
    if (['combat', 'elite', 'boss'].includes(type)) { await see('screen-battle'); await p.evaluate(() => window.__uhaBattle.win()); await tap('btn-battle-continue'); await see('screen-expeditionMap'); return type; }
    await p.waitForTimeout(150);
    for (let k = 0; k < 3; k++) {
      if (await visible('[data-testid^="ev-relic-"]')) await p.locator('[data-testid^="ev-relic-"]').first().click();
      else if (await visible('[data-testid^="ev-agent-"]')) await p.locator('[data-testid^="ev-agent-"]').nth(k === 0 ? 0 : 0).click();
      else if (await visible('[data-testid="ev-choice-0"]')) await tap('ev-choice-0');
      else if (await visible('[data-testid="ev-ok"]')) await tap('ev-ok');
      else if (await visible('[data-testid="ev-skip"]')) await tap('ev-skip');
      else break;
      await p.waitForTimeout(120);
    }
    return type;
  };

  await p.goto(URL);
  await step('start expedition (difficulty 1, 3 agents) -> generated map', async () => {
    await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await tap('spd-pause');
    await tap('nav-expeditionPrep'); await tap('pick-aion'); await tap('pick-ring'); await tap('pick-jerag'); await tap('btn-launch');
    await see('screen-expeditionMap');
    assert(await p.locator('.map-node[data-type="boss"]').count() === 1, 'no boss');
    assert(await p.locator('.map-node.reach').count() === 1, 'start should be the only reachable node');
    await shot('01-map');
  });
  await step('non-connected nodes cannot be entered', async () => {
    const far = p.locator('.map-node:not(.reach)').nth(3);
    await far.click(); assert(await p.getByTestId('btn-enter').isDisabled(), 'far node enterable');
  });
  await step('first combat node (temporary victory) moves the party forward', async () => {
    await advanceOne(0);
    assert(await p.locator('.map-node.done').count() === 1, 'path not recorded');
    assert(await p.locator('.map-node.reach').count() >= 1, 'no branches');
    await shot('02-after-first');
  });
  await step('save while a node event is open; reload + load shows the same event (no re-roll)', async () => {
    for (let i = 0; i < 10; i++) {
      if (await p.locator('.modal').isVisible().catch(() => false)) break;
      const reach = p.locator('.map-node.reach'); const n = await reach.count(); let target = null;
      for (let j = 0; j < n; j++) { const t = await reach.nth(j).getAttribute('data-type'); if (!['combat', 'elite', 'boss'].includes(t)) { target = reach.nth(j); break; } }
      if (!target) { await advanceOne(i); continue; }
      await target.click(); await tap('btn-enter'); await p.waitForTimeout(200);
    }
    const before = await p.locator('.modal').innerText();
    const path = await p.locator('.map-node.done').count();
    await shot('03-event');
    await tap('ev-save'); await see('screen-saveLoad'); await tap('slot-3'); await tap('btn-save');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-3"]')?.textContent === '정상');
    await tap('back'); await see('screen-expeditionMap');
    await p.reload(); await tap('btn-load'); await tap('slot-3'); await tap('btn-load-slot'); await see('screen-expeditionMap');
    await p.waitForTimeout(200);
    assert((await p.locator('.modal').innerText()) === before, 'event changed after reload');
    assert((await p.locator('.map-node.done').count()) === path, 'path changed');
  });
  await step('explore to the boss through branches; every node event resolves', async () => {
    for (let i = 0; i < 30; i++) {
      if (await p.getByTestId('map-cleared').isVisible().catch(() => false)) break;
      if (await p.locator('.modal').isVisible().catch(() => false)) { await advanceOneModal(); continue; }
      await advanceOne(i);
    }
    await see('map-cleared');
    const relics = await p.getByTestId('relic-owned').allInnerTexts();
    assert(new Set(relics).size === relics.length, 'duplicate relic');
    await shot('04-cleared');
  });
  async function advanceOneModal() {
    if (await visible('[data-testid^="ev-relic-"]')) await p.locator('[data-testid^="ev-relic-"]').first().click();
    else if (await visible('[data-testid^="ev-agent-"]')) await p.locator('[data-testid^="ev-agent-"]').first().click();
    else if (await visible('[data-testid="ev-choice-0"]')) await tap('ev-choice-0');
    else if (await visible('[data-testid="ev-ok"]')) await tap('ev-ok');
    else if (await visible('[data-testid="ev-skip"]')) await tap('ev-skip');
    await p.waitForTimeout(120);
  }
  await step('victory -> result -> base; difficulty 2 unlocked', async () => {
    await tap('btn-clear-return'); await see('screen-result');
    assert((await p.getByTestId('result-title').innerText()) === '원정 완료', 'not victory'); await shot('05-result');
    await tap('btn-to-base'); await see('screen-main');
    await tap('nav-expeditionPrep'); assert(!(await p.getByTestId('diff-2').isDisabled()), 'difficulty 2 still locked');
  });
  await step('battle retreat = expedition failure, nothing unlocked', async () => {
    await tap('pick-aion'); await tap('pick-ring'); await tap('pick-jerag'); await tap('diff-2'); await tap('btn-launch');
    await see('screen-expeditionMap'); await tap('node-c0r0'); await tap('btn-enter'); await see('screen-battle');
    await tap('btn-retreat'); await tap('confirm'); await see('screen-result');
    assert((await p.getByTestId('result-title').innerText()) === '원정 실패', 'not failure');
    await tap('btn-to-base'); await tap('nav-expeditionPrep');
    assert(await p.getByTestId('diff-3').isDisabled(), 'difficulty 3 unlocked by a failure');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nnode types visited: ${[...seen].join(', ')}\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
