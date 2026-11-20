# LearnScroll AI MVP

Android-first, installable PWA. Features: vertical snap-scrolling YouTube embeds, local bookmarks, Android share sheet, manual YouTube URL import, YouTube Data API discovery across eight AI topics, basic duration/keyword filtering, and local preferences.

## Run

From this folder run `python3 -m http.server 8080` and visit `http://localhost:8080`. On Android, host on an HTTPS static site (e.g. GitHub Pages), then choose Chrome > Add to Home screen / Install app.

## Enable discovery

Create a project in Google Cloud Console, enable **YouTube Data API v3**, create an API key, and enter it under Settings. For a local proof of concept this key is stored in localStorage. **Do not deploy a public version with an unrestricted browser API key.** Use a server-side proxy, restricted credentials, quotas and rate limits before public launch. YouTube `search.list` costs quota; repeated multi-topic searches can consume daily quota quickly.

## Compliance / limitations

Uses official YouTube embedded players. Does not download, alter, or obscure playback, controls, ads or attribution. Embedded videos may not autoplay on Android and may be blocked by the creator or YouTube. The feed loads only one player at a time, and navigation does not cover the player. YouTube search cannot reliably distinguish Shorts from other short videos, so this prototype filters to 8–180 seconds; classification is heuristic, not verified educational accuracy. Personalisation is topic-based only. No accounts/cloud sync or Instagram discovery yet. No AI model is connected for fact-checking.

## Files

- index.html: responsive mobile interface
- app.js: feed, discovery, bookmarking, sharing, settings
- sw.js: static shell caching
- manifest.webmanifest: install metadata
