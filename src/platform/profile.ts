import { restoreGame } from '../core/serialization';
import type { GameState } from '../core/types';
export interface Settings { sound: boolean; music: boolean; mute: boolean; reducedMotion: boolean; intenseEffects: boolean; language: 'ru' | 'en' }
export interface Profile {
  version: 2; game: GameState | null; best: number; maxCombo: number; totalLines: number; selectedSwapSlot: number;
  tutorialDone: boolean; settings: Settings;
}
export function defaultProfile(language: string, reducedMotion: boolean): Profile {
  return { version: 2, game: null, best: 0, maxCombo: 0, totalLines: 0, selectedSwapSlot:0, tutorialDone: false,
    settings: { sound: true, music: true, mute: false, reducedMotion, intenseEffects:true, language: language.startsWith('ru') ? 'ru' : 'en' } };
}
export function restoreProfile(raw: unknown, fallback: Profile): Profile {
  try {
    const p = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Profile;
    if (!p || ![1,2].includes(p.version)) return fallback;
    const result = { ...fallback, settings: { ...fallback.settings } };
    for (const key of ['best', 'maxCombo', 'totalLines'] as const) if (Number.isSafeInteger(p[key]) && p[key] >= 0) result[key] = p[key];
    result.game = restoreGame(p.game);
    result.best = Math.max(result.best, result.game?.best || 0);
    if(result.game)result.game={...result.game,best:result.best};
    result.tutorialDone = p.tutorialDone === true;
    if(Number.isInteger(p.selectedSwapSlot)&&p.selectedSwapSlot>=0&&p.selectedSwapSlot<3)result.selectedSwapSlot=p.selectedSwapSlot;
    if (p.settings) {
      for (const key of ['sound','music','mute','reducedMotion','intenseEffects'] as const) if (typeof p.settings[key] === 'boolean') result.settings[key] = p.settings[key];
      if (p.settings.language === 'ru' || p.settings.language === 'en') result.settings.language = p.settings.language;
    }
    return result;
  } catch { return fallback; }
}
