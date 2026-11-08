// Region PHASE 5 E2E: a controlled region is developed through the UI: repair sites (cost + time),
// assign workers (shared labor), production and upkeep reflected, erosion cleanup -> 지역 개발 완료,
// state survives save/load; an uncontrolled region cannot be managed.
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
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-r5-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const g = (fn) => p.evaluate(fn);

  await p.goto(URL);
  await step('no controlled region yet -> 지역 관리 shows empty state', async () => {
    await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await tap('spd-pause');
    await tap('nav-regionManage'); await see('screen-regionManage');
    assert((await p.locator('.rm-item').count()) === 0, 'should be empty');
    await tap('back');
  });
  await step('after control (set via test hook): map offers 지역 관리, sites are damaged, nothing produced', async () => {
    await g(() => { const G = window.__uhaGame; const s = G.getState().state;
      G.setState({ state: { ...s, resources: { ...s.resources, material: 5000, parts: 2000, budget: 20000 },
        regions: { ...s.regions, rg_industrial: { unlocked: true, state: 4, generalRuns: 1, generalClears: 1 } },
        strategicOps: { op_industrial_forward: { attempts: 1, objectiveAchieved: true, returned: true, rewardGranted: true, controlGranted: false, completedAt: 1 }, op_industrial_control: { attempts: 1, objectiveAchieved: true, returned: true, rewardGranted: true, controlGranted: true, completedAt: 2 } } } }); });
    await tap('nav-regionMap'); await tap('region-rg_industrial'); await tap('btn-region-manage'); await see('screen-regionManage');
    assert((await txt('site-status-ind_plant')) === '손상', 'not damaged');
    assert((await txt('rm-produce')) === '없음', 'producing before repair');
  });
  await step('repair both sites: cost paid, repair progresses over game time', async () => {
    const mat0 = await g(() => window.__uhaGame.getState().state.resources.material);
    await tap('site-repair-ind_plant'); await tap('site-repair-ind_yard');
    assert((await txt('site-status-ind_plant')) === '복구 중', 'not repairing');
    assert((await g(() => window.__uhaGame.getState().state.resources.material)) < mat0, 'cost not paid');
    await tap('back'); await tap('back'); await tap('spd-4');
    await p.waitForFunction(() => Object.values(window.__uhaGame.getState().state.regionDev.rg_industrial.sites).every((x) => x.status === 'active'), null, { timeout: 30000 });
    await tap('spd-pause');
  });
  await step('assign workers -> production appears, labor shared with base', async () => {
    await tap('nav-regionManage'); await see('screen-regionManage');
    const free0 = await txt('labor-free');
    await tap('site-max-ind_plant'); await tap('site-max-ind_yard');
    assert((await txt('rm-produce')).includes('산업 부품'), await txt('rm-produce'));
    assert(free0 !== await txt('labor-free'), 'labor not consumed');
    assert((await txt('rm-consume')).includes('예산'), 'no upkeep');
  });
  await step('cleanup crew lowers erosion -> 지역 개발 완료 (state 5)', async () => {
    await tap('rm-clean-max');
    await g(() => { const G = window.__uhaGame; const s = G.getState().state; G.setState({ state: { ...s, regionDev: { ...s.regionDev, rg_industrial: { ...s.regionDev.rg_industrial, erosion: 21 } } } }); }); // skip most of the wait
    await tap('back'); await tap('spd-4');
    await p.waitForFunction(() => window.__uhaGame.getState().state.regions.rg_industrial.state === 5, null, { timeout: 40000 });
    await tap('spd-pause'); await tap('nav-regionManage');
    assert((await txt('rm-state')) === '지역 개발 완료', await txt('rm-state'));
    await p.screenshot({ path: `${OUT}/${name}-r5-developed.png` });
  });
  await step('development survives save -> reload -> load', async () => {
    await tap('back'); await tap('nav-save'); await tap('slot-1'); await tap('btn-save');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-1"]')?.textContent === '정상');
    await p.reload(); await tap('btn-load'); await tap('slot-1'); await tap('btn-load-slot'); await see('screen-main');
    await tap('nav-regionManage');
    assert((await txt('rm-state')) === '지역 개발 완료', 'state lost');
    assert((await txt('site-workers-ind_plant')) !== '0', 'workers lost');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
