# Learning OS · Phase 3 — Multimedia Learning Experience

## Delivered
- Unified Media Studio on `/#studio` without replacing the Phase 1 Audio or Reader pages.
- YouTube direct videos and playlists via privacy-enhanced `youtube-nocookie.com` embeds.
- Channel pages are open externally, not embedded. Links are not transcribed automatically.
- Local PDF rendering using existing PDF.js dependency. PDF page text can be spoken with SpeechSynthesis; scanned PDFs may have no extractable text.
- Locally selected audio files use browser-native controls and automatic time position persistence; actual media bytes are never sent to a server.
- Text-to-speech (browser voices/rate/pause/stop) for pasted lesson text and selected PDF-page text.
- Bookmarks per media source, page/time/character offsets and notes. Local persistence and same-origin cross-tab synchronization using `localStorage` storage events.
- Content-sensitive text source IDs, strict YouTube host/video parsing, file-size limits and provenance notes.

## Explicit limitations
- No backend, PostgreSQL, cross-device sync, OAuth or Google Calendar app synchronization; browser-only persistence is not a durable account backup.
- YouTube playback positions are not automatically tracked because this static embed has no verified YouTube player API integration. Users manually mark watched and save a minute bookmark.
- Local PDF/audio bytes must be selected again after reload. Metadata/bookmarks/progress may remain.
- Browser TTS voice availability, seeking, boundary events and mobile playback vary; restarting a spoken passage begins at the start.
- Third-party rights remain with publishers. No scraping, unauthorized downloads or audio ripping.
- Phase 3 UI tests cover local progress and controls; full real-device audio/PDF/YouTube/network accessibility remains pre-release QA.

## To develop
`npm ci && npm run check:phase3 && npm run test:media && npm run typecheck && npm run build && npm run test:e2e`.

## GitHub Pages
The application is built at base `/Learning-Os/`, using the existing GitHub Actions Pages deployment workflow from `main`. No secrets are shipped in the static bundle.
