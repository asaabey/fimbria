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
