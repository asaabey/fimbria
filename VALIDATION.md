# Local validation

Measured on 2026-11-09 using Node 24.16.0 on the development Mac.

- Strict TypeScript check: passed.
- Production Vite / server build: passed.
- Vitest: 3 tests passed (validation, durable room lifecycle, online backup restoration).
- Playwright Chromium: passed teacher upload/session creation and two independent student contexts, voting, refresh recovery, reveal and completion. Screenshot: test-results/teacher.png (generated, ignored).
- Production server on localhost:3001; 40 simulated students, teacher and display; 120 accepted votes; five deliberate reconnects; 10-second post-vote hold. Zero reported errors or unexpected disconnects. p95 vote acknowledgement 69.75 ms; p95 host update receipt 6.29 ms. Timings are local smoke-test figures, not deployment guarantees.
- Docker Compose configuration: validated. Image build attempted but unavailable because the Docker daemon was not running.

Not yet measured: 30-minute acceptance, 60-minute stability, server CPU/memory under those runs, Linux/Proxmox deployment, reverse-proxy latency, physical-phone Wi-Fi/screen-lock recovery. Follow README.md on the target environment.

## GitHub lesson import

- Strict TypeScript check and production build passed.
- Vitest: 17 total tests passed, including URL restrictions, GitHub file/raw/commit URL conversion, JSON/schema errors, missing files, response-size limits, network failures, and timeout behavior.
- Playwright: 2 tests passed. Import UI covers disabled/working controls, unsupported URL feedback, unauthenticated API rejection and selection/preview after import. Success uses a seeded lesson and stubbed import response; upstream downloads are tested with controlled responses rather than a dependency on a public repository.
- Existing upload and two-student teaching flow still passes.

## Fimbria branding and themes

- Production build, strict TypeScript checks and Compose configuration validation passed.
- All four browser tests passed, including the existing teaching/import flows.
- Theme checks cover saved selection across refresh/navigation, live system appearance changes, keyboard focus and no horizontal overflow at a 375px viewport.
- Visually inspected mobile Light, Dark and Paper screenshots; serif headings, controls and readable contrast are consistent.
- DEPLOYMENT.md documents the proposed fimbria.lattice-1.com setup. DNS, TLS and production deployment have not been performed.

## Initial public release validation

- Re-ran all 17 unit tests, strict TypeScript checks, production build and four browser tests successfully.
- Browser tests used port 3002 while leaving the existing application on port 3000 running.
- Re-ran the 40-student production-server simulator against a separate test database: 120 answers, five deliberate reconnects, a 10-second hold, zero errors and zero unexpected disconnects. Local p95 vote acknowledgement: 61.59 ms; host-update receipt: 7.57 ms.
- Reviewed publishable files for credentials and private-machine paths. Local databases, environment files, key material and generated assets are excluded. Documented passwords are placeholders or isolated browser-test fixtures.
- Sustained runs and target deployment checks remain unverified as described above.
