# Phase D7 — Settlement Evidence Review

Date: 24 August 2026  
Release: `2026.08.24-phase-d7`

## Outcome

Phase D7 turns settlement confirmation into an explicit evidence-review workflow for both transfer and cash handover.

- Tapper still attaches an image or PDF slip for a bank transfer and records a handover location for cash.
- The settlement list no longer exposes a raw Google Drive URL.
- `settlements.evidence` authenticates the caller, verifies garden access, verifies that the Drive file belongs to the settlement Tapper and the `settlements` evidence folder, then returns the private evidence as a data URL.
- Owner opens **ตรวจและยืนยัน** to inspect the amount, date, method, bank, reference, location, note, and transfer evidence.
- Bank transfer confirmation stays disabled until the slip loads and Owner checks **ฉันตรวจสลิปและพบยอดเงินเข้าจริงแล้ว**.
- Cash confirmation requires Owner to check **ฉันตรวจนับและได้รับเงินสดจริงแล้ว** on the Owner phone.
- Tapper can open the same read-only detail view, preserving transparency between both parties.
- Confirmation still rechecks outstanding balance and allocates oldest confirmed Sales first before writing the wallet debit and audit event.

## Security contract

1. A caller cannot fetch a slip using a Drive file ID; the API accepts only `settlementId`.
2. The backend resolves the `Settlements` row and applies garden-scoped authorization.
3. The `Files` row must match the Settlement's `slipFileId`, folder type `settlements`, and Tapper owner ID.
4. Evidence is limited to images or PDF and 4 MB.
5. A caller cannot attach an arbitrary existing Drive file ID unless it is a trusted settlement file created by the same authenticated Tapper.
6. Bank transfer confirmation is rejected if the Settlement has no slip relationship.

## API change

| Action | Input | Authorization | Result |
|---|---|---|---|
| `settlements.evidence` | `settlementId` | Active member of the Settlement garden | Private image/PDF metadata and data URL |

## Deployment and acceptance

No schema migration is required.

1. Deploy the latest `appsscript/Code.gs` as a new Web App version.
2. Confirm `health.get` reports `release=2026.08.24-phase-d7` and `schemaVersion=2026-08-production-v3`.
3. As Tapper, create a bank-transfer Settlement with an image slip smaller than 4 MB.
4. As Owner, open **การส่งเงิน → ตรวจและยืนยัน** and verify the slip plus all transfer fields are visible.
5. Verify the confirm button is disabled until the acknowledgement is checked.
6. Confirm the transfer and verify status, outstanding, allocation, WalletEntry, notification, and AuditLog.
7. Create a cash Settlement and verify Owner must acknowledge physical receipt on the Owner phone before confirmation.
8. Verify an unauthorized account cannot call `settlements.evidence` for the Settlement.

## Production acceptance evidence — bank transfer

Owner and Tapper mobile recordings `1000020250.mp4` and `1000020253.mp4` were reviewed on 24 August 2026. The attached bank slip was explicitly provided as test evidence and does not represent a real transfer.

- Owner opened the pending 1 baht bank-transfer Settlement and the private slip loaded inside ParaWallet.
- The D7.1 mobile fix kept both **ยืนยันยอดโอนแล้ว** and **ปฏิเสธรายการ** visible above the bottom navigation.
- Owner checked **ฉันตรวจสลิปและพบยอดเงินเข้าจริงแล้ว** and completed confirmation.
- The Settlement changed from **รอเจ้าของยืนยัน** to **ยืนยันแล้ว**.
- Owner outstanding changed from 1,510 to 1,509 baht.
- Tapper owner-money-held changed to 1,509 baht and owner-money-transferred changed from 2,000 to 2,001 baht.
- Tapper and Owner both displayed the same confirmed 1 baht and 2,000 baht Settlement history.

The production bank-transfer path is accepted.

## Production acceptance evidence — cash handover

Tapper and Owner mobile recordings `1000020254.mp4` and `1000020255.mp4` were reviewed on 24 August 2026.

- Tapper created a 1 baht cash Settlement without a transfer slip and supplied the handover location plus a test note.
- Owner opened **ตรวจและยืนยัน** and saw the amount, cash method, handover location, note, and the physical-receipt acknowledgement.
- The confirmation action was available only after Owner checked **ฉันตรวจนับและได้รับเงินสดจริงแล้ว**.
- The Apps Script confirmation took roughly one minute on the recorded mobile connection; the interface remained in **กำลังยืนยัน...** until the request completed and did not permit a duplicate action.
- The Settlement changed from **รอเจ้าของยืนยัน** to **ยืนยันแล้ว**.
- Owner outstanding changed from 1,509 to 1,508 baht.
- The previously confirmed 1 baht bank transfer and 2,000 baht cash handover remained unchanged.

Both production settlement methods are accepted. Phase D7 is complete.
