import { DATA } from '../data';
import { events } from '../core/events';
import { useGame } from '../core/gameStore';
import { useRouter } from '../core/router';
import { useToast } from '../ui/components/Toast';
import { useTutorialRuntime } from './tutorialStore';
import type { TutorialStep } from './types';

export const STEPS = DATA.tutorial.steps as unknown as TutorialStep[];
const rt = () => useTutorialRuntime.getState();
const tut = () => useGame.getState().state?.tutorial;

export const currentStep = (): TutorialStep | undefined => {
  const t = tut();
  return t?.active ? STEPS.find((s) => s.id === t.step) : undefined;
};

function patch(p: Partial<NonNullable<ReturnType<typeof tut>>>) {
  useGame.getState().mutate((s) => ({ ...s, tutorial: { ...s.tutorial, ...p } }));
}

function trainingParty() {
  const picked = rt().trainingParty;
  if (picked.length) return picked;
  return useGame.getState().state!.roster.slice(0, 3).map((r) => r.charId);
}

/** Moves to the screen a step needs (on step entry, or on resume after loading). */
function navigateFor(step: TutorialStep, resume: boolean) {
  const router = useRouter.getState();
  const screen = resume ? step.startScreen : step.enter?.screen;
  if (!screen) return;
  const training = screen === 'expeditionMap' || screen === 'battle';
  if (!training) { router.reset(screen); return; }
  if (resume) router.reset('main');
  router.go(screen, { training: true, party: trainingParty() });
}

/** Offer the tutorial (first run). */
export function offerTutorial() { rt().set({ promptOpen: true }); }

export function startTutorial() {
  rt().set({ promptOpen: false, line: 0, signals: {}, trainingParty: [] });
  patch({ active: true, step: 1, skipped: false, completedHints: [] });
  useRouter.getState().reset('main');
  events.emit('tutorial:step', { step: 1 }); // autosave so a quit during step 1 can resume
}

export function skipTutorial() {
  rt().set({ promptOpen: false, line: 0 });
  patch({ active: false, skipped: true });
  useRouter.getState().reset('main');
  events.emit('tutorial:step', { step: -1 });
}

/** Called after loading a save: continue from the start of the last unfinished step. */
export function resumeTutorial() {
  const step = currentStep();
  if (!step) return;
  rt().set({ line: 0, signals: {} });
  navigateFor(step, true);
}

export function nextLine() {
  const step = currentStep();
  if (!step) return;
  const r = rt();
  if (r.line < step.lines.length - 1) { r.set({ line: r.line + 1 }); return; }
  completeStep(step);
}

function completeStep(step: TutorialStep) {
  const t = tut()!;
  const idx = STEPS.findIndex((s) => s.id === step.id);
  const next = STEPS[idx + 1];
  const hints = [...new Set([...t.completedHints, `step-${step.id}`])];
  rt().set({ line: 0 });
  if (!next) {
    patch({ active: false, step: step.id + 1, completedHints: hints });
    events.emit('tutorial:step', { step: step.id + 1 });
    useToast.getState().push('튜토리얼을 완료했습니다.');
    return;
  }
  patch({ step: next.id, completedHints: hints });
  events.emit('tutorial:step', { step: next.id });
  navigateFor(next, false);
}

/** Screens report player actions here (e.g. party selection) for steps that wait on them. */
export function tutorialSignal(name: string, value: unknown) {
  rt().set({ signals: { ...rt().signals, [name]: value } });
  const step = currentStep();
  const line = step?.lines[rt().line];
  if (line?.await?.signal === name && value) {
    if (name === 'party-full') rt().set({ trainingParty: value as string[] });
    nextLine();
  }
}
