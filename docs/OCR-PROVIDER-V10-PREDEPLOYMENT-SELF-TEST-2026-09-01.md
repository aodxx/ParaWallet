# OCR provider v10 pre-deployment self-test

Date: 1 September 2026

## Release decision

Backend `2026.08.30-ocr-provider-v8` remains deployed. The v9 source fixes were merged but were not deployed; v10 contains all v9 protections and supersedes v9 as the only next deployment target. No Google Sheets migration is required.

The working Pem project was used as a read-only comparison. It confirmed that a single Gemini image-to-structured-JSON provider path can work when the API key and model setting are separate. ParaWallet retains its canonical stateless Interactions API, pinned `gemini-3.7-flash`, deterministic financial validation, Tapper confirmation, and Owner review. It does not copy Pem's legacy `generateContent` endpoint or deprecated sampling parameters.

## What v10 adds

Run `testGeminiProviderConnection()` directly from the Apps Script editor before deploying. The function:

- uses the same pinned model, Interactions endpoint, image input shape, response parser, and production receipt JSON Schema as `receipts.extract`;
- sends a small synthetic PNG containing no receipt or personal data;
- does not call Vision, Google Sheets, Google Drive, the Sale service, or a public Web App action;
- returns only a safe status object and never returns the API key, request headers, provider response body, or model output.

Passing output:

```text
ok: true
provider: gemini
model: gemini-3.7-flash
release: 2026.09.01-ocr-provider-v10
imageInput: true
structuredOutput: true
code: GEMINI_CONNECTION_OK
```

`durationMs` may vary. A failed result is a stop condition; do not deploy until its safe code is resolved.

| Code | Meaning | Correct action |
|---|---|---|
| `GEMINI_NOT_CONFIGURED` | `GEMINI_API_KEY` is missing | Add the replacement key only to `GEMINI_API_KEY` |
| `GEMINI_HTTP_400` | Provider rejected the current request contract | Stop; preserve the code and inspect the current Gemini request documentation before changing the adapter |
| `GEMINI_HTTP_401` / `403` | Credential is invalid or lacks access | Rotate/check the key and its project/API restrictions |
| `GEMINI_HTTP_404` | Model or endpoint is unavailable to the configured project | Confirm API/model access; do not place a key in `GEMINI_MODEL` |
| `GEMINI_HTTP_429` | Quota or rate limit | Check quota and retry later |
| `OCR_PROVIDER_EMPTY_RESPONSE` | Provider returned no model text | Retry once; investigate provider response shape if repeated |
| `OCR_PROVIDER_INVALID_JSON` / `OCR_PROVIDER_INVALID_RESPONSE` | Response did not satisfy the parser contract | Stop deployment and investigate the adapter |
| `OCR_PROVIDER_SCHEMA_MISMATCH` | Parsed JSON omitted or changed a field required by the production schema | Stop deployment and investigate provider/schema compatibility |
| `GEMINI_STRUCTURED_OUTPUT_INVALID` | JSON parsed but required receipt-schema fields were absent | Stop deployment and investigate schema compatibility |
| `GEMINI_SELF_TEST_FAILED` | An unexpected error was safely redacted | Open Apps Script execution details without sharing secrets and record only time and safe failure context |

## Exact deployment order

1. Revoke any credential ever pasted into `GEMINI_MODEL` and do not record its replacement.
2. Store the replacement only in Script Property `GEMINI_API_KEY`.
3. Delete `GEMINI_MODEL`; v10 pins `gemini-3.7-flash` in source. Delete `GOOGLE_CLOUD_VISION_API_KEY` unless a valid Vision project is intentionally provisioned.
4. Copy the complete v10 `appsscript/Code.gs` into the existing Apps Script project and save it, but do not deploy yet.
5. Select and run `testGeminiProviderConnection()` in the Apps Script editor. Continue only when every passing field above is present.
6. Create a new Web App version. Confirm public health reports `release=2026.09.01-ocr-provider-v10` and `schemaVersion=2026-08-production-v3`.
7. Authenticate as Owner and require diagnostics to report `financialSchemaReady=true`, `ocr.automaticReadingReady=true`, `ocr.model=gemini-3.7-flash`, and no configuration issues.
8. Authenticate as an authorized Tapper and scan one controlled receipt. The provider must return reviewable fields without `GEMINI_HTTP_400`, `401`, `403`, or `404`; saving still requires Tapper verification and Owner review.

Passing the provider self-test proves connectivity and schema compatibility, not handwritten-receipt accuracy. Recognition remains uncertified until the private real-receipt rollout gate in `OCR-GEMINI-CANONICAL.md` passes.
