# ParaWallet Phase D — Sandbox E2E Verification Report

## ขอบเขตการทดสอบ

การทดสอบชุดนี้เป็น **sandbox-only controlled fixture** และไม่ได้เรียก Google Apps Script, Google Sheets, Google Drive หรือ production endpoint จึงไม่มีการเขียนข้อมูลจริงและไม่เพิ่มความเสี่ยงต่อบัญชีการเงินจริง Fixture ใช้รหัสที่ขึ้นต้นด้วย `sandbox-` และ test tag `SANDBOX-E2E-00x` อย่างชัดเจน

## Workflow ที่ทดสอบ

| ลำดับ | State transition | ผลลัพธ์ |
|---|---|---|
| 1 | Tapper creates Sale | `pending_owner_review` |
| 2 | Owner confirms Sale | `confirmed` |
| 3 | Tapper creates partial Settlement | `pending_owner_confirmation` |
| 4 | Owner confirms Settlement | `confirmed` |
| 5 | Ledger and audit reconciliation | ผ่าน |

## ผลการคำนวณ

| รายการ | ผลลัพธ์ |
|---|---:|
| Gross sale | 6,000 บาท |
| Buyer/shared deductions | 150 บาท |
| Split base | 5,850 บาท |
| Owner share 60% | 3,510 บาท |
| Tapper share 40% | 2,340 บาท |
| Partial settlement | 2,000 บาท |
| Owner outstanding หลังรับเงิน | 1,510 บาท |

## Assertions ที่ผ่าน

ชุดทดสอบตรวจสอบการคำนวณจาก `src/financial.ts`, Agreement date window, active Tapper membership, Owner-only Sale confirmation, partial allocation, Tapper income ที่ไม่ลดลงเมื่อมีการ Settlement, WalletEntries 2 แถวสำหรับ Sale, WalletEntry 1 แถวสำหรับ Settlement, Audit events 4 เหตุการณ์ และ idempotent replay ที่ไม่สร้าง Sale ซ้ำ

## Verification evidence

`pnpm verify` ผ่านทั้งหมด โดยมี Vitest 53 tests จาก 3 test files, TypeScript ผ่าน, Apps Script syntax ผ่าน และ production build ผ่าน การทดสอบนี้ยืนยัน business workflow และ contract behavior ในสภาพแวดล้อมจำลองที่ deterministic แต่ยังไม่ใช่หลักฐานว่า deployment จริงบน Google Apps Script และ Google Sheets ทำงานสำเร็จ เพราะการทดสอบ production ถูกแยกออกตามข้อจำกัดด้านสิทธิ์และความปลอดภัย

## ข้อสรุป

ระบบมี deterministic sandbox E2E harness ที่สามารถรันซ้ำใน CI ได้โดยไม่แตะข้อมูลจริง เหตุการณ์ `AGREEMENT_NOT_ACTIVE` ใน Google Sheets จริงยังเป็นปัญหาเฉพาะด้าน schema/deployment synchronization ของ production Apps Script ไม่ใช่ความล้มเหลวของ business calculation ใน harness นี้ การแก้ไข production ที่เหมาะสมควรทำผ่านการ deploy Code.gs ฉบับเดียวกับ repository และตรวจ schema แบบ read-only ก่อนสร้างธุรกรรม
