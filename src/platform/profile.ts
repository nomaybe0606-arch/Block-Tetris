import { restoreGame } from '../core/serialization';
import type { GameState } from '../core/types';
export interface Settings { sound: boolean; music: boolean; mute: boolean; reducedMotion: boolean; language: 'ru' | 'en' }
export interface Profile {
  version: 1; game: GameState | null; best: number; maxCombo: number; totalLines: number;
  tutorialDone: boolean; settings: Settings;
}
export function defaultProfile(language: string, reducedMotion: boolean): Profile {
  return { version: 1, game: null, best: 0, maxCombo: 0, totalLines: 0, tutorialDone: false,
    settings: { sound: true, music: true, mute: false, reducedMotion, language: language.startsWith('ru') ? 'ru' : 'en' } };
}
export function restoreProfile(raw: unknown, fallback: Profile): Profile {
  try {
    const p = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Profile;
    if (!p || p.version !== 1) return fallback;
    const result = { ...fallback, settings: { ...fallback.settings } };
    for (const key of ['best', 'maxCombo', 'totalLines'] as const) if (Number.isSafeInteger(p[key]) && p[key] >= 0) result[key] = p[key];
    result.game = restoreGame(p.game);
    result.best = Math.max(result.best, result.game?.best || 0);
    result.tutorialDone = p.tutorialDone === true;
    if (p.settings) {
      for (const key of ['sound','music','mute','reducedMotion'] as const) if (typeof p.settings[key] === 'boolean') result.settings[key] = p.settings[key];
      if (p.settings.language === 'ru' || p.settings.language === 'en') result.settings.language = p.settings.language;
    }
    return result;
  } catch { return fallback; }
}
