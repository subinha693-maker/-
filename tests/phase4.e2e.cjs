// PHASE 4 E2E: real-time clock, speed/pause, production & consumption, staffing, construction,
// upgrade, repair, research and save/load of the running economy.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || 'shots';
const URL = process.argv[3] || 'http://localhost:4173/';
require('fs').mkdirSync(OUT, { recursive: true });

async function run(name, ctxOpts, full) {
  const b = await chromium.launch();
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage();
  const errors = [], steps = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (n) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${name}-p4-${n}.png` }); };
  const tap = (id) => p.getByTestId(id).click();
  const see = (id, t = 5000) => p.getByTestId(id).waitFor({ timeout: t });
  const txt = (id) => p.getByTestId(id).innerText();
  const num = async (id) => Number((await txt(id)).replace(/[^0-9.-]/g, ''));
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-p4-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };

  await p.goto(URL); await see('screen-title');
  await step('new game, decline tutorial', async () => { await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await see('screen-main'); });
  await step('clock runs at 1s = 10 game minutes and resources change', async () => {
    const t0 = await txt('clock-time'); const b0 = await num('res-val-budget');
    await p.waitForTimeout(3200);
    const t1 = await txt('clock-time'); const b1 = await num('res-val-budget');
    assert(t0 !== t1, `clock did not move ${t0} -> ${t1}`);
    assert(b1 > b0, `budget did not grow ${b0} -> ${b1}`);
    await shot('01-main-running');
  });
  await step('pause stops time; x4 speeds it up', async () => {
    await tap('spd-pause'); const t0 = await txt('clock-time'); await p.waitForTimeout(1200);
    assert(t0 === await txt('clock-time'), 'time moved while paused');
    await tap('spd-4'); const m0 = await txt('clock-time'); await p.waitForTimeout(1600);
    const [h0, mm0] = m0.split(':').map(Number); const [h1, mm1] = (await txt('clock-time')).split(':').map(Number);
    const diff = ((h1 * 60 + mm1) - (h0 * 60 + mm0) + 1440) % 1440;
    assert(diff >= 40, `x4 too slow: ${diff} min in 1.6s`);
  });
  await step('resource popover shows production / consumption', async () => {
    await tap('res-food'); await see('res-pop'); await shot('02-res-pop'); await tap('res-food');
  });
  await step('facility staffing changes output (farm workers to 0 -> 0%)', async () => {
    await tap('nav-facilities'); await see('screen-facilities');
    await tap('fac-row-f3'); // farm
    await tap('w-zero'); assert((await txt('w-val')) === '0', 'workers not zero');
    await p.waitForTimeout(300);
    assert((await p.getByTestId('fac-row-f3').innerText()).includes('0%'), 'efficiency not 0%');
    await tap('w-max'); await shot('03-facility');
  });
  await step('stop / resume facility', async () => {
    await tap('btn-toggle'); assert((await txt('btn-toggle')).includes('재개'), 'not stopped'); await tap('btn-toggle');
  });
  await step('build a facility: cost paid, construction progresses, completes', async () => {
    const b0 = await num('res-val-budget');
    await tap('btn-build'); await see('build-fac_housing'); await shot('04-build-modal'); await tap('build-fac_housing');
    await see('fac-job'); assert((await num('res-val-budget')) < b0, 'budget not paid');
    if (full) {
      await p.waitForFunction(() => !document.querySelector('[data-testid="fac-job"]'), null, { timeout: 40000 });
      assert((await txt('fac-name')).includes('주거'), 'wrong facility selected');
    }
  });
  await step('locked facility shows research requirement', async () => {
    await tap('btn-build'); assert(await p.getByTestId('build-fac_workshop').isDisabled(), 'workshop not locked');
    assert((await p.getByTestId('build-fac_workshop').innerText()).includes('연구 필요'), 'no requirement text'); await tap('build-close');
  });
  await step('upgrade starts (Lv.2 work in progress)', async () => {
    await tap('fac-row-f1'); await tap('btn-upgrade'); await see('fac-job');
    assert((await txt('fac-job')).includes('Lv.2'), 'no upgrade job');
  });
  await step('labor screen shows assignment and limits', async () => {
    await tap('back'); await tap('nav-population'); await see('screen-population');
    const before = await txt('pop-labor'); await tap('labor-minus-f3'); await p.waitForTimeout(150);
    assert(before !== await txt('pop-labor'), 'labor totals did not change'); await tap('labor-plus-f3'); await shot('05-population');
  });
  await step('research needs data; accumulates and starts, progress grows', async () => {
    await tap('back'); await tap('nav-research'); await see('screen-research');
    await tap('rnode-r_bio_1');
    await p.waitForFunction(() => !document.querySelector('[data-testid="btn-research"]').disabled, null, { timeout: 30000 }); // data income
    await tap('btn-research'); await p.waitForTimeout(2500);
    assert(/\d+%/.test(await txt('research-active')), 'no progress shown');
    await shot('06-research');
  });
  await step('save, reload, load -> clock, resources, jobs and research restored', async () => {
    await tap('back'); await tap('spd-pause');
    const snap = { t: await txt('clock-time'), d: await txt('clock-date'), food: await txt('res-val-food') };
    await tap('nav-save'); await tap('slot-1'); await tap('btn-save');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-1"]')?.textContent === '정상');
    await p.reload(); await tap('btn-load'); await tap('slot-1'); await tap('btn-load-slot'); await see('screen-main');
    const after = { t: await txt('clock-time'), d: await txt('clock-date'), food: await txt('res-val-food') };
    assert(JSON.stringify(snap) === JSON.stringify(after), `mismatch ${JSON.stringify(snap)} vs ${JSON.stringify(after)}`);
    assert((await p.locator('.base-bld.building').count()) >= 1, 'construction lost');
    await tap('nav-research'); assert(/\d+%/.test(await txt('research-active')), 'research lost');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } }, true);
  await run('phone', { ...devices['iPhone 14 landscape'] }, false);
})();
