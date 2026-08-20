# ParaWallet Development Roadmap and Acceptance Criteria

## Phase 1 — Foundation

Create the Sheets tabs and header bootstrap, configure Script Properties, deploy a health endpoint, and publish the PWA shell. Acceptance requires that a new Apps Script deployment can bootstrap all tabs without duplicate headers, the PWA installs from GitHub Pages, and `health.get` returns a valid response envelope.

## Phase 2 — Identity and garden access

Register users, define Owner/Tapper membership, and apply garden-scoped authorization to every read and write. Acceptance requires an Owner to see owned gardens, an active Tapper to see only assigned gardens, and unauthorized IDs to return an error without changing Sheets.

## Phase 3 — Agreements, sales, and dual wallet

Implement versioned agreements and the server-side calculator. Acceptance requires percentages to total 100, deductions to reduce the split base, owner and Tapper shares to balance exactly, and a historical sale to retain the agreement snapshot used when it was created.

## Phase 4 — Payments and auditability

Implement partial payments, confirmation, disputes, wallet movements, notifications, audit logs, and RequestID idempotency. Acceptance requires a repeated RequestID to produce one write, concurrent requests to serialize under LockService, confirmations to notify the sender, and every state transition to have an audit event.

## Phase 5 — Evidence and OCR

Store receipt/slip/evidence files in Drive and persist only Drive metadata in Sheets. Run OCR through the configured Gemini or Vision adapter. Acceptance requires no API key in frontend assets, low-confidence results to enter `needs_review`, editable fields to be available before sale creation, and the original Drive file to remain traceable.

## Phase 6 — Reporting and release

Add dashboard summaries, date-range reports, CSV export, offline shell behavior, deployment documentation, and automated build checks. Acceptance requires `pnpm build` to pass, GitHub Pages to serve the PWA at its repository base path, Apps Script responses to match the documented envelope, and the final checklist to cover role scope, lock boundaries, RequestID, Drive metadata, and secret storage.
