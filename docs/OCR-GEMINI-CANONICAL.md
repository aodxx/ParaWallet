# Canonical OCR + Gemini architecture

Current deployed backend release: `2026.08.30-ocr-provider-v8`
Next deployment target: `2026.09.01-ocr-provider-v10` (includes the undeployed v9 protections and adds a safe pre-deployment provider self-test)
Schema: `2026-08-production-v3` — no Google Sheets migration

This document is the only current design for ParaWallet receipt scanning. Historical OCR notes do not override it.

## Reliability definition

No OCR or multimodal model can guarantee every handwritten digit in every photo. For ParaWallet, “100%” means **financial safety**, not 100% automatic character recognition: uncertain data must never become a financial Sale without deterministic checks and explicit human verification.

The five images supplied on 28 August 2026 are temporary reference images because no real operational bills were available. They help define expected layouts and calculations, but they do **not** prove provider-level image accuracy or production readiness.

## One production pipeline

| Stage | Canonical behavior | Authority |
|---|---|---|
| Capture | Accept one image, apply EXIF rotation, resize/compress to JPEG, show the image being reviewed | PWA |
| Text evidence | Run Vision `DOCUMENT_TEXT_DETECTION` when configured; treat its transcript as untrusted supporting evidence | Apps Script |
| Semantic extraction | Send the image plus optional transcript to pinned `gemini-3.7-flash` through the stateless Interactions API at `POST /v1beta/interactions`, with `store=false` and one JSON Schema | Apps Script |
| Normalization | Normalize Thai digits/dates, weight rows, gross/tare/net, DRC/dry weight, price, written total, and explicit deductions | Apps Script |
| Validation | Score completeness and verify equations independently of model confidence; reject blank templates, promotional examples, unrelated images, unreadable receipts, and unknown receipt types | Apps Script |
| Tapper review | Display the source image and editable fields; any edit clears the confirmation; require an explicit image check | PWA + Apps Script |
| Financial write | Recalculate on the server, run duplicate checks, bind Receipt→Drive file→Sale, and create only `pending_owner_review` | Apps Script |
| Final review | Owner reviews the private receipt evidence and calculated split before confirmation | Apps Script workflow |

Vision failure does not authorize a weaker path: Gemini may still extract from the image, but human review remains mandatory. Gemini failure may return Vision text only for manual review; it must not create a scanned Sale automatically.

## Canonical schema and receipt families

The schema classifies `documentClass` first, then extracts one of two layout-independent receipt families:

- `weigh_ticket`: one or many weight rows, gross weight, basket/container tare, net/payable weight, unit price, written total, and explicit deductions.
- `rubber_form`: fresh latex weight, DRC percentage, dry weight, unit price, written total, and explicit deductions.

Product type is normalized to `น้ำยางสด`, `ขี้ยาง`, `ยางแผ่น`, or a human-selected value. Missing or unreadable values are `null`/empty and listed in `uncertainFields`; the model must never invent digits.

The written total remains evidence. The server compares it with the calculated amount and accepts only normal shop rounding within `1.01` baht. A positive round-down difference is included in buyer deductions so the wallet split equals the amount actually written.

## Team rules

- There is one runtime AI entry point: `OCR` inside `appsscript/Code.gs`.
- There is one model: `gemini-3.7-flash`, pinned in `Code.gs`. `GEMINI_MODEL` may be empty or contain that exact value; every other value is ignored and reported as `GEMINI_MODEL_PROPERTY_INVALID_IGNORED`. Never place credentials in a model property or use floating aliases such as `latest`.
- The browser never calls Gemini/Vision and never owns OCR scoring or financial validation.
- Do not add fixed-coordinate templates, store-specific parsers, regex-only extraction, or a second JSON shape. New layouts are supported by semantic fields and reference scenarios.
- Provider output is evidence, not truth. Provider confidence alone cannot unlock saving.
- Every contract change updates `Code.gs`, `src/ocr.ts`, the review UI, this document, and tests in the same pull request.

## Reference scenarios — not real-bill acceptance

Do not commit the supplied images because they include names and phone numbers. The deterministic tests use only visible example values:

| Reference | Expected classification | Compatibility expectation |
|---|---|---|
| Blank fresh-latex form | `blank_template` | Block Sale creation |
| Product advertisement/sample collage | `promotional_example` | Block Sale creation and never combine sample receipts |
| Blank table form | `blank_template` | Block Sale creation |
| Two-row example ticket | `rubber_receipt` + `weigh_ticket` | Rows `175, 149`; total `324`; price `29`; written total `9,396` |
| Multi-row example cash bill | `rubber_receipt` + `weigh_ticket` | 11 rows total `448.5`; tare `17`; net `431.5`; price `27`; written total `11,650`; rounding delta `0.50` |

A separate rubber-form reference scenario uses fresh weight `99`, DRC `49%`, dry weight `48.51`, price `99`, and written total `4,802`.

These scenarios verify normalization, equations, and safety gates. They do not assert that a provider read the attached pixels.

## Real-bill rollout gate

Until real receipts exist, deploy only in controlled review mode: no OCR result bypasses Tapper confirmation or Owner review. Production recognition is “not yet certified.”

Build a private, consented golden set outside GitHub as real bills become available. Before calling recognition production-ready, test at least 30 real receipts covering all three product types, multiple buyers/layouts, one-row and multi-row tickets, tare, DRC, faint handwriting, skew, folds, shadows, and low light. Record field-level expected values and retain failures as regression cases.

Required release evidence:

1. `pnpm verify` passes.
2. Before deployment, editor-only `testGeminiProviderConnection()` reports `ok=true`, `model=gemini-3.7-flash`, `imageInput=true`, `structuredOutput=true`, and `code=GEMINI_CONNECTION_OK` without writing Sheets/Drive or exposing provider data.
3. After v10 deployment, `health.get` reports release `2026.09.01-ocr-provider-v10` and schema `2026-08-production-v3`.
4. Owner-authenticated `diagnostics.get` reports `ocr.automaticReadingReady=true`, `ocr.model=gemini-3.7-flash`, and no configuration issues; otherwise the UI must offer manual entry.
5. Diagnostics reports `financialSchemaReady=true`.
6. Provider smoke tests confirm the receipt image path and `store=false` behavior; optional Vision is tested only when intentionally provisioned.
7. Every real-bill mismatch is caught by the review/validation gate; no unverified Sale is written.
8. Created test Sales remain `pending_owner_review` and controlled test records are cleaned using the audited test procedure.
