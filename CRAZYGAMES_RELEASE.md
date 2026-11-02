# Grid Pulse — CrazyGames Basic Launch

Release branch: `release/crazygames-grid-pulse`, based on `origin/main` at `9513852` (includes VK loader fixes, Pikabu build/artwork and the latest larger, longer combo animation). This branch is for review; do not merge without the owner's approval. Repository and Pages URL remain `nomaybe0606-arch/Block-Tetris` and `https://nomaybe0606-arch.github.io/Block-Tetris/`. The main deployment workflow is unchanged.

## Build and package

```sh
npm ci
npm run typecheck
npm test
npm run package:crazygames
npm run verify:promo:crazygames
```

Independent commands: `npm run build:crazygames` builds `dist-crazygames/` with Vite base `./`; `npm run verify:crazygames` checks isolation, assets, MIME types, paths and size over a local HTTP server. `npm run package:crazygames` runs both and writes `artifacts/grid-pulse-crazygames.zip`. No game source, node_modules, dev entry, covers, videos, Playgama/VK/Pikabu SDK files or credentials are in this ZIP. `index.html` is at its root. Official CrazyGames SDK v3 is loaded asynchronously from `https://sdk.crazygames.com/crazygames-sdk-v3.js` at runtime; it is intentionally not redistributed.

The measured distribution is 24 files and 1,978,569 bytes uncompressed (1.89 MiB). ZIP is 999,752 bytes (0.95 MiB). All local files together, including all audio, are below the 20 MB mobile initial-download target and the 50 MB limit; file count is below 1500. This is a conservative upper bound for local assets, not a measured Developer Portal network waterfall. The external official SDK and its host-managed requests are additional; initial load to gameplayStart must also be checked in the portal Preview tool.

## Upload in Developer Portal

1. Submit a new HTML5 game named **Grid Pulse** and use **Basic Launch**. Upload `artifacts/grid-pulse-crazygames.zip` as the game build; entry point `index.html`.
2. SDK integration: HTML5 SDK v3; select **Yes, using the Data Module from the CrazyGames SDK**. There is no custom login or global leaderboard. Do not enable Full Launch monetization for this release.
3. Upload the three PNGs from `promo/crazygames/covers/`: landscape 1920×1080, portrait 800×1200, square 800×800.
4. Upload the two MP4s from `promo/crazygames/video/`: landscape 1920×1080 and portrait 1080×1620. Both are 18 seconds, 30 fps, H.264/yuv420p, without audio and below 50 MB.
5. Copy English metadata and controls from `promo/crazygames/submission.md`.
6. Run the portal Preview/QA tool to validate environment, Data module, gameplay events, mobile layout and SDK mute before submitting for review. Acceptance/Full Launch selection is controlled by CrazyGames.

## Integration and compatibility

- User-facing name is Grid Pulse in title, description, ARIA labels, UI, loader, docs and catalogue artwork. Existing save key `grid-pulse-v1`, npm internal name, archive naming for previous generic exports and repository URLs remain compatible.
- `CrazyGamesPlatform` is imported only by mode `crazygames`. It awaits SDK init, checks `local`/`crazygames` environment before accessing modules, reads SDK locale with English fallback, honors SDK mute and uses Data getItem/setItem. It reads before writing; a load failure cannot overwrite cloud progress. An unavailable/blocked/timed-out SDK leaves a playable in-memory session with an honest saving-unavailable message. It never calls modules in disabled environment. SDK init is the required bootstrap before environment can be read.
- loadingStart/Stop bracket engine/loading-screen readiness. Gameplay start waits for both a ready scene/hidden loader and actual gameplay, including tutorial. Menu, dialogs and Game Over stop it; resume restarts it. Duplicate renders do not duplicate events. Tab visibility is handled by the SDK itself as documented; the game still pauses audio/input when hidden.
- Basic Launch has no ads, banners, rewarded requests, reward grants or rewarded buttons. Playgama is absent from this build. A future Full Launch adapter can implement the existing PlatformPort/showRewarded boundary after approval and ad callback QA; Full Launch ads are not shipped or claimed tested here.
- The 8×8 rules, three-piece generation, scoring, combo timings/effects, exact finger/preview/drop behavior, immediate input during clears, balance, records and existing host adapters are unchanged. The only shared App addition is an optional lifecycle notification for hosts that implement it.
- All builds remain separate: Pages `/Block-Tetris/`; generic Playgama `./`; VK `dist-vk/`; Pikabu `dist-pikabu/`; CrazyGames `dist-crazygames/`. `.github/workflows/pages.yml` is untouched, including the existing Pikabu subdirectory deployment.

## Verification and media provenance

277 tests in 24 files passed, including all 260 tests inherited from current main and 17 new CrazyGames cases. TypeScript, Pages build/verify, VK build/verify, Pikabu build/verify, generic Playgama package/verify and CrazyGames package/verify passed. Unit tests cover SDK absence/rejection/timeout/disabled environment, init ordering, ready/playable lifecycle, pause/resume/over deduplication, locale, mute, load-before-write, save retry and 100 repeated rewarded requests without ads or rewards. Existing input and continuous-play tests cover quick touch, overlapping clears, model immutability, Game Over, saves and rewarded replacements on their existing hosts.

The ZIP was safely extracted under `artifacts/crazygames-unpacked/` and served through `node scripts/crazygames-preview.mjs` at http://127.0.0.1:4175/ rather than file://. `verify:crazygames` checks all 24 served files byte for byte, including 14 audio files and relative chunk references. `/offline/` on the preview server is available for a manual SDK-absence test; this route was not browser-tested before the tool stopped. SDK absence/error/timeout were verified in automated adapter tests. Browser checks and their exact limits are recorded in QA.md.

Three original imagegen masters and the retained generation brief are in `promo/crazygames/source/`; the deterministic size-normalization script is `scripts/prepare-crazygames-covers.mjs`. All artwork uses original geometric assets, without platform logos, slogans or external trademarks. The two videos show the real Phaser GameScene, DragController, core placement rules, generated next tray, clear and combo animations in real time. A separate DEV fixture starts a valid mid-game position. Six legal moves, four cleared lines and three clear events are recorded over 18 seconds in each format. The final clear is near 17 seconds. The corrected 8×8 opening cover holds for 0.55 s and fades out by 0.75 s over genuine gameplay. Landscape composition uses an unscaled-aspect portrait board and original background/title; portrait shows the board large. No artificial gameplay speedup, cursor or audio.

Reproduction: see `promo/crazygames/source/README.md`, `scripts/promo-crazygames-server.mjs` and `scripts/finalize-crazygames-video.mjs`. `promo.html`, capture receiver and DEV module never enter production. `verify:promo:crazygames` uses PNG headers and ffprobe to verify dimensions, fps, codec, pixel format, audio absence, duration and size, and checks sampled frames change plus the real capture report. Results are retained in `promo/crazygames/validation.json`.

## Remaining checks

Physical iPhone/Android touch, Safari audio interruption, complete native Chrome/Edge interaction and CrazyGames Developer Portal Preview/Data must be checked on their actual environments; local Chromium and synthetic tests cannot certify them. Chrome launched the ZIP/menu, but an input call timed out. Edge was launched; Computer Use then refused to control the browser because it could not reliably determine the current Windows browser URL. All further UI automation stopped; this safety stop was not bypassed with another browser automation method. This release is ready as an upload package, not a claim of platform approval or measured physical-phone FPS. SDK save acknowledgement confirms acceptance by its local Data API, not a synchronous cross-device cloud flush.

No final merge, portal submission, account/terms acceptance or production replacement is performed by this task.

Media grid correction: see [GRID_AUDIT.md](promo/crazygames/GRID_AUDIT.md). All final covers and both MP4 openings/gameplay have been visually reviewed as 8×8. Reviewed file hashes are enforced by verify:promo:crazygames; this does not claim automatic computer-vision counting.
