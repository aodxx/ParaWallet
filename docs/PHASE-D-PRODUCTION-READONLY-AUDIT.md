# ParaWallet Phase D — Production Read-only Audit

## Post-deployment verification — 24 สิงหาคม 2026

ตรวจสอบหลังผู้ดูแล deploy backend และเรียก migration แล้ว โดยการตรวจครั้งนี้เป็น read-only และไม่สร้าง Sale, Settlement หรือรายการกระเป๋าเงินใด ๆ

| Gate | หลักฐานจาก Spreadsheet จริง | ผล |
|---|---|---|
| Backup before migration | พบชีต `Agreements_Backup_20260824_085715` ซึ่งเก็บ legacy header 12 คอลัมน์และข้อมูล Agreement เดิม 2 แถว | ผ่าน |
| Agreements schema | `Agreements` มี canonical header 16 คอลัมน์ตาม `Code.gs` | ผ่าน |
| Semantic row mapping | ค่า id, garden, คู่สัญญา, version และสัดส่วน 60/40 ตรงกับ backup; ฟิลด์ legacy ท้ายแถวถูกย้ายไปตำแหน่ง canonical โดยไม่เลื่อนความหมาย | ผ่าน |
| Production financial safety | `Sales`, `Settlements`, `SettlementAllocations` และ `WalletEntries` ยังมีเฉพาะ header | ผ่าน |
| Garden membership | สวน `garden-pahpayom-001` มี Owner และ Tapper membership สถานะ active | ผ่าน |
| Backend fingerprint | ยังอ่าน live health response หลัง deploy ไม่ได้จากสภาพแวดล้อมตรวจสอบ จึงยังไม่ยืนยัน `release=2026.08.24-phase-d1`, `schemaVersion=2026-08-agreements-v2` และ `financialSchemaReady=true` | รอยืนยัน |

ดังนั้น migration และ data-safety gate ผ่านแล้ว แต่ยังไม่ควรเริ่ม controlled production E2E จนกว่า live health/diagnostics fingerprint จะตรงกับ release ที่คาดไว้ และต้องได้รับอนุมัติแยกต่างหากก่อนสร้างธุรกรรมจริง

## ขอบเขต

การตรวจสอบครั้งนี้อ่านข้อมูลจาก Google Spreadsheet จริงเท่านั้น ไม่มีการแก้ไขหรือลบแถวใด ๆ และไม่มีการสร้างธุรกรรมเพิ่ม ตรวจเฉพาะสวน `garden-pahpayom-001` และข้อมูลที่เกี่ยวข้องกับ E2E test tag `E2E-PAHPAYOM-001`

## ผลตรวจสอบ

| พื้นที่ | ผลการอ่าน | สถานะ |
|---|---|---|
| Agreements | พบ 2 แถวของสวนเดียวกัน เวอร์ชัน 1 และ 2 ทั้งคู่มีข้อมูล 60/40 แต่ header ยังเป็น legacy 12 คอลัมน์และมีช่องว่างท้าย | ต้องซ่อม schema ผ่าน Apps Script |
| Sales | มีเฉพาะ header ไม่มีแถวธุรกรรม | ปลอดภัย ไม่มี Sale E2E สำเร็จ |
| Settlements | มีเฉพาะ header ไม่มีแถวธุรกรรม | ปลอดภัย ไม่มี Settlement E2E สำเร็จ |
| SettlementAllocations | มีเฉพาะ header ไม่มีแถวจัดสรร | ปลอดภัย |
| WalletEntries | มีเฉพาะ header ไม่มีรายการบัญชี | ปลอดภัย |
| AuditLogs | พบ `agreement_created` 2 เหตุการณ์จากการรันที่หยุดก่อนสร้าง Sale | ต้องเก็บไว้เป็น audit evidence ห้ามลบโดยตรง |
| Apps Script GET health | ตอบ `status=ok` | ผ่าน |
| Apps Script POST diagnostics | redirect กลับไปหน้าที่อ่านผลไม่ได้จาก sandbox | ยังไม่ยืนยัน diagnostics |

## ข้อสรุปด้านความปลอดภัย

ไม่มีหลักฐานว่ามี Sale, Settlement, SettlementAllocation หรือ WalletEntry จริงถูกสร้างจากการรันที่ล้มเหลว มีเพียง Agreement ทดสอบ 2 แถวและ AuditLogs ที่เกี่ยวข้อง การลบหรือแก้แถวเหล่านี้โดยตรงด้วย Google Sheets CLI จะข้าม Apps Script audit/authorization boundary จึงไม่ดำเนินการ

การจัดระเบียบที่ปลอดภัยคือซิงค์ `Code.gs` ล่าสุดเข้า Apps Script project แล้วใช้ `repairParaWalletAgreementSchema()` ซึ่งตรวจเฉพาะ legacy header ที่รู้จัก จากนั้นตรวจ preview แบบ read-only และกำหนด Agreement เวอร์ชันที่ต้องการให้ active ผ่าน Apps Script เท่านั้น หากไม่ต้องการให้ผู้ใช้รัน Editor ต่อ ควรถือ sandbox E2E เป็นผลทดสอบหลักและปล่อย production rows เหล่านี้เป็น audit evidence ที่ยังไม่มีธุรกรรมการเงิน

## สถานะ deployment

GET health ของ Web App URL ที่บันทึกไว้ตอบ `parawallet-appsscript` และ `status=ok` แต่ยังไม่มีหลักฐานเพียงพอว่า deployment ที่ตอบอยู่เป็น Code.gs commit ล่าสุด เพราะ Apps Script Web App ไม่เปิดเผย source revision ผ่าน health response และ POST diagnostics ไม่สามารถอ่าน response ได้จาก sandbox redirect flow

## คำแนะนำ

ไม่ควรสร้างธุรกรรมจริงเพิ่มใน Spreadsheet นี้จนกว่าจะยืนยัน schema และ deployment synchronization ได้ หากต้องการทดสอบ workflow ต่อโดยไม่ใช้ Editor ให้ใช้ sandbox harness ใน `tests/e2e-sandbox.test.ts` ซึ่งผ่าน 53 tests และไม่แตะข้อมูลจริง
