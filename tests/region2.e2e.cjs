// Region reclamation PHASE 2 E2E: strategic map shows the finite region list with states,
// connections and lock status; detail separates general expeditions and strategic operations;
// region state survives save/load.
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
  const attr = (id, a) => p.getByTestId(id).getAttribute(a);
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-r2-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const ids = ['rg_industrial', 'rg_residential', 'rg_energy', 'rg_research', 'rg_military'];

  await p.goto(URL);
  await step('main menu -> strategic map with the fixed 5 regions', async () => {
    await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await tap('spd-pause');
    await tap('nav-regionMap'); await see('screen-regionMap');
    assert((await p.locator('[data-testid^="region-rg_"]').count()) === 5, 'region count');
  });
  await step('new game: only the first region is open, everything is 미확인', async () => {
    for (const id of ids) assert((await attr(`region-${id}`, 'data-state')) === '1', `${id} state`);
    assert((await attr('region-rg_industrial', 'data-unlocked')) === 'true', 'first region locked');
    for (const id of ids.slice(1)) assert((await attr(`region-${id}`, 'data-unlocked')) === 'false', `${id} unlocked`);
    assert((await p.getByTestId('controlled-count').innerText()).includes('0 / 5'), 'controlled count');
  });
  await step('detail separates general expedition (repeatable) and strategic operations', async () => {
    await tap('region-rg_industrial');
    assert((await p.getByTestId('general-section').innerText()).includes('반복 가능'), 'general section');
    const op = await p.getByTestId('op-op_industrial_forward').innerText();
    assert(op.includes('전략 작전') && op.includes('주요 목표') && op.includes('목표 달성 후 귀환'), 'op section');
    assert((await p.getByTestId('op-status-op_industrial_forward').innerText()) === '조건 미충족', 'forward op should be blocked at 미확인');
  });
  await step('locked region lists its unlock conditions', async () => {
    await tap('region-rg_research');
    const t = await p.getByTestId('unlock-conditions').innerText();
    assert(t.includes('구 주거 지구') && t.includes('연구 완료'), t);
  });
  await step('progressed state renders all states; completed op shows completion', async () => {
    await p.evaluate(() => {
      const g = window.__uhaGame; const s = g.getState().state;
      const rec = { attempts: 1, objectiveAchieved: true, returned: true, rewardGranted: true, controlGranted: false, completedAt: 100 };
      g.setState({ state: { ...s,
        regions: { ...s.regions, rg_industrial: { unlocked: true, state: 4, generalRuns: 5, generalClears: 3 }, rg_residential: { unlocked: true, state: 3, generalRuns: 2, generalClears: 1 }, rg_energy: { unlocked: true, state: 2, generalRuns: 1, generalClears: 1 } },
        strategicOps: { op_industrial_forward: rec, op_industrial_control: { ...rec, controlGranted: true }, op_residential_forward: rec } } });
    });
    await p.waitForTimeout(150);
    assert((await attr('region-rg_industrial', 'data-state')) === '4', 'industrial 4');
    assert((await attr('region-rg_residential', 'data-state')) === '3', 'residential 3');
    assert((await p.getByTestId('controlled-count').innerText()).includes('1 / 5'), 'count 1');
    await tap('region-rg_industrial');
    assert((await p.getByTestId('op-status-op_industrial_control').innerText()) === '작전 완료', 'completed op');
    await tap('region-rg_residential');
    assert((await p.getByTestId('op-status-op_residential_control').innerText()) === '개시 가능', 'control op should be available at state 3');
    await p.screenshot({ path: `${OUT}/${name}-r2-map.png` });
  });
  await step('region state survives save -> reload -> load', async () => {
    await tap('back'); await tap('nav-save'); await tap('slot-1'); await tap('btn-save');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-1"]')?.textContent === '정상');
    await p.reload(); await tap('btn-load'); await tap('slot-1'); await tap('btn-load-slot'); await see('screen-main');
    await tap('nav-regionMap');
    assert((await attr('region-rg_industrial', 'data-state')) === '4' && (await attr('region-rg_residential', 'data-state')) === '3', 'states lost');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
