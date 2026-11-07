import { useLayoutEffect, useState } from 'react';
import { useRouter } from '../../core/router';
import { DATA, getNpc } from '../../data';
import { Button, ConfirmDialog } from '../components/Common';
import { asset } from '../components/Icon';
import { MainScreen } from './MainScreen';

// Which main-screen area each preview step highlights (data-tut anchors). Final mapping is decided in PHASE 3.
const HIGHLIGHT: Record<number, string | undefined> = { 2: 'menu', 3: 'resources' };

/** Preview of the secretary dialogue UI + highlight overlay on top of the real main screen. */
export function TutorialPreviewScreen() {
  const back = useRouter((r) => r.back);
  const steps = DATA.tutorial.steps;
  const npc = getNpc(DATA.tutorial.speaker)!;
  const [i, setI] = useState(0);
  const [skip, setSkip] = useState(false);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    const key = HIGHLIGHT[step.id];
    const el = key ? document.querySelector<HTMLElement>(`[data-tut="${key}"]`) : null;
    const stage = document.querySelector<HTMLElement>('[data-testid="stage"]');
    if (!el || !stage) return setRect(null);
    const sr = stage.getBoundingClientRect(), er = el.getBoundingClientRect();
    const k = stage.offsetWidth / sr.width; // undo stage scale
    setRect({ x: (er.left - sr.left) * k, y: (er.top - sr.top) * k, w: er.width * k, h: er.height * k });
  }, [step.id]);

  return (
    <div className="screen" data-testid="screen-tutorialPreview">
      <MainScreen />
      <div className="tut-layer">
        {rect
          ? <div className="tut-hole" style={{ left: rect.x - 8, top: rect.y - 8, width: rect.w + 16, height: rect.h + 16 }} />
          : <div className="tut-veil" />}
        <div className="tut-dialog">
          <img className="tut-npc" src={asset(npc.art.full)} alt={npc.name} />
          <div className="tut-box">
            <div className="tut-name"><b>{npc.name}</b><span className="dim">통합인류행정부 비서</span><span className="tut-step" data-testid="tut-step">STEP {step.id} / {steps.length} · {step.title}</span></div>
            <p className="tut-text">{DATA.tutorial.placeholderLine}</p>
            <div className="row">
              <div className="tut-dots">{steps.map((s, k) => <i key={s.id} className={k <= i ? 'on' : ''} />)}</div>
              <div className="grow" />
              <Button small variant="ghost" onClick={() => setSkip(true)} data-testid="tut-skip">건너뛰기</Button>
              <Button small variant="primary" onClick={() => (i < steps.length - 1 ? setI(i + 1) : back())} data-testid="tut-next">{i < steps.length - 1 ? '다음' : '종료'}</Button>
            </div>
          </div>
        </div>
        <div className="tut-preview-tag"><span className="tag placeholder">튜토리얼 UI 미리보기 · 진행 로직은 PHASE 3</span></div>
      </div>
      {skip && <ConfirmDialog title="튜토리얼 건너뛰기" message="튜토리얼을 건너뛰면 완료 처리됩니다. 건너뛸까요?" confirmLabel="건너뛰기" onCancel={() => setSkip(false)} onConfirm={back} />}
    </div>
  );
}
