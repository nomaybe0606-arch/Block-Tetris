/** The subset of VK Storage used by the game, so tests can replace the bridge. */
export interface KeyValueApi {
  get(keys: string[]): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
}

// VK limits a value to 4096 bytes. A little headroom is kept below that.
export const VK_CHUNK_BYTES = 4000;
export const VK_MAX_CHUNKS = 16;
type Slot = 'a' | 'b';

const bytes = (codePoint: number) => codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
/** Splits by UTF-8 size without cutting a character in half. */
export function splitChunks(value: string, limit = VK_CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let current = '', size = 0;
  for (const char of value) {
    const length = bytes(char.codePointAt(0)!);
    if (size + length > limit) { chunks.push(current); current = ''; size = 0; }
    current += char; size += length;
  }
  if (current || !chunks.length) chunks.push(current);
  return chunks;
}

/**
 * One value spread over VK keys. Chunks are written to the inactive slot first and
 * the pointer key (`<slot>.<count>`) is switched last, so an interrupted save keeps
 * the previous complete copy instead of a mix of old and new chunks.
 */
export class VkStorage {
  private active: Slot | null = null;
  constructor(private api: KeyValueApi, private key: string) {
    if (!/^[a-zA-Z0-9_-]{1,90}$/.test(key)) throw new Error(`Invalid VK storage key: ${key}`);
  }
  private chunkKey(slot: Slot, index: number): string { return `${this.key}_${slot}${index}`; }

  async read(): Promise<string | null> {
    const pointer = (await this.api.get([this.key]))[this.key] ?? '';
    const match = /^([ab])\.(\d+)$/.exec(pointer);
    const count = match ? Number(match[2]) : 0;
    if (!match || count < 1 || count > VK_MAX_CHUNKS) return null;
    const slot = match[1] as Slot;
    const names = Array.from({ length: count }, (_, index) => this.chunkKey(slot, index));
    const values = await this.api.get(names);
    // VK returns an empty string for a key that was never written, and real chunks are never empty.
    if (names.some(name => !values[name])) throw new Error('VK storage chunk is missing');
    this.active = slot;
    return names.map(name => values[name]).join('');
  }

  async write(value: string): Promise<void> {
    const chunks = splitChunks(value);
    if (chunks.length > VK_MAX_CHUNKS) throw new Error('Save is too large for VK storage');
    const slot: Slot = this.active === 'a' ? 'b' : 'a';
    for (const [index, chunk] of chunks.entries()) await this.api.set(this.chunkKey(slot, index), chunk);
    await this.api.set(this.key, `${slot}.${chunks.length}`);
    this.active = slot;
  }
}
