# Grid Pulse assets

All visual artwork, UI icons, block textures, effects, and audio compositions in this project were created specifically for Grid Pulse. No Block Blast assets or third-party sample packs were used.

## Audio

Files: `audio/pick`, `place`, `clear`, `combo`, `record`, `ui`, `ambient`, each in `.ogg` and `.mp3` formats. MP3 is a compatibility fallback for browsers that do not advertise Vorbis support.

Original offline synthesis and composition: `scripts/generate-audio.mjs`, created for this project, 2026-10-31. Rendered as PCM and encoded to Ogg Vorbis and MP3 with FFmpeg. The ambient composition is a 32-second harmonic loop; effects are separate rendered assets. Runtime only plays these local files; it does not synthesize Web Audio tones. OGG is preferred for gapless looping; MP3 loop timing can vary by browser decoder.

These original project assets may be used, modified and distributed, including commercially, with the Grid Pulse project, without attribution requirements. No exclusive ownership of purely AI-generated material is asserted where local law does not recognize it.

## Graphics

Original vector favicon: `favicon.svg`. Original SVG interface paths: `src/ui/icons.ts`. Original procedural Canvas block textures: `src/rendering/textures.ts`. Original HTML/CSS menu art: `src/style.css`.

## Dependencies

Phaser: MIT. Vite: MIT. TypeScript: Apache-2.0. Vitest: MIT. Playgama Bridge: LGPL-3.0, distributed as a separate replaceable script by the official Vite plugin. See `THIRD_PARTY_NOTICES.md` and `licenses/playgama-bridge-LGPL-3.0.txt` in the distribution. Platform services may load platform-owned SDKs as required by the host.
