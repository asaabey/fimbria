# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains only `PRD.md`, the product requirements for a lightweight live polling application supporting up to 30 participants. No source code, tests, or asset directories exist yet.

Use `PRD.md` as the baseline for scope and behavior. When scaffolding the application, separate frontend views, backend room/session logic, shared event contracts, tests, and static assets into clearly named directories. Document the chosen layout here when it exists.

## Build, Test, and Development Commands

No package manifest, build scripts, or development commands are configured. Do not assume `npm run dev`, `npm test`, or `npm run build` works yet.

When adding tooling, provide documented commands for local development, production builds, linting, and tests. Record prerequisites and required configuration alongside those commands.

## Architecture & Scope

The PRD proposes a React, Vue, or Svelte frontend with Tailwind CSS, a Node.js/Express backend, and Socket.IO or WebSockets. These choices are not yet implemented. Room state is intended to live in memory, with optional lightweight history persistence.

Preserve the presenter and audience workflows, six-digit room codes, and event contracts such as `join_room`, `submit_vote`, and `room_state_update`. Keep account registration, gamification, and long-term database infrastructure outside the MVP.

## Coding Style & Naming Conventions

No formatter or linter is configured. Establish shared formatting and linting rules when introducing code. For JavaScript/TypeScript, prefer two-space indentation, camelCase variables and functions, and PascalCase UI components. Retain the PRD's snake_case socket event names and uppercase session states.

## Testing Guidelines

No test framework or coverage threshold exists yet. Add tests for room creation, joining, host transitions, vote validation, duplicate submissions, and disconnections. Use descriptive filenames such as `room-state.test.ts`. Validate the PRD's synchronization and 30-participant stability targets with integration or load checks.

## Commit & Pull Request Guidelines

No Git history is available to establish commit conventions. Use concise, imperative commit subjects, such as `Add room join validation`.

Pull requests should describe behavior changes, reference applicable requirements or issues, and report validation performed. Include screenshots for UI changes and document new configuration or socket contract changes.

## Implemented Layout and Tooling

The implementation follows PLAN.md where it extends the original PRD (40 participants, SQLite, plain CSS). Node 24.16+ is required. Source is split into src/client, src/server, and src/shared; lesson schema and fixture live in schemas and examples; tests and scripts hold validation and operational tools. README.md documents setup, configuration, socket contracts, Docker, backup/restore and acceptance procedures.

Use npm ci, npm run dev, npm run build, npm run lint (TypeScript strict checking), npm test, npm run test:browser and npm run test:classroom. See README.md for required account setup and simulator credentials. Use two-space indentation, semicolons, camelCase variables, PascalCase components, snake_case events and uppercase session phases.

Video lesson steps use `type: 'video'`, `title`, `src` (MP4 or YouTube link) and optional English WebVTT `captionsSrc` for MP4s. `src/shared/video.ts` validates and normalizes supported YouTube URLs for embedding. `public/media` holds static media copied into production builds; `src/client/VideoPlayer.tsx` renders the shared player. Playback is independent per screen, with no new socket events.

Slides and questions take an optional `image` object (`src` site path or HTTPS, required `alt`, optional `caption`), validated with the same URL rules as video. `src/client/LessonImage.tsx` renders it. `.step-layout.has-image` puts it in the right third on `.presentation`/`.teacher-session` above 900 px and above the content elsewhere. No new socket events.

The public authoring docs are `public/llms.txt` and `public/docs/lesson-format.md`, and the server serves `/lesson.schema.json`. Update the guide in the same change as any schema change; `tests/video-lesson.test.ts` enforces that every schema field is documented and that the guide's full example validates.

Slides and questions also take an optional `table` (`rows` of string/number cells, optional `columns`, `rowHeaders`, `caption`). `parseLesson` enforces equal row lengths. `src/client/LessonTable.tsx` renders it inside a focusable scroll region.

`src/client/Handout.tsx` renders the printable handout at `/handout?lesson=<id>` or `/handout?room=<id|code>` and opens the print dialog once images load; print styles live at the end of `style.css`. `Store.handout` enforces access: teachers any time, students (participant credential via `X-Participant`) only after the session ends, with their own answers and no class totals.

`src/client/BodyText.tsx` renders slide bodies and explanations: `- `/`* `/`• ` lines become `<ul>`, `1. `/`1) ` lines `<ol>`, other text stays pre-wrapped prose; `emphasis()` turns `**bold**` into `<strong>` and `==highlight==` into `<mark>` (`--highlight`/`--on-highlight` tokens). Use it wherever that text appears.

In a room, `main` gets `in-room`: the header holds the connection badge and room code (`src/client/SessionStatus.tsx`: `PlugIcon`, `StepProgress`), and `.title-row` pairs the title with the step progress bar. Browser tests set `LOGIN_ATTEMPTS_PER_MINUTE=100`, because the suite signs in more than 10 times a minute.

The teacher home lists `Store.sessions()` (unended rooms with lesson title, step, participants, last activity); `POST /api/rooms/:id/end` and `/api/rooms/end-all` end them and broadcast. The End all browser test runs in a separate Playwright project after the others because it ends every session on the shared test server.

Broadcasting: every screen joins the Socket.IO room named after its room id. `broadcast()` (host actions) sends to all screens using `Store.views()`, built once per room; `notifyTeachers()` (joins, votes) sends only to teacher screens plus the acting student. Do not broadcast per-vote or per-join updates to every screen: it makes a question round O(N²). `scripts/load-test.mjs` is the capacity test; README records results.

Teacher-only session extras live in `src/client/SessionStatus.tsx`: `SessionClock` (current time, plus elapsed time from `startedAt`/`endedAt` corrected by `serverNow`) and `JoinCorner` (room code and QR, aligned below Session controls in the sticky `.teacher-sidebar`, hidden in the lobby, after the end and below 900 px). The projector display and student phones do not show them. `rooms.started`/`rooms.ended` are added by a startup migration.

`src/client/SlideNavigation.tsx` provides the teacher-only numbered slide picker. `host_action` accepts `JUMP` with zero-based `index`, validated by `Store.action`; teacher snapshots carry `navigation` titles. Jumps use the same question closing and reveal rules as Next/Previous.

`BodyText.emphasis()` also parses `[marker]…[/marker]`, `[underline]…[/underline]` and `[fade]…[/fade]` in bodies/explanations (same-line, paired, lowercase). CSS animates once only in `.in-room`; preview, handout, reduced-motion and print are static. Active step sections are keyed by step id so returning replays effects while votes/joins do not. See `examples/text-effects.json` and the public guide.

`InlineText` in `BodyText.tsx` renders the same safe markup in question prompts and option text (including preview correct-answer summaries and handouts), without paragraph/list conversion. Shared CSS uses `:is(.body, .inline-text)`. `plainText()` strips supported markup for the native slide picker. Option ids and voting contracts are unaffected. See `examples/formatted-question.json`.

`src/client/AppFooter.tsx` reads the release version from `package.json` (calendar `YYYY.M.D`, optional same-day suffix `-2`) and displays `vYYYY.MM.DD` at the footer's right edge. Use `npm version <version> --no-git-tag-version` to keep the lockfile in sync, rebuild for releases, and do not change lesson `schemaVersion` for app releases. `.app-shell` keeps the footer at the bottom of short pages without covering controls.

`AnswerText.tsx` applies `.correct-answer-text` only when the server exposes the matching `correctOptionId` after reveal (static in handouts). CSS runs `correct-answer-sweep` once in `.in-room` using `--correct-highlight`/`--on-correct-highlight` per theme, with static reduced-motion/print styles. Correct labels override authored marker backgrounds, preserve text elements, and keep disabled correct buttons at full opacity.

`SessionControls.tsx` renders the compact teacher panel: icon metrics/PDF, Previous/Next, inline slide picker with an icon jump button and End session. The panel retains its accessible region name without a visible heading. Left/right arrows navigate only running, connected teacher sessions; editable/select/media focus, modifiers and repeated keys are excluded. `ControlIcon.tsx` supplies theme-coloured SVGs. The projector route remains `/display/:id`, without a panel link.
