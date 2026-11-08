// PHASE 7 E2E: a real-time battle played through the UI: run-in, waves, auto attacks, skills cast
// when charged, a swap, victory -> node completed with HP written back; outpost loss = failure.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || 'shots';
const URL = process.argv[3] || 'http://localhost:4173/';
require('fs').mkdirSync(OUT, { recursive: true });

async function run(name, ctxOpts) {
  const b = await chromium.launch();
  const p = await (await b.newContext(ctxOpts)).newPage();
  const errors = [], steps = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (n) => { await p.screenshot({ path: `${OUT}/${name}-p7-${n}.png` }); };
  const tap = (id) => p.getByTestId(id).click();
  const see = (id, t = 5000) => p.getByTestId(id).waitFor({ timeout: t });
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-p7-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const party = ['aion', 'james_harold', 'miley_sneaker'];

  await p.goto(URL);
  await step('enter the first combat node of a new expedition', async () => {
    await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await tap('spd-pause');
    await tap('nav-expeditionPrep'); for (const id of party) await tap(`pick-${id}`); await tap('btn-launch');
    await tap('node-c0r0'); await tap('btn-enter'); await see('screen-battle');
  });
  await step('A advance (running) -> B enemies appear in two lanes', async () => {
    await see('phase-banner'); assert((await p.getByTestId('phase-banner').innerText()).startsWith('전진'), 'no advance phase'); await shot('01-advance');
    await p.waitForFunction(() => document.querySelectorAll('[data-testid="enemy"]').length > 0, null, { timeout: 8000 });
    assert((await p.locator('[data-testid^="unit-"]').count()) === 3, 'allies not deployed');
  });
  await step('auto attacks damage enemies (floating numbers appear)', async () => {
    await tap('b-speed-2');
    await p.waitForFunction(() => document.querySelectorAll('.float.dmg, .float.crit').length > 0, null, { timeout: 15000 });
    await shot('02-fight');
  });
  await step('swap: pick Aion, move to lane 2 back slot', async () => {
    await tap('card-aion'); await tap('slot-1-2');
    await p.waitForTimeout(150);
    const box = await p.getByTestId('lane-2').boundingBox(); const u = await p.getByTestId('unit-aion').boundingBox();
    assert(u.y > box.y && u.y < box.y + box.height, 'aion not in lane 2');
  });
  await step('a skill becomes ready and is cast by the player', async () => {
    let cast = false;
    for (let i = 0; i < 6 && !cast; i++) {  // a wave can end between enabling and clicking; retry
      await p.waitForFunction(() => [...document.querySelectorAll('[data-testid^="skill-"]')].some((b) => !b.disabled), null, { timeout: 30000 });
      await p.locator('[data-testid^="skill-"]:not([disabled])').first().click().catch(() => {});
      await p.waitForTimeout(80);
      cast = (await p.locator('.float.skill').count()) > 0;
    }
    await shot('03-skill');
    assert(cast, 'no skill text');
  });
  await step('victory: all waves cleared (casting skills as they charge)', async () => {
    await tap('b-speed-4');
    for (let i = 0; i < 120; i++) {
      if (await p.getByTestId('battle-end').isVisible().catch(() => false)) break;
      for (const id of party) { const s = p.getByTestId(`skill-${id}`); if (await s.isEnabled().catch(() => false)) await s.click().catch(() => {}); }
      await p.waitForTimeout(500);
    }
    await see('battle-end');
    assert((await p.getByTestId('battle-end').innerText()).includes('노드 완료'), await p.getByTestId('battle-end').innerText());
    await shot('04-victory');
  });
  await step('F: reward choice, then map: node completed, next branches reachable', async () => {
    await tap('btn-battle-continue'); await see('screen-expeditionMap'); await see('ev-reward-0'); await shot('05-reward'); await tap('ev-reward-0');
    assert(await p.locator('.map-node.done').count() === 1, 'node not completed');
    assert(await p.locator('.map-node.reach').count() >= 1, 'no next nodes');
  });
  await step('retreat from a later battle -> expedition failure (outpost-loss defeat is unit-tested)', async () => {
    const next = p.locator('.map-node.reach').first();
    // walk until a combat node is next
    for (let i = 0; i < 6; i++) {
      const reach = p.locator('.map-node.reach'); const n = await reach.count(); let found = null;
      for (let j = 0; j < n; j++) if (['combat', 'elite', 'boss'].includes(await reach.nth(j).getAttribute('data-type'))) { found = reach.nth(j); break; }
      if (found) { await found.click(); await tap('btn-enter'); break; }
      await reach.first().click(); await tap('btn-enter'); await p.waitForTimeout(150);
      for (const t of ['ev-skip', 'ev-ok', 'ev-choice-0']) if (await p.getByTestId(t).isVisible().catch(() => false)) { await tap(t); break; }
      if (await p.locator('[data-testid^="ev-reward-"]').first().isVisible().catch(() => false)) await p.locator('[data-testid^="ev-reward-"]').first().click();
      if (await p.locator('[data-testid^="ev-relic-"]').first().isVisible().catch(() => false)) await p.locator('[data-testid^="ev-relic-"]').first().click();
      if (await p.locator('[data-testid^="ev-agent-"]').first().isVisible().catch(() => false)) await p.locator('[data-testid^="ev-agent-"]').first().click();
      if (await p.getByTestId('ev-ok').isVisible().catch(() => false)) await tap('ev-ok');
    }
    await see('screen-battle');
    // pull everyone out of the lanes: move each deployed unit into ... there is no "undeploy"; retreat is the failure path
    await tap('btn-retreat'); await tap('confirm'); await see('screen-result');
    assert((await p.getByTestId('result-title').innerText()) === '원정 실패', 'not failure');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
