import { useMemo, useState } from 'react';
import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { CONFIG } from '../../core/config';
import { loadSlot, saveSlot, saves } from '../../core/session';
import type { SlotId, SlotInfo, SlotStatus } from '../../save/types';
import { Button, ConfirmDialog, Notice, Panel, ScreenHeader, Tabs } from '../components/Common';
import { useToast } from '../components/Toast';

type Mode = 'save' | 'load';
const STATUS: Record<SlotStatus, { label: string; cls: string }> = {
  empty: { label: '비어 있음', cls: '' }, ok: { label: '정상', cls: 'accent' }, corrupt: { label: '손상됨', cls: 'danger' },
  incompatible: { label: '호환 불가', cls: 'warn' }, newer: { label: '새 버전 데이터', cls: 'warn' },
};
const slotName = (s: SlotId) => (s === 'auto' ? '자동' : String(s).padStart(2, '0'));
const fmtReal = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Pending = { kind: 'overwrite' | 'load' | 'delete' | 'restore'; slot: SlotId } | null;

export function SaveLoadScreen() {
  const params = useRouter((r) => r.params);
  const { state, inBattle, lastSavedAt } = useGame();
  const hasGame = !!state;
  const toast = useToast((t) => t.push);
  const [mode, setMode] = useState<Mode>(hasGame ? ((params.mode as Mode) ?? 'save') : 'load');
  const [rev, setRev] = useState(0);
  const list = useMemo(() => saves.list(), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState<SlotId>(mode === 'save' ? 1 : (saves.latest()?.slot ?? 1));
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const info: SlotInfo = list.find((s) => s.slot === sel)!;
  const modes = hasGame ? [{ id: 'save' as const, name: '저장' }, { id: 'load' as const, name: '불러오기' }] : [{ id: 'load' as const, name: '불러오기' }];

  const doSave = (slot: SlotId) => {
    const r = saveSlot(slot);
    setPending(null); setRev((v) => v + 1);
    if (r.ok) { toast(`슬롯 ${slotName(slot)}에 저장했습니다.`); setError(null); } else setError(r.message);
  };
  const doLoad = (slot: SlotId, backup = false) => {
    setPending(null);
    const r = loadSlot(slot, backup);
    if (r.ok) toast(r.restoredFromBackup ? '백업 데이터로 복구해 불러왔습니다.' : `슬롯 ${slotName(slot)}을 불러왔습니다.`);
    else { setError(r.message); setRev((v) => v + 1); }
  };
  const doDelete = (slot: SlotId) => { saves.delete(slot); setPending(null); setRev((v) => v + 1); toast(`슬롯 ${slotName(slot)}을 삭제했습니다.`); };

  const onSave = () => (info.status === 'empty' ? doSave(sel) : setPending({ kind: 'overwrite', slot: sel }));
  const onLoad = () => (hasGame ? setPending({ kind: 'load', slot: sel }) : doLoad(sel));

  return (
    <div className="screen" data-testid="screen-saveLoad">
      <ScreenHeader title="저장 / 불러오기" code="DATA ARCHIVE" tail={hasGame && <span className="tag">마지막 저장 {fmtReal(lastSavedAt ?? undefined)}</span>} />
      <div className="screen-main">
        <Panel title="저장 슬롯" style={{ flex: 2 }} bodyClass="col grow">
          <Tabs items={modes} value={mode} onChange={(m) => { setMode(m); setError(null); if (m === 'save' && sel === 'auto') setSel(1); }} />
          <table className="table">
            <thead><tr><th>슬롯</th><th>저장 일시</th><th>게임 내 날짜</th><th>진행 요약</th><th>원정</th><th>상태</th></tr></thead>
            <tbody>
              {list.map((s) => {
                const disabled = mode === 'save' && s.slot === 'auto';
                const m = s.meta?.summary;
                return (
                  <tr key={s.slot} className={`${disabled ? 'dim' : 'click'} ${sel === s.slot ? 'sel' : ''}`} onClick={() => !disabled && (setSel(s.slot), setError(null))} data-testid={`slot-${s.slot}`}>
                    <td className="num">{slotName(s.slot)}</td>
                    <td className="num">{fmtReal(s.meta?.savedAt)}</td>
                    <td className="num">{m ? `${m.gameDate} ${m.gameTime}` : '—'}</td>
                    <td>{m ? `시설 ${m.facilities} · 부대원 ${m.roster}` : '—'}</td>
                    <td>{m ? (m.inExpedition ? `진행 중 (난이도 ${m.difficulty})` : '없음') : '—'}</td>
                    <td><span className={`tag ${STATUS[s.status].cls}`} data-testid={`slot-status-${s.slot}`}>{STATUS[s.status].label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="grow" />
          <Notice>저장 슬롯 {CONFIG.save.slotCount}개와 자동 저장 슬롯 1개를 사용합니다. 자동 저장 슬롯에는 직접 저장할 수 없습니다. 전투 중에는 저장할 수 없고, 불러오면 전투 시작 직전으로 돌아갑니다.</Notice>
        </Panel>

        <Panel title={`슬롯 ${slotName(sel)}`} style={{ flex: 1 }} bodyClass="col grow">
          {info.meta ? (
            <dl className="kv" data-testid="slot-detail">
              <dt>상태</dt><dd><span className={`tag ${STATUS[info.status].cls}`}>{STATUS[info.status].label}</span></dd>
              <dt>저장 방식</dt><dd>{info.meta.kind === 'auto' ? '자동 저장' : '수동 저장'}</dd>
              <dt>저장 일시</dt><dd className="num">{fmtReal(info.meta.savedAt)}</dd>
              <dt>게임 내 날짜</dt><dd className="num">{info.meta.summary.gameDate} {info.meta.summary.gameTime}</dd>
              <dt>운영 시설</dt><dd className="num">{info.meta.summary.facilities}</dd>
              <dt>개척부대원</dt><dd className="num">{info.meta.summary.roster}명</dd>
              <dt>원정</dt><dd>{info.meta.summary.inExpedition ? `진행 중 · 난이도 ${info.meta.summary.difficulty}` : '없음'}</dd>
              <dt>데이터 버전</dt><dd className="num">v{info.saveVersion}</dd>
            </dl>
          ) : <div className="empty grow">{info.status === 'empty' ? '저장 데이터 없음' : '정보를 읽을 수 없습니다'}</div>}
          {info.problem && <div className="notice danger-notice" data-testid="slot-problem">{info.problem}</div>}
          {error && <div className="notice danger-notice" data-testid="save-error">{error}</div>}
          <div className="grow" />
          {mode === 'save' && (
            inBattle
              ? <Button variant="primary" disabled>전투 중에는 저장할 수 없습니다</Button>
              : <Button variant="primary" disabled={sel === 'auto'} onClick={onSave} data-testid="btn-save">{info.status === 'empty' ? '이 슬롯에 저장' : '덮어쓰기'}</Button>
          )}
          {mode === 'load' && <Button variant="primary" disabled={info.status !== 'ok'} onClick={onLoad} data-testid="btn-load-slot">불러오기</Button>}
          {mode === 'load' && info.status !== 'ok' && info.hasBackup && <Button onClick={() => setPending({ kind: 'restore', slot: sel })} data-testid="btn-restore">백업으로 복구</Button>}
          <Button variant="danger" disabled={info.status === 'empty'} onClick={() => setPending({ kind: 'delete', slot: sel })} data-testid="btn-delete">삭제</Button>
        </Panel>
      </div>

      {pending?.kind === 'overwrite' && <ConfirmDialog warn title="저장 데이터 덮어쓰기" confirmLabel="덮어쓰기" onCancel={() => setPending(null)} onConfirm={() => doSave(pending.slot)}
        message={<>슬롯 {slotName(pending.slot)}의 기존 저장 데이터({fmtReal(info.meta?.savedAt)})를 현재 진행 상황으로 덮어씁니다. 계속할까요?</>} />}
      {pending?.kind === 'load' && <ConfirmDialog warn title="저장 데이터 불러오기" confirmLabel="불러오기" onCancel={() => setPending(null)} onConfirm={() => doLoad(pending.slot)}
        message="현재 진행 중인 게임에서 저장하지 않은 내용은 사라집니다. 불러올까요?" />}
      {pending?.kind === 'delete' && <ConfirmDialog warn title="저장 데이터 삭제" confirmLabel="삭제" onCancel={() => setPending(null)} onConfirm={() => doDelete(pending.slot)}
        message={<>슬롯 {slotName(pending.slot)}의 저장 데이터와 백업을 삭제합니다. 삭제한 데이터는 되돌릴 수 없습니다.</>} />}
      {pending?.kind === 'restore' && <ConfirmDialog title="백업으로 복구" confirmLabel="복구 후 불러오기" onCancel={() => setPending(null)} onConfirm={() => doLoad(pending.slot, true)}
        message="손상된 데이터를 마지막 정상 백업으로 바꾸고 불러옵니다." />}
    </div>
  );
}
