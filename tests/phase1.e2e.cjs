// Phase 1 E2E: walks every menu/screen transition and captures screenshots (desktop + phone landscape).
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || 'shots';
const URL = process.argv[3] || 'http://localhost:4173/';
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });

async function run(name, ctxOpts) {
  const b = await chromium.launch();
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (n) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${name}-${n}.png` }); };
  const tap = (id) => p.getByTestId(id).click();
  const expect = async (id) => { await p.getByTestId(id).waitFor({ timeout: 4000 }); };
  const steps = [];
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); } };

  await p.goto(URL); await p.waitForLoadState('networkidle');
  await step('title shown', () => expect('screen-title')); await shot('01-title');
  await step('settings open/close', async () => { await tap('btn-settings'); await expect('settings-close'); await shot('01b-settings'); await tap('settings-close'); });
  await step('load from title -> saveLoad -> back', async () => { await tap('btn-load'); await expect('screen-saveLoad'); await tap('back'); await expect('screen-title'); });
  await step('new game -> main', async () => { await tap('btn-new-game'); await expect('screen-main'); }); await shot('02-main');
  await step('select building popup', async () => { await tap('bld-f1'); await expect('facility-popup'); }); await shot('02b-main-select');
  const menus = ['facilities', 'population', 'research', 'squad', 'recruit', 'expeditionPrep'];
  for (const m of menus) {
    await step(`main -> ${m} -> back`, async () => { await tap(`nav-${m}`); await expect(`screen-${m}`); await shot(`03-${m}`); if (m !== 'expeditionPrep') { await tap('back'); await expect('screen-main'); } });
  }
  await step('select party of 3 and launch', async () => {
    await tap('pick-aion'); await tap('pick-ling'); await tap('pick-zerag'); await shot('04-prep-picked');
    await tap('btn-launch'); await expect('screen-expeditionMap');
  }); await shot('05-map');
  await step('enter combat node -> battle', async () => { await tap('node-n0'); await tap('btn-enter'); await expect('screen-battle'); }); await shot('06-battle');
  await step('battle -> back to map -> return -> result', async () => { await tap('btn-battle-back'); await expect('screen-expeditionMap'); await tap('btn-return'); await expect('screen-result'); }); await shot('07-result');
  await step('result -> main', async () => { await tap('btn-to-base'); await expect('screen-main'); });
  await step('main -> save screen', async () => { await tap('nav-save'); await expect('screen-saveLoad'); await shot('08-save'); await tap('back'); await expect('screen-main'); });
  await step('quit to title with confirm', async () => { await tap('nav-title'); await tap('confirm'); await expect('screen-title'); });
  await step('screen index -> tutorial preview', async () => { await tap('btn-screen-index'); await expect('screen-screenIndex'); await shot('09-index'); await tap('idx-tutorialPreview'); await expect('screen-tutorialPreview'); });
  await shot('10-tutorial-1');
  await step('tutorial next x2 (highlight)', async () => { await tap('tut-next'); await tap('tut-next'); }); await shot('10-tutorial-3');
  await step('tutorial skip confirm', async () => { await tap('tut-skip'); await tap('confirm'); await expect('screen-screenIndex'); });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
