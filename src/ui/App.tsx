import type { ComponentType } from 'react';
import { useGame } from '../core/gameStore';
import { useRouter, type ScreenId } from '../core/router';
import { Stage } from './components/Stage';
import { ToastHost } from './components/Toast';
import { TitleScreen } from './screens/TitleScreen';
import { MainScreen } from './screens/MainScreen';
import { FacilitiesScreen } from './screens/FacilitiesScreen';
import { PopulationScreen } from './screens/PopulationScreen';
import { ResearchScreen } from './screens/ResearchScreen';
import { SquadScreen } from './screens/SquadScreen';
import { RecruitScreen } from './screens/RecruitScreen';
import { ExpeditionPrepScreen } from './screens/ExpeditionPrepScreen';
import { ExpeditionMapScreen } from './screens/ExpeditionMapScreen';
import { BattleScreen } from './screens/BattleScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SaveLoadScreen } from './screens/SaveLoadScreen';
import { TutorialHost } from '../tutorial/TutorialHost';
import { ScreenIndexScreen } from './screens/ScreenIndexScreen';

const SCREENS: Record<ScreenId, ComponentType> = {
  title: TitleScreen, main: MainScreen, facilities: FacilitiesScreen, population: PopulationScreen,
  research: ResearchScreen, squad: SquadScreen, recruit: RecruitScreen, expeditionPrep: ExpeditionPrepScreen,
  expeditionMap: ExpeditionMapScreen, battle: BattleScreen, result: ResultScreen, saveLoad: SaveLoadScreen,
  screenIndex: ScreenIndexScreen,
};
// Screens that can render without an active game session.
const NO_SESSION: ScreenId[] = ['title', 'saveLoad', 'screenIndex'];

export function App() {
  const screen = useRouter((r) => r.screen);
  const hasGame = useGame((g) => !!g.state);
  const Current = !hasGame && !NO_SESSION.includes(screen) ? TitleScreen : SCREENS[screen];
  return <Stage><Current key={screen} />{hasGame && <TutorialHost />}<ToastHost /></Stage>;
}
