# ParaWallet — Canonical Work Status

Updated: 29 August 2026

This file is the current work queue. Phase reports under `docs/PHASE-D*.md` are release evidence, not open task lists.

## Blocking priority — UX remediation before new work

Complete the seven workstreams in [`docs/UX-AUDIT-REMEDIATION-2026-08-29.md`](docs/UX-AUDIT-REMEDIATION-2026-08-29.md) before beginning any new feature or visual redesign:

- [ ] Correct terminology and role-specific navigation
- [ ] Introduce one explicit system-status model
- [ ] Make pending work and latest records primary
- [ ] Add a completion receipt to every mutation
- [ ] Remove or connect inert controls
- [ ] Separate loading, empty, error, offline, and unauthorized states
- [ ] Remove technical vocabulary and improve field readability

## Accepted production baseline

- [x] Backend `2026.08.24-phase-d10` deployed with schema `2026-08-production-v3`
- [x] Frontend Phase D12.1 Forest Fintech mobile QA refinement deployed on GitHub Pages
- [x] Production schema migration completed and all 22 domain headers verified
- [x] Controlled Owner/Tapper production E2E completed
- [x] D5 Owner-managed Tapper membership accepted on mobile
- [x] D6 receipt evidence and Owner Sale review accepted
- [x] D7–D8 bank/cash settlement evidence and confirmation accepted
- [x] D9 pending-work queue and notifications implemented and accepted
- [x] D10 connection resilience and actionable error/retry states deployed
- [x] D11 Lottie loading, typography hierarchy, grid alignment, and non-overlapping state transitions deployed
- [x] D12 Earthy Harmony palette, curved mobile header, prioritized dual wallets, and accessible Animated Circle Dock implemented
- [x] D12.1 Tapper date formatting, settlement-card spacing, outdoor text contrast, screen-specific descriptions, wallet-heading alignment, and dock clearance implemented
- [x] Automated verification passes 98 tests, TypeScript, Apps Script syntax, and production build
- [x] Current README, operating manual, roadmap, gap matrix, and document index synchronized

## Release closure — validation only

These are operational checks, not new feature development.

- [ ] Complete one final real-device acceptance pass for Owner and Tapper after D12.1: login, curved-header layout, dock navigation, More sheet, localized dates, pending work, notification read, Sale review, bank transfer, cash handover, reconnect, and loading transitions
- [ ] Confirm that any password or secret ever shared during testing has been rotated; do not record the replacement in this repository
- [ ] Monitor Apps Script failures and connection interruptions during controlled real use; record exact request ID, time, role, action, and error before changing code
- [ ] Preserve production migration backups and tagged E2E audit records

## Deferred by Owner decision

Do not start these items until the Owner explicitly reopens scope.

- Offline draft queue and mutation retry synchronization
- Multi-garden switching and portfolio overview
- Settings/profile management and advanced user administration
- Advanced filters, analytics, report variants, and scheduled exports
- Full plots/products/buyers management screens
- Invite code/email onboarding for users not yet registered
- Immutable field-level OCR revision timeline and financial reversal workflow
- QR invitation, push/LINE/email delivery, and other external notifications
- Additional visual redesign implementation beyond an approved design direction

## Change rule

Core financial behavior, authorization, ledger math, schema, and evidence retention must not be changed as part of visual work. Any future feature starts with an explicit scope decision, acceptance criteria, tests, and a deployment note.
