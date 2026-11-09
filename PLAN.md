# MVP Implementation Plan

## Objective

Build a minimal live teaching tool for medical students that also works in other teaching environments. A teacher uploads a JSON lesson, presents slides, collects multiple-choice answers, and reveals results. Students join through a room code without accounts.

Validate one complete teaching session with 40 simulated students before adding richer content or authoring tools. This plan extends `PRD.md` with slides, JSON uploads, durable session storage, and Proxmox deployment. No application code exists yet.

## MVP Scope

- One local teacher account, created and reset through server-side commands.
- JSON lesson upload, validation, and preview.
- Text slides and single-answer multiple-choice questions in one ordered sequence.
- Six-digit room codes and QR join links.
- Teacher-controlled progression, answer collection, and result reveal.
- Student submission confirmation and reconnection recovery.
- Persistent lessons, session progress, and accepted answers.
- One containerised application deployed through Docker Compose.
- A repeatable 40-student simulator and focused browser tests.

There must be no email dependency: no email verification, invitations, password-reset emails, or email delivery of results.

## Minimal Frontend

Use a neutral background, readable typography, one accent colour, generous spacing, and simple native controls. Avoid decorative animations, dense navigation, dashboards, and a component-heavy design system. Support keyboard use, visible focus, sufficient contrast, and large touch targets; never communicate answer status through colour alone.

| Screen | Essential content |
| --- | --- |
| Teacher preparation | Login, JSON upload, validation feedback, ordered lesson preview, Start session |
| Teacher controls | Current content, step number, participant/response counts, Previous, Next, Reveal results, End session |
| Presentation display | Read-only content, room code/QR in the lobby, revealed results; no private notes or teacher controls |
| Student join | Room code and Join button; QR links populate the code |
| Student session | Current slide or question, answer buttons, submitting/submitted state, connection status, revealed explanation |

Use a simple bar chart for results. Before reveal, show response counts only to the teacher. Disable answer controls after confirmed submission. Show a clear reconnecting state during interruptions.

## Technical Stack

| Layer | Choice |
| --- | --- |
| Frontend | React, TypeScript, Vite, plain CSS |
| Backend | Node.js, Express, TypeScript |
| Live updates | Socket.IO |
| Storage | SQLite on persistent local storage |
| Upload validation | Versioned JSON Schema validated with Ajv |
| Automated checks | Vitest, Playwright, and a custom Socket.IO client simulator |
| Deployment | Docker Compose inside a Linux VM on Proxmox |

Serve the built frontend and API from the same application process and origin. Keep a single server instance for the MVP. SQLite runs in-process and requires no separate database service.

Suggested layout: `src/client/`, `src/server/`, `src/shared/`, `schemas/`, `examples/`, `tests/`, and `scripts/`.

## Lesson Format

Store each uploaded lesson as an immutable JSON document. A lesson contains `schemaVersion`, `id`, `title`, and an ordered `steps` array.

- Slide: `id`, `type: "slide"`, `title`, and `body`.
- Question: `id`, `type: "question"`, `prompt`, options with stable IDs, `correctOptionId`, and `explanation`.

Publish the schema and an example lesson so external agents can generate compatible files. The initial fixture contains two introductory slides, three questions, and an ending slide.

Validate size limits, supported versions/types, required fields, unique step/option IDs, and correct-answer references. Render uploaded strings as text. Return actionable errors that identify the invalid field. Fix a lesson version when starting a session; later uploads must not alter an active class.

## Session and Voting Behaviour

Keep reusable lesson content separate from session state. Persist the session ID, join code, lesson version, current step, phase, state revision, participant identities, and answers.

1. Teacher starts a session in the lobby; students join using the code.
2. Teacher starts the lesson and advances through its steps.
3. Entering a new question opens voting.
4. The server validates and saves each answer before acknowledging it.
5. Reveal closes voting and publishes totals, the correct answer, and the explanation.
6. Advancing closes the previous question; revisiting it does not reopen voting or clear answers.
7. End session closes voting and shows a simple completion screen.

The server is authoritative. Authorise teacher commands, reject stale or closed-question submissions, and enforce one answer per participant per question with a database uniqueness constraint. Retried identical submissions return the recorded outcome without incrementing totals. Keep correct answers and explanations out of student payloads until reveal.

Use a persistent, server-issued participant credential rather than a socket ID. Refreshing or reconnecting in the same browser restores participation. Anonymous access cannot prevent someone from joining as a new participant using a different browser.

Persist teacher transitions and accepted answers before confirmation. On reconnect, send a current state snapshot and that student's answer status. A teacher disconnect must not end the session. Restore persisted state after application restart. Expire abandoned sessions after a configurable inactivity period.

## Proxmox Deployment

- Run Docker Compose in a Linux VM; begin evaluation with 2 vCPUs and 2 GB RAM.
- Build one application image and mount a persistent data directory for SQLite.
- Use the existing HTTPS reverse proxy if available; configure WebSocket forwarding.
- Configure the public base URL so QR links resolve correctly for students.
- Add automatic startup, a health endpoint, and configuration documentation.
- Store credentials outside the image and use password hashing and secure session cookies.
- Provide a consistent SQLite backup/restore procedure and test it.
- Schedule container updates between classes; restarts briefly interrupt connections.

Before external testing, establish whether access is LAN-only or through a public HTTPS address. Persistent storage supports recovery; it does not provide uninterrupted service during a restart.

## Implementation Milestones

### 1. Local Teaching Loop

Scaffold the app, schema, example lesson, database, and teacher login. Implement upload/preview, session creation, slide progression, voting, reveal, and completion. Demonstrate the entire lesson with one teacher and two isolated student browsers.

### 2. Recovery and Correctness

Implement participant credentials, acknowledgements, duplicate protection, persisted transitions, reconnect snapshots, and teacher recovery. Test invalid uploads, unauthorised controls, late answers, retries, refreshes, and restarts. Verify two concurrent rooms remain isolated.

### 3. Simulated Classroom

Create 40 independent Socket.IO connections with distinct participant identities. Exercise staggered joins, varied voting delays, simultaneous answers, deliberate disconnections, and reconnections. Compare expected answers with stored records and displayed totals.

Run a 30-minute acceptance session and a 60-minute stability check. Record latency percentiles, errors, disconnects, CPU, and memory. Measure host-command-to-client receipt using the simulator's shared clock; measure submission acknowledgement as a round trip.

### 4. Proxmox Rehearsal

Deploy the image and run the simulator from a separate machine through the intended student URL. Use Playwright for actual UI flows and several physical phones for touch layout, screen locking, and Wi-Fi recovery. Exercise application restart and backup restoration.

## Acceptance Criteria

| Check | Target |
| --- | --- |
| Teaching flow | Complete the sample lesson through the minimal UI |
| Capacity | 40 students plus teacher and presentation display |
| Correctness | Every acknowledged answer stored exactly once; totals match |
| Responsiveness | p95 slide-update receipt and vote acknowledgement below 500 ms under documented test conditions |
| Recovery | Current state and recorded answer restored within 5 seconds after a connection is re-established |
| Restart | Previously acknowledged answers and confirmed progress survive |
| Isolation | No content, controls, or votes cross between rooms |
| Stability | No unexplained disconnects or lost progress during the sustained test |

These are validation targets, not measured results. Proposed commands such as `npm run test:classroom -- --students 40 --duration 30m` will be implemented and documented with the tooling.

## Deferred Features

Defer in-app lesson authoring, AI generation, images/media uploads, animation templates, timers, scoring, leaderboards, multiple teacher accounts, reporting/export tools, and horizontal scaling.

After the core passes acceptance, add a small set of staged diagrams inspired by clear visual explanation: consistent colours, progressive reveals, and teacher-controlled replay. Keep the JSON format extensible without implementing an animation engine in this MVP.
