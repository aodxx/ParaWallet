# ParaWallet Documentation Index

Updated: 24 August 2026

Use this page to identify the current source of truth. A release number inside a historical report describes that report's point in time; it does not override the current baseline.

## Start here — current documents

| Document | Purpose |
|---|---|
| [`../README.md`](../README.md) | Product overview, current deployment baseline, architecture, and verification |
| [`../todo.md`](../todo.md) | Only canonical open-work list and deferred-scope decision |
| [`../PRD.md`](../PRD.md) | Product requirements and business intent |
| [`PRD_IMPLEMENTATION_GAP.md`](PRD_IMPLEMENTATION_GAP.md) | Current implementation status versus PRD |
| [`ROADMAP_AND_ACCEPTANCE.md`](ROADMAP_AND_ACCEPTANCE.md) | Current acceptance gates and release discipline |
| [`PARAWALLET-REAL-USE-MANUAL.md`](PARAWALLET-REAL-USE-MANUAL.md) | Thai installation and Owner/Tapper operating manual |
| [`SETUP_APPS_SCRIPT.md`](SETUP_APPS_SCRIPT.md) | Apps Script, OAuth, Sheets, Drive, and deployment checklist |

## Technical contracts — current

| Document | Purpose |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Component boundaries and invariants |
| [`API_CONTRACT.md`](API_CONTRACT.md) | Request/response actions and security contract |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Canonical Google Sheets tables and columns |
| [`MOBILE_DESIGN_DIRECTION.md`](MOBILE_DESIGN_DIRECTION.md) | Existing mobile UX and information-architecture rules |
| [`DESIGN-FOREST-FINTECH-PROTOTYPE.md`](DESIGN-FOREST-FINTECH-PROTOTYPE.md) | Approved Forest Fintech prototype and Bottom Navigation accessibility specification |
| [`INTEGRATION_VERIFICATION.md`](INTEGRATION_VERIFICATION.md) | Deterministic integration-verification notes |

## Historical release and audit evidence

The following files are intentionally retained. Do not use their old release numbers, test counts, or open-gap statements as the current operating status.

- `FINAL-HANDOFF-2026-08-21.md`
- `report-source.md`
- `PHASE-D-E2E-RUNNER.md`
- `PHASE-D-GARDEN-SETUP-REPORT.md`
- `PHASE-D-PRODUCTION-E2E-EVIDENCE.md`
- `PHASE-D-PRODUCTION-READONLY-AUDIT.md`
- `PHASE-D-SANDBOX-E2E-REPORT.md`
- `PHASE-D5-MEMBER-MANAGEMENT.md`
- `PHASE-D6-SALE-EVIDENCE-REVIEW.md`
- `PHASE-D7-SETTLEMENT-EVIDENCE-REVIEW.md`
- `PHASE-D8-SETTLEMENT-CONFIRMATION-PERFORMANCE.md`
- `PHASE-D9-PENDING-WORK-NOTIFICATIONS.md`
- `PHASE-D10-CONNECTION-RESILIENCE.md`
- `PHASE-D11-LOADING-UX.md`
- `PHASE-D12-FOREST-FINTECH-UI.md`

## Current status precedence

When documents disagree, use this order:

1. Current deployed health/diagnostics and controlled acceptance evidence
2. `README.md` and `todo.md`
3. Current technical contracts and operating manual
4. Historical phase reports

Never place credentials, passwords, OAuth secrets, API keys, production IDs, or evidence files in documentation.
