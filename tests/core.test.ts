import { describe, expect, it } from 'vitest';
import { availableMoves, canPlace, clearLines, emptyBoard, findLines } from '../src/core/board';
import { generateTray } from '../src/core/generator';
import { isGameOver, newGame, placePiece } from '../src/core/game';
import { SeededRng } from '../src/core/rng';
import { getShape, SHAPES } from '../src/core/shapes';
import { restoreGame, serializeGame } from '../src/core/serialization';
import { defaultProfile, restoreProfile } from '../src/platform/profile';
import type { GameState } from '../src/core/types';

function single(state=newGame(123)):GameState {
  return {...state,tray:[{shapeId:'single',color:1},{shapeId:'single',color:2},{shapeId:'single',color:3}]};
}
function readyRow(state:GameState,row=0):GameState {
  const result=single({...state,board:state.board.map(r=>[...r])});
  result.board[row].fill(1);result.board[row][7]=0;return result;
}
describe('placement and immutable board operations',()=>{
  it('allows a fitting shape at both boundaries',()=>{
    expect(canPlace(emptyBoard(),getShape('square-2'),0,0)).toBe(true);
    expect(canPlace(emptyBoard(),getShape('square-2'),6,6)).toBe(true);
  });
  it.each([[-1,0],[0,-1],[7,7],[8,0],[0,8],[.5,1],[NaN,0]])('rejects outside or fractional coordinate %s,%s',(x,y)=>{
    expect(canPlace(emptyBoard(),getShape('square-2'),x,y)).toBe(false);
  });
  it('rejects an overlap and preserves input',()=>{
    const state=single();state.board[0][0]=4;const before=serializeGame(state);
    expect(placePiece(state,0,0,0)).toBeNull();expect(serializeGame(state)).toBe(before);
  });
  it('does not mutate the previous game on legal placement',()=>{
    const state=single(),before=serializeGame(state),result=placePiece(state,0,3,4)!;
    expect(serializeGame(state)).toBe(before);expect(result.state.board[4][3]).toBe(1);
  });
  it('keeps holes in non-rectangular shapes free',()=>{
    const state=newGame(1);state.tray[0]={shapeId:'T-0',color:3};
    const result=placePiece(state,0,1,1)!;expect(result.state.board[2][1]).toBe(0);expect(result.state.board[2][2]).toBe(3);
  });
});
describe('simultaneous line clearing without gravity',()=>{
  it('clears a full row',()=>{
    const board=emptyBoard();board[2].fill(2);const result=clearLines(board);
    expect(result.rows).toEqual([2]);expect(result.columns).toEqual([]);expect(result.board[2]).toEqual(Array(8).fill(0));
  });
  it('clears a full column',()=>{
    const board=emptyBoard();board.forEach(row=>row[4]=3);const result=clearLines(board);
    expect(result.columns).toEqual([4]);expect(result.cells).toHaveLength(8);expect(result.board.every(row=>row[4]===0)).toBe(true);
  });
  it('clears intersecting row and column simultaneously, counting the shared cell once',()=>{
    const state=single();state.board[3].fill(1);state.board.forEach(row=>row[4]=2);state.board[3][4]=0;
    const result=placePiece(state,0,4,3)!;
    expect(result.rows).toEqual([3]);expect(result.columns).toEqual([4]);expect(result.cleared).toHaveLength(15);
    expect(result.points).toBe(41);expect(result.state.board.flat().every(c=>c===0)).toBe(true);
  });
  it('clears several lines in one move',()=>{
    const state=single();state.tray[0]={shapeId:'line-2-v',color:5};state.board[0].fill(1);state.board[1].fill(2);state.board[0][7]=0;state.board[1][7]=0;
    const result=placePiece(state,0,7,0)!;expect(result.rows).toEqual([0,1]);expect(result.points).toBe(42);
  });
  it('preserves every unrelated coordinate',()=>{
    const board=emptyBoard();board[4].fill(3);board[1][2]=5;board[7][6]=7;
    const result=clearLines(board);expect(result.board[1][2]).toBe(5);expect(result.board[7][6]).toBe(7);expect(result.board[2][2]).toBe(0);expect(board[4][0]).toBe(3);
  });
  it('does not clear a line with a hole',()=>{
    const board=emptyBoard();board[0].fill(1);board[0][4]=0;expect(findLines(board).cells).toEqual([]);
  });
});
describe('score, combo and game lifecycle',()=>{
  it('awards one point per placed cell',()=>{
    const state=newGame(1);state.tray[0]={shapeId:'square-3',color:4};expect(placePiece(state,0,0,0)!.points).toBe(9);
  });
  it('increases combo, preserves it for two misses, resets on the third',()=>{
    let state=placePiece(readyRow(newGame(4)),0,7,0)!.state;
    expect(state.combo).toBe(1);expect(state.score).toBe(11);
    state=placePiece(readyRow(state),0,7,0)!.state;expect(state.combo).toBe(2);expect(state.score).toBe(32);
    for(let i=0;i<2;i++){state=placePiece(single(state),0,i,3)!.state;expect(state.combo).toBe(2);}
    state=placePiece(single(state),0,2,3)!.state;expect(state.combo).toBe(0);expect(state.maxCombo).toBe(2);
    expect(placePiece(readyRow(state),0,7,0)!.state.combo).toBe(1);
  });
  it('continues a combo after exactly two misses',()=>{
    let state={...newGame(2),combo:3,maxCombo:3,misses:2};
    const result=placePiece(readyRow(state),0,7,0)!;expect(result.state.combo).toBe(4);expect(result.points).toBe(41);expect(result.state.misses).toBe(0);
  });
  it('caps only the bonus multiplier at 8x',()=>{
    const state=readyRow({...newGame(4),combo:12,maxCombo:12});const result=placePiece(state,0,7,0)!;
    expect(result.points).toBe(81);expect(result.state.combo).toBe(13);expect(result.state.maxCombo).toBe(13);
  });
  it('tracks best, lines, moves and spent slots',()=>{
    const state=readyRow(newGame(12,100));const result=placePiece(state,1,7,0)!;
    expect(result.state.best).toBe(100);expect(result.state.lines).toBe(1);expect(result.state.moves).toBe(1);expect(result.state.tray[1]).toBeNull();expect(result.state.tray[0]).toEqual(state.tray[0]);
  });
  it('deals a fresh tray only when all three slots are spent, in any order',()=>{
    let state=single(),rng=state.rng;
    state=placePiece(state,2,0,0)!.state;expect(state.tray.filter(Boolean)).toHaveLength(2);expect(state.rng).toBe(rng);
    state=placePiece(state,0,1,0)!.state;expect(state.tray.filter(Boolean)).toHaveLength(1);
    state=placePiece(state,1,2,0)!.state;expect(state.tray.filter(Boolean)).toHaveLength(3);expect(state.rng).not.toBe(rng);
  });
  it('detects game over from remaining pieces and rejects later moves',()=>{
    const state=single();state.board=Array.from({length:8},()=>Array(8).fill(1));state.board[0][0]=0;
    state.tray=[{shapeId:'square-2',color:1},null,null];expect(isGameOver(state)).toBe(true);
    state.tray[0]={shapeId:'single',color:1};expect(isGameOver(state)).toBe(false);
    state.over=true;expect(placePiece(state,0,0,0)).toBeNull();
  });
  it('does not confuse an unplaceable slot with a game over when another slot fits',()=>{
    const state=single();state.board=Array.from({length:8},()=>Array(8).fill(1));state.board[0][0]=0;
    state.tray=[{shapeId:'square-3',color:1},{shapeId:'single',color:2},null];expect(isGameOver(state)).toBe(false);
  });
});
describe('controlled generation and seeded randomness',()=>{
  it('produces identical sequences from identical seeds',()=>{
    const a=new SeededRng(0),b=new SeededRng(0);expect(Array.from({length:100},()=>a.next())).toEqual(Array.from({length:100},()=>b.next()));
    expect(newGame(123)).toEqual(newGame(123));expect(newGame(124).tray).not.toEqual(newGame(123).tray);
  });
  it('restores the RNG sequence exactly',()=>{
    const a=new SeededRng(55);a.next();const b=new SeededRng(a.state);expect(a.next()).toBe(b.next());
  });
  it('guarantees at least one move even with a single free cell',()=>{
    const board=Array.from({length:8},()=>Array(8).fill(1));board[3][5]=0;
    for(let seed=0;seed<100;seed++)expect(generateTray(board,new SeededRng(seed)).some(p=>availableMoves(board,getShape(p.shapeId)).length)).toBe(true);
  });
  it('uses a diverse shape library with no duplicate shapes',()=>{
    expect(SHAPES.length).toBeGreaterThan(30);expect(new Set(SHAPES.map(s=>JSON.stringify(s.cells))).size).toBe(SHAPES.length);
    const seen=new Set<string>();for(let seed=0;seed<100;seed++)for(const p of generateTray(emptyBoard(),new SeededRng(seed)))seen.add(p.shapeId);
    expect(seen.size).toBeGreaterThan(25);
  });
  it('does not promise an impossible move on a full board',()=>{
    const board=Array.from({length:8},()=>Array(8).fill(1)),tray=generateTray(board,new SeededRng(5));expect(isGameOver({board,tray})).toBe(true);
  });
  it('maintains board and score invariants through reproducible games',()=>{
    for(let seed=1;seed<=10;seed++){
      let state=newGame(seed),moves=0;
      while(!state.over&&moves<300){
        const choices=state.tray.flatMap((p,slot)=>p?availableMoves(state.board,getShape(p.shapeId)).map(([x,y])=>({slot,x,y})):[]);
        expect(choices.length).toBeGreaterThan(0);const m=choices[Math.floor(choices.length/2)],before=state.score;
        state=placePiece(state,m.slot,m.x,m.y)!.state;expect(state.score).toBeGreaterThan(before);expect(state.board).toHaveLength(8);
        expect(state.board.flat().every(c=>c>=0&&c<=7)).toBe(true);expect(findLines(state.board).cells).toHaveLength(0);expect(state.over).toBe(isGameOver(state));moves++;
      }
      expect(moves).toBeGreaterThan(3);
    }
  });
});
describe('save validation and deterministic continuation',()=>{
  it('round trips a partially used tray and continues with exactly the same result',()=>{
    const state=placePiece(single(),1,2,3)!.state,restored=restoreGame(serializeGame(state))!;
    expect(restored).toEqual(state);expect(placePiece(restored,0,0,0)).toEqual(placePiece(state,0,0,0));
  });
  it.each(['bad json','null','{}','{"version":2}'])('safely rejects corrupt data: %s',raw=>expect(restoreGame(raw)).toBeNull());
  it('rejects forged shapes, invalid colors and invalid numeric fields',()=>{
    const state=newGame(1);expect(restoreGame({...state,tray:[{shapeId:'bad',color:1},null,null]})).toBeNull();
    expect(restoreGame({...state,score:-1})).toBeNull();expect(restoreGame({...state,rng:0x100000000})).toBeNull();
    const board=emptyBoard();board[0][0]=9;expect(restoreGame({...state,board})).toBeNull();
  });
  it('recomputes the game-over flag instead of trusting saved state',()=>{
    const state=single();expect(restoreGame({...state,over:true})!.over).toBe(false);
  });
  it('validates settings and profile statistics independently of a corrupt game',()=>{
    const defaults=defaultProfile('ru',true);const result=restoreProfile(JSON.stringify({...defaults,best:700,game:{version:7},settings:{sound:false,language:'xx',music:'no'}}),defaults);
    expect(result.best).toBe(700);expect(result.game).toBeNull();expect(result.settings.sound).toBe(false);expect(result.settings.music).toBe(true);expect(result.settings.language).toBe('ru');
    expect(defaultProfile('de',false).settings.language).toBe('en');
  });
});
