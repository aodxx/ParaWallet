# ParaWallet Architecture

## Runtime boundaries

> GitHub Pages + PWA is the presentation layer. Google Apps Script is the only application backend and the only component permitted to write business data. Google Sheets is the system of record for structured data, Google Drive stores binary evidence, and Gemini or Google Cloud Vision is accessed only from Apps Script.

The frontend uses `src/api.ts` to send JSON requests to the deployed Apps Script Web App. It never receives spreadsheet identifiers, Drive credentials, or OCR keys. Every mutating request contains a unique `requestId`. Apps Script validates the request, resolves the authenticated user, applies role and garden membership rules, acquires a script lock, writes Sheets/Drive records, and returns a response envelope.

```text
Browser / PWA
    |
    | HTTPS JSON + requestId
    v
Apps Script Web App (doGet/doPost)
    |-- Auth and role scope
    |-- RequestID idempotency cache
    |-- LockService transaction boundary
    |-- Domain calculator and validation
    |-- Google Sheets repositories
    |-- Google Drive evidence storage
    |-- Gemini / Vision OCR adapters
    v
Google Sheets + Google Drive + OCR provider
```

## Security rules

The frontend must not write to Sheets directly. API keys and spreadsheet/folder identifiers belong in Apps Script `PropertiesService`, not GitHub Pages or repository files. Mutating actions must be authenticated, must verify garden membership and role, and must record an audit event. A repeated RequestID must return the original response without writing again. Concurrent financial writes must run inside `LockService.getScriptLock()`.

## Deployment

`pnpm verify` is the repository gate. The GitHub Pages workflow builds and publishes the frontend artifact at the repository base path. Apps Script remains a separate manual deployment: copy the single `appsscript/Code.gs` source into the existing project, save it, and create a new Web App version only when backend code changes. After deployment, compare the public health fingerprint with the repository and use authenticated diagnostics to require `financialSchemaReady=true`. Frontend-only releases do not require an Apps Script deploy or migration.
