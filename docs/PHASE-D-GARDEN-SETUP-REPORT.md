# ParaWallet Phase D — Garden Setup Checkpoint

## สถานะ

สร้างและตรวจสอบข้อมูลสวนตัวอย่าง **ป่าพะยอม** ใน Google Spreadsheet จริงเรียบร้อยแล้ว โดยใช้ค่าเริ่มต้นที่ผู้ใช้อนุญาตให้สร้างเป็นตัวอย่าง ดังนี้

| รายการ | ค่า |
|---|---|
| Garden ID | `garden-pahpayom-001` |
| ชื่อสวน | ป่าพะยอม |
| จังหวัด | พัทลุง |
| อำเภอ | ป่าพะยอม |
| พื้นที่ | 10 ไร่ |
| จำนวนต้นยาง | 1,000 ต้น |
| สถานะ | active |
| Owner ID ที่บันทึก | `user-owner-001` |

## สมาชิกสวน

มีการสร้างสมาชิกที่สถานะ `active` จำนวน 2 รายในแท็บ `GardenMembers` โดยผูกกับ `garden-pahpayom-001` ได้แก่ Owner (`user-owner-001`) และ Tapper คุณสมหมาย (`user-tapper-001`) ตามลำดับ

| Member ID | Garden ID | User ID | Role | Status |
|---|---|---|---|---|
| `member-pahpayom-owner-001` | `garden-pahpayom-001` | `user-owner-001` | owner | active |
| `member-pahpayom-tapper-001` | `garden-pahpayom-001` | `user-tapper-001` | tapper | active |

## การตรวจสอบ

อ่านค่ากลับจากช่วง `Gardens!A1:J5` และ `GardenMembers!A1:F5` สำเร็จ พบหัวคอลัมน์ตรงกับ Data Model และพบข้อมูลสวนกับสมาชิกครบถ้วน ไม่มีการเขียนข้อมูลธุรกรรมการเงินในขั้นตอนนี้

## ขอบเขตถัดไป

ขั้นตอนถัดไปคือการทดสอบ E2E ของ Sale → Owner Confirm → Settlement → Owner Confirm ซึ่งจะสร้างข้อมูลจริงเพิ่มเติมใน `Sales`, `Settlements`, `WalletEntries`, `SettlementAllocations`, `Notifications` และ `AuditLogs` ดังนั้นควรถือเป็นการอนุมัติแยกจากการสร้างสวน หากต้องการให้ดำเนินการต่อ โปรดยืนยันว่าจะให้สร้าง **รายการขายและการชำระเงินตัวอย่างในข้อมูลจริง** หรือไม่ พร้อมระบุราคายาง น้ำหนัก และวันที่ทำรายการ หากต้องการให้ผมใช้ค่าตัวอย่างทั้งหมด ผมจะหยุดรอการยืนยันก่อนสร้างธุรกรรมดังกล่าว
