import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { leaveBattle, loseBattle, winBattle } from '../../core/session';
import { DATA, charName, getCharacterDef } from '../../data';
import { effectiveDifficulty, party as expeditionParty } from '../../systems/expedition';
import { BCFG, castSkill, createBattle, isOver, results, skillReady, step, swapInto, type BattleState } from '../../systems/battle';
import { Bar, Button, ConfirmDialog, PlaceholderTag } from '../components/Common';
import { CharacterArt } from '../components/CharacterArt';
import { Sprite } from '../components/Sprite';
import { asset } from '../components/Icon';

const LANES = ['1열', '2열'];
const SLOTS = BCFG.slotX.length;
const pct = (x: number) => `${(x / (BCFG.spawnX + 2)) * 100}%`;
const ALLY_H = 175;
const PHASE_TEXT: Record<string, string> = { advance: '전진', appear: '적 출현', cleared: '웨이브 종료' };

export function BattleScreen() {
  const { params, back } = useRouter();
  const g = useGame();
  const ex = g.state?.expedition;
  const tutorial = !!g.state?.tutorial.active;
  const training = !!params.training || !ex;
  const node = params.node as string | undefined;
  const nodeType = (ex && node ? ex.map.columns.flat().find((n) => n.id === node)?.type : undefined) ?? 'combat';

  // Build the battle once from the saved expedition (or a preview party).
  const bRef = useRef<BattleState | null>(null);
  if (!bRef.current) {
    const ids = !training ? expeditionParty(ex!) : ((params.party as string[] | undefined)?.length ? params.party as string[] : DATA.startingRoster.slice(0, 3));
    const roster = g.state!.roster;
    bRef.current = createBattle({
      party: ids.map((id) => roster.find((c) => c.charId === id)!).filter(Boolean),
      hp: ex?.hp ?? {}, relics: ex?.relics ?? [], supplied: (ex?.buffs ?? []).map((b) => b.source),
      outpost: ex?.outpost ?? { hp: 100, maxHp: 100 }, nodeType, difficulty: ex ? effectiveDifficulty(ex) : 1,
      seed: ((ex?.seed ?? 1) ^ [...(node ?? 'x')].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) >>> 0,
    });
  }
  const b = bRef.current;
  const [, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [retreat, setRetreat] = useState(false);
  const skillLv = useMemo(() => Object.fromEntries((g.state?.roster ?? []).map((c) => [c.charId, c.skillLevel])), [g.state?.roster]);

  useEffect(() => { useGame.getState().setInBattle(true); return leaveBattle; }, []);
  // Fixed-step simulation loop; rendering at ~30fps.
  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, lastDraw = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      const halted = paused || tutorial || isOver(b);
      if (!halted) { acc += dt * speed; while (acc >= BCFG.tick) { step(b, BCFG.tick); acc -= BCFG.tick; } }
      if (now - lastDraw > 33) { lastDraw = now; setTick((t) => t + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [b, paused, speed, tutorial]);

  // Test hook (only with ?e2e in the URL): lets automated tests resolve battles quickly.
  useEffect(() => {
    if (!location.search.includes('e2e')) return;
    (window as unknown as { __uhaBattle?: object }).__uhaBattle = { win: () => { b.phase = 'victory'; }, state: () => b };
  }, [b]);

  const clickSlot = (lane: number, slot: number) => {
    const occupant = b.allies.find((a) => a.lane === lane && a.slot === slot);
    if (!picked) { if (occupant && !occupant.down) setPicked(occupant.charId); return; }
    if (picked === occupant?.charId) { setPicked(null); return; }
    swapInto(b, picked, lane, slot); setPicked(null);
  };
  const finish = () => {
    if (training) { leaveBattle(); back(); return; }
    if (b.phase === 'victory') winBattle(node!, results(b)); else loseBattle();
  };
  const waveText = `${Math.min(b.wave + 1, b.waves.length)} / ${b.waves.length}`;

  return (
    <div className="screen battle" data-testid="screen-battle">
      <header className="battle-hud">
        <div className="col" style={{ gap: 4, width: 420 }}>
          <div className="row" style={{ gap: 8 }}><span className="dim grow" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.12em' }}>임시 거점 HP</span><span className="num" data-testid="outpost-hp">{Math.ceil(b.outpost.hp)} / {Math.round(b.outpost.max)}</span></div>
          <Bar value={b.outpost.hp} max={b.outpost.max} tone={b.outpost.hp / b.outpost.max < 0.35 ? 'danger' : undefined} />
        </div>
        <div className="wave"><span className="dim">WAVE</span><b className="num" data-testid="wave">{waveText}</b></div>
        <span className={`tag ${nodeType === 'objective' ? 'warn' : ''}`}>{nodeType === 'objective' ? '작전 목표 전투' : nodeType === 'boss' ? '보스 전투' : nodeType === 'elite' ? '강적 전투' : '일반 전투'}</span>
        <span className="tag" data-testid="battle-nosave">전투 중 저장 불가</span>
        <PlaceholderTag label="전투 수치 임시" />
        <div className="grow" />
        <Button small onClick={() => setPaused(!paused)} data-testid="b-pause">{paused ? '재개' : '일시정지'}</Button>
        {[1, 2, 4].map((v) => <Button key={v} small variant={speed === v ? 'primary' : undefined} onClick={() => setSpeed(v)} data-testid={`b-speed-${v}`}>x{v}</Button>)}
        <Button small variant="danger" onClick={() => (training ? finish() : setRetreat(true))} data-testid="btn-retreat">후퇴</Button>
      </header>

      <div className="battle-field" data-tut="battle-lanes">
        {/* parallax: background drifts slowly, obstacle layers pass by while the party runs */}
        <div className="bf-bg" style={{ backgroundImage: `url(${asset('battle/bg_flooded_city.webp')})`, backgroundPositionX: `${-b.scroll * 0.08}px` }} />
        <div className="bf-mid" style={{ backgroundImage: `url(${asset('battle/layer_mid.svg')})`, backgroundPositionX: `${-b.scroll * 0.45}px` }} />
        <div className="outpost" data-tut="battle-outpost">
          <img src={asset('sprites/kenney/sp-gate-door.png')} alt="" />
          <span>임시 거점</span>
        </div>
        {LANES.map((label, li) => (
          <div key={label} className="lane" data-testid={`lane-${li + 1}`}>
            <div className="lane-ground" style={{ backgroundImage: `url(${asset('battle/layer_ground.svg')})`, backgroundPositionX: `${-b.scroll * (1 + li * 0.08)}px` }} />
            {/* footing (발판) the lane's units stand on; scrolls with the ground while advancing */}
            <div className="lane-platform" data-testid={`platform-${li + 1}`} style={{ backgroundImage: `url(${asset('battle/platform.svg')})`, backgroundPositionX: `${-b.scroll * (1 + li * 0.08)}px` }} />
            <span className="lane-label">{label}</span>
            {Array.from({ length: SLOTS }).map((_, si) => {
              const occ = b.allies.find((a) => a.lane === li && a.slot === si);
              return <button key={si} className={`slot-pad ${picked ? 'armed' : ''} ${occ ? 'occ' : ''}`} style={{ left: pct(BCFG.slotX[si]) }} onClick={() => clickSlot(li, si)} data-testid={`slot-${li}-${si}`} aria-label={`${label} ${si + 1}번 자리`} />;
            })}
            {b.allies.filter((a) => a.lane === li).map((a) => {
              const meta = DATA.unitSprites[a.charId];
              return (
                <div key={a.charId} className={`unit ally ${picked === a.charId ? 'picked' : ''}`} style={{ left: pct(a.x) }} onClick={() => clickSlot(li, a.slot!)} data-testid={`unit-${a.charId}`}>
                  {meta ? <Sprite url={`sprites/units/${a.charId}.webp`} meta={meta} anim={a.anim} t={a.animT} height={ALLY_H} /> : null}
                  <span className="foot-shadow" />
                  <div className="unit-hp"><i style={{ width: `${(a.hp / a.stats.hp) * 100}%` }} /></div>
                </div>
              );
            })}
            {b.enemies.filter((e) => e.lane === li).map((e) => {
              const meta = DATA.enemySprites[e.def.sprite];
              return (
                <div key={e.uid} className={`unit foe ${e.dead ? 'dying' : ''} ${e.st.stunUntil > b.t ? 'stunned' : ''}`} style={{ left: pct(e.x) }} data-testid="enemy">
                  <Sprite url={`sprites/enemies/${e.def.sprite}.webp`} meta={meta} anim={e.anim} t={e.animT} height={e.def.size} fps={8} loop={e.anim !== 'dead'} />
                  {!e.dead && <div className="unit-hp foe"><i style={{ width: `${(e.hp / e.maxHp) * 100}%` }} /></div>}
                  {(e.st.slow > 0 || e.st.accDown > 0 || e.st.bleedUntil > b.t) && !e.dead && <span className="debuff">{[e.st.slow > 0 && '둔화', e.st.accDown > 0 && '명중↓', e.st.bleedUntil > b.t && '출혈'].filter(Boolean).join(' ')}</span>}
                </div>
              );
            })}
            {b.floats.filter((f) => f.lane === li).map((f) => (
              <span key={f.id} className={`float ${f.kind}`} style={{ left: pct(f.x), bottom: `${55 + (b.t - f.t) * 60}%`, opacity: 1 - (b.t - f.t) }}>{f.text}</span>
            ))}
          </div>
        ))}
        {b.phase !== 'fight' && !isOver(b) && <div className="phase-banner" data-testid="phase-banner">{PHASE_TEXT[b.phase]}{b.phase === 'advance' || b.phase === 'appear' ? ` · WAVE ${b.wave + 1}` : ''}</div>}
        {isOver(b) && (
          <div className="battle-end" data-testid="battle-end">
            <h2 className={b.phase === 'victory' ? 'pos' : 'neg'}>{b.phase === 'victory' ? '노드 완료' : '임시 거점 함락'}</h2>
            <span className="muted">{b.phase === 'victory' ? '모든 웨이브를 처치했습니다.' : '거점 HP가 0이 되어 원정이 실패합니다.'}</span>
            <Button variant="primary" onClick={finish} data-testid="btn-battle-continue">{training ? '돌아가기' : b.phase === 'victory' ? '보상 선택' : '결과 확인'}</Button>
          </div>
        )}
      </div>

      <footer className="battle-deck">
        <div className="deck-units" data-tut="battle-deck">
          {b.allies.filter((a) => a.lane !== null).map((a) => <UnitCard key={a.charId} b={b} charId={a.charId} picked={picked} setPicked={setPicked} lv={skillLv[a.charId] ?? 1} />)}
        </div>
        <div className="queue" data-tut="battle-queue">
          <span className="dim" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.12em' }}>대기열 · 교체: 요원 선택 → 자리 선택</span>
          <div className="queue-list">
            {b.allies.filter((a) => a.lane === null).map((a) => <UnitCard key={a.charId} b={b} charId={a.charId} picked={picked} setPicked={setPicked} lv={skillLv[a.charId] ?? 1} small />)}
            {!b.allies.some((a) => a.lane === null) && <div className="empty" style={{ padding: 12 }}>대기 중인 부대원 없음</div>}
          </div>
        </div>
      </footer>
      {retreat && <ConfirmDialog warn title="후퇴" confirmLabel="후퇴" onCancel={() => setRetreat(false)} onConfirm={loseBattle}
        message="전투에서 후퇴하면 원정 실패로 처리됩니다. 원정에서 얻은 유물은 사라집니다." />}
    </div>
  );
}

function UnitCard({ b, charId, picked, setPicked, lv, small }: { b: BattleState; charId: string; picked: string | null; setPicked: (v: string | null) => void; lv: number; small?: boolean }) {
  const a = b.allies.find((x) => x.charId === charId)!;
  const d = getCharacterDef(charId)!;
  const ready = skillReady(a) && b.phase === 'fight';
  return (
    <div className={`unit-card ${small ? 'small' : ''} ${picked === charId ? 'picked' : ''} ${a.down ? 'down' : ''}`} onClick={() => !a.down && setPicked(picked === charId ? null : charId)} data-testid={`card-${charId}`}>
      <CharacterArt def={d} zoom={2.3} className="unit-art" />
      <div className="col grow" style={{ gap: 6, minWidth: 0 }}>
        <b>{charName(d)}{a.down && <span className="tag danger" style={{ marginLeft: 8 }}>전투 불능</span>}</b>
        <div className="row" style={{ gap: 8 }}><span className="dim" style={{ width: 40 }}>HP</span><div className="grow"><Bar value={a.hp} max={a.stats.hp} tone={a.hp / a.stats.hp < 0.35 ? 'danger' : undefined} /></div></div>
        {!small && <div className="row" style={{ gap: 8 }}><span className="dim" style={{ width: 40 }}>SP</span><div className="grow"><Bar value={a.sp} max={1} tone="warn" /></div></div>}
      </div>
      {!small && (
        <button className={`skill-btn ${ready ? 'ready' : ''}`} disabled={!ready} onClick={(e) => { e.stopPropagation(); castSkill(b, charId, lv); }} data-testid={`skill-${charId}`} title={d.skill?.desc}>
          <span>{d.skill?.name}</span>
        </button>
      )}
    </div>
  );
}
