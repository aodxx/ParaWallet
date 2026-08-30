# ParaWallet Integration Verification

Updated: 24 August 2026

This is the current non-secret integration summary. Exact Spreadsheet IDs, Apps Script deployment IDs, OAuth tokens, account credentials, and evidence-file IDs must remain outside the repository.

## Accepted baseline

| Integration | Accepted result |
|---|---|
| GitHub Pages PWA | Frontend D11 serves the production build at the repository subpath |
| Apps Script Web App | Health reports `status=ok` and `release=2026.08.29-ux-ws3-v7` |
| Google Sheets | Schema reports `2026-08-production-v3`; all 22 canonical domain headers were migrated and verified |
| Authentication | Separate active Owner and Tapper Google accounts completed controlled E2E |
| Garden scope | Both roles see only records permitted by garden ownership or active membership |
| Google Drive evidence | Receipt and settlement evidence are stored privately and retrieved through authorized API actions |
| Financial workflow | Controlled Sale → Owner confirmation → Settlement → Owner confirmation reconciled across ledger, allocations, notifications, and audit logs |
| Reliability/UX | D9 pending work and notifications, D10 connection recovery, and D11 loading transitions are deployed |
| Repository gate | 98 automated tests, TypeScript, Apps Script syntax, and production build pass |

## Repeatable release check

1. Run `pnpm verify`.
2. Confirm the Pages workflow publishes compiled assets, not `/src/main.tsx`.
3. Confirm health reports the exact repository release and schema fingerprint.
4. Sign in with an active test account and require diagnostics to report `financialSchemaReady=true`.
5. Run read-only role/garden checks before any controlled mutation.
6. For backend or financial changes only, execute the smallest approved idempotent workflow and reconcile Sales, WalletEntries, Settlements, SettlementAllocations, Notifications, and AuditLogs.
7. Do not store returned IDs, tokens, personal emails, images, or account secrets in this file.

Detailed point-in-time evidence is preserved in the `PHASE-D*.md` documents listed in [`INDEX.md`](INDEX.md).
