// Region PHASE 3 E2E: strategic map -> region -> purpose -> sortie -> full general expedition ->
// settlement into government resources -> region becomes 정보 확보, control unchanged; a second
// (withdrawn) run adds a record but no territory.
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
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-r3-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const resources = () => p.evaluate(() => ({ ...window.__uhaGame.getState().state.resources }));
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

  await p.goto(URL);
  await step('strategic map -> 외곽 공업 지구 -> 특수 조사 -> sortie opens prep with region/purpose', async () => {
    await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await tap('spd-pause');
    await tap('nav-regionMap'); await tap('region-rg_industrial'); await tap('purpose-survey'); await tap('btn-general-sortie');
    await see('screen-expeditionPrep');
    assert((await txt('prep-region-name')).includes('외곽 공업 지구'), 'region not carried');
  });
  await step('launch -> map header shows region and purpose', async () => {
    for (const id of ['aion', 'ring', 'jerag']) await tap(`pick-${id}`);
    await tap('btn-launch'); await see('screen-expeditionMap');
    assert((await p.locator('.screen-head .code').innerText()).includes('특수 조사'), 'purpose not shown');
  });
  let before;
  await step('play to the boss and clear', async () => {
    for (let i = 0; i < 40; i++) {
      if (await p.getByTestId('map-cleared').isVisible().catch(() => false)) break;
      if (await visible('.modal')) { await resolveModal(); continue; }
      const node = p.locator('.map-node.reach').first(); const type = await node.getAttribute('data-type');
      await node.click(); await tap('btn-enter');
      if (['combat', 'elite', 'boss'].includes(type)) { await see('screen-battle'); await p.evaluate(() => window.__uhaBattle.win()); await tap('btn-battle-continue'); await see('screen-expeditionMap'); }
      await p.waitForTimeout(120); await resolveModal();
    }
    await see('map-cleared');
  });
  await step('result shows settlement and "control unchanged"', async () => {
    await tap('btn-clear-return'); await see('screen-result');
    assert((await txt('result-control')).includes('변화 없음'), 'control text');
    assert((await txt('result-region')).includes('정보 확보'), 'region text');
    assert((await txt('settle-items')).includes('작전 경력서'), 'items');
    await p.screenshot({ path: `${OUT}/${name}-r3-result.png` });
    before = await resources();
  });
  await step('base: loot delivered to government resources', async () => {
    const expected = await p.evaluate(() => { const ex = window.__uhaGame.getState().state.expedition; return ex.loot; });
    await tap('btn-to-base'); await see('screen-main');
    const after = await resources();
    const gained = Object.keys(expected).filter((k) => expected[k] > 0 && after[k] > before[k]);
    assert(gained.length > 0, 'no resource increased: ' + JSON.stringify({ expected }));
  });
  await step('region is now 정보 확보 (state 2) with record 1/1, no control', async () => {
    await tap('nav-regionMap');
    assert((await p.getByTestId('region-rg_industrial').getAttribute('data-state')) === '2', 'not state 2');
    await tap('region-rg_industrial');
    assert((await txt('general-record')).includes('출격 1회 · 완수 1회'), await txt('general-record'));
    assert((await txt('controlled-count')).includes('0 / 5'), 'control changed');
  });
  await step('second run withdrawn early: record grows, state stays 2, still no control', async () => {
    await tap('purpose-resource'); await tap('btn-general-sortie');
    for (const id of ['aion', 'ring', 'jerag']) await tap(`pick-${id}`);
    await tap('btn-launch'); await see('screen-expeditionMap');
    await tap('btn-return'); await tap('confirm'); await see('screen-result'); await tap('btn-to-base');
    await tap('nav-regionMap'); await tap('region-rg_industrial');
    assert((await txt('general-record')).includes('출격 2회 · 완수 1회'), await txt('general-record'));
    assert((await p.getByTestId('region-rg_industrial').getAttribute('data-state')) === '2', 'state changed');
    assert((await txt('controlled-count')).includes('0 / 5'), 'control changed');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
