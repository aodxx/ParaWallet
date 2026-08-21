# Phase D — One-time E2E Runner

## วัตถุประสงค์

`runAuthorizedE2ETestOnce()` เป็นฟังก์ชันสำหรับรันทดสอบ E2E จาก Apps Script Editor โดยตรง จึงไม่ต้องใช้ browser login และไม่เปิดเป็น API action ผ่าน `doPost` ฟังก์ชันจำกัดข้อมูลไว้กับสวน `garden-pahpayom-001`, Owner `user-owner-001`, Tapper `user-tapper-001` และ test tag `E2E-PAHPAYOM-001` เท่านั้น

ธุรกรรมตัวอย่างใช้ตัวเลขที่ประกาศชัดเจนว่าเป็น test fixture: น้ำหนักสุทธิ 100 กิโลกรัม, ราคา 60 บาทต่อกิโลกรัม, หักจากผู้ซื้อ 100 บาท, ค่าใช้จ่ายร่วม 50 บาท, อัตราแบ่ง Owner/Tapper 60/40 และส่งเงินบางส่วน 2,000 บาท

| รายการ | ค่าที่คาดหวัง |
|---|---:|
| Gross sale | 6,000 บาท |
| Deductions | 150 บาท |
| Split base | 5,850 บาท |
| Owner share | 3,510 บาท |
| Tapper share | 2,340 บาท |
| Settlement | 2,000 บาท |
| Outstanding หลังยืนยัน Settlement | 1,510 บาท |

## ขั้นตอนใน Apps Script Editor

1. เปิด Apps Script project เดิมที่อยู่เบื้องหลัง Web App URL ของ ParaWallet
2. สำรอง `Code.gs` เดิมไว้ก่อน แล้วแทนที่ด้วย `appsscript/Code.gs` ฉบับล่าสุดจาก repository โดยคงสถาปัตยกรรม single-file ไว้
3. กด Save และรัน `previewAuthorizedE2ETest()` ก่อน ฟังก์ชันนี้เป็น read-only และควรแสดงสวนป่าพะยอมกับรายการที่มีอยู่ก่อนรัน
4. จากผลการทดสอบครั้งแรก หากแท็บ `Agreements` แสดงหัวตาราง legacy 12 คอลัมน์ ให้รัน `repairParaWalletAgreementSchema()` หนึ่งครั้ง ฟังก์ชันนี้ซ่อมเฉพาะกรณีที่หัวตารางขึ้นต้นด้วย legacy schema ที่รู้จัก และช่องท้ายที่เหลือเป็นค่าว่างเท่านั้น
5. รัน `previewAuthorizedE2ETest()` อีกครั้งเพื่อตรวจว่า Agreement แสดง `status=active`, `effectiveFrom` และเปอร์เซ็นต์ 60/40 อยู่ในคอลัมน์ที่ถูกต้อง
6. หาก preview ถูกต้อง ให้รัน `runAuthorizedE2ETestOnce()` เพียงครั้งเดียว แล้วอนุญาตสิทธิ์ Apps Script หากระบบร้องขอ
7. รัน `getAuthorizedE2ETestResult()` และเปิด Execution log เพื่ออ่านผลสรุป หากสำเร็จจะมีสถานะ `completed` และผลลัพธ์ถูกเก็บใน Script Properties
8. หลังบันทึก Code.gs แล้ว ให้สร้าง Web App version ใหม่ตามขั้นตอน deploy เดิมของโครงการ เพื่อให้ deployment กับ repository ตรงกัน แม้การรัน E2E จะเกิดจาก Editor โดยตรง

## การป้องกันความเสียหาย

ก่อนสร้าง Agreement หรือ Sale runner จะตรวจหัวตาราง `Agreements` ให้ตรงกับ Data Model ปัจจุบัน หากยังไม่ถูกซ่อมจะหยุดด้วย `E2E_AGREEMENTS_SCHEMA_REPAIR_REQUIRED` ฟังก์ชันนี้ไม่รับข้อมูลจาก HTTP request, ใช้ Script Lock, ตรวจสอบ Garden/Users/GardenMembers ก่อนทำรายการ, ใช้ request IDs คงที่สำหรับ test run, ตรวจสอบรายการเดิมก่อนเพิ่มซ้ำ และตั้งสถานะ `PARAWALLET_E2E_PAHPAYOM_STATUS=completed` หลังตรวจสอบหลักฐานครบเท่านั้น หากรันสำเร็จแล้ว การรันซ้ำจะหยุดด้วย `E2E_ALREADY_COMPLETED`

การคำนวณและการเปลี่ยนสถานะยังผ่าน `Services.createAgreement`, `Services.createSale`, `Services.confirmSale`, `Services.createSettlement` และ `Services.confirmSettlement` ซึ่งเป็นเส้นทางเดียวกับ backend ปกติ ไม่ใช่การเขียน Sheet โดยตรงจาก Frontend

## หลักฐานที่ต้องตรวจสอบหลังรัน

ควรพบ Sale สถานะ `confirmed`, Settlement สถานะ `confirmed`, `SettlementAllocations` รวม 2,000 บาท, `WalletEntries` ของ Sale จำนวน 2 แถว, `WalletEntries` ของ Settlement จำนวน 1 แถว และ AuditLogs อย่างน้อยสำหรับการสร้าง/ยืนยัน Agreement, Sale และ Settlement ฟังก์ชัน runner จะตรวจสอบเงื่อนไขเหล่านี้เองและหยุดทันทีหากไม่ครบ

หากเกิดข้อผิดพลาด ให้เก็บ Execution log และข้อความ error ไว้ก่อน อย่าแก้ไขหรือลบแถวทางการเงินโดยตรง ให้ตรวจสอบสถานะใน `Sales`, `Settlements`, `SettlementAllocations`, `WalletEntries` และ `AuditLogs` แล้วใช้เส้นทาง reversal/adjustment ที่ระบบกำหนดในภายหลัง
