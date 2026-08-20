# ParaWallet Project TODO

- [x] Create GitHub Pages PWA shell with responsive Owner/Tapper dashboard
- [x] Add PWA manifest, service worker, offline shell, and GitHub Pages base-path configuration
- [x] Add frontend API client that calls Google Apps Script only and never writes Google Sheets directly
- [x] Add RequestID generation and response-envelope handling in the API client; retry policy remains a hardening item
- [x] Create Apps Script doGet/doPost router and authentication/role boundary
- [x] Create Google Sheets repositories and header/schema bootstrap for all domain tables
- [x] Create Apps Script calculator for agreement-based dual-wallet split and deductions
- [x] Add LockService transaction wrapper for sale, payment, wallet, and idempotency writes
- [x] Add RequestID idempotency repository and duplicate request response behavior
- [x] Add Google Drive receipt/slip/evidence storage adapter and metadata records
- [x] Add Gemini and Google Cloud Vision OCR adapter interfaces using PropertiesService secrets
- [x] Add initial Owner/Tapper role-scoped garden, sale, payment, and audit API operations; agreement/wallet/notification expansion remains
- [x] Add Data Model documentation for Google Sheets tabs and column contracts
- [x] Add API Contract documentation with endpoint actions, payloads, errors, and security rules
- [x] Add development phases and Apps Script-specific acceptance criteria documentation
- [x] Add clasp/appsscript deployment configuration and GitHub Pages workflow
- [ ] Add unit tests for calculations, RequestID idempotency, locking boundaries, and API validation
- [x] Run frontend build; Apps Script checks, repository tests, and final architecture review remain
