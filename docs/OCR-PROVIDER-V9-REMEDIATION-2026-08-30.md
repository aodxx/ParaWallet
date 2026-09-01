# OCR provider v9 remediation

Date: 30 August 2026

> Historical source milestone: v9 was merged but not deployed. Its protections are included in `2026.09.01-ocr-provider-v10`, which supersedes v9 as the next deployment target and adds an editor-only provider self-test.

## Production evidence

The first authenticated Tapper receipt smoke test against backend `2026.08.30-ocr-provider-v8` accepted and displayed the image, blocked financial submission, and returned provider warnings equivalent to Vision HTTP 401 and Gemini HTTP 404. The screen incorrectly described the configured provider failure as an unopened service.

An Owner diagnostics check confirmed that both provider properties existed, while the value stored in `GEMINI_MODEL` was not a model identifier. The raw value is intentionally not recorded here. Because v8 returned the configured model value in unauthenticated diagnostics, any credential ever placed in that property must be treated as exposed and revoked.

## Root causes and corrective actions

| Finding | Root cause | v9 correction | Operator action |
|---|---|---|---|
| Gemini HTTP 404 | `GEMINI_MODEL` contained a credential-like value instead of a supported model ID | `Code.gs` accepts only the pinned `gemini-3.7-flash`; every other property value is ignored without echoing it | Delete `GEMINI_MODEL` or set it exactly to `gemini-3.7-flash` |
| Vision HTTP 401 | Optional Vision credential was rejected | Provider errors are labeled separately and Vision state is no longer reported as not configured after a failed request | Delete the Vision property unless Vision is intentionally provisioned; otherwise rotate and verify it separately |
| Misleading Thai status | Frontend inferred “not configured” from warning combinations before honoring `provider_error` | Only the explicit `not_configured` state shows “ระบบอ่านบิลยังไม่ได้เปิดใช้งาน” | Deploy the new frontend build |
| Secret exposure risk | Public v8 diagnostics returned the configured model value verbatim | v9 diagnostics is Owner-authenticated and returns only the safe effective model plus a validation status | Revoke any credential ever pasted into `GEMINI_MODEL` |

## Required deployment order

1. Revoke the exposed/misplaced credential. Never paste a replacement into chat, GitHub, logs, screenshots, or `GEMINI_MODEL`.
2. Store the replacement only as `GEMINI_API_KEY` in Apps Script Script Properties.
3. Remove `GEMINI_MODEL`, allowing the pinned code default, and remove the invalid optional Vision key.
4. Copy the complete `appsscript/Code.gs`, save it, and create a new Apps Script Web App version.
5. Confirm public health reports release `2026.08.30-ocr-provider-v9` and schema `2026-08-production-v3`.
6. Sign in as Owner and confirm diagnostics reports the pinned model, no configuration issues, and `financialSchemaReady=true`.
7. Sign in as Tapper and scan one authorized receipt. Acceptance requires reviewable fields and no Gemini HTTP 400/401/404 warning. Tapper confirmation and Owner review remain mandatory.

The v8 smoke test is recorded as a safe failure, not an OCR accuracy pass. No Sale may be created from this evidence.
