import type { PlatformPort } from './PlatformService';
import { RewardedAdService, type RewardedResult } from './RewardedAdService';
import { MONETIZATION } from '../config/monetization';

// Types follow https://games.pikabu.ru/sdk/docs (SDK Пикабу Игры).
type AdError = 'NOT_SUPPORTED' | 'IN_PROGRESS' | 'UI_BUSY' | 'COOLDOWN_ACTIVE' | 'INVALID_GAME_STATE' | 'UNKNOWN';
type AdResult = { rendered: true } | { rendered: false; reason: AdError };
type SaveError = 'QUOTA_EXCEEDED' | 'RATE_LIMIT' | 'REVISION_CONFLICT' | 'NETWORK_ERROR' | 'UNKNOWN';
interface AdApi<R = AdResult> { isSupported: boolean; canShow(): Promise<boolean>; show(): Promise<R> }
export interface PikabuSdk {
  gameStarted(): void;
  ads: { fullscreen: AdApi; preloader: AdApi; rewarded: AdApi<AdResult & { reward: boolean }> };
  storage: { get(key: string): unknown; set(key: string, value: unknown): void; flush(): Promise<{ success: true } | { success: false; reason: SaveError }> };
  on(event: 'storageSaveError', listener: (reason: SaveError) => void): () => void;
}
declare global { interface Window { PkbSDK?: { init(): Promise<PikabuSdk> } } }

export const PIKABU = {
  sdkUrl: 'https://games.pikabu.ru/sdk/sdk.js',
  storageKey: 'grid-pulse-v1',
  loadTimeoutMs: 8000,
  // The platform allows a fullscreen ad every 120 s; the first one waits for a finished round anyway.
  interstitialGapMs: 120000,
  retryMs: 15000,
};

function withTimeout<T>(request: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([request, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Pikabu SDK timed out')), ms); })])
    .finally(() => clearTimeout(timer));
}
function loadScript(src: string): Promise<void> {
  if (window.PkbSDK) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src; script.async = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Pikabu SDK script failed to load'));
    document.head.append(script);
  });
}

export class PikabuPlatform implements PlatformPort {
  // The platform requires a Russian interface on first launch; players can still switch in settings.
  language = 'ru'; audioEnabled = true; paused = false; storageAvailable = true;
  onChange: (() => void) | null = null;
  private sdk: PikabuSdk | null = null;
  // A failed load must never be followed by a save that overwrites the player's cloud progress.
  private writable = false;
  // After REVISION_CONFLICT the SDK refuses all saves until the page is reloaded.
  private conflict = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private adOpen = false;
  private started = false;
  private lastGameOver: string | null = null;
  private afterRewarded = false;
  private lastInterstitial = 0;
  private rewardListener: ((state: string) => void) | null = null;
  private rewarded = new RewardedAdService({
    supported: () => !!this.sdk?.ads.rewarded.isSupported,
    blocked: () => this.adOpen,
    show: () => { void this.playRewarded(); },
    subscribe: listener => { this.rewardListener = listener; return () => { if (this.rewardListener === listener) this.rewardListener = null; }; },
  }, () => this.update());

  get rewardedSupported(): boolean { return this.rewarded.supported; }
  get adBusy(): boolean { return this.rewarded.busy || this.adOpen; }

  async initialize(): Promise<void> {
    try {
      await withTimeout(loadScript(PIKABU.sdkUrl), PIKABU.loadTimeoutMs);
      if (!window.PkbSDK) throw new Error('Pikabu SDK is missing');
      this.sdk = await withTimeout(window.PkbSDK.init(), PIKABU.loadTimeoutMs);
      this.sdk.on('storageSaveError', reason => this.saveFailed(reason));
      this.lastInterstitial = Date.now();
    } catch (error) {
      this.sdk = null; this.storageAvailable = false;
      console.warn('Pikabu SDK is unavailable (the game works only on games.pikabu.ru). Progress is kept for this session only.', error);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) void this.flush(); this.update(); });
    window.addEventListener('pagehide', () => { void this.flush(); });
    this.update();
  }

  private update(): void {
    this.paused = this.adOpen || this.rewarded.busy || document.hidden;
    this.onChange?.();
  }
  private saveFailed(reason: SaveError): void {
    if (reason === 'REVISION_CONFLICT') this.conflict = true;
    // A network hiccup or rate limit passes, so one delayed retry clears the warning when it does.
    else this.retry ??= setTimeout(() => { this.retry = null; void this.flush(); }, PIKABU.retryMs);
    console.warn('Pikabu storage save failed', reason);
    if (this.storageAvailable) { this.storageAvailable = false; this.onChange?.(); }
  }

  async load(): Promise<unknown> {
    if (!this.sdk) return null;
    try {
      const value = this.sdk.storage.get(PIKABU.storageKey);
      this.writable = true;
      return typeof value === 'string' ? value : null;
    } catch (error) { this.storageAvailable = false; console.warn('Pikabu storage load failed', error); return null; }
  }
  /** The SDK keeps the value at once and uploads changes by itself shortly after. */
  async save(data: string): Promise<boolean> {
    if (!this.canWrite()) return false;
    try { this.sdk!.storage.set(PIKABU.storageKey, data); }
    catch (error) { this.saveFailed('UNKNOWN'); console.warn(error); }
    return this.storageAvailable;
  }
  async checkpoint(data: string): Promise<boolean> {
    if (!this.canWrite()) return false;
    await this.save(data);
    return this.flush();
  }
  private canWrite(): boolean { return !!this.sdk && this.writable && !this.conflict; }
  // Explicit uploads are limited to 100 per 5 minutes, so they happen only at checkpoints and when the page hides.
  private async flush(): Promise<boolean> {
    if (!this.canWrite()) return false;
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    try {
      const result = await this.sdk!.storage.flush();
      if (!result.success) { this.saveFailed(result.reason); return false; }
      if (!this.storageAvailable) { this.storageAvailable = true; this.onChange?.(); }
      return true;
    } catch (error) { this.saveFailed('UNKNOWN'); console.warn(error); return false; }
  }

  private async playRewarded(): Promise<void> {
    const emit = (state: string) => this.rewardListener?.(state);
    const ads = this.sdk?.ads.rewarded;
    try {
      if (!ads || !await ads.canShow()) { emit('failed'); return; }
      this.adOpen = true; this.update(); emit('opened');
      const result = await ads.show();
      if (!result.rendered) { console.warn('Rewarded ad was not shown', result.reason); emit('failed'); return; }
      if (result.reward) emit('rewarded');
      emit('closed');
    } catch { emit('failed'); }
    finally { if (this.adOpen) { this.adOpen = false; this.update(); } }
  }
  showRewarded(onReward: () => void | Promise<void>): Promise<RewardedResult> {
    this.afterRewarded = true; return this.rewarded.request(MONETIZATION.placement, onReward);
  }
  gameplayAction(): void { this.afterRewarded = false; }

  message(message: string): void {
    // The first interactive screen is up and the loading screen has faded out.
    if (message === 'game_ready' && this.sdk && !this.started) { this.started = true; this.sdk.gameStarted(); }
  }

  gameOver(gameId = 'legacy'): void {
    if (this.lastGameOver === gameId) return;
    this.lastGameOver = gameId;
    void this.flush();
    if (!this.sdk?.ads.fullscreen.isSupported || this.adBusy || this.afterRewarded || document.hidden || Date.now() - this.lastInterstitial < PIKABU.interstitialGapMs) return;
    void this.showInterstitial(this.sdk);
  }
  private async showInterstitial(sdk: PikabuSdk): Promise<void> {
    try {
      if (!await sdk.ads.fullscreen.canShow()) return;
      this.adOpen = true; this.update();
      const result = await sdk.ads.fullscreen.show();
      if (result.rendered) this.lastInterstitial = Date.now();
      else console.warn('Fullscreen ad was not shown', result.reason);
    } catch { /* No ad is a normal outcome; the game simply continues. */ }
    finally { if (this.adOpen) { this.adOpen = false; this.update(); } }
  }
}
