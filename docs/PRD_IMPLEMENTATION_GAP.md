# PRD Implementation Gap Matrix

The repository currently has a working PWA shell, a single-file Apps Script foundation, Google Sheets schema bootstrap, Drive/OCR adapters, RequestID handling, and a basic dashboard. The following matrix is the implementation order for the remaining PRD scope.

| PRD area | Current state | Next implementation |
|---|---|---|
| Authentication and pairing | Google token authentication, registered Users, and Owner-controlled garden membership are implemented | Add optional pending invite-code/email onboarding for people not yet registered |
| Garden and plot management | Garden/plot create/list plus Owner member add/deactivate are implemented | Add garden/plot edit and archive UI with safe historical guards |
| Agreements | Header exists but no API/UI CRUD | Add versioned agreement create/activate/read with immutable sale snapshot |
| Products and buyers | Not implemented | Add product type and buyer repositories plus sale references |
| Receipt/OCR | Garden-scoped image upload, OCR review, Receipt-to-Sale binding, confidence, and authorized receipt display are implemented | Add immutable field-by-field correction revisions and optional receipt timeline |
| Sales | Create/list, duplicate signals, evidence review, confirm, dispute, adjustment, and reconciliation are implemented | Add dedicated filters/detail history and immutable reversal workflow |
| Dual wallets | Dashboard fallback metrics only | Add wallet entries, confirmed/pending/disputed aggregation, owner custody, and traceability |
| Settlements | Basic payment append only | Add cash/bank fields, partial allocation oldest-first, confirmation, rejection, and balance prevention |
| Notifications and audit | Basic audit append; no complete query lifecycle | Add event creation, list/read, dispute/settlement notifications, and timeline queries |
| Reports | No backend report action | Add daily/monthly/custom aggregation and CSV-ready rows |
| PWA screens | Dashboard shell only | Add route-like screen state for gardens, agreements, sales, OCR review, wallet, settlement, notifications, and reports |
| Security and reliability | Lock wrapper and cache idempotency exist | Add server permission checks, durable request records, immutable confirmed rules, and workflow tests |

The next development slice prioritizes server-side domain contracts and calculations before expanding the PWA screens. This preserves the PRD rule that Apps Script is the source of truth and the browser is a presentation/client layer.
