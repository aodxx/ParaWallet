# ParaWallet

ParaWallet is a mobile-first Rubber Dual Wallet PWA. The browser application is designed for GitHub Pages, while Google Apps Script provides the authenticated API, business calculations, transaction locking, RequestID idempotency, Google Sheets repositories, Google Drive evidence storage, and OCR provider adapters.

## Repository layout

| Path | Responsibility |
|---|---|
| `src/` | GitHub Pages React PWA and Apps Script API client |
| `public/` | PWA manifest, icon, and service worker |
| `appsscript/Code.gs` | Single-file Apps Script Web App API, repositories, calculator, locks, idempotency, Drive, OCR, and domain services |
| `docs/` | Architecture, Data Model, API Contract, roadmap, and acceptance criteria |
| `.github/workflows/pages.yml` | GitHub Pages build and deployment |

## Local frontend

Run `pnpm install`, then set `VITE_APPS_SCRIPT_URL` to the deployed Apps Script Web App URL and run `pnpm dev`. Run `pnpm build` to produce the GitHub Pages artifact in `dist/`.

## Apps Script setup

Create a Google Apps Script project, set its Script ID in a local `.clasp.json`, and push the single `appsscript/Code.gs` file together with `appsscript/appsscript.json`. In Script Properties configure `SHEET_ID`, `DRIVE_ROOT_FOLDER_ID`, `ALLOWED_ORIGINS`, and exactly one or both OCR credentials: `GEMINI_API_KEY` and `GOOGLE_CLOUD_VISION_API_KEY`. Never place these values in GitHub Pages variables or committed source.

Run `Repositories.bootstrap()` once from the Apps Script editor to create the required Sheets tabs. Deploy as a Web App with the documented `doGet` and `doPost` entrypoints. Use the Web App URL as the GitHub Actions variable `VITE_APPS_SCRIPT_URL`.

## Architectural invariants

The frontend never writes Google Sheets directly. All business writes happen inside Apps Script. Financial mutations use `LockService`; every client mutation supplies a unique RequestID; repeated RequestIDs return the original response; sale calculations snapshot agreement percentages; evidence bytes live in Drive while Sheets stores metadata; and OCR results require review when confidence is low.
