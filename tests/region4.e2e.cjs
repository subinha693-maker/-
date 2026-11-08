// Region PHASE 4 E2E: strategic operations through the UI. Forward-base op -> objective node ->
// return -> state 3; control op with a mid-operation save/load -> state 4 and neighbours unlock;
// a withdrawn operation grants nothing.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || 'shots';
const URL = (process.argv[3] || 'http://localhost:4173/') + '?e2e';
require('fs').mkdirSync(OUT, { recursive: true });

async function run(name, ctxOpts) {
  const b = await chromium.launch();
  const p = await (await b.newContext(ctxOpts)).newPage();
  const errors = [], steps = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const tap = (id) => p.getByTestId(id).click();
  const see = (id, t = 5000) => p.getByTestId(id).waitFor({ timeout: t });
  const txt = (id) => p.getByTestId(id).innerText();
  const visible = (sel) => p.locator(sel).first().isVisible().catch(() => false);
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-r4-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const state = (id) => p.getByTestId(`region-${id}`).getAttribute('data-state');
  const resolveModal = async () => {
    for (let k = 0; k < 3; k++) {
      if (await visible('[data-testid^="ev-reward-"]')) await p.locator('[data-testid^="ev-reward-"]').first().click();
      else if (await visible('[data-testid^="ev-relic-"]')) await p.locator('[data-testid^="ev-relic-"]').first().click();
      else if (await visible('[data-testid^="ev-agent-"]')) await p.locator('[data-testid^="ev-agent-"]').first().click();
      else if (await visible('[data-testid="ev-choice-0"]')) await tap('ev-choice-0');
      else if (await visible('[data-testid="ev-ok"]')) await tap('ev-ok');
      else if (await visible('[data-testid="ev-skip"]')) await tap('ev-skip');
      else break;
      await p.waitForTimeout(100);
    }
  };
  /** Plays nodes until the map is cleared, or until the objective node is next (stopAtObjective). */
  const play = async (stopAtObjective = false) => {
    for (let i = 0; i < 40; i++) {
      if (await p.getByTestId('map-cleared').isVisible().catch(() => false)) return;
      if (await visible('.modal')) { await resolveModal(); continue; }
      const node = p.locator('.map-node.reach').first(); const type = await node.getAttribute('data-type');
      if (stopAtObjective && type === 'objective') return;
      await node.click(); await tap('btn-enter');
      if (['combat', 'elite', 'boss', 'objective'].includes(type)) { await see('screen-battle'); await p.evaluate(() => window.__uhaBattle.win()); await tap('btn-battle-continue'); await see('screen-expeditionMap'); }
      await p.waitForTimeout(120); await resolveModal();
    }
  };
  const launchOp = async (op) => {
    await tap(`btn-op-${op}`); await see('prep-op');
    for (const id of ['aion', 'ring', 'jerag']) await tap(`pick-${id}`);
    await tap('btn-launch'); await see('screen-expeditionMap');
  };

  await p.goto(URL);
  await step('setup: new game, industrial region at 정보 확보 (reached via a general run in region PHASE 3)', async () => {
    await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await tap('spd-pause');
    await p.evaluate(() => { const g = window.__uhaGame; const s = g.getState().state; g.setState({ state: { ...s, regions: { ...s.regions, rg_industrial: { unlocked: true, state: 2, generalRuns: 1, generalClears: 1 } } } }); });
    await tap('nav-regionMap'); await tap('region-rg_industrial');
    assert((await txt('op-status-op_industrial_forward')) === '개시 가능', 'forward op not available');
    assert(await p.getByTestId('btn-op-op_industrial_control').isDisabled(), 'control op should be blocked');
  });
  await step('forward-base op: briefing -> objective node on the map', async () => {
    await launchOp('op_industrial_forward');
    assert((await p.locator('.map-node[data-type="objective"]').count()) === 1, 'no objective node');
    assert((await p.locator('.map-node[data-type="boss"]').count()) === 0, 'boss still there');
    assert((await txt('op-objective-state')) === '미달성', 'objective state');
  });
  await step('objective completed -> "목표 달성 · 귀환 필요", region still 2', async () => {
    await play();
    assert((await txt('op-objective-state')).startsWith('목표 달성'), await txt('op-objective-state'));
    const st = await p.evaluate(() => window.__uhaGame.getState().state.regions.rg_industrial.state);
    assert(st === 2, 'territory changed before return');
    await p.screenshot({ path: `${OUT}/${name}-r4-objective.png` });
  });
  await step('return -> result "성공 · 전진 거점 확보" -> region state 3', async () => {
    await tap('btn-clear-return'); await see('screen-result');
    assert((await txt('result-op')).includes('전진 거점 확보'), await txt('result-op'));
    await tap('btn-to-base'); await tap('nav-regionMap');
    assert((await state('rg_industrial')) === '3', 'not state 3');
  });
  await step('control op: save mid-operation, reload, load, continue', async () => {
    await tap('region-rg_industrial'); await launchOp('op_industrial_control');
    await play(true);
    await tap('btn-map-save'); await tap('slot-1'); await tap('btn-save');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-1"]')?.textContent === '정상');
    await p.reload(); await tap('btn-load'); await tap('slot-1'); await tap('btn-load-slot'); await see('screen-expeditionMap');
    assert((await p.locator('.map-node[data-type="objective"].reach').count()) === 1, 'objective not next after load');
  });
  await step('objective + return -> control: state 4, 1/5 controlled, neighbours unlocked', async () => {
    await play(); await tap('btn-clear-return'); await see('screen-result');
    assert((await txt('result-op')).includes('통제권 확보'), await txt('result-op'));
    await tap('btn-to-base'); await tap('nav-regionMap');
    assert((await state('rg_industrial')) === '4', 'not state 4');
    assert((await txt('controlled-count')).includes('1 / 5'), 'count');
    assert((await p.getByTestId('region-rg_residential').getAttribute('data-unlocked')) === 'true', 'residential not unlocked');
    await tap('region-rg_industrial');
    assert((await txt('op-status-op_industrial_control')) === '작전 완료', 'not completed');
    await p.screenshot({ path: `${OUT}/${name}-r4-control.png` });
  });
  await step('withdrawal before the objective grants nothing', async () => {
    await p.evaluate(() => { const g = window.__uhaGame; const s = g.getState().state; g.setState({ state: { ...s, regions: { ...s.regions, rg_energy: { ...s.regions.rg_energy, state: 2, generalRuns: 1, generalClears: 1 } } } }); });
    await tap('region-rg_energy'); await launchOp('op_energy_forward');
    await tap('btn-return'); await tap('confirm'); await see('screen-result');
    assert((await txt('result-op')).includes('실패'), await txt('result-op'));
    await tap('btn-to-base'); await tap('nav-regionMap');
    assert((await state('rg_energy')) === '2', 'energy changed');
    await tap('region-rg_energy');
    assert((await txt('op-status-op_energy_forward')) === '개시 가능', 'op should be retryable');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
