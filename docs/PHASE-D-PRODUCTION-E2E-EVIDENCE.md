# ParaWallet Phase D — Production E2E Evidence

วันที่ตรวจสอบ: 24 สิงหาคม 2026

## ขอบเขตและการอนุมัติ

ผู้ดูแลอนุมัติ controlled production E2E สำหรับสวน `garden-pahpayom-001` และรัน `runAuthorizedE2ETestOnce()` จาก Apps Script Editor ตาม runner ที่จำกัด test tag เป็น `E2E-PAHPAYOM-001` การตรวจหลักฐานหลังรันเป็น read-only และไม่มีการแก้หรือลบแถวผ่าน Google Sheets โดยตรง

## Preconditions

| Gate | Evidence | Result |
|---|---|---|
| Backend source | ผู้ดูแลรายงานว่า deploy release `2026.08.24-phase-d2` แล้ว | ผ่านตาม operator confirmation |
| Production migration | พบ `Gardens_Backup_20260824_093335`, `Buyers_Backup_20260824_093335`, `Sales_Backup_20260824_093335` และ `Settlements_Backup_20260824_093335` | ผ่าน |
| Schema | ตรวจ 22 domain sheets เทียบ `HEADERS` ใน `Code.gs`; mismatch = 0 | ผ่าน |
| Garden migration | ค่าเดิมทุก field ของ Garden ตรงกับ backup และเพิ่ม `locationText` ว่างในตำแหน่งใหม่ | ผ่าน |
| Duplicate safety | ก่อนรัน Sales, Settlements, SettlementAllocations และ WalletEntries ไม่มี data row | ผ่าน |

## Transaction evidence

| Evidence | Expected | Observed | Result |
|---|---:|---:|---|
| Active Agreement | version 3, Owner/Tapper 60/40 | version 3, 60/40, active | ผ่าน |
| Sale rows with test tag | 1 | 1 | ผ่าน |
| Sale status | confirmed | confirmed | ผ่าน |
| Weight × unit price | 100 × 60 | 100 × 60 | ผ่าน |
| Gross sale | 6,000 | 6,000 | ผ่าน |
| Buyer deductions | 100 | 100 | ผ่าน |
| Shared expenses | 50 | 50 | ผ่าน |
| Split base | 5,850 | 5,850 | ผ่าน |
| Owner share | 3,510 | 3,510 | ผ่าน |
| Tapper share | 2,340 | 2,340 | ผ่าน |
| Settlement rows with test tag | 1 | 1 | ผ่าน |
| Settlement status/method | confirmed / cash | confirmed / cash | ผ่าน |
| Settlement allocation | 1 row / 2,000 | 1 row / 2,000 | ผ่าน |
| Sale wallet entries | 2 confirmed rows | Owner credit 3,510; Tapper credit 2,340 | ผ่าน |
| Settlement wallet entry | 1 confirmed row | Owner settlement debit 2,000 | ผ่าน |
| Owner outstanding | 1,510 | 3,510 − 2,000 = 1,510 | ผ่าน |

## Audit and notification evidence

พบ audit events ที่เกี่ยวข้องครบ 5 รายการ: `agreement_created`, `sale_created`, `sale_confirmed`, `settlement_created` และ `settlement_confirmed` จำนวน AuditLogs รวมเพิ่มจาก 2 เป็น 7 แถว และ Notifications เพิ่มจาก 2 เป็น 7 แถว โดยมี event types `agreement_created`, `sale_pending_review`, `sale_confirmed`, `settlement_pending` และ `settlement_confirmed`

## Duplicate and ledger conclusion

มี Sale ที่ใช้ `E2E-PAHPAYOM-001` เพียง 1 แถวและ Settlement ที่ใช้ reference เดียวกันเพียง 1 แถว ไม่พบ duplicate mutation ยอดบัญชีสมดุล: 6,000 − 150 = 5,850 และ 3,510 + 2,340 = 5,850 ส่วนยอด Owner คงค้างหลัง Settlement เท่ากับ 1,510 บาท

## Sign-off

Controlled production E2E สำหรับ Agreement → Sale → Owner confirmation → Settlement → Owner confirmation **ผ่านครบทุก acceptance assertion** ข้อมูลทดสอบถูกเก็บไว้เป็น audit evidence และไม่ควรลบแถวโดยตรง หากต้องปรับยอดภายหลังให้ใช้ reversal/adjustment workflow ที่มี audit trail
