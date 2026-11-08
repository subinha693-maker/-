// Region PHASE 6: full campaign slice played through the UI from a new game, with NO state injection
// for regions/ops/resources (battles are resolved with the e2e battle hook; battle play itself is
// covered by phase7). Save/load between every step and in the middle of an operation; checks that
// rewards and control are never granted twice and that deep expedition is not reachable yet.
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
  const see = (id, t = 8000) => p.getByTestId(id).waitFor({ timeout: t });
  const txt = (id) => p.getByTestId(id).innerText();
  const visible = (sel) => p.locator(sel).first().isVisible().catch(() => false);
  const st = () => p.evaluate(() => window.__uhaGame.getState().state);
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-r6-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };
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
  const play = async (stopAtObjective = false) => {
    for (let i = 0; i < 45; i++) {
      if (await p.getByTestId('map-cleared').isVisible().catch(() => false)) return;
      if (await visible('.modal')) { await resolveModal(); continue; }
      const node = p.locator('.map-node.reach').first(); const type = await node.getAttribute('data-type');
      if (stopAtObjective && type === 'objective') return;
      await node.click(); await tap('btn-enter');
      if (['combat', 'elite', 'boss', 'objective'].includes(type)) { await see('screen-battle'); await p.evaluate(() => window.__uhaBattle.win()); await tap('btn-battle-continue'); await see('screen-expeditionMap'); }
      await p.waitForTimeout(120); await resolveModal();
    }
    throw new Error('map not cleared');
  };
  const pick3 = async () => { for (const id of ['aion', 'ring', 'jerag']) await tap(`pick-${id}`); await tap('btn-launch'); await see('screen-expeditionMap'); };
  const saveLoad = async (slot) => {
    const before = await st();
    await tap('nav-save'); await tap(`slot-${slot}`); await tap('btn-save');
    if (await p.getByTestId('confirm').isVisible().catch(() => false)) await tap('confirm');
    await p.waitForFunction((n) => document.querySelector(`[data-testid="slot-status-${n}"]`)?.textContent === '정상', slot);
    await p.reload(); await tap('btn-load'); await tap(`slot-${slot}`); await tap('btn-load-slot'); await see('screen-main');
    const after = await st();
    assert(JSON.stringify(after.regions) === JSON.stringify(before.regions), 'regions changed by save/load');
    assert(JSON.stringify(after.strategicOps) === JSON.stringify(before.strategicOps), 'ops changed by save/load');
    assert(JSON.stringify(after.regionDev) === JSON.stringify(before.regionDev), 'development changed by save/load');
    await tap('spd-pause');
  };
  const region = (id) => p.evaluate((x) => window.__uhaGame.getState().state.regions[x], id);

  await p.goto(URL);
  await step('1. new game -> general expedition in 외곽 공업 지구 -> 정보 확보', async () => {
    await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await tap('spd-pause');
    await tap('nav-regionMap'); await tap('region-rg_industrial'); await tap('purpose-resource'); await tap('btn-general-sortie'); await pick3();
    await play(); await tap('btn-clear-return'); await tap('btn-to-base'); await see('screen-main'); await tap('spd-pause');
    assert((await region('rg_industrial')).state === 2, 'not 정보 확보');
    await saveLoad(1);
  });
  await step('2. forward-base op -> 전진 거점 확보 (state 3)', async () => {
    await tap('nav-regionMap'); await tap('region-rg_industrial'); await tap('btn-op-op_industrial_forward'); await see('prep-op'); await pick3();
    await play(); await tap('btn-clear-return'); await see('screen-result');
    assert((await txt('result-op')).includes('전진 거점'), await txt('result-op'));
    await tap('btn-to-base'); await see('screen-main'); await tap('spd-pause');
    assert((await region('rg_industrial')).state === 3, 'not 3');
    await saveLoad(2);
  });
  let certAfter;
  await step('3. control op with a save/load right before the objective -> control (state 4), neighbours open', async () => {
    const cert0 = (await st()).inventory.certificate ?? 0;
    await tap('nav-regionMap'); await tap('region-rg_industrial'); await tap('btn-op-op_industrial_control'); await see('prep-op'); await pick3();
    await play(true);
    await tap('btn-map-save'); await tap('slot-3'); await tap('btn-save');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-3"]')?.textContent === '정상');
    await p.reload(); await tap('btn-load'); await tap('slot-3'); await tap('btn-load-slot'); await see('screen-expeditionMap');
    await play(); await tap('btn-clear-return'); await see('screen-result');
    assert((await txt('result-op')).includes('통제권'), await txt('result-op'));
    await tap('btn-to-base'); await see('screen-main'); await tap('spd-pause');
    const s = await st();
    certAfter = s.inventory.certificate ?? 0;
    assert(s.regions.rg_industrial.state === 4, 'not 4');
    assert(certAfter === cert0 + 1, `certificate ${cert0} -> ${certAfter}`);
    assert(s.regions.rg_residential.unlocked && s.regions.rg_energy.unlocked, 'neighbours locked');
    assert(!s.regions.rg_research.unlocked && !s.regions.rg_military.unlocked, 'far regions opened early');
  });
  await step('4. no duplicates: completed op cannot be launched, reload keeps a single grant', async () => {
    await tap('nav-regionMap'); await tap('region-rg_industrial');
    assert((await txt('op-status-op_industrial_control')) === '작전 완료', 'not completed');
    assert((await p.getByTestId('btn-op-op_industrial_control').count()) === 0, 'launch button still present');
    await tap('back'); await saveLoad(1);
    assert(((await st()).inventory.certificate ?? 0) === certAfter, 'certificate changed after reload');
    assert((await st()).strategicOps.op_industrial_control.rewardGranted, 'grant lost');
  });
  await step('5. repeat general expeditions in the controlled region: no new territory', async () => {
    const before = (await st()).regions;
    await tap('nav-regionMap'); await tap('region-rg_industrial'); await tap('purpose-threat'); await tap('btn-general-sortie'); await pick3();
    await play(); await tap('btn-clear-return'); await tap('btn-to-base'); await see('screen-main'); await tap('spd-pause');
    const after = (await st()).regions;
    for (const k of Object.keys(before)) { assert(after[k].state === before[k].state, `${k} state changed`); assert(after[k].unlocked === before[k].unlocked, `${k} unlock changed`); }
    assert(after.rg_industrial.generalRuns === before.rg_industrial.generalRuns + 1, 'run not recorded');
  });
  await step('6. develop the region with real resources and time -> 지역 개발 완료 (state 5)', async () => {
    await tap('nav-regionManage'); await see('screen-regionManage');
    await tap('site-repair-ind_plant'); await tap('site-repair-ind_yard');
    assert((await txt('site-status-ind_yard')) === '복구 중', 'repair did not start (resources?)');
    await tap('rm-clean-max');
    await tap('back'); await tap('spd-4');
    await p.waitForFunction(() => Object.values(window.__uhaGame.getState().state.regionDev.rg_industrial.sites).every((x) => x.status === 'active'), null, { timeout: 60000 });
    await tap('spd-pause'); await tap('nav-regionManage'); await tap('site-max-ind_plant'); await tap('site-max-ind_yard'); await tap('back');
    await saveLoad(2);
    await tap('spd-4');
    await p.waitForFunction(() => window.__uhaGame.getState().state.regions.rg_industrial.state === 5, null, { timeout: 150000 });
    await tap('spd-pause');
    await tap('nav-regionMap');
    assert((await p.getByTestId('region-rg_industrial').getAttribute('data-state')) === '5', 'map not showing 5');
    await p.screenshot({ path: `${OUT}/${name}-r6-map.png` });
  });
  await step('7. next region: general run in 구 주거 지구 is available, its operation needs 정보 확보 first', async () => {
    await tap('region-rg_residential');
    assert((await txt('op-status-op_residential_forward')) === '조건 미충족', 'op should be blocked');
    assert(!(await p.getByTestId('btn-general-sortie').isDisabled()), 'general run blocked');
  });
  await step('8. deep expedition is not available yet (planned), expeditions still end normally', async () => {
    await tap('purpose-resource'); await tap('btn-general-sortie'); await pick3();
    await play();
    const deep = p.locator('.map-clear button', { hasText: '심층 원정' });
    assert(await deep.isDisabled(), 'deep expedition clickable');
    await tap('btn-clear-return'); await tap('btn-to-base'); await see('screen-main');
    assert((await region('rg_residential')).state === 2, 'residential not 정보 확보');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
