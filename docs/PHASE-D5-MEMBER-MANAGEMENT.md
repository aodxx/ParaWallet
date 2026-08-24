# Phase D5 — Owner-Controlled Tapper Membership

Date: 24 August 2026  
Release: `2026.08.24-phase-d5`

## Outcome

Owner can now open **สวนและแปลง**, see the active members of the selected garden, and add a registered Tapper by Google email. The backend resolves the email against the active `Users` row, creates or reactivates one `GardenMembers` relationship, writes an audit event with the envelope RequestID, and notifies the Tapper.

Owner can also deactivate a Tapper without deleting history. Deactivation is rejected while that Tapper still has an active Agreement, a pending/disputed Sale, a pending Settlement, or confirmed Owner money that has not been allocated through a confirmed Settlement. This prevents access revocation from hiding unfinished financial rights or obligations.

Agreement creation no longer requires Owner to type an internal Tapper ID. The form lists active Tapper members from the selected garden.

## Security decisions

| Control | ParaWallet implementation |
|---|---|
| Least privilege and deny by default | `members.list`, `members.add`, and `members.deactivate` call `requireOwner_` for the target garden. |
| Validate permission on every request | Authorization is enforced server-side after Google token verification; the PWA role check is presentation only. |
| Prevent duplicate relationships | Adding an already-active membership returns the existing row; an inactive row is reactivated rather than appended again. |
| Preserve financial history | Deactivation changes membership status to `inactive`; it never deletes Users, Sales, WalletEntries, Settlements, or AuditLogs. |
| Trace sensitive changes | Add, reactivate, and deactivate operations write `AuditLogs` with the request envelope ID and send a notification to the Tapper. |
| Serialize shared writes | Member mutations remain outside `READ_ONLY_ACTIONS_`, so they run under the existing Apps Script `ScriptLock` and durable RequestID replay handling. |
| Isolate money by Tapper | Tapper wallet balances, settlement limits, and oldest-first allocation are filtered by the same `tapperId`; one Tapper's payment cannot settle another Tapper's Sale. |

These decisions follow the [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), which recommends least privilege, deny-by-default behavior, and permission validation on every request; the [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), which recommends audit trails for data addition, modification, and deletion; and the official [Google Apps Script Lock Service](https://developers.google.com/apps-script/reference/lock), which documents locking shared-resource mutations to prevent collisions.

## API

| Action | Payload | Result |
|---|---|---|
| `members.list` | `gardenId` | Active Owner/Tapper member views with name and email; Owner only |
| `members.add` | `gardenId`, `email` | Existing, reactivated, or newly created Tapper membership; Owner only |
| `members.deactivate` | `gardenId`, `memberId` | Membership with `status=inactive`; Owner only and guarded by financial lifecycle checks |

## Deployment and acceptance

No schema migration is required because D5 uses the existing `Users`, `GardenMembers`, `Agreements`, `Sales`, `Settlements`, `SettlementAllocations`, `Notifications`, and `AuditLogs` columns.

1. Replace Apps Script `Code.gs` with the repository version and deploy a new Web App version.
2. Confirm `health.get` returns `release=2026.08.24-phase-d5` and `schemaVersion=2026-08-production-v3`.
3. Sign in as Owner, open **สวนและแปลง**, and add the registered Tapper email.
4. Confirm exactly one active `GardenMembers` row for that garden/user pair, one matching AuditLog for a new/reactivated relationship, and one Tapper notification.
5. Open **ข้อตกลง** and confirm the Tapper appears by name/email in the selector.
6. Re-add the same email and confirm no duplicate active membership row is created.
7. Attempt deactivation while an active Agreement or outstanding balance exists and confirm the operation is rejected with a clear Thai message.
8. If the garden has two Tappers, create confirmed Sales for both and verify each Settlement allocates only to Sales with the matching `tapperId`.

## Limitations and next slice

D5 adds an existing registered Tapper; it does not create a new `Users` account or email an external invitation. A future invite-code/email onboarding flow should use a separate pending-invitation record and explicit acceptance before granting garden access.
