# ParaWallet Apps Script API Contract

All requests are JSON POST bodies sent to the deployed Google Apps Script Web App URL. The frontend never writes Google Sheets or Google Drive directly. Apps Script is the source of truth for authentication boundaries, permissions, calculations, locking, idempotency, audit, and state transitions.

## Request and response envelope

```json
{
  "action": "sales.create",
  "requestId": "uuid-or-client-generated-id",
  "authToken": "optional-approved-session-token",
  "payload": {}
}
```

Successful responses use:

```json
{"status":"ok","requestId":"...","data":{}}
```

Errors use:

```json
{"status":"error","requestId":"...","error":{"code":"CODE","message":"Human-readable message"}}
```

Every mutation must include a unique `requestId`. A repeated RequestID returns the cached original response and must not append a second Sheet row or create a second Drive file.

`health.get` and `diagnostics.get` include non-secret `release` and `schemaVersion` fields. Operators must compare them with the repository release before enabling financial mutations; `status=ok` alone proves only that the endpoint responds.

## Action contract

| Action | Required payload | Role / scope | Mutation |
|---|---|---|---:|
| `health.get` | none | public health check | No |
| `dashboard.get` | none | authenticated user | No |
| `gardens.list` | none | Owner/member gardens | No |
| `gardens.create` | name, location/area fields | Owner | Yes |
| `gardens.update` | gardenId plus editable fields | Garden Owner | Yes |
| `plots.list` | gardenId | Garden member | No |
| `plots.create` | gardenId, name | Garden Owner | Yes |
| `members.list` | gardenId | Garden Owner | No |
| `members.add` | gardenId, registered Tapper email | Garden Owner | Yes: membership/audit/notification |
| `members.deactivate` | gardenId, memberId | Garden Owner; no open agreement/items/balance | Yes: status/audit/notification |
| `agreements.list` | gardenId | Garden member | No |
| `agreements.create` | gardenId, tapperId, percentages, effectiveFrom | Garden Owner | Yes |
| `products.list` | none | Authenticated user | No |
| `buyers.list` | gardenId | Garden member | No |
| `receipts.extract` | gardenId, base64 image data, mimeType, filename | Active Tapper in garden | Yes: Drive/Receipt/OCR/audit |
| `sales.create` | gardenId, agreementId, saleDate, product, weight, price | Tapper | Yes: sale/wallet/audit/notification |
| `sales.list` | gardenId, optional filters | Garden member | No |
| `sales.receipt` | saleId | Authorized garden member | No: reads Sale-bound private Drive image |
| `sales.confirm` | saleId | Garden Owner | Yes: status/wallet/audit/notification |
| `sales.dispute` | saleId, reason, optional note/evidence | Garden member | Yes: dispute/status/audit/notification |
| `wallets.me` | gardenId | Garden member | No |
| `settlements.create` | gardenId, amount, method; bank transfer requires slipData/slipFileId, cash requires location | Tapper | Yes: Drive evidence/settlement/audit/notification |
| `settlements.confirm` | settlementId | Garden Owner | Yes: status/audit/notification |
| `payments.create` | gardenId, amount, method, recipient fields | Garden member | Yes |
| `payments.confirm` | paymentId | Garden Owner | Yes |
| `notifications.list` | none | Current user | No |
| `notifications.read` | notificationId | Notification owner | Yes |
| `reports.summary` | gardenId, from, to | Garden member | No |

## Apps Script setup actions

These are editor-only functions and are not exposed as unauthenticated Web App actions:

```javascript
setupParaWalletSheets();
validateParaWalletSheets();
previewParaWalletProductionSchemaRepair();
repairParaWalletProductionSchema();
```

`setupParaWalletSheets()` creates missing tabs and writes the exact Data Model headers. If an existing tab has a different header order, it fails with `SCHEMA_MISMATCH:<tab>` rather than overwriting data.

`previewParaWalletProductionSchemaRepair()` is read-only. `repairParaWalletProductionSchema()` accepts only the explicitly known legacy headers for Agreements, Gardens, Buyers, Sales, and Settlements, copies every changed sheet to a timestamped backup, semantically maps the existing rows, and refuses any unexpected schema.

## Security and transaction boundary

Every authenticated action must resolve a registered user, verify garden ownership or active membership, enforce the role-specific permission, validate the state transition, and then enter a `LockService` critical section for writes. File bytes go to Drive, while Sheets store metadata and references only. API keys remain in Apps Script `PropertiesService`.

Bank-transfer settlements store the uploaded slip in the configured Drive evidence folder and persist only `slipFileId` in the Settlements row and audit event. Cash settlements remain `pending_owner_confirmation` until the Owner explicitly confirms receipt on their device; only then are allocations and wallet debits written.

The current repository is an architecture-ready MVP scaffold. Before production, the placeholder token/email resolver in `Auth.requireUser()` must be replaced by an approved identity provider and the remaining state-specific permission tests must be completed.
