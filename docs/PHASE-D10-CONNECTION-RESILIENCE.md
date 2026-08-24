# Phase D10 — Connection Resilience

Release: `2026.08.24-phase-d10`

## Evidence and root cause

The 91-second mobile recording `1000020257.mp4` shows a successful core dashboard response followed by a delayed failure in one of the secondary overview requests. The role changes from stale Owner UI to the authenticated Tapper response after roughly 30 seconds. Roughly 30 seconds later, the previous frontend marks the entire app disconnected even though the dashboard data remains available.

The failure had two contributing causes:

1. `refresh("overview")` used `Promise.all` for Gardens, Agreements, and Wallet. One rejected secondary request changed the global state to disconnected and hid all financial values.
2. Apps Script reread the same sheet several times within one request. `dashboard.get` calls the wallet calculation and then reads Sales, Settlements, and Notifications again, increasing mobile cold-start latency.

## D10 changes

- Network errors, invalid JSON responses, retryable HTTP failures, and retryable Apps Script envelopes are retried three times with the same Request ID.
- Secondary page models use `Promise.allSettled`; successful models are retained when another model fails.
- The UI distinguishes `degraded` from `disconnected`. A degraded connection keeps the last verified values visible and labels them as not fully updated.
- A refresh sequence prevents a slow, older response from overwriting a newer navigation result.
- Apps Script caches parsed sheet rows for the lifetime of one request and invalidates the affected cache after append or update. No data is cached between requests.

## Deployment and acceptance

1. Deploy `appsscript/Code.gs` as a new Web App version.
2. Confirm health reports `release=2026.08.24-phase-d10` and `schemaVersion=2026-08-production-v3`.
3. Open Owner once and Tapper once on the same mobile connection used in the recording.
4. Confirm the authenticated role appears without first presenting stale values as live data.
5. If a secondary read fails, confirm the banner says `ข้อมูลยังไม่ครบ`, the last verified amounts remain visible, and `ลองใหม่` resynchronizes the page.
6. Confirm no duplicate Sale, Settlement, WalletEntry, Notification, or AuditLog rows are created. Read retries are side-effect free; mutation retries retain the same Request ID and remain idempotent.

