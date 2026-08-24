# Phase D6 — Sale Evidence Review

Date: 24 August 2026  
Release: `2026.08.24-phase-d6`

## Outcome

Phase D6 makes receipt evidence part of the Sale confirmation contract instead of an optional UI hint.

- `receipts.extract` now requires the target `gardenId`, validates active Tapper membership, accepts image files only, enforces the 4 MB limit, and normalizes a Data URL to raw base64 before Gemini/Vision OCR.
- The PWA persists both `receiptId` and `receiptFileId` returned by OCR and sends them when creating the Sale.
- The backend derives the Drive file and OCR confidence from the trusted `Receipts` row. A scanned Sale cannot be created without a Receipt owned by the authenticated Tapper, and mismatched receipt/file IDs are rejected.
- `sales.receipt` returns the receipt image only after authenticating the user and verifying access to the Sale's garden. Raw Drive links are not exposed and Drive files do not need public sharing.
- Owner opens **ตรวจและยืนยัน**, views the image, calculation details, deductions, split base, Owner/Tapper shares, and Agreement reference, then checks an explicit review acknowledgement before confirmation is enabled.
- Manual Sales remain supported, but the review screen clearly states that no receipt image exists.

## Authorization and data flow

1. Tapper captures an image in the PWA.
2. `receipts.extract` verifies Tapper membership for the supplied garden before storing the file and Receipt/OCR metadata.
3. `sales.create` resolves the Receipt by ID, verifies `createdBy`, derives its file ID/confidence, and stores the Sale relationship.
4. Owner or active garden member opens a Sale.
5. `sales.receipt` resolves the file only through that Sale and verifies garden access before returning an image data URL.
6. Only Owner can call `sales.confirm`; the server rechecks status and ledger equality before confirming WalletEntries.

## API changes

| Action | Change |
|---|---|
| `receipts.extract` | Adds required `gardenId`; validates image type/size and active Tapper membership |
| `sales.create` | Scanned mode requires `receiptId`; derives trusted `receiptFileId` and OCR confidence |
| `sales.receipt` | New authenticated read action returning the Sale-bound receipt image |

## Deployment and acceptance

No schema migration is required. D6 uses the existing `Receipts`, `Files`, `OcrRecords`, and Sales receipt columns.

1. Deploy the latest `appsscript/Code.gs` as a new Web App version.
2. Confirm `health.get` reports `release=2026.08.24-phase-d6` and `schemaVersion=2026-08-production-v3`.
3. As Tapper, scan one non-production test receipt and verify OCR review opens without `GARDEN_NOT_FOUND`.
4. Correct the fields and create the Sale. Confirm the Sales row contains both `receiptId` and `receiptFileId`.
5. As Owner, open **รายการขาย → ตรวจและยืนยัน**. Confirm the receipt image and all calculation fields are visible.
6. Confirm the button remains disabled until the acknowledgement is checked.
7. Confirm the Sale and reconcile its WalletEntries and AuditLog RequestID.
8. Verify another garden or unregistered account cannot retrieve the receipt.

## Known limitation

D6 presents the stored receipt image and final reviewed Sale values. It does not yet store field-by-field OCR corrections as a separate immutable revision record; that remains a future evidence-lifecycle enhancement.

## Production acceptance evidence

Owner mobile screen recording `1000020247.mp4` was reviewed on 24 August 2026 after the D6 deployment.

- Owner dashboard loaded the production garden and existing balances.
- **รายการขาย** loaded the confirmed E2E Sale for 6,000 baht.
- **ดูรายละเอียด** opened the D6 review modal on mobile.
- The legacy manual-entry path correctly displayed **ไม่มีภาพใบเสร็จ** without failing or mutating the Sale.
- The calculation remained consistent: gross 6,000; buyer deduction 100; shared expense 50; split base 5,850; Owner 3,510; Tapper 2,340.
- The Sale remained **ยืนยันแล้ว** while the modal was opened repeatedly, confirming that review is read-only after confirmation.
