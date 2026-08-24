# ParaWallet Release Roadmap and Acceptance Gates

Updated: 24 August 2026

## Current release — stabilization

The accepted baseline is backend `2026.08.24-phase-d10`, schema `2026-08-production-v3`, and frontend Phase D11. Core feature development is complete for the current scope. The release remains in controlled-use stabilization until the final real-device closure pass in [`todo.md`](../todo.md) is recorded.

Acceptance requires all of the following:

1. Health reports the exact backend release and schema fingerprint; diagnostics reports `financialSchemaReady=true`.
2. Owner and Tapper authenticate with separate active accounts and see only authorized gardens and records.
3. Receipt/OCR or manual Sale creation reaches Owner pending review; confirmation creates one balanced ledger result.
4. Bank transfer requires evidence; cash handover requires Owner acknowledgement; repeated RequestID creates no duplicate effect.
5. Pending-work cards, notification badges, notification read state, and deep links refresh correctly for both roles.
6. A temporary disconnect produces a clear retry state and recovers without blanking the screen or showing demo money.
7. Loading animation, skeleton/content transition, text hierarchy, alignment, sticky actions, and keyboard-safe controls work on real mobile devices.
8. `pnpm verify` passes before every release.

## Visual-design exploration — next decision, not implementation

After documentation closure, the Owner and maintainer will select a visual direction. The design proposal may change color, typography, spacing, card composition, icon treatment, and motion, but must preserve current workflows, authorization, financial calculations, evidence rules, accessibility, and outdoor readability. Implementation begins only after a direction and screen priority are approved.

## Deferred expansion

Offline mutation queues, multi-garden portfolio views, full plot/product/buyer management, advanced reporting, external notification channels, invitations, and reversal timelines have no scheduled phase. They remain outside the current release until explicitly reopened.

## Release discipline

- Frontend-only releases do not require Apps Script deployment or migration.
- Backend releases require a new Apps Script Web App version and fingerprint verification.
- Schema changes require a previewable, backup-first migration and read-only diagnostics before financial mutations resume.
- Historical Phase D reports are immutable evidence; current status lives in README, this roadmap, the gap matrix, and `todo.md`.
