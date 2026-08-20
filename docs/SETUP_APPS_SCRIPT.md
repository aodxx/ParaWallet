# Apps Script Deployment Checklist

Create a standalone Apps Script project and copy only `appsscript/Code.gs` and `appsscript/appsscript.json` into it, or use clasp with a local `.clasp.json` that contains the real Script ID. `Code.gs` is intentionally the single deployment source and already contains configuration, routing, repositories, calculator, locking, idempotency, Drive, OCR, and domain services. The committed `.clasp.json` is intentionally ignored and only serves as a template reference.

Before deployment, create one Google Spreadsheet and one Drive root folder. Set these Script Properties in the Apps Script project:

| Property | Purpose |
|---|---|
| `SHEET_ID` | Google Sheets system-of-record spreadsheet ID |
| `DRIVE_ROOT_FOLDER_ID` | Root folder for receipts, slips, and evidence |
| `GEMINI_API_KEY` | Optional Gemini OCR credential |
| `GOOGLE_CLOUD_VISION_API_KEY` | Optional Vision OCR credential |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins for future origin enforcement |
| `PUBLIC_USER_EMAIL` | Email of an active row in `Users.email`; required for anonymous GitHub Pages MVP access |
| `DEFAULT_USER_EMAIL` | Backward-compatible alias for `PUBLIC_USER_EMAIL` |

Run `setupParaWalletSheets()` from the Apps Script editor once. This explicit admin entrypoint calls `Repositories.bootstrap()` internally. The function creates missing tabs, writes the exact header arrays from `HEADERS`, freezes the first row on newly initialized tabs, and returns `created`, `initialized`, and `validated` arrays. If an existing tab has a different header order, it stops with `SCHEMA_MISMATCH:<tab>` instead of overwriting data. Use `validateParaWalletSheets()` for a non-destructive status report; it calls `Repositories.validateSchema()` internally. Confirm all tabs from `HEADERS` exist and that only header rows were created. Do not create or upload the removed module files such as `Config.gs`, `Locking.gs`, or `Services.gs`; their code is already inside `Code.gs`. Deploy the project as a Web App and copy the `/exec` URL into GitHub repository variable `VITE_APPS_SCRIPT_URL`. The frontend build must be performed with `VITE_BASE_PATH=/ParaWallet/` for the project Pages URL.

For the current single-tenant GitHub Pages MVP, add `PUBLIC_USER_EMAIL` after creating a registered user row in the `Users` tab. The value must exactly match `Users.email` and the row must not have `status=disabled`; otherwise the PWA receives `USER_NOT_REGISTERED`. This property is a controlled bridge for one account, not multi-user authentication. Before production or multi-account use, replace this boundary with Google OAuth and remove the public fallback. Do not store API keys in GitHub Actions variables; only the public Apps Script Web App URL belongs in the frontend build environment.

To diagnose synchronization without exposing Sheet data, send a POST request with action `diagnostics.get` and a unique `requestId`. The response reports whether `SHEET_ID` is configured, whether the spreadsheet is accessible, how many required tabs are missing, and how many Users rows exist. `health.get` only proves the Web App is reachable; it does not prove that Google Sheets is configured.
