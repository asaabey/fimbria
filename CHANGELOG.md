# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Teacher session screen: a running current-time clock and session timer in the top bar (the timer starts at Begin lesson, uses the server's clock and freezes at the end), and the room code with a join QR pinned to the lower right during the lesson. Rooms record `started` and `ended` times.
- Teachers can end unfinished sessions from the home page, one at a time or all at once, after confirming (`POST /api/rooms/:id/end`, `POST /api/rooms/end-all`). The list now shows each session's lesson, step, students and last activity.
- `**bold**` and `==highlight==` in slide bodies, explanations and list items, themed for every appearance and kept in handouts.
- Lines starting with `- `, `* `, `• ` or `1. ` in slide bodies and explanations render as bulleted or numbered lists on every screen and in handouts.
- Printable lesson handouts saved as PDF through the browser's print dialog: teachers from the lesson preview or the session controls (with response counts), students after the session ends (with answers, explanations and their own responses). `GET /api/handout`.
- Optional `table` (`rows`, `columns`, `rowHeaders`, `caption`) on slides and questions, with accessible headers, scrolling on phones, preview rendering, docs and `examples/tables.json`.
- Public lesson-format docs for authors and AI agents: `/llms.txt`, `/docs/lesson-format.md` and the canonical `/lesson.schema.json`, linked from the teacher page.
- Optional `image` (`src`, `alt`, `caption`) on slides and questions: right third on the presentation and teacher views, above the content on phones, with tap-to-enlarge, preview thumbnails and a text fallback. Includes `examples/images.json`.
- Teachers can delete saved lessons from the preview panel after an inline confirmation (`DELETE /api/lessons/:id`). Sessions already started keep their own copy.
- YouTube video links in lesson steps, including watch/share/Shorts/live/embed URLs and start times.
- Embedded MP4 lesson steps with responsive playback controls, optional captions, media error feedback and a sample video lesson.

- Teacher login, immutable JSON lesson uploads and public GitHub imports with validation and preview.
- Live slide presentation, six-digit room codes, QR joining, single-answer voting and teacher-controlled results.
- Persistent lessons, session progress, participant credentials and recorded answers with reconnect recovery.
- Fimbria branding, readable serif typography and persistent System, Light, Dark and Paper themes.
- Unit and browser tests, a 40-student classroom simulator, and configurable browser-test ports.
- Docker Compose deployment, teacher password setup/reset commands, consistent SQLite backups, and deployment guidance for fimbria.lattice-1.com.

### Changed

- Joins and votes update only the teacher's screen and the voter's own, and broadcasts build each view once per room with the lesson parsed once. One room now serves about 1,000 students with votes accepted in under 0.3 s (p95), up from about 200. Added `scripts/load-test.mjs`, a staged ramp load test.
- Session screens use a compact top bar holding a plug connection indicator (unplugged and red while reconnecting) and the room code, with a step progress bar beside the lesson title, so the lesson starts higher on the screen.
- Teacher login attempts per minute are configurable with `LOGIN_ATTEMPTS_PER_MINUTE` (default 10).
- Keep teacher lesson previews and session controls alongside lesson content, and improve student layouts and answer visibility on mobile.

### Deprecated

### Removed

### Fixed

### Security

- Hash teacher passwords, protect login sessions with HttpOnly cookies, and authorize teacher commands.
- Validate uploaded/imported lessons, restrict GitHub downloads to HTTPS raw-file URLs, and enforce size and timeout limits.
- Exclude local databases, environment files, key material and generated output from version control and container builds.
