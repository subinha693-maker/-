import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { useRouter, type ScreenId } from '../../core/router';
import { DATA, getFacilityDef } from '../../data';
import { TopBar } from '../components/TopBar';
import { Button, ConfirmDialog, Panel, PlaceholderTag } from '../components/Common';
import { Icon } from '../components/Icon';
import { BaseView } from '../components/BaseView';
import { SettingsModal } from './SettingsModal';

const MENU: { id: ScreenId; label: string; icon: string; code: string }[] = [
  { id: 'facilities',     label: '시설 관리',   icon: 'facility',   code: 'FAC' },
  { id: 'population',     label: '인구 관리',   icon: 'population', code: 'POP' },
  { id: 'research',       label: '연구 개발',   icon: 'research',   code: 'R&D' },
  { id: 'squad',          label: '개척부대',    icon: 'squad',      code: 'SQD' },
  { id: 'recruit',        label: '이력서 확인', icon: 'recruit',    code: 'REC' },
  { id: 'expeditionPrep', label: '개척 작전',   icon: 'expedition', code: 'OPS' },
];

const fmt = new Intl.NumberFormat('ko-KR');

export function MainScreen() {
  const s = useGame((g) => g.state)!;
  const quit = useGame((g) => g.quitToTitle);
  const { go, reset } = useRouter();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const popTotal = Object.values(s.population).reduce((a, b) => a + b, 0);
  const sel = s.facilities.find((f) => f.uid === selected);
  const selDef = sel && getFacilityDef(sel.defId);

  return (
    <div className="screen" data-testid="screen-main">
      <TopBar />
      <div className="main-body">
        <nav className="side-nav" data-tut="menu">
          {MENU.map((m) => (
            <button key={m.id} className="nav-item" onClick={() => go(m.id)} data-testid={`nav-${m.id}`}>
              <Icon name={m.icon} size={40} />
              <span className="grow">{m.label}</span>
              <span className="nav-code">{m.code}</span>
            </button>
          ))}
          <div className="grow" />
          <div className="nav-sys">
            <Button small onClick={() => go('saveLoad', { mode: 'save' })} data-testid="nav-save">저장 / 불러오기</Button>
            <Button small onClick={() => setSettings(true)} data-testid="nav-settings">설정</Button>
            <Button small variant="ghost" onClick={() => setConfirmQuit(true)} data-testid="nav-title">타이틀로</Button>
          </div>
        </nav>

        <section className="base-area" data-tut="base">
          <BaseView facilities={s.facilities} selected={selected} onSelect={setSelected} />
          <div className="base-legend">
            <span className="tag accent">행정 구역 전경</span>
            <PlaceholderTag label="시설 배치 임시" />
          </div>
          {sel && selDef && (
            <div className="base-pop" data-testid="facility-popup">
              <b>{selDef.name}</b>
              <span className="dim">{DATA.facilityCategories.find((c) => c.id === selDef.category)?.name} · Lv.{sel.level}</span>
              <Button small onClick={() => go('facilities', { focus: sel.uid })}>시설 관리에서 보기</Button>
            </div>
          )}
        </section>

        <aside className="right-col">
          <Panel title="정부 현황" tail={<PlaceholderTag />} tut="status">
            <dl className="kv">
              <dt>총 인구</dt><dd className="num">{fmt.format(popTotal)}</dd>
              <dt>운영 시설</dt><dd className="num">{s.facilities.filter((f) => f.status === 'active').length} / {s.facilities.length}</dd>
              <dt>개척부대원</dt><dd className="num">{s.roster.length}명</dd>
              <dt>진행 중 연구</dt><dd>{s.research.active ?? '없음'}</dd>
              <dt>개척 작전</dt><dd>{s.expedition ? '진행 중' : '대기'}</dd>
              <dt>해금 난이도</dt><dd className="num">{Math.max(...s.progress.unlockedDifficulties)}단계</dd>
            </dl>
          </Panel>
          <Panel title="알림 및 경고" className="grow" bodyClass="scroll alerts" tut="alerts">
            <div className="alert info"><b>행정 단말 연결</b><span>새 행정 세션이 시작되었습니다.</span></div>
            <div className="alert warn"><b>시간 흐름 미가동</b><span>자원 생산·소비는 PHASE 4에서 연결됩니다.</span></div>
            <div className="alert"><b>저장 기능 준비 중</b><span>세이브/로드는 PHASE 2에서 연결됩니다.</span></div>
          </Panel>
        </aside>
      </div>

      {confirmQuit && (
        <ConfirmDialog
          title="타이틀로 이동"
          warn
          message="현재 진행 상황은 아직 저장 기능이 없어 사라집니다. 타이틀로 이동할까요?"
          confirmLabel="이동"
          onCancel={() => setConfirmQuit(false)}
          onConfirm={() => { quit(); reset('title'); }}
        />
      )}
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}
