import type { Settings } from '../platform/profile';
export type SoundName = 'pick' | 'place' | 'clear' | 'combo' | 'record' | 'ui';

export class AudioService {
  private extension = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  private music = new Audio(`${import.meta.env.BASE_URL}assets/audio/ambient.${this.extension}`);
  private effects = new Map<SoundName, HTMLAudioElement[]>();
  private unlocked = false;
  private blocked = false;
  private active = true;
  private settings: Settings;
  constructor(settings: Settings) {
    this.settings = settings;
    this.music.loop = true; this.music.volume = 0.2; this.music.preload = 'auto';
    for (const name of ['pick','place','clear','combo','record','ui'] as SoundName[]) {
      this.effects.set(name, Array.from({ length: 3 }, () => {
        const audio = new Audio(`${import.meta.env.BASE_URL}assets/audio/${name}.${this.extension}`);
        audio.volume = 0.45; audio.preload = 'auto'; return audio;
      }));
    }
    document.addEventListener('pointerdown', () => { this.unlocked = true; this.sync(); }, { capture: true });
    document.addEventListener('keydown', () => { this.unlocked = true; this.sync(); }, { capture: true });
  }
  configure(settings: Settings): void { this.settings = settings; this.sync(); }
  setBlocked(blocked: boolean): void { this.blocked = blocked; this.sync(); }
  setActive(active: boolean): void { this.active = active; this.sync(); }
  private sync(): void {
    if (!this.unlocked || this.blocked || !this.active || this.settings.mute || !this.settings.music) this.music.pause();
    else if (this.music.paused) void this.music.play().catch(() => {});
    if (this.blocked || this.settings.mute || !this.settings.sound) for (const pool of this.effects.values()) for (const a of pool) { a.pause(); a.currentTime = 0; }
  }
  play(name: SoundName): void {
    if (!this.unlocked || this.blocked || this.settings.mute || !this.settings.sound) return;
    const pool = this.effects.get(name)!;
    const audio = pool.find(a => a.paused || a.ended) ?? pool[0];
    audio.currentTime = 0; void audio.play().catch(() => {});
  }
}
