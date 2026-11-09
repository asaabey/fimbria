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

The header theme selector offers System, Light, Dark and Paper appearances, remembered per browser. Headings use a local serif font with a sans-serif interface; no font service is required.

To run browser tests while a local application already uses port 3000, choose another test port: `TEST_PORT=3002 npm run test:browser`. The test server uses its own database and does not change the live teacher account.
