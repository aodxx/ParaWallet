# Phase D8 — Settlement Confirmation Performance

Date: 24 August 2026  
Release: `2026.08.24-phase-d8`

## Reason

The D7 production cash-handover test completed correctly, but the Owner recording showed the confirmation request remaining in **กำลังยืนยัน...** for roughly one minute. The final state and wallet balance were correct, so D8 targets request latency without changing settlement rules or financial results.

## Changes

- Cache the Spreadsheet handle for one Apps Script request instead of calling `SpreadsheetApp.openById()` for every sheet access.
- Reset that cache at the beginning of every `doPost` execution so a reused V8 isolate cannot carry request state forward.
- Read `SettlementAllocations` and confirmed `Adjustments` once before the oldest-first allocation loop.
- Build the per-sale Owner adjustment map once instead of rereading Adjustments for every Sale.
- Return the already known confirmed Settlement object instead of rereading the Settlements sheet after all writes.

The global Script Lock, durable RequestID idempotency, schema preflight, outstanding-balance check, oldest-first allocation, WalletEntry, AuditLog, Notification, and final `SpreadsheetApp.flush()` remain unchanged.

## Deployment

No schema migration is required.

1. Replace Apps Script `Code.gs` with the repository version.
2. Save and deploy a new Web App version.
3. Confirm `health.get` reports `release=2026.08.24-phase-d8` and `schemaVersion=2026-08-production-v3`.
4. Create one 1 baht cash Settlement or bank-transfer Settlement in the test garden.
5. Confirm it once from the Owner phone and verify the status becomes **ยืนยันแล้ว** and outstanding decreases exactly 1 baht.
6. Record the approximate time from tapping confirm until the list refreshes. If it still exceeds 20 seconds, capture the video and Apps Script execution duration for the same request time.
