import { useGame } from '../../core/gameStore';
import { resolveNodeEvent } from '../../core/session';
import { charName, getCharacterDef, getEvent, getRelic, DATA } from '../../data';
import { party } from '../../systems/expedition';
import type { NodeOffer, ResourceMap } from '../../core/types';
import type { ReactNode } from 'react';
import { useRouter } from '../../core/router';
import { Button, Modal } from './Common';
import { CharacterArt } from './CharacterArt';
import { costText } from '../format';

const RES = Object.fromEntries(DATA.resources.map((r) => [r.id, r.name]));
const lootText = (l: ResourceMap) => costText(l, RES) || '없음';
const STAT: Record<string, string> = { atkSpeed: '공격속도', def: '방어력', hp: '체력', skillCharge: '스킬 회복', elementalDmg: '속성 피해', atk: '공격력', outpostHp: '임시 거점 내구도' };
export const relicFx = (id: string) => getRelic(id)?.effects.map((e) => `${STAT[e.stat] ?? e.stat} +${Math.round(e.value * 100)}%`).join(', ');
const fx = relicFx;

/** Node event dialog with a save button (the event is already stored, so saving here is safe). */
function EventModal({ title, actions, wide, children }: { title: string; actions: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <Modal wide={wide} title={title} actions={<>
      <Button small variant="ghost" onClick={() => useRouter.getState().go('saveLoad', { mode: 'save' })} data-testid="ev-save">저장</Button>
      <span className="grow" />
      {actions}
    </>}>{children}</Modal>
  );
}

/** Dialog for the pending node event. The offer was rolled and saved when the node was entered. */
export function NodeEvent({ offer }: { offer: NodeOffer }) {
  const ex = useGame((g) => g.state!.expedition!);
  const deployed = party(ex);
  switch (offer.kind) {
    case 'relic':
      return (
        <EventModal wide title="유물 획득" actions={<Button variant="ghost" onClick={() => resolveNodeEvent({ skip: true })} data-testid="ev-skip">가져가지 않는다</Button>}>
          <p className="muted" style={{ marginTop: 0 }}>부토스 잔재가 모인 무기물입니다. 오염구역 안에서만 발동하고 원정이 끝나면 사라집니다. 하나를 고르세요.</p>
          <div className="choice-grid">
            {offer.choices.map((id) => (
              <button key={id} className="choice" onClick={() => resolveNodeEvent({ pick: id })} data-testid={`ev-relic-${id}`}>
                <b>{getRelic(id)?.name}</b><span className="dim">{fx(id)}</span><span className="tag">{getRelic(id)?.tags.join(' · ')}</span>
              </button>
            ))}
          </div>
        </EventModal>
      );
    case 'reinforce':
      return (
        <EventModal wide title="후발대 모집" actions={<Button variant="ghost" onClick={() => resolveNodeEvent({ skip: true })} data-testid="ev-skip">모집하지 않는다</Button>}>
          <p className="muted" style={{ marginTop: 0 }}>기지의 다른 개척부대원을 합류시킬 수 있습니다. 이미 원정 중인 요원을 고르면 보급품 도착 이벤트가 일어납니다.</p>
          <div className="choice-grid">
            {offer.candidates.map((id) => {
              const d = getCharacterDef(id)!; const inParty = deployed.includes(id);
              return (
                <button key={id} className="choice agent" onClick={() => resolveNodeEvent({ pick: id })} data-testid={`ev-agent-${id}`}>
                  <CharacterArt def={d} zoom={2.1} className="choice-art" />
                  <b>{charName(d)}</b>
                  <span className={`tag ${inParty ? 'warn' : 'accent'}`}>{inParty ? '원정 중 → 보급품 도착' : '후발대 합류'}</span>
                </button>
              );
            })}
          </div>
        </EventModal>
      );
    case 'battleReward':
      return (
        <EventModal wide title="전투 보상 선택" actions={<span className="dim">하나를 선택하면 원정 지도로 돌아갑니다.</span>}>
          <div className="choice-grid">
            {offer.choices.map((c, i) => (
              <button key={i} className="choice" onClick={() => resolveNodeEvent({ index: i })} data-testid={`ev-reward-${i}`}>
                {c.type === 'loot' && <><b>물자 회수</b><span className="muted">{lootText(c.loot)}</span><span className="tag">원정 획득물</span></>}
                {c.type === 'relic' && <><b>{getRelic(c.relic)?.name}</b><span className="dim">{fx(c.relic)}</span><span className="tag warn">유물</span></>}
                {c.type === 'heal' && <><b>부대 정비</b><span className="muted">부대원 HP +{Math.round(c.amount * 100)}%</span><span className="tag accent">회복</span></>}
              </button>
            ))}
          </div>
        </EventModal>
      );
    case 'supply':
      return (
        <EventModal title="보급품 도착" actions={<Button variant="primary" onClick={() => resolveNodeEvent({})} data-testid="ev-ok">수령</Button>}>
          <div className="row" style={{ gap: 20, alignItems: 'flex-start' }}>
            <CharacterArt def={getCharacterDef(offer.charId)!} zoom={2.1} className="choice-art" style={{ width: 160, height: 160, flex: 'none' }} />
            <div className="col" style={{ gap: 8 }}>
              <b>{charName(getCharacterDef(offer.charId))} 앞으로 기지에서 보급품이 도착했습니다.</b>
              <span className="muted">기지에서 육성한 능력을 바탕으로 하는 특별 지원입니다.</span>
              <span className="tag placeholder">효과 임시: 해당 요원 HP 완전 회복 + 원정 버프 기록 (수치 효과는 PHASE 7)</span>
            </div>
          </div>
        </EventModal>
      );
    case 'resource': case 'intel':
      return (
        <EventModal title={offer.kind === 'resource' ? '자원 탐색' : '정보 및 연구 자료'} actions={<Button variant="primary" onClick={() => resolveNodeEvent({})} data-testid="ev-ok">회수</Button>}>
          <p style={{ marginTop: 0 }}>{offer.kind === 'resource' ? '쓸 만한 물자를 찾았습니다.' : '부토스 관련 기록과 연구 자료를 확보했습니다.'}</p>
          <p className="muted">획득: {lootText(offer.loot)} <span className="dim">(원정 획득물 · 귀환 후 정산)</span></p>
        </EventModal>
      );
    case 'rest':
      return (
        <EventModal title="회복 및 정비" actions={<Button variant="primary" onClick={() => resolveNodeEvent({})} data-testid="ev-ok">정비한다</Button>}>
          <p style={{ marginTop: 0 }}>안전한 지점입니다. 부대원 HP와 임시 거점을 정비합니다.</p>
          <p className="muted">부대원 HP +{Math.round(DATA.generation.restHeal * 100)}% · 임시 거점 +{DATA.generation.restOutpost} <span className="dim">(임시 수치)</span></p>
        </EventModal>
      );
    case 'shop':
      return (
        <EventModal wide title="상점 및 교환" actions={<Button variant="ghost" onClick={() => resolveNodeEvent({ skip: true })} data-testid="ev-skip">떠난다</Button>}>
          <p className="muted" style={{ marginTop: 0 }}>원정 획득물로 유물을 교환할 수 있습니다. 보유: {lootText(ex.loot)}</p>
          <div className="choice-grid">
            {offer.stock.map((it, i) => (
              <button key={it.relic} className="choice" onClick={() => resolveNodeEvent({ index: i })} data-testid={`ev-shop-${i}`}>
                <b>{getRelic(it.relic)?.name}</b><span className="dim">{fx(it.relic)}</span><span className="tag">{lootText(it.price)}</span>
              </button>
            ))}
          </div>
        </EventModal>
      );
    case 'event': {
      const ev = getEvent(offer.eventId)!;
      return (
        <EventModal title={ev.title} actions={<span className="tag placeholder">사건 내용 임시</span>}>
          <p style={{ marginTop: 0 }}>{ev.text}</p>
          <div className="col" style={{ gap: 10 }}>
            {ev.choices.map((c, i) => <Button key={i} block onClick={() => resolveNodeEvent({ index: i })} data-testid={`ev-choice-${i}`}>{c.label}</Button>)}
          </div>
        </EventModal>
      );
    }
  }
}
