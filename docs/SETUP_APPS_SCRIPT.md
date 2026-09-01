# Apps Script Deployment Checklist

> Current backend target: `2026.09.01-financial-clarity-v11` with schema `2026-09-financial-clarity-v4`. This release requires the backup-first Financial Clarity migration after the new Web App version is deployed.

Create a standalone Apps Script project and copy only `appsscript/Code.gs` and `appsscript/appsscript.json` into it, or use clasp with a local `.clasp.json` that contains the real Script ID. `Code.gs` is intentionally the single deployment source and already contains configuration, routing, repositories, calculator, locking, idempotency, Drive, OCR, and domain services. The committed `.clasp.json` is intentionally ignored and only serves as a template reference.

Before deployment, create one Google Spreadsheet and one Drive root folder. Set these Script Properties in the Apps Script project:

| Property | Purpose |
|---|---|
| `SHEET_ID` | Google Sheets system-of-record spreadsheet ID |
| `DRIVE_ROOT_FOLDER_ID` | Root folder for receipts, slips, and evidence |
| `GEMINI_API_KEY` | Required Gemini credential for automatic bill reading |
| `GEMINI_MODEL` | Optional; leave unset or set exactly to `gemini-3.7-flash`. Never paste an API key here. |
| `GOOGLE_CLOUD_VISION_API_KEY` | Optional Vision OCR credential |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins for future origin enforcement |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth Web client ID used as the ID-token audience; required for sign-in |

Run `setupParaWalletSheets()` from the Apps Script editor once. This explicit admin entrypoint calls `Repositories.bootstrap()` internally. The function creates missing tabs, writes the exact header arrays from `HEADERS`, freezes the first row on newly initialized tabs, and returns `created`, `initialized`, and `validated` arrays. If an existing tab has a different header order, it stops with `SCHEMA_MISMATCH:<tab>` instead of overwriting data. Use `validateParaWalletSheets()` for a non-destructive status report; it calls `Repositories.validateSchema()` internally. Confirm all tabs from `HEADERS` exist and that only header rows were created. Do not create or upload the removed module files such as `Config.gs`, `Locking.gs`, or `Services.gs`; their code is already inside `Code.gs`. Before deploying, run `testGeminiProviderConnection()` as described below. Then deploy the project as a Web App and copy the `/exec` URL into GitHub repository variable `VITE_APPS_SCRIPT_URL`. The frontend build must be performed with `VITE_BASE_PATH=/ParaWallet/` for the project Pages URL.

ParaWallet now uses Google Identity Services and Google OpenID Connect ID tokens. Create a Google OAuth **Web application** client ID in Google Cloud Console. Add `https://aodxx.github.io` to **Authorized JavaScript origins**, then set the client ID in the GitHub repository variable `VITE_GOOGLE_CLIENT_ID` and in Apps Script Script Properties as `GOOGLE_OAUTH_CLIENT_ID`. The two values must match exactly. The client ID is public configuration, not a secret; never put a client secret or API key in the frontend.

The PWA displays the official Google Sign-In button, stores only the short-lived ID token in browser storage, and sends it as `authToken` to Apps Script. Apps Script validates the token with Google’s `tokeninfo` endpoint, checks issuer, audience, expiry, subject, and verified email, then matches the verified email to an active row in `Users.email`. `PUBLIC_USER_EMAIL` and `DEFAULT_USER_EMAIL` are no longer used for authentication and may be removed.

To diagnose synchronization without exposing Sheet data, sign in as an Owner and send a POST request with action `diagnostics.get`, a unique `requestId`, and the Owner ID token. The response reports whether `SHEET_ID` is configured, whether the spreadsheet is accessible, how many required tabs are missing, and how many Users rows exist. It never returns Script Property values verbatim. `health.get` remains public and proves only that the Web App is reachable.

Before deploying v11, keep `GEMINI_MODEL` unset; the model is pinned to `gemini-3.7-flash`. Store the credential only in `GEMINI_API_KEY`, and keep `GOOGLE_CLOUD_VISION_API_KEY` unset when Vision is not intentionally configured. Copy and save the complete v11 `Code.gs`, select `testGeminiProviderConnection()` in the Apps Script editor, and run it before creating a Web App version. Continue only when it reports `ok=true`, `provider=gemini`, `model=gemini-3.7-flash`, `release=2026.09.01-financial-clarity-v11`, `imageInput=true`, `structuredOutput=true`, and `code=GEMINI_CONNECTION_OK`. The function uses a synthetic image, never writes Sheets/Drive, and never returns the key or provider response.

After deployment, verify health reports `release=2026.09.01-financial-clarity-v11` and `schemaVersion=2026-09-financial-clarity-v4`. Then run `previewFinancialClarityV11Migration()` and require `ready_to_migrate_as_test` for Agreements, Sales, and Settlements. Run `migrateFinancialClarityV11()` once and require `financialSchemaReady=true`, `timeZone=Asia/Bangkok`, and `nextAction=CREATE_REAL_PRODUCTION_AGREEMENT`. Create that Agreement from the Owner screen, then authenticate as Owner and require diagnostics to report `financialSchemaReady=true`, `ocr.automaticReadingReady=true`, the pinned model, and no configuration issues. Follow [`FINANCIAL-CLARITY-REMEDIATION-2026-09-01.md`](FINANCIAL-CLARITY-REMEDIATION-2026-09-01.md) and [`OCR-GEMINI-CANONICAL.md`](OCR-GEMINI-CANONICAL.md).
