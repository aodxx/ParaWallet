# Integration Verification

ตรวจสอบเมื่อ 20 สิงหาคม 2026:

- Apps Script Web App URL ตอบกลับ JSON สำเร็จด้วย `status: ok`, service `parawallet-appsscript` และ `health` payload
- Spreadsheet ID `1RcZ3NqJl_iWrKnLOaTk1r2iWL_GhkVqpaBWv1yBrqUI` เปิดได้ใน Google Sheets
- Spreadsheet มีชื่อไฟล์ `ยางพารา`
- การตรวจสอบใน browser อยู่ในโหมดดูอย่างเดียวและพบแท็บเริ่มต้นชื่อ `ชีต1`; ต้องให้ Apps Script ที่มีสิทธิ์แก้ไขรัน `Repositories.bootstrap()` เพื่อสร้างแท็บระบบ เช่น Users, Gardens, Agreements, Sales และ Payments
- Apps Script URL ที่ตรวจสอบ: https://script.google.com/macros/s/AKfycbwiW2tuD_RQUgygjZz-jIEfCLe03s6kdXXyz2Z2ZG8mUDwjvfA_luGrl4SpZ253UeH3/exec
