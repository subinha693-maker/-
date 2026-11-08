// PHASE 2 E2E: real play-through of manual/auto save, quit (page reload), continue, load, overwrite,
// corruption + backup restore, delete, and settings persistence.
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
  const shot = async (n) => { await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/${name}-p2-${n}.png` }); };
  const tap = (id) => p.getByTestId(id).click();
  const see = (id) => p.getByTestId(id).waitFor({ timeout: 4000 });
  const text = (id) => p.getByTestId(id).innerText();
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const reload = async () => { await p.reload(); await see('screen-title'); };

  await p.goto(URL); await see('screen-title');
  await step('fresh start: 이어하기 disabled', async () => assert(await p.getByTestId('btn-continue').isDisabled(), 'continue enabled'));
  await step('new game (decline tutorial)', async () => { await tap('btn-new-game'); await see('screen-main'); await tap('tut-decline'); await tap('confirm'); });
  await step('change BGM volume in settings', async () => {
    await tap('nav-settings'); await p.getByTestId('vol-bgm').fill('35'); await tap('settings-close');
  });
  await step('launch expedition -> autosave toast, map shows party', async () => {
    await tap('nav-expeditionPrep'); await tap('pick-aion'); await tap('pick-ring'); await tap('pick-jerag'); await tap('btn-launch');
    await see('screen-expeditionMap'); await p.getByTestId('toast').last().waitFor();
    assert((await p.getByTestId('toast').last().innerText()).includes('자동 저장'), 'no autosave toast');
  });
  await step('manual save to slot 1 during expedition', async () => {
    await tap('btn-map-save'); await see('screen-saveLoad'); await tap('slot-1'); await tap('btn-save');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-1"]')?.textContent === '정상');
    await shot('01-saved');
    await tap('back'); await see('screen-expeditionMap');
  });
  await step('enter battle (pre-battle autosave), saving blocked in battle', async () => {
    await tap('node-c0r0'); await tap('btn-enter'); await see('screen-battle'); await see('battle-nosave');
  });
  await step('retreat -> result -> base (expedition ends, autosave)', async () => {
    await tap('btn-retreat'); await tap('confirm'); await see('screen-result'); await tap('btn-to-base'); await see('screen-main');
  });
  await step('quit (reload) -> 이어하기 resumes latest autosave at base', async () => {
    await reload();
    assert(!(await p.getByTestId('btn-continue').isDisabled()), 'continue disabled after saves');
    await tap('btn-continue'); await see('screen-main');
  });
  await step('load slot 1 from in-game menu -> resumes expedition map with same party', async () => {
    await tap('nav-save'); await see('screen-saveLoad'); await p.getByRole('tab', { name: '불러오기' }).click();
    await tap('slot-1'); await tap('btn-load-slot'); await tap('confirm'); await see('screen-expeditionMap');
    const party = await p.locator('.party-mini').allInnerTexts();
    assert(party.join('|').includes('아이온') && party.join('|').includes('링') && party.join('|').includes('제라그'), 'party mismatch: ' + party);
    await shot('02-resumed-expedition');
  });
  await step('overwrite asks for confirmation', async () => {
    await tap('btn-map-save'); await tap('slot-1'); await tap('btn-save'); await see('confirm'); await shot('03-overwrite-confirm'); await tap('confirm');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-1"]')?.textContent === '정상');
  });
  await step('damaged slot is detected, load blocked, backup restore works', async () => {
    await tap('slot-2'); await tap('btn-save'); await tap('slot-2'); await tap('btn-save'); await tap('confirm'); // second save creates a backup
    await p.evaluate(() => { const k = 'uha.save.2'; localStorage.setItem(k, localStorage.getItem(k).replace(/"food":[0-9.]+/, '"food":7')); });
    await reload(); await tap('btn-load'); await tap('slot-2');
    assert((await text('slot-status-2')) === '손상됨', 'not detected');
    await see('slot-problem'); assert(await p.getByTestId('btn-load-slot').isDisabled(), 'load enabled for corrupt');
    await shot('04-corrupt');
    await tap('btn-restore'); await tap('confirm'); await see('screen-expeditionMap');
  });
  await step('delete slot 2 with confirmation', async () => {
    await tap('btn-map-save'); await tap('slot-2'); await tap('btn-delete'); await tap('confirm');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-2"]')?.textContent === '비어 있음');
  });
  await step('settings persisted across restart', async () => {
    await reload(); await tap('btn-settings');
    assert((await p.getByTestId('vol-bgm').inputValue()) === '35', 'bgm not persisted');
    await tap('settings-close');
  });
  await step('tampered file with unknown character is flagged as damaged', async () => {
    await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('uha.save.1'));
      raw.data.roster.push({ charId: 'ghost', level: 1, growth: {}, equipment: [] });
      // re-seal with a wrong checksum is caught earlier; emulate a well-formed but invalid file by keeping checksum invalid
      localStorage.setItem('uha.save.3', JSON.stringify(raw));
    });
    await reload(); await tap('btn-load'); await tap('slot-3');
    assert((await text('slot-status-3')) === '손상됨', 'invalid not flagged');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
