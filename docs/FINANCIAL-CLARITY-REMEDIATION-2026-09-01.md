# แผนแก้ไขความชัดเจนทางการเงินและ UX

วันที่ตรวจ: 1 กันยายน 2026  
ขอบเขต: Google Sheet `ยางพารา`, หน้าคนกรีด, หน้าจอเจ้าของสวน และ Apps Script

## ข้อสรุปจากการตรวจ

สูตรคำนวณในข้อมูลปัจจุบันสมดุลทุกจุด:

- ยอดขาย 6,000 − ค่าใช้จ่าย 150 = ฐานแบ่ง 5,850; เจ้าของ 3,510 และคนกรีด 2,340
- ยอดขาย 9,396; เจ้าของ 5,637.60 และคนกรีด 3,758.40
- ส่วนแบ่งเจ้าของสะสม 9,147.60 − รับเงินยืนยันแล้ว 7,002 = คงเหลือ 2,145.60
- `SettlementAllocations` จัดสรรยอดส่งเงินเข้าบิลเก่าสุดก่อนและผลรวมตรงกับ Settlement

อย่างไรก็ตาม ยอดทั้งหมดเป็นข้อมูล E2E/ภาพอ้างอิง/การทดสอบกระบวนการ ไม่ใช่ยอดจากบิลจริง จึงห้ามแสดงรวมเป็นยอดเงินจริงหลังเปิดใช้งาน

## ลำดับแก้ไข 7 ขั้น

| ลำดับ | ความบกพร่อง | วิธีแก้ | เกณฑ์รับงาน |
|---:|---|---|---|
| 1 | Spreadsheet ใช้เขตเวลา Fiji และโค้ดบางจุดใช้วัน UTC | ตั้ง Sheet/Apps Script เป็น `Asia/Bangkok`; ส่งวันที่ธุรกิจเป็น `YYYY-MM-DD`; frontend สร้าง “วันนี้” ตามกรุงเทพฯ | วันที่ในบิล ข้อตกลง รายงาน และการส่งเงินไม่เลื่อนหนึ่งวัน โดยเฉพาะเวลา 00:00–06:59 น. |
| 2 | ข้อมูลทดสอบปนยอดเงินจริง | เพิ่ม `dataMode=production/test`; สำรองชีตก่อน migration; ติดป้ายข้อมูลเดิมทั้งหมดเป็น `test`; กระเป๋า รายงาน รายการ และแจ้งเตือนนับเฉพาะ `production` | หลัง migration ยอดจริงเริ่มที่ศูนย์ ข้อมูลเดิมยังอยู่และตรวจย้อนหลังได้ |
| 3 | เห็นยอดส่งเงินแต่ไม่เห็นว่าตัดบิลใด | API ส่ง `allocations` พร้อมวันที่บิล ร้าน และจำนวนที่ตัด; แสดงรายละเอียดเดียวกันทั้งสองบทบาท | ผลรวม allocation เท่ากับยอดส่งเงินที่ยืนยัน |
| 4 | คำว่า “ทั้งหมด/ได้รับแล้ว/คงค้าง” ไม่บอกช่วงเวลา | ใช้คำว่า “สะสม”, “ทุกบิลจริง” และ “เดือนนี้” ให้ชัด | ผู้ใช้แยกยอดสะสมกับยอดรายเดือนได้โดยไม่ต้องเดา |
| 5 | ข้อตกลงเก่า/ไม่สมบูรณ์ทำให้เข้าใจว่าใช้งานอยู่ | แสดงเฉพาะ production; แยก “ข้อตกลงที่ใช้อยู่” กับ “ประวัติ”; หลัง migration ให้ Owner สร้างข้อตกลงจริงใหม่ | คนกรีดสร้างบิลได้เฉพาะข้อตกลงจริงที่ active และตรงกับตนเอง |
| 6 | ไม่มีจุดพิสูจน์ยอดร่วมกัน | เพิ่มกล่องสมการ `ส่วนแบ่งเจ้าของ − รับ/ส่งยืนยันแล้ว = เงินเจ้าของคงเหลือ` ให้ทั้งสองบทบาท | ตัวเลขสามจุดตรงกับ backend wallet ทุกครั้ง |
| 7 | ทีมไม่รู้ว่าชีตใดใช้งานจริง/legacy/backup | เพิ่ม Data Dictionary และกติกาห้ามแก้ยอดด้วยมือ | ทีมระบุ source of truth และเส้นทางแก้ไขได้จากเอกสารเดียว |

## การย้ายข้อมูลแบบย้อนกลับได้

รุ่น v11 เพิ่ม editor-only functions:

```javascript
previewFinancialClarityV11Migration();
migrateFinancialClarityV11();
```

`preview...` อ่านอย่างเดียว ส่วน `migrate...` จะ:

1. ตรวจ header เดิมแบบ exact match
2. สำเนา `Agreements`, `Sales`, `Settlements` เป็นแท็บ `*_Backup_FinancialClarity_<timestamp>`
3. เพิ่มคอลัมน์ `dataMode`
4. ติดป้ายทุกแถวเดิมเป็น `test` ตามผลตรวจและคำยืนยันว่าไม่มีบิลจริง
5. ตั้ง Spreadsheet timezone เป็น `Asia/Bangkok`
6. ตรวจ schema v4 ซ้ำและคืน `financialSchemaReady`

ฟังก์ชันจะปฏิเสธทันทีหากพบ header ที่ไม่ใช่ v3 ที่รู้จัก และการรันซ้ำหลัง migration จะไม่เปลี่ยนแถวเดิมอีก

## ลำดับ Deploy บังคับ

1. Merge และรอ GitHub Pages สำเร็จ
2. คัดลอก `appsscript/Code.gs` รุ่น `2026.09.01-financial-clarity-v11` ไป Apps Script
3. รัน `testGeminiProviderConnection()` และต้องผ่าน
4. Deploy Web App version ใหม่
5. ตรวจ health ให้ได้ schema `2026-09-financial-clarity-v4`
6. รัน `previewFinancialClarityV11Migration()` แล้วตรวจว่าทั้ง 3 ชีตเป็น `ready_to_migrate_as_test`
7. รัน `migrateFinancialClarityV11()` หนึ่งครั้ง และต้องได้ `financialSchemaReady=true`, `timeZone=Asia/Bangkok`
8. Owner สร้างข้อตกลงจริงใหม่ก่อนรับบิลจริง
9. ทดสอบมือถือทั้งสองบทบาทด้วยรายการใหม่ 1 ชุด และตรวจสมการ/รายละเอียด allocation

ห้ามรับรายการเงินจริงระหว่างข้อ 2–7 เพราะ backend v11 ต้องใช้ schema v4 จึงจะผ่าน financial mutation gate

## Checklist ส่งมอบ

- [x] ตรวจสูตรและความสัมพันธ์ใน Google Sheet
- [x] ตั้ง Spreadsheet timezone เป็น Asia/Bangkok และอ่านกลับยืนยัน
- [x] ออกแบบ migration แบบ backup-first/non-destructive
- [x] กรอง test data ออกจาก read models ทางการเงิน
- [x] เพิ่มรายละเอียด Settlement allocation
- [x] ปรับคำศัพท์และกล่องพิสูจน์ยอดทั้งสองบทบาท
- [x] จัดทำ Data Dictionary
- [x] `pnpm verify` ผ่าน 159 tests พร้อม TypeScript, Apps Script syntax และ production build
- [ ] Push, PR และ merge `main`
- [ ] GitHub Pages deployment ผ่าน
- [ ] ผู้ดูแล Deploy Code.gs และรัน migration
- [ ] ตรวจ health/diagnostics และทดสอบมือถือหลัง Deploy
