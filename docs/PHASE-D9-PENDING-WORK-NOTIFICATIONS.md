# Phase D9 — Pending Work and Notifications

Date: 24 August 2026  
Release: `2026.08.24-phase-d9`

## Production evidence behind the fix

The previously supplied Owner and Tapper recordings were reviewed again. They showed two gaps that were not covered by D7 acceptance:

- Owner Dashboard displayed **0 รายการ** while a 1 baht Settlement was visibly in **รอเจ้าของยืนยัน**.
- Notification rows existed for the Tapper, but the header and bottom navigation had no unread count. Tapping a row only changed `readAt` with a subtle opacity change and did not open the related workflow.

## Changes

- Dashboard now counts role-scoped pending Sales and pending Settlements separately and exposes their sum as `pendingReviews`.
- Owner sees an explicit **งานที่ต้องทำ** section with buttons for Sale review and Settlement confirmation.
- Tapper sees the same pending total described as items waiting for Owner confirmation.
- Desktop navigation, mobile bottom navigation, and the top bell show separate badges for pending Sales, pending Settlements, and unread notifications.
- Notification API responses include a derived `targetScreen` based on the existing notification type, so no schema migration is required.
- Tapping a notification marks it read, decrements the unread badge immediately, and opens Sales, Settlements, Gardens, or Agreements as appropriate.
- Reading an already-read notification is idempotent.

## Deployment and acceptance

No schema migration is required.

1. Deploy the latest `appsscript/Code.gs` as a new Web App version.
2. Confirm health reports `release=2026.08.24-phase-d9` and `schemaVersion=2026-08-production-v3`.
3. Sign out and sign in once on both phones after deployment.
4. As Tapper, create a 1 baht cash Settlement.
5. On Owner Dashboard verify **งานรอตรวจสอบ = 1**, **การส่งเงินรอยืนยัน = 1**, the Wallet badge is `1`, and the bell/notification badge increases.
6. Open the notification and verify it becomes read and navigates to **การส่งเงิน**.
7. Confirm the Settlement and return to Owner Dashboard; all pending Settlement counters must return to `0` and outstanding must decrease exactly 1 baht.
8. On Tapper, verify the confirmation notification appears unread; tapping it must open **การส่งเงิน** and mark it read.
