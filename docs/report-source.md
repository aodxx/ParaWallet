# ParaWallet Phase D Research and Hardening Report

**Audience:** ParaWallet owner and future maintainers  
**Date:** 24 August 2026  
**Scope:** Thailand; GitHub Pages PWA, Google Apps Script, Google Sheets, and Google Drive architecture  
**Decision:** Identify the highest-value unfinished work and harden it without splitting `appsscript/Code.gs` or creating production financial records.

## Executive answer

The product logic and deterministic tests are already substantially implemented. The remaining production risk is deployment identity and schema migration, not another user-facing feature. The live Apps Script must prove which backend release it runs, and the legacy `Agreements` sheet must be migrated without changing the meaning of existing dates, status, expense rules, or timestamps.

This pass therefore adds a release/schema fingerprint to health and diagnostics, replaces the header-only Agreements repair with a backup-first semantic migration, and makes the script flush pending Spreadsheet writes before releasing its script lock.

## Evidence and decisions

| Material claim | Evidence | Confidence | Decision |
|---|---|---:|---|
| Concurrent writes to shared Apps Script resources need a lock boundary. | [Google Apps Script Lock Service](https://developers.google.com/apps-script/reference/lock) documents locks for preventing concurrent access; the Lock reference recommends flushing Spreadsheet writes before releasing the lock. | High | Retain the script-wide financial lock and flush before release. |
| A deployed Apps Script Web App is tied to a version, but repository commits and Apps Script deployments do not synchronize automatically. | [Apps Script deployment resources](https://developers.google.com/apps-script/api/reference/rest/v1/projects.deployments) expose deployment configuration including a version number; [Web Apps guidance](https://developers.google.com/apps-script/guides/web) treats deployment as a separate step. | High | Expose a non-secret ParaWallet release fingerprint in the app response and verify it after every deploy. |
| GitHub Pages deployment should remain gated by the build artifact and GitHub Pages environment. | [GitHub custom Pages workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) requires the Pages permissions, artifact, dependency, and deployment environment pattern already used by this repository. | High | Preserve the existing Pages workflow and keep `pnpm verify` as the build gate. |
| Apps Script quotas can interrupt execution, so financial work must fail visibly and remain replay-safe. | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) state that exceeding quotas raises exceptions and stops execution. | High | Keep durable RequestID replay records, auditable state transitions, and explicit error responses. |
| Rubber work arrangements vary; a universal Owner/Tapper percentage should not be hard-coded. | Department of Agriculture material describes multiple labor arrangements, including owner tapping and hired tapping, rather than one mandatory split model: [DOA rubber-sector study](https://lib.doa.go.th/multim/BB00280.pdf). | Medium | Keep percentages configurable per versioned Agreement and snapshot the applied version on each Sale. |

## Material limitation

No existing ParaWallet or rubber-project design was found in the connected Canva account, so no Canva asset was treated as an authoritative UI source. The connected Drive contained the project manual and production-readiness evidence; production financial rows were not mutated during this work.

## Production acceptance gate

1. Deploy `appsscript/Code.gs` release `2026.08.24-phase-d2` as a new Web App version.
2. Open the health endpoint and confirm both `release` and `schemaVersion` match the repository.
3. Run `previewParaWalletProductionSchemaRepair()` and require only `correct` or `known_legacy` results.
4. Run `repairParaWalletProductionSchema()` once; keep every generated `*_Backup_*` sheet.
5. Run diagnostics and require `financialSchemaReady=true` with no schema mismatches.
6. Only then run one authenticated Owner/Tapper Sale → confirmation → Settlement → confirmation journey.
7. Reconcile `Sales`, `WalletEntries`, `SettlementAllocations`, `Notifications`, and `AuditLogs` before accepting real use.

## Claim-to-source ledger

- **Lock Service / Lock:** Google for Developers, updated 13 April 2026, https://developers.google.com/apps-script/reference/lock
- **Apps Script deployments:** Google for Developers, accessed 24 August 2026, https://developers.google.com/apps-script/api/reference/rest/v1/projects.deployments
- **Apps Script Web Apps:** Google for Developers, updated 22 July 2026, https://developers.google.com/apps-script/guides/web
- **Apps Script quotas:** Google for Developers, updated 22 July 2026, https://developers.google.com/apps-script/guides/services/quotas
- **Custom GitHub Pages workflows:** GitHub Docs, accessed 24 August 2026, https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- **Rubber-sector labor arrangements:** Department of Agriculture, https://lib.doa.go.th/multim/BB00280.pdf
