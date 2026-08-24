# PRD Implementation Status and Deferred Gap Matrix

Updated: 24 August 2026

The PRD core is implemented through backend D10 and frontend D11. This matrix is a present-tense status record, not authorization to begin optional work.

| PRD area | Current production status | Remaining boundary |
|---|---|---|
| Authentication and garden access | Google ID-token verification, active Users, Owner/Tapper roles, and garden-scoped membership checks are implemented | Invite code/email onboarding is deferred |
| Gardens and members | Garden reads/creation plus Owner member list/add/reactivate/deactivate are implemented with audit and safety guards | Rich plot editing/archive and multi-garden switching are deferred |
| Agreements | Versioned create/list/activation, date validity, 100% split validation, and immutable Sale snapshot are implemented | Advanced editing/history presentation is deferred |
| Receipt and OCR | Garden-scoped upload, Drive evidence, OCR/manual review, confidence handling, duplicate signals, and trusted Sale linkage are implemented | Field-level immutable correction timeline is deferred |
| Sales and disputes | Create/list, Owner evidence review, confirm, dispute, adjustment, reconciliation, and audited ledger effects are implemented | Advanced filters and immutable reversal workflow are deferred |
| Dual wallets | Owner/Tapper confirmed, pending, disputed, custody, and outstanding calculations are persisted and scoped | Portfolio/multi-garden aggregation is deferred |
| Settlements | Partial bank/cash handover, slip evidence, Owner confirmation/rejection, oldest-first allocation, and balance guards are implemented | Additional payment rails are deferred |
| Pending work and notifications | Role-aware pending queue, notification list/read, event generation, refresh, and badges are implemented in D9 | Push/LINE/email delivery is deferred |
| Reports | Date filtering, financial summary rows, and CSV export are implemented | Advanced analytics and scheduled export are deferred |
| PWA and mobile UX | Owner/Tapper screens, primary actions, bottom navigation, responsive layouts, loading/error/empty states, and connection recovery are implemented | A new visual direction requires separate approval before implementation |
| Security and reliability | Server authorization, LockService, durable RequestID idempotency, schema guards, audit logs, and deterministic workflow tests are implemented | Ongoing production monitoring remains operational work |

## Current release decision

No core PRD implementation gap blocks controlled use. The only open release work is the real-device closure pass and operational monitoring listed in [`todo.md`](../todo.md). Optional expansion remains frozen by Owner instruction.

Historical gaps reported in older Phase D documents reflect the release at that time and are intentionally preserved as audit evidence.
