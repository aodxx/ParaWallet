# ParaWallet

ParaWallet is a mobile-first Rubber Dual Wallet PWA for transparent money sharing between a garden Owner and Tapper. The React PWA is hosted on GitHub Pages; Google Apps Script is the authenticated API and financial source of truth; Google Sheets stores domain records; and Google Drive stores receipt and settlement evidence.

## Current repository baseline

| Component | Current status |
|---|---|
| Frontend | UX remediation workstreams 1–7 on GitHub Pages |
| Backend deployed | `2026.08.30-ocr-provider-v8` |
| Backend next deployment | `2026.08.30-ocr-provider-v9` |
| Schema | `2026-08-production-v3` |
| Automated verification | 147 tests, TypeScript, Apps Script syntax, and production build |
| Production workflow | Owner/Tapper authenticated E2E and D5–D10 mobile acceptance completed |

Live PWA: <https://aodxx.github.io/ParaWallet/>  
Repository: <https://github.com/aodxx/ParaWallet>

> [!IMPORTANT]
> **สถานะ UX ปัจจุบัน:** remediation ทั้ง 7 ชุดผ่าน automated repository verification แล้ว เหลือ real-device acceptance และ production closure ตาม `todo.md` ก่อนปิด release

> **งานสำคัญของทีมตอนนี้:** ใช้ [เช็กลิสต์ปิดงานบนมือถือจริง](docs/RELEASE-CLOSURE-ACCEPTANCE-2026-08-30.md) ทดสอบทั้งบทบาทเจ้าของสวนและคนกรีด ก่อนปิด release หรือเริ่มฟีเจอร์ใหม่

## Implemented scope

- Google Identity sign-in with backend role and garden-membership authorization
- Owner-managed gardens, Tapper membership, and versioned agreements
- Receipt upload/OCR, review, duplicate signals, Sale confirmation, dispute, and adjustment
- Confirmed/pending/disputed dual-wallet ledger with server-side calculations
- Bank-transfer slip evidence and cash-handover Owner confirmation
- Pending-work queue, notifications, audit logs, date reports, and downloadable tables
- RequestID idempotency, LockService write boundaries, schema guards, and connection recovery
- Mobile-first Owner/Tapper views, PWA install support, structured Lottie loading states, curved mobile header, and accessible animated dock navigation

Optional expansion is intentionally frozen. See [todo.md](todo.md) for the deferred list; do not begin those items without a new Owner decision.

## Repository layout

| Path | Responsibility |
|---|---|
| `src/` | React PWA and Apps Script API client |
| `public/` | PWA manifest, icons, service worker, and loading animation asset |
| `appsscript/Code.gs` | Single deployment source for API, repositories, calculations, authorization, evidence, and domain services |
| `docs/` | Current operating documents plus historical release evidence |
| `tests/` | Deterministic unit, contract, and workflow tests |
| `.github/workflows/pages.yml` | Verification and GitHub Pages deployment |

Start with the [documentation index](docs/INDEX.md) to distinguish current operating documents from historical phase reports.

## Local verification

```bash
pnpm install
pnpm verify
```

For local development, set `VITE_APPS_SCRIPT_URL` to the deployed Apps Script Web App URL and run `pnpm dev`. A production Pages build uses `VITE_BASE_PATH=/ParaWallet/`.

## Deployment boundary

- Frontend changes are verified and deployed by the GitHub Pages workflow.
- Backend changes are not synchronized automatically. Copy the latest `appsscript/Code.gs`, save it in the existing Apps Script project, and deploy a new Web App version.
- After deploying the current Apps Script target, require health to report `release=2026.08.30-ocr-provider-v9` and `schemaVersion=2026-08-production-v3`, then use Owner-authenticated diagnostics to require `financialSchemaReady=true`, `ocr.automaticReadingReady=true`, `ocr.model=gemini-3.7-flash`, and no configuration issues. This release pins the model, protects diagnostics, separates Gemini/Vision errors, and requires no Sheet migration. Follow the controlled rollout in `docs/OCR-GEMINI-CANONICAL.md`; the supplied sample images are reference scenarios, not real-bill acceptance evidence.
- Run a migration only when its release document explicitly requires it. D10–D12 require no schema migration.

Detailed setup is in [docs/SETUP_APPS_SCRIPT.md](docs/SETUP_APPS_SCRIPT.md), and real-use procedures are in [docs/PARAWALLET-REAL-USE-MANUAL.md](docs/PARAWALLET-REAL-USE-MANUAL.md).

## Architectural invariants

The frontend never writes Google Sheets directly. Financial writes happen in Apps Script under authorization and LockService. Every client mutation supplies a unique RequestID; repeated RequestIDs replay the original result. Sale calculations snapshot their Agreement. Evidence bytes remain in Drive while Sheets stores references. Confirmed financial history is corrected through audited state transitions, not direct row deletion. Receipt work follows the single contributor contract in [AGENTS.md](AGENTS.md).

Never commit OAuth secrets, API keys, Spreadsheet IDs, Drive folder IDs, user passwords, or production evidence.
