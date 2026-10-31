import bridge from '@playgama/bridge';

export interface PlatformPort {
  language: string; audioEnabled: boolean; paused: boolean;
  load(): Promise<unknown>; save(data: string): Promise<boolean>;
  message(message: string): void; gameOver(): void;
  onChange: (() => void) | null;
  storageAvailable: boolean;
}

const KEY = 'grid-pulse-v1';
export class PlatformService implements PlatformPort {
  language = 'en'; audioEnabled = true; paused = false;
  storageAvailable = true;
  onChange: (() => void) | null = null;
  private hostPaused = false;
  private adPaused = false;
  private initialized = false;
  private pending: string | null = null;
  private writing = false;

  async initialize(): Promise<void> {
    try {
      await bridge.initialize();
      this.initialized = true;
      this.language = bridge.platform.language || 'en';
      this.audioEnabled = bridge.platform.isAudioEnabled;
      this.hostPaused = bridge.platform.isPaused;
      this.adPaused = bridge.advertisement.interstitialState === 'opened';
      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (value: boolean) => { this.audioEnabled = value; this.update(); });
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (value: boolean) => { this.hostPaused = value; this.update(); });
      bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (value: string) => { this.adPaused = value === 'opened'; this.update(); });
    } catch (error) {
      this.storageAvailable = false;
      console.warn('Bridge initialization failed. Progress is available only in this session.', error);
    }
    document.addEventListener('visibilitychange', () => this.update());
    this.update();
  }
  private update(): void {
    this.paused = this.hostPaused || this.adPaused || document.hidden;
    this.onChange?.();
  }
  async load(): Promise<unknown> {
    if (!this.initialized) return null;
    try { const data = await bridge.storage.get([KEY]); return Array.isArray(data) ? data[0] : null; }
    catch (error) { this.storageAvailable = false; console.warn('Bridge load failed', error); return null; }
  }
  async save(data: string): Promise<boolean> {
    if (!this.initialized) return false;
    this.pending = data;
    if (this.writing) return this.storageAvailable;
    this.writing = true;
    try {
      while (this.pending !== null) {
        const snapshot = this.pending;
        this.pending = null;
        const wasAvailable = this.storageAvailable;
        try { await bridge.storage.set([KEY], [snapshot]); this.storageAvailable = true; }
        catch (error) { this.storageAvailable = false; console.warn('Bridge save failed', error); }
        if (wasAvailable !== this.storageAvailable) this.onChange?.();
      }
    } finally { this.writing = false; }
    return this.storageAvailable;
  }
  message(message: string): void {
    if (!this.initialized) return;
    void Promise.resolve(bridge.platform.sendMessage(message)).catch(error => console.warn('Bridge message failed', error));
  }
  gameOver(): void {
    this.message('level_failed');
    if (!this.initialized || !bridge.advertisement.isInterstitialSupported) return;
    try { bridge.advertisement.showInterstitial('game_over'); }
    catch (error) { console.warn('Interstitial unavailable', error); }
  }
}

/** Explicit development-only mock; intentionally has no disk persistence. */
export class MemoryPlatform implements PlatformPort {
  language = 'en'; audioEnabled = true; paused = false; storageAvailable = true;
  onChange: (() => void) | null = null;
  private data: string | null = null;
  async load(): Promise<unknown> { return this.data; }
  async save(data: string): Promise<boolean> { this.data = data; return true; }
  message(_message: string): void { /* No host in explicit local mock mode. */ }
  gameOver(): void { /* No ads in local mock mode. */ }
}
