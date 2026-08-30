# ParaWallet Release Roadmap and Acceptance Gates

Updated: 30 August 2026

## Current release — stabilization

The accepted baseline is backend `2026.08.29-ux-ws3-v7`, schema `2026-08-production-v3`, and frontend UX remediation workstreams 1–7. Core feature development is complete for the current scope. The release remains in controlled-use stabilization until the final real-device closure pass in [`todo.md`](../todo.md) is recorded.

Acceptance requires all of the following:

1. Health reports the exact backend release and schema fingerprint; diagnostics reports `financialSchemaReady=true`.
2. Owner and Tapper authenticate with separate active accounts and see only authorized gardens and records.
3. Receipt/OCR or manual Sale creation reaches Owner pending review; confirmation creates one balanced ledger result.
4. Bank transfer requires evidence; cash handover requires Owner acknowledgement; repeated RequestID creates no duplicate effect.
5. Pending-work cards, notification badges, notification read state, and deep links refresh correctly for both roles.
6. A temporary disconnect produces a clear retry state and recovers without blanking the screen or showing demo money.
7. Loading animation, skeleton/content transition, text hierarchy, curved header, animated dock, sticky actions, and keyboard-safe controls work on real mobile devices.
8. `pnpm verify` passes before every release.

## Visual-design baseline — implemented

The Owner-approved Forest Fintech direction is implemented in Phase D12. It changes color, typography hierarchy, spacing, card composition, header treatment, and navigation motion while preserving workflows, authorization, financial calculations, evidence rules, accessibility, and outdoor readability. Further visual expansion remains deferred until explicitly approved.

## Deferred expansion

Offline mutation queues, multi-garden portfolio views, full plot/product/buyer management, advanced reporting, external notification channels, invitations, and reversal timelines have no scheduled phase. They remain outside the current release until explicitly reopened.

## Release discipline

- Frontend-only releases do not require Apps Script deployment or migration.
- Backend releases require a new Apps Script Web App version and fingerprint verification.
- Schema changes require a previewable, backup-first migration and read-only diagnostics before financial mutations resume.
- Historical Phase D reports are immutable evidence; current status lives in README, this roadmap, the gap matrix, and `todo.md`.
