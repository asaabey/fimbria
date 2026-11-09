# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Teacher login, immutable JSON lesson uploads and public GitHub imports with validation and preview.
- Live slide presentation, six-digit room codes, QR joining, single-answer voting and teacher-controlled results.
- Persistent lessons, session progress, participant credentials and recorded answers with reconnect recovery.
- Fimbria branding, readable serif typography and persistent System, Light, Dark and Paper themes.
- Unit and browser tests, a 40-student classroom simulator, and configurable browser-test ports.
- Docker Compose deployment, teacher password setup/reset commands, consistent SQLite backups, and deployment guidance for fimbria.lattice-1.com.

### Changed

### Deprecated

### Removed

### Fixed

### Security

- Hash teacher passwords, protect login sessions with HttpOnly cookies, and authorize teacher commands.
- Validate uploaded/imported lessons, restrict GitHub downloads to HTTPS raw-file URLs, and enforce size and timeout limits.
- Exclude local databases, environment files, key material and generated output from version control and container builds.
