# Apps Script Deployment Checklist

Create a standalone Apps Script project and copy the files under `appsscript/` into it, or use clasp with a local `.clasp.json` that contains the real Script ID. The committed `.clasp.json` is intentionally ignored and only serves as a template reference.

Before deployment, create one Google Spreadsheet and one Drive root folder. Set these Script Properties in the Apps Script project:

| Property | Purpose |
|---|---|
| `SHEET_ID` | Google Sheets system-of-record spreadsheet ID |
| `DRIVE_ROOT_FOLDER_ID` | Root folder for receipts, slips, and evidence |
| `GEMINI_API_KEY` | Optional Gemini OCR credential |
| `GOOGLE_CLOUD_VISION_API_KEY` | Optional Vision OCR credential |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins for future origin enforcement |

Run `Repositories.bootstrap()` from the Apps Script editor once. Confirm all tabs from `HEADERS` exist and that only header rows were created. Deploy the project as a Web App and copy the `/exec` URL into GitHub repository variable `VITE_APPS_SCRIPT_URL`. The frontend build must be performed with `VITE_BASE_PATH=/ParaWallet/` for the project Pages URL.

The initial scaffold intentionally keeps authentication as a server boundary placeholder because the exact user identity provider is not specified. Before production, replace the token/email resolver with an approved identity flow and make every action verify role, garden membership, and state transition. Do not store API keys in GitHub Actions variables; only the public Apps Script Web App URL belongs in the frontend build environment.
