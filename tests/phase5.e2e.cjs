// PHASE 5 E2E: confirmed agent profiles, 이력서 확인 with duplicate -> 인사 공적, skill deepening,
// trait unlock, training/level cap, promotion requirements, and persistence through save/load.
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
  const shot = async (n) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${name}-p5-${n}.png` }); };
  const tap = (id) => p.getByTestId(id).click();
  const see = (id, t = 5000) => p.getByTestId(id).waitFor({ timeout: t });
  const txt = (id) => p.getByTestId(id).innerText();
  const step = async (label, fn) => { try { await fn(); steps.push(`PASS ${label}`); } catch (e) { steps.push(`FAIL ${label}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/${name}-p5-FAIL-${steps.length}.png` }).catch(() => {}); } };
  const assert = (c, m) => { if (!c) throw new Error(m); };

  await p.goto(URL);
  await step('new game: 6 distribution agents in the roster', async () => {
    await tap('btn-new-game'); await tap('tut-decline'); await tap('confirm'); await see('screen-main');
    await tap('spd-pause'); await tap('nav-squad'); await see('screen-squad');
    assert((await p.locator('.char-card').count()) === 6, 'roster size');
  });
  await step('confirmed profile shown (Miley: specialty, tendencies, skill)', async () => {
    await tap('card-miley_sneaker');
    assert((await txt('char-specialty')) === '화력 지원 및 제압 사격', await txt('char-specialty'));
    const detail = await txt('char-detail');
    for (const t of ['야전사령부 전술교관 출신', '제압 사격망', '화력', '통솔', 'MILEY SNEAKER']) assert(detail.includes(t), 'missing ' + t);
    await shot('01-profile');
  });
  await step('Ring and Jerag use the confirmed English names', async () => {
    await tap('card-ring'); assert((await txt('char-detail')).includes('RING'), 'ring');
    await tap('card-jerag'); assert((await txt('char-detail')).includes('JERAG'), 'jerag');
  });
  await step('promotion is locked until requirements are met', async () => {
    await tap('card-aion'); await p.getByRole('tab', { name: '육성 · 승급' }).click();
    assert(await p.getByTestId('btn-promote').isDisabled(), 'promote enabled');
    assert((await txt('promo-reqs')).includes('국가 공인 직무 인증서'), 'no certificate requirement');
    await shot('02-growth');
  });
  await step('training raises proficiency level (temporary level source)', async () => {
    const before = await txt('char-level'); await tap('btn-train'); await tap('btn-train');
    assert(before !== await txt('char-level'), 'level unchanged');
  });
  await step('이력서 확인 1건: owned agent -> duplicate -> 인사 공적 +1', async () => {
    await tap('back'); await tap('nav-recruit'); await see('screen-recruit');
    await tap('btn-review-1'); await p.waitForTimeout(200);
    assert((await txt('dossier-stamp')) === '중복 지원', await txt('dossier-stamp'));
    assert((await txt('dossier-result')).includes('인사 공적 +1'), await txt('dossier-result'));
    await shot('03-review-1');
  });
  await step('이력서 10건: results list, all duplicates, roster stays 6', async () => {
    await tap('btn-review-10'); await see('dossier-next'); await shot('04-review-10');
    for (let i = 0; i < 9; i++) await tap('dossier-next');
    await tap('back'); await tap('nav-squad'); assert((await p.locator('.char-card').count()) === 6, 'roster changed');
  });
  let merit = 0;
  await step('인사 공적 deepens a skill level', async () => {
    // find an agent that received merit
    for (const id of ['shion_shirayuko', 'james_harold', 'aion', 'ring', 'jerag', 'miley_sneaker']) {
      await tap(`card-${id}`); await p.getByRole('tab', { name: '육성 · 승급' }).click();
      if (!(await p.getByTestId('btn-skill').isDisabled())) {
        await tap('btn-skill'); merit = 1;
        assert((await p.getByTestId('char-detail').innerText()).includes('Lv.2 / 3'), 'skill not raised');
        break;
      }
    }
    assert(merit === 1, 'no agent had merit');
    await shot('05-skill');
  });
  await step('save -> reload -> load keeps growth (skill level, levels)', async () => {
    const lv = await txt('char-level'); const name = await txt('char-name');
    await tap('back'); await tap('nav-save'); await tap('slot-1'); await tap('btn-save');
    await p.waitForFunction(() => document.querySelector('[data-testid="slot-status-1"]')?.textContent === '정상');
    await p.reload(); await tap('btn-load'); await tap('slot-1'); await tap('btn-load-slot'); await see('screen-main');
    await tap('nav-squad');
    const cards = p.locator('.char-card');
    for (let i = 0; i < 6; i++) { await cards.nth(i).click(); if ((await txt('char-name')) === name) break; }
    assert((await txt('char-level')) === lv, `level ${lv} -> ${await txt('char-level')}`);
    await p.getByRole('tab', { name: '육성 · 승급' }).click();
    assert((await p.getByTestId('char-detail').innerText()).includes('Lv.2 / 3'), 'skill level lost');
  });
  console.log(`== ${name}\n` + steps.join('\n') + `\nerrors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1920, height: 1080 } });
  await run('phone', { ...devices['iPhone 14 landscape'] });
})();
