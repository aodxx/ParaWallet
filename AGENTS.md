# ParaWallet contributor contract

This file applies to the entire repository. `main` is the multi-developer source of truth; all changes use a feature branch and pass `pnpm verify` before merge.

## Non-negotiable architecture

- Keep `appsscript/Code.gs` as the single Apps Script deployment source. Do not split the backend into additional `.gs` modules.
- The browser calls only Apps Script. Never put Gemini, Vision, Sheets, Drive, or other secret credentials in `src/` or public assets.
- Apps Script is the financial authority. Client calculations are previews only; server validation, authorization, idempotency, audit, and Owner confirmation remain mandatory.
- The canonical receipt design is [`docs/OCR-GEMINI-CANONICAL.md`](docs/OCR-GEMINI-CANONICAL.md). Runtime behavior, API fields, UI review, tests, and deployment docs must change together.

## Canonical OCR rules

1. Normalize one receipt image in the browser and send it to `receipts.extract` with `gardenId`.
2. When configured, Vision `DOCUMENT_TEXT_DETECTION` supplies an untrusted text transcript.
3. Gemini `gemini-3.7-flash` uses the stateless Interactions API, the image, optional Vision transcript, and one JSON Schema to classify and extract semantic fields independent of table coordinates.
4. Apps Script normalizes dates and numbers, verifies row sums, tare/net weight, DRC/dry weight, written total, and rounding, then assigns the validation score.
5. A Tapper must compare the editable fields with the image and explicitly confirm. Apps Script repeats the safety checks. An Owner must still review the evidence before confirmation.

Do not introduce coordinate templates, regex-only financial extraction, client-side AI calls, provider confidence as a financial gate, automatic Sale creation, a second receipt schema, or another model/API path without first updating the canonical document and contract tests.

## Evidence and testing

- The five images supplied on 28 August 2026 are temporary reference images, not real operational bills and not production acceptance evidence.
- Deterministic reference scenarios may use their visible example values, but must not claim that Gemini/Vision read the original pixels unless a provider smoke test actually ran.
- Never commit real receipt images or personally identifiable receipt data. Keep the private golden set outside the public repository.
- Any OCR change must cover classification, structured schema, Thai dates, multi-row/tare arithmetic, DRC arithmetic, rounding, non-receipt rejection, human verification, and server-side blocking.
