# Fimbria

**Live lessons, shared understanding.** A single-teacher live classroom app built from PLAN.md.

For production setup at fimbria.lattice-1.com, see [DEPLOYMENT.md](DEPLOYMENT.md). Node.js **24.16+** (built-in SQLite), npm, and a modern browser are required. No email service or external database is used.

## Run locally

```sh
npm ci
TEACHER_PASSWORD='choose-a-long-password' npm run teacher
npm run dev
```

Open http://localhost:3000, sign in, upload `examples/intro.json` or import a public GitHub lesson link, preview it, and start a session. Open the presentation link on a projector. Students use /join or the QR link. The teacher home page lists sessions that can be resumed after refresh or restart.

```sh
npm run lint
npm test
npm run build
NODE_ENV=production npm start
npx playwright install chromium
npm run test:browser
TEACHER_PASSWORD='choose-a-long-password' npm run test:classroom -- --students 40 --duration 30m
TEACHER_PASSWORD='choose-a-long-password' npm run test:classroom -- --students 40 --duration 60m
```

Browser tests start their own server and database on port 3000; stop any local server first. The simulator runs against an existing server, uploads the fixture, creates an isolated room, tests all three questions and five reconnects, then holds the connections for the requested duration. It fails on mismatched totals, missing restored answers, unexpected disconnects, or p95 above 500 ms. Its resource figures describe the simulator process; collect server CPU/RAM separately (for Docker: `docker stats`). Full sustained runs and deployment rehearsal remain acceptance activities.

## Configuration

- `PORT`: 3000.
- `DB_PATH`: data/app.sqlite, on persistent local disk.
- `PUBLIC_BASE_URL`: externally reachable origin, default http://localhost:3000; used for QR links and origin checks.
- `COOKIE_SECURE`: true for HTTPS; false for local HTTP only.
- `SESSION_TTL_HOURS`: 24; inactivity expiration checked every minute.
- `TEST_BASE_URL`: simulator target, defaults to localhost.
- `TEACHER_PASSWORD`: used only by the account setup/reset command and simulator. Minimum 12 characters.

The setup command replaces the only teacher password and revokes all teacher cookies. Passwords use salted scrypt; login cookies are HttpOnly, SameSite Strict, and expire after 12 hours. Teacher commands recheck authorization. Keep the data directory and backups private.

## Layout and contracts

`src/client` contains React views and plain CSS; `src/server` contains Express, SQLite, validation, auth and authoritative transitions; `src/shared/contracts.ts` defines snapshots and replies. `schemas` publishes the version 1 JSON Schema; `examples` includes the six-step lesson. Uploads are immutable versions limited to 256 KB and 100 steps. All strings render as text.

Socket.IO events use acknowledged replies `{ok:true,data}` or `{ok:false,error}`:

- `join_room {roomId, role?, credential?}`: room code or internal ID; role is teacher, display, or student (default). Returns credential and state. Save the credential privately per room.
- `host_action {action}`: START, NEXT, PREVIOUS, REVEAL, END; requires a teacher cookie and teacher join.
- `submit_vote {questionId, optionId, revision}`: uses joined room and credential, validates the current revision, records once before acknowledgement. Identical retries return the saved answer.
- `room_state_update`: individualized snapshot, with private answer status and teacher-only response counts. Correct answer, explanation and totals are published only after reveal.

Session phases are WAITING, ACTIVE, REVEALED, ENDED. Leaving a question closes it permanently. Revealed answers remain visible on revisits. Participant counts represent registered identities, including disconnected browsers. Teacher disconnects leave sessions running. Anonymous users can obtain another identity in a different browser.

## Proxmox / Docker

Use a Linux VM with Docker Compose, initially 2 vCPU / 2 GB RAM. Decide LAN-only versus public HTTPS before external testing.

```sh
PUBLIC_BASE_URL=https://lessons.example.org COOKIE_SECURE=true docker compose up -d --build
docker compose exec -e TEACHER_PASSWORD='choose-a-long-password' app node scripts/teacher-container.mjs
```

The server must start once before setting the password so its tables exist. Prefer passing secrets from a private shell environment instead of typing them into retained history. The image contains no credentials; the named volume retains SQLite. The default bind address is loopback. Set BIND_ADDRESS to the VM's LAN IP for LAN access. On plain LAN HTTP use COOKIE_SECURE=false and a matching http PUBLIC_BASE_URL. Configure the existing reverse proxy to forward HTTP and WebSocket upgrades to port 3000. Health endpoint: /api/health. Restart/update between classes; reconnections restore snapshots, but service is briefly interrupted.

Back up SQLite using its online backup API, never copy an active database file alone:

```sh
npm run backup -- /private/backups/lesson.sqlite
```

For a container backup:
```sh
docker compose exec app node --input-type=module -e "import {DatabaseSync,backup} from 'node:sqlite'; const db=new DatabaseSync('/app/data/app.sqlite'); await backup(db,'/app/data/backup.sqlite'); db.close();"
docker compose cp app:/app/data/backup.sqlite ./backup.sqlite
```

Restore: stop the app, replace app.sqlite in its data directory/volume with the backup, remove the old app.sqlite-wal and app.sqlite-shm files **while stopped**, ensure node (UID 1000) owns the file, and restart. Verify a resumed room's phase and recorded answers before class. For local recovery testing, use a separate DB_PATH and inspect the restored room. Protect backups as credentials and participant records.

## Validation boundaries

Unit tests cover schema errors, codes, identity restoration, stale/invalid/duplicate votes, restart persistence, question closure, reveal, end, and room isolation. Browser tests exercise teacher upload and two separate student contexts, submission, refresh recovery and reveal. Simulator timings use one shared monotonic clock for host update receipt and vote acknowledgement round trips.

Before deployment acceptance, run both sustained durations through the actual reverse proxy from another machine, record server resource use, rehearse restart/restore, and test physical phones for touch controls, screen locking and Wi-Fi recovery. These environment-dependent checks are not implied by a passing local smoke test.

## Import a lesson from GitHub

In teacher preparation, paste the JSON file's GitHub link and click **Import lesson**. Both regular file links (`https://github.com/owner/repo/blob/main/lesson.json`) and raw links (`https://raw.githubusercontent.com/owner/repo/main/lesson.json`) are accepted. Copy a permalink containing a commit SHA to choose an exact repository version. Branch/tag links import the file as it exists at import time.

Imports require teacher login and use the same schema validation, 256 KB size limit, saved-lesson list and preview as file uploads. Every import saves an immutable local copy: it does not sync automatically or change active sessions. Reimport to use a newer version. Private repositories and authenticated URLs are unsupported; no GitHub token is needed.

The server only downloads from raw.githubusercontent.com over HTTPS, rejects redirects, limits streamed response size, and times out after 10 seconds. The server needs outbound access to that host. API: `POST /api/lessons/import { "url": "https://github.com/..." }` returns the same `{id, lesson}` result as an upload.

To remove a saved lesson, choose it, click **Delete lesson** in the preview and confirm. Deletion removes it from the saved list only: sessions already started from it keep their own copy and stay resumable. API (teacher login required): `DELETE /api/lessons/:id` returns `{ok:true}`, or 404 if the lesson does not exist.

The header theme selector offers System, Light, Dark and Paper appearances, remembered per browser. Headings use a local serif font with a sans-serif interface; no font service is required.

To run browser tests while a local application already uses port 3000, choose another test port: `TEST_PORT=3002 npm run test:browser`. The test server uses its own database and does not change the live teacher account.

## Embed MP4 and YouTube videos

Put your MP4 files in `public/media/` (for example, `public/media/gradient.mp4`). Vite serves them at `/media/gradient.mp4` during development and copies them into production builds. Rebuild/redeploy after adding files. These are public static assets; SQLite backups do not include them, so keep the originals separately.

Add a video object anywhere in your lesson's `steps` array, between slides or questions:

```json
{
  "id": "gradient-video",
  "type": "video",
  "title": "Understanding gradients",
  "src": "/media/gradient.mp4"
}
```

See `examples/video.json` for a complete lesson; replace its placeholder path with your own MP4 before uploading. You can also use a direct public HTTPS MP4 URL. Video sources must be site-relative paths or HTTPS URLs; computer file paths are not playable sources. Use browser-compatible MP4 encoding such as H.264 video with AAC audio.

Videos appear in the teacher preview, host, presentation display and student views with play/pause, seeking, volume and fullscreen controls. Playback is manual and independent on each screen; host navigation changes the lesson step for everyone, but does not synchronize video playback. For classroom projection, play the video on the presentation display. Leaving a video step stops its playback.

Optionally add `"captionsSrc": "/media/gradient.en.vtt"` for English WebVTT captions. Place that file alongside the MP4. When using external caption URLs, both the video and caption hosts must allow cross-origin requests. Missing or unsupported videos show an error and an open-video link.

For YouTube, use the same `video` step with a YouTube link in `src`:

```json
{
  "id": "youtube-video",
  "type": "video",
  "title": "YouTube explanation",
  "src": "https://www.youtube.com/watch?v=M7lc1UVf-VE"
}
```

See `examples/youtube.json` for a complete lesson. Watch links, `youtu.be` share links, Shorts, live-video links and embed links are supported. Start times such as `?t=90`, `?t=1m30s` or `?start=90` are preserved. Links must identify a single video; playlist-only and channel links are rejected. Additional URL parameters are not passed to the player.

YouTube steps use the embedded YouTube player in preview and all classroom views, with a **Watch on YouTube** fallback link. They require internet access and embedding enabled by the video owner; unavailable, private or restricted videos may not play in the app. Playback remains manual and independent per screen. Use YouTube's own captions for these steps; `captionsSrc` applies only to MP4 steps. No API key or server-side download is required. Player integration follows [YouTube's embed documentation](https://developers.google.com/youtube/player_parameters).
