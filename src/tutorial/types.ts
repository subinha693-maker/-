import type { ScreenId } from '../core/router';

export interface TutorialLine {
  text: string;
  target?: string;                         // data-tut anchor to highlight
  pose?: 'full';                           // full-body secretary illustration
  await?: { click?: string; signal?: string }; // wait for a player action instead of "다음"
}
export interface TutorialStep {
  id: number; title: string;
  startScreen: ScreenId;                   // where to resume this step after loading a save
  enter?: { screen: ScreenId; training?: boolean }; // navigate when the step begins
  lines: TutorialLine[];
}
