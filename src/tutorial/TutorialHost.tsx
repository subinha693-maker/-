import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../core/gameStore';
import { useRouter } from '../core/router';
import { DATA, getNpc } from '../data';
import { Button, ConfirmDialog, Modal } from '../ui/components/Common';
import { asset } from '../ui/components/Icon';
import { STEPS, currentStep, nextLine, skipTutorial, startTutorial } from './controller';
import { useTutorialRuntime } from './tutorialStore';

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 10;
const CHAR_MS = 22;

/** Finds an anchor and returns its rect in stage (logical 1080p) coordinates. */
function measure(anchor: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tut="${anchor}"]`);
  const stage = document.querySelector<HTMLElement>('[data-testid="stage"]');
  if (!el || !stage) return null;
  const sr = stage.getBoundingClientRect(), er = el.getBoundingClientRect();
  if (!er.width || !er.height) return null;
  const k = stage.offsetWidth / sr.width;
  return { x: (er.left - sr.left) * k - PAD, y: (er.top - sr.top) * k - PAD, w: er.width * k + PAD * 2, h: er.height * k + PAD * 2 };
}

export function TutorialHost() {
  const active = useGame((g) => !!g.state?.tutorial.active);
  const stepNo = useGame((g) => g.state?.tutorial.step ?? 0);
  const screen = useRouter((r) => r.screen);
  const { line, promptOpen } = useTutorialRuntime();
  const [skipAsk, setSkipAsk] = useState(false);
  const [declineAsk, setDeclineAsk] = useState(false);

  if (promptOpen) return <TutorialPrompt declineAsk={declineAsk} setDeclineAsk={setDeclineAsk} />;
  if (!active) return null;
  const step = currentStep();
  if (!step) return null;
  return (
    <>
      <Overlay key={`${stepNo}-${line}-${screen}`} stepTitle={step.title} lineIdx={line} onSkip={() => setSkipAsk(true)} />
      {skipAsk && <ConfirmDialog warn title="튜토리얼 건너뛰기" confirmLabel="건너뛰기" onCancel={() => setSkipAsk(false)}
        onConfirm={() => { setSkipAsk(false); skipTutorial(); }}
        message="튜토리얼을 건너뛰면 완료한 것으로 처리되고 바로 일반 게임이 시작됩니다. 설정에서 언제든 다시 볼 수 있습니다." />}
    </>
  );
}

function TutorialPrompt({ declineAsk, setDeclineAsk }: { declineAsk: boolean; setDeclineAsk: (v: boolean) => void }) {
  const npc = getNpc(DATA.tutorial.speaker)!;
  if (declineAsk) {
    return <ConfirmDialog warn title="튜토리얼 건너뛰기" confirmLabel="건너뛰기" onCancel={() => setDeclineAsk(false)}
      onConfirm={() => { setDeclineAsk(false); skipTutorial(); }}
      message="튜토리얼 없이 바로 시작할까요? 설정에서 언제든 튜토리얼을 다시 볼 수 있습니다." />;
  }
  return (
    <Modal title="최초 접속 안내" actions={<>
      <Button variant="ghost" onClick={() => setDeclineAsk(true)} data-testid="tut-decline">건너뛰기</Button>
      <Button variant="primary" onClick={startTutorial} data-testid="tut-start">안내 받기</Button>
    </>}>
      <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
        <img src={asset(npc.art.portrait ?? npc.art.full)} alt="" className="tut-portrait" />
        <div className="col" style={{ gap: 8 }}>
          <b style={{ color: 'var(--accent)', fontSize: 'var(--fs-l)' }}>{npc.name}</b>
          <span>처음 오셨네요, 책임자님! 화면을 직접 눌러 보면서 정부 운영과 개척 작전을 같이 익혀 볼까요?</span>
          <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>총 {STEPS.length}단계 · 진행 상황은 자동으로 저장됩니다.</span>
        </div>
      </div>
    </Modal>
  );
}

function Overlay({ stepTitle, lineIdx, onSkip }: { stepTitle: string; lineIdx: number; onSkip: () => void }) {
  const step = currentStep()!;
  const ln = step.lines[lineIdx];
  const npc = getNpc(DATA.tutorial.speaker)!;
  const [rect, setRect] = useState<Rect | null>(null);
  const [shown, setShown] = useState(0);
  const typing = shown < ln.text.length;
  const waiting = !!ln.await;
  const stepIndex = STEPS.findIndex((s) => s.id === step.id);

  // Track the highlighted element (it can appear after a screen change or move on resize).
  useLayoutEffect(() => {
    if (!ln.target) { setRect(null); return; }
    const upd = () => setRect((prev) => {
      const r = measure(ln.target!);
      return prev && r && prev.x === r.x && prev.y === r.y && prev.w === r.w && prev.h === r.h ? prev : r;
    });
    upd();
    const h = setInterval(upd, 200);
    window.addEventListener('resize', upd);
    return () => { clearInterval(h); window.removeEventListener('resize', upd); };
  }, [ln.target]);

  // Typewriter text.
  useEffect(() => {
    setShown(0);
    const h = setInterval(() => setShown((n) => { if (n >= ln.text.length) { clearInterval(h); return n; } return n + 1; }), CHAR_MS);
    return () => clearInterval(h);
  }, [ln.text]);

  // Wait for a click on the anchor (the click still reaches the real UI first).
  const done = useRef(false);
  useEffect(() => {
    const anchor = ln.await?.click;
    if (!anchor) return;
    const on = (e: Event) => {
      const t = e.target as HTMLElement;
      if (!done.current && t.closest?.(`[data-tut="${anchor}"]`)) { done.current = true; setTimeout(nextLine, 0); }
    };
    document.addEventListener('click', on, true);
    return () => document.removeEventListener('click', on, true);
  }, [ln.await?.click]);

  const advance = useCallback(() => { if (typing) setShown(ln.text.length); else if (!waiting) nextLine(); }, [typing, waiting, ln.text.length]);

  const full = ln.pose === 'full';
  const stageW = document.querySelector<HTMLElement>('[data-testid="stage"]')?.offsetWidth ?? 1920;
  // Keep the dialog away from the highlight: beside tall narrow targets, otherwise above/below.
  const side = rect && rect.h > 560 && rect.w < stageW * 0.5 ? (rect.x + rect.w / 2 > stageW / 2 ? 'left' : 'right') : null;
  const placeTop = !!rect && rect.y + rect.h / 2 > 560;
  const place = full ? 'full' : side ?? (placeTop ? 'top' : 'bottom');
  const holeOpen = waiting && !!ln.await?.click || waiting && !!ln.await?.signal;

  return (
    <div className="tut-layer" data-testid="tutorial-overlay">
      {/* click shields: everything except the hole (and the hole too unless the player must act there) */}
      {rect ? (
        <>
          <div className="tut-shield" style={{ left: 0, top: 0, right: 0, height: Math.max(0, rect.y) }} />
          <div className="tut-shield" style={{ left: 0, top: rect.y + rect.h, right: 0, bottom: 0 }} />
          <div className="tut-shield" style={{ left: 0, top: rect.y, width: Math.max(0, rect.x), height: rect.h }} />
          <div className="tut-shield" style={{ left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h }} />
          {!holeOpen && <div className="tut-shield clear" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
          <div className={`tut-hole ${holeOpen ? 'act' : ''}`} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} data-testid="tut-hole" />
        </>
      ) : <div className="tut-shield full" />}

      {full && <img className="tut-npc" src={asset(npc.art.full)} alt="" />}
      <div className={`tut-box ${place}`} onClick={advance} data-testid="tut-box">
        {!full && <img className="tut-portrait" src={asset(npc.art.portrait ?? npc.art.full)} alt="" />}
        <div className="col grow" style={{ gap: 10, minWidth: 0 }}>
          <div className="tut-name">
            <b>{npc.name}</b><span className="dim">통합인류행정부 비서</span>
            <span className="tut-step" data-testid="tut-step">STEP {step.id} / {STEPS.length} · {stepTitle}</span>
          </div>
          <p className="tut-text" data-testid="tut-text">{ln.text.slice(0, shown)}<span className="tut-caret">{typing ? '▍' : ''}</span></p>
          <div className="row" onClick={(e) => e.stopPropagation()}>
            <div className="tut-dots" aria-label={`대화 ${lineIdx + 1} / ${step.lines.length}`}>
              {step.lines.map((_, k) => <i key={k} className={k <= lineIdx ? 'on' : ''} />)}
            </div>
            <span className="dim num" style={{ fontSize: 'var(--fs-xs)' }}>{stepIndex + 1}단계 · {lineIdx + 1}/{step.lines.length}</span>
            <div className="grow" />
            <Button small variant="ghost" onClick={onSkip} data-testid="tut-skip">건너뛰기</Button>
            {waiting
              ? <span className="tag accent" data-testid="tut-waiting">{ln.await?.signal ? '선택을 완료해 주세요' : '표시된 곳을 눌러 주세요'}</span>
              : <Button small variant="primary" onClick={advance} data-testid="tut-next">{typing ? '전체 보기' : '다음'}</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
