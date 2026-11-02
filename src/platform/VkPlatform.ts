import bridge from '@vkontakte/vk-bridge';
import type { PlatformPort } from './PlatformService';
import { RewardedAdService, type RewardedResult } from './RewardedAdService';
import { VkStorage } from './vkStorage';
import { MONETIZATION } from '../config/monetization';

export const VK = {
  storageKey: 'grid-pulse-v1',
  supportUrl: 'https://vk.com/id200006485101',
  initTimeoutMs: 8000,
  // VK Storage is rate limited, so moves are batched; hiding the app or a checkpoint writes at once.
  saveDelayMs: 10000,
  interstitialGapMs: 60000,
  rewardedRecheckMs: 30000,
};

type AdFormat = 'reward' | 'interstitial';
function withTimeout<T>(request: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([request, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('VK Bridge timed out')), ms); })])
    .finally(() => clearTimeout(timer));
}

export class VkPlatform implements PlatformPort {
  language = 'ru'; audioEnabled = true; paused = false; storageAvailable = true;
  onChange: (() => void) | null = null;
  readonly supportUrl = VK.supportUrl;
  private initialized = false;
  private storage: VkStorage | null = null;
  // A failed load must never be followed by a save that overwrites the player's cloud progress.
  private writable = false;
  private hostHidden = false;
  private interstitialOpen = false;
  private rewardedOpen = false;
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private lastGameOver: string | null = null;
  private afterRewarded = false;
  private lastInterstitial = 0;
  private rewardedRecheck: ReturnType<typeof setTimeout> | null = null;
  private rewardListener: ((state: string) => void) | null = null;
  private bannerWanted = false;
  private bannerShown = false;
  private bannerClosed = false;
  private bannerQueue = Promise.resolve();
  private rewarded = new RewardedAdService({
    supported: () => this.initialized,
    blocked: () => this.hostHidden || this.interstitialOpen || this.rewardedOpen,
    show: () => { void this.playRewarded(); },
    subscribe: listener => { this.rewardListener = listener; return () => { if (this.rewardListener === listener) this.rewardListener = null; }; },
  }, () => this.update());

  get rewardedSupported(): boolean { return this.rewarded.supported; }
  get adBusy(): boolean { return this.rewarded.busy || this.interstitialOpen || this.rewardedOpen; }

  async initialize(): Promise<void> {
    const query = new URLSearchParams(location.search);
    this.language = query.get('vk_language') || navigator.language || 'ru';
    bridge.subscribe(event => {
      const type = event.detail?.type;
      if (type === 'VKWebAppViewHide') { this.hostHidden = true; void this.flush(); this.update(); }
      else if (type === 'VKWebAppViewRestore') { this.hostHidden = false; this.update(); }
      else if (type === 'VKWebAppBannerAdClosedByUser') { this.bannerClosed = true; this.bannerShown = false; }
    });
    try {
      if (!bridge.isEmbedded()) throw new Error('The game is opened outside VK');
      await withTimeout(bridge.send('VKWebAppInit'), VK.initTimeoutMs);
      this.initialized = true;
      this.storage = new VkStorage({
        get: async keys => Object.fromEntries((await bridge.send('VKWebAppStorageGet', { keys })).keys.map(({ key, value }) => [key, value])),
        set: async (key, value) => { await bridge.send('VKWebAppStorageSet', { key, value }); },
      }, VK.storageKey);
      this.lastInterstitial = Date.now();
      void this.preload('interstitial');
      void this.preloadRewarded();
    } catch (error) {
      this.storageAvailable = false;
      console.warn('VK Bridge initialization failed. Progress is available only in this session.', error);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) void this.flush(); this.update(); });
    window.addEventListener('pagehide', () => { void this.flush(); });
    this.update();
  }

  private update(): void {
    this.paused = this.hostHidden || this.interstitialOpen || this.rewardedOpen || this.rewarded.busy || document.hidden;
    this.onChange?.();
  }

  async load(): Promise<unknown> {
    if (!this.storage) return null;
    try { const data = await this.storage.read(); this.writable = true; return data; }
    catch (error) { this.storageAvailable = false; console.warn('VK storage load failed', error); return null; }
  }
  /** Queues the latest snapshot; VK receives it after a short delay or on the next flush. */
  async save(data: string): Promise<boolean> {
    if (!this.writable) return false;
    this.pending = data;
    this.timer ??= setTimeout(() => { void this.flush(); }, VK.saveDelayMs);
    return this.storageAvailable;
  }
  async checkpoint(data: string): Promise<boolean> {
    if (!this.writable) return false;
    this.pending = data;
    return this.flush();
  }
  private flush(): Promise<boolean> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.writing = this.writing.then(async () => {
      const snapshot = this.pending;
      if (snapshot === null || !this.storage) return;
      this.pending = null;
      const wasAvailable = this.storageAvailable;
      try { await this.storage.write(snapshot); this.storageAvailable = true; }
      catch (error) {
        this.storageAvailable = false; this.pending ??= snapshot;
        console.warn('VK storage save failed', error);
      }
      if (wasAvailable !== this.storageAvailable) this.onChange?.();
    });
    return this.writing.then(() => this.storageAvailable);
  }

  private async preload(format: AdFormat): Promise<boolean> {
    try { return (await bridge.send('VKWebAppCheckNativeAds', { ad_format: format })).result; }
    catch { return false; }
  }
  // The check also asks VK to load an ad, so it repeats until a rewarded video is ready.
  private async preloadRewarded(): Promise<boolean> {
    if (this.rewardedRecheck) clearTimeout(this.rewardedRecheck);
    this.rewardedRecheck = null;
    const ready = await this.preload('reward');
    if (!ready) this.rewardedRecheck = setTimeout(() => { void this.preloadRewarded(); }, VK.rewardedRecheckMs);
    return ready;
  }
  private async playRewarded(): Promise<void> {
    const emit = (state: string) => this.rewardListener?.(state);
    try {
      if (!await this.preloadRewarded()) { emit('failed'); return; }
      this.rewardedOpen = true; this.update(); emit('opened');
      const shown = await bridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' });
      if (shown.result) emit('rewarded');
      emit('closed');
    } catch { emit('failed'); }
    finally {
      if (this.rewardedOpen) { this.rewardedOpen = false; this.update(); }
      void this.preloadRewarded();
    }
  }
  showRewarded(onReward: () => void | Promise<void>): Promise<RewardedResult> {
    this.afterRewarded = true; return this.rewarded.request(MONETIZATION.placement, onReward);
  }
  gameplayAction(): void { this.afterRewarded = false; }
  message(_message: string): void { /* VK has no game lifecycle events. */ }

  gameOver(gameId = 'legacy'): void {
    if (this.lastGameOver === gameId) return;
    this.lastGameOver = gameId;
    void this.flush();
    if (!this.initialized || this.adBusy || this.afterRewarded || this.hostHidden || Date.now() - this.lastInterstitial < VK.interstitialGapMs) return;
    void this.showInterstitial();
  }
  private async showInterstitial(): Promise<void> {
    this.lastInterstitial = Date.now();
    this.interstitialOpen = true; this.update();
    try { await bridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' }); }
    catch { /* No fill is normal; the game continues without an ad. */ }
    finally { this.interstitialOpen = false; this.update(); void this.preload('interstitial'); }
  }

  setBanner(visible: boolean): void {
    if (this.bannerWanted === visible) return;
    this.bannerWanted = visible;
    this.bannerQueue = this.bannerQueue.then(() => this.syncBanner());
  }
  private async syncBanner(): Promise<void> {
    if (!this.initialized) return;
    if (this.bannerWanted && !this.bannerShown && !this.bannerClosed) {
      try { this.bannerShown = (await bridge.send('VKWebAppShowBannerAd', { banner_location: 'bottom', layout_type: 'resize' })).result; }
      catch { this.bannerShown = false; }
    } else if (!this.bannerWanted && this.bannerShown) {
      this.bannerShown = false;
      try { await bridge.send('VKWebAppHideBannerAd'); } catch { /* The banner may already be gone. */ }
    }
  }
}
