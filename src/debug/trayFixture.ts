// GRID_PULSE_DEV_TRAY_ONLY: deterministic visual QA, imported only by the local DEV mock.
import { newGame } from '../core/game';
import type { Profile } from '../platform/profile';
export function prepareTrayFixture(profile:Profile):void{
  profile.tutorialDone=true;profile.game=newGame(42,profile.best);
  profile.game.tray=[{shapeId:'line-5-v',color:3},{shapeId:'line-5-h',color:7},{shapeId:'square-3',color:2}];
}
