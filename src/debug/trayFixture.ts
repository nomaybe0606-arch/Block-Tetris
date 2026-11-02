// GRID_PULSE_DEV_TRAY_ONLY: deterministic visual QA, imported only by the local DEV mock.
import { newGame } from '../core/game';
import type { Profile } from '../platform/profile';
export function prepareTrayFixture(profile:Profile):void{
  profile.tutorialDone=true;profile.game=newGame(42,profile.best);
  profile.game.tray=[{shapeId:'line-5-v',color:3},{shapeId:'line-5-h',color:7},{shapeId:'square-3',color:2}];
}
export function prepareComboFixture(profile:Profile,level:number):void{
  profile.tutorialDone=true;profile.best=1000;profile.game=newGame(42,1000);profile.game.score=500;
  profile.game.combo=Math.max(1,Math.min(7,Math.floor(level)-1));profile.game.maxCombo=profile.game.combo;
  profile.game.board[0]=[1,1,1,1,1,1,1,0];profile.game.tray=[{shapeId:'single',color:2},{shapeId:'single',color:3},null];
}
