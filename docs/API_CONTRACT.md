# ParaWallet Apps Script API Contract

All requests are JSON POST bodies to the deployed Web App URL. Apps Script returns a JSON envelope with `status`, `requestId`, and either `data` or an `error` object. The frontend never calls Google Sheets or Drive directly.

| Action | Method | Payload | Mutation |
|---|---|---|---|
| health.get | POST | none | No |
| dashboard.get | POST | none | No |
| gardens.list | POST | none | No |
| sales.create | POST | gardenId, agreementId, saleDate, productType, weightKg, unitPrice, deductions | Yes |
| payments.create | POST | gardenId, saleId?, toUserId, amount, method, reference, paidAt | Yes |
| payments.confirm | POST | paymentId | Yes |
| receipts.extract | POST | data, mimeType, filename | Yes: Drive + OCR records |

A successful response has the following shape:

```json
{"status":"ok","requestId":"2026-...","data":{}}
```

An error response has the following shape:

```json
{"status":"error","requestId":"2026-...","error":{"code":"REQUEST_ID_REQUIRED","message":"requestId is required"}}
```

Every mutation is validated server-side. Apps Script checks the authenticated user, role, garden membership, agreement ownership, and allowed state transition before entering a `LockService` critical section. It then checks the RequestID record/cache. If the RequestID already exists, the original response is returned and no Sheet or Drive write occurs.
