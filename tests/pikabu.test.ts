import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PikabuPlatform, PIKABU, type PikabuSdk } from '../src/platform/PikabuPlatform';

type SaveError = 'QUOTA_EXCEEDED' | 'RATE_LIMIT' | 'REVISION_CONFLICT' | 'NETWORK_ERROR' | 'UNKNOWN';
let store: Map<string, unknown>;
let saveError: ((reason: SaveError) => void) | null;
let sdk: ReturnType<typeof fakeSdk>;
let scripts: { src: string; onload?: () => void; onerror?: () => void }[];

function fakeSdk() {
  const ad = (extra = {}) => ({ isSupported: true, canShow: vi.fn(async () => true), show: vi.fn(async (): Promise<Record<string, unknown>> => ({ rendered: true, ...extra })) });
  return {
    gameStarted: vi.fn(),
    ads: { fullscreen: ad(), preloader: ad(), rewarded: ad({ reward: true }) },
    storage: { get: vi.fn((key: string) => store.get(key)), set: vi.fn((key: string, value: unknown) => { store.set(key, value); }), flush: vi.fn(async () => ({ success: true as const })) },
    on: vi.fn((_event: string, listener: (reason: SaveError) => void) => { saveError = listener; return () => {}; }),
  };
}
beforeEach(() => {
  store = new Map(); saveError = null; scripts = []; sdk = fakeSdk();
  const win: Record<string, unknown> = { addEventListener: vi.fn() };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', {
    hidden: false, addEventListener: vi.fn(),
    createElement: () => ({}) as never,
    head: { append: (script: { src: string; onload?: () => void }) => { scripts.push(script); win.PkbSDK = { init: async () => sdk as unknown as PikabuSdk }; script.onload?.(); } },
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
async function ready(): Promise<PikabuPlatform> { const p = new PikabuPlatform(); await p.initialize(); await p.load(); return p; }

describe('Pikabu platform', () => {
  it('loads the official SDK script, starts in Russian and restores the cloud save', async () => {
    store.set(PIKABU.storageKey, '{"saved":true}');
    const p = new PikabuPlatform(); await p.initialize();
    expect(scripts.map(s => s.src)).toEqual(['https://games.pikabu.ru/sdk/sdk.js']);
    expect(p.language).toBe('ru'); expect(await p.load()).toBe('{"saved":true}'); expect(p.rewardedSupported).toBe(true);
  });
  it('runs without saves outside the platform', async () => {
    vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), createElement: () => ({}) as never, head: { append: (s: { onerror?: () => void }) => s.onerror?.() } });
    const p = new PikabuPlatform(); await p.initialize();
    expect(p.storageAvailable).toBe(false); expect(await p.load()).toBeNull(); expect(await p.checkpoint('x')).toBe(false); expect(p.rewardedSupported).toBe(false);
    p.message('game_ready'); p.gameOver('one');
  });
  it('reports game start once, after the first screen is ready', async () => {
    const p = await ready(); expect(sdk.gameStarted).not.toHaveBeenCalled();
    p.message('level_started'); p.message('game_ready'); p.message('game_ready'); expect(sdk.gameStarted).toHaveBeenCalledTimes(1);
  });
  it('saves through the SDK and uploads explicitly only at checkpoints', async () => {
    const p = await ready();
    for (let move = 0; move < 20; move++) await p.save(`move-${move}`);
    expect(store.get(PIKABU.storageKey)).toBe('move-19'); expect(sdk.storage.flush).not.toHaveBeenCalled();
    expect(await p.checkpoint('reward')).toBe(true); expect(sdk.storage.flush).toHaveBeenCalledTimes(1); expect(store.get(PIKABU.storageKey)).toBe('reward');
  });
  it('never writes after a failed load', async () => {
    sdk.storage.get = vi.fn(() => { throw new Error('broken'); });
    const p = await ready(); expect(await p.save('fresh')).toBe(false); expect(await p.checkpoint('fresh')).toBe(false); expect(sdk.storage.set).not.toHaveBeenCalled();
  });
  it('recovers from a passing save error and stops for good after a revision conflict', async () => {
    vi.useFakeTimers(); const p = await ready();
    saveError!('NETWORK_ERROR'); expect(p.storageAvailable).toBe(false);
    await vi.advanceTimersByTimeAsync(PIKABU.retryMs); expect(p.storageAvailable).toBe(true);
    saveError!('REVISION_CONFLICT'); expect(p.storageAvailable).toBe(false);
    expect(await p.save('x')).toBe(false); expect(await p.checkpoint('x')).toBe(false);
    await vi.advanceTimersByTimeAsync(PIKABU.retryMs * 2); expect(p.storageAvailable).toBe(false);
  });
  it('grants the swap only for a fully watched rewarded ad and pauses meanwhile', async () => {
    const p = await ready(), reward = vi.fn();
    let finish!: (value: unknown) => void;
    sdk.ads.rewarded.show = vi.fn(() => new Promise(resolve => { finish = resolve; })) as never;
    const pending = p.showRewarded(reward);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function')); expect(p.paused).toBe(true);
    finish({ rendered: true, reward: true }); expect(await pending).toBe('rewarded'); expect(reward).toHaveBeenCalledTimes(1); expect(p.paused).toBe(false);
    sdk.ads.rewarded.show = vi.fn(async () => ({ rendered: true, reward: false })) as never;
    const skipped = vi.fn(); expect(await p.showRewarded(skipped)).toBe('cancelled'); expect(skipped).not.toHaveBeenCalled();
    sdk.ads.rewarded.canShow = vi.fn(async () => false); expect(await p.showRewarded(skipped)).toBe('unavailable');
    sdk.ads.rewarded.canShow = vi.fn(async () => true); sdk.ads.rewarded.show = vi.fn(async () => ({ rendered: false, reason: 'UI_BUSY' })) as never;
    expect(await p.showRewarded(skipped)).toBe('unavailable'); expect(skipped).not.toHaveBeenCalled(); expect(p.paused).toBe(false);
  });
  it('shows a fullscreen ad only after the cooldown, once per game over and not right after a reward', async () => {
    vi.useFakeTimers(); const p = await ready();
    p.gameOver('early'); await vi.advanceTimersByTimeAsync(0); expect(sdk.ads.fullscreen.show).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + PIKABU.interstitialGapMs);
    p.gameOver('one'); p.gameOver('one'); await vi.advanceTimersByTimeAsync(0); expect(sdk.ads.fullscreen.show).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + PIKABU.interstitialGapMs);
    await p.showRewarded(() => {}); p.gameOver('after-reward'); await vi.advanceTimersByTimeAsync(0); expect(sdk.ads.fullscreen.show).toHaveBeenCalledTimes(1);
  });
});
