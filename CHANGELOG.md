# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

- Keep teacher lesson previews and session controls alongside lesson content, and improve student layouts and answer visibility on mobile.

### Deprecated

### Removed

### Fixed

### Security

- Hash teacher passwords, protect login sessions with HttpOnly cookies, and authorize teacher commands.
- Validate uploaded/imported lessons, restrict GitHub downloads to HTTPS raw-file URLs, and enforce size and timeout limits.
- Exclude local databases, environment files, key material and generated output from version control and container builds.
