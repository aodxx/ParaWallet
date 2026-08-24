# คู่มือการติดตั้งและใช้งาน ParaWallet สำหรับใช้งานจริง

**ชื่อระบบ:** ParaWallet — Rubber Dual Wallet System  
**แพลตฟอร์ม:** GitHub Pages PWA + Google Apps Script + Google Sheets + Google Drive  
**ผู้จัดทำคู่มือ:** Manus AI  
**สถานะคู่มือ:** สำหรับเตรียมใช้งานจริงแบบควบคุม

> **ข้อสำคัญ:** ParaWallet เป็นระบบบัญชีดิจิทัลสำหรับติดตามสิทธิในเงินและยอดที่ต้องส่งมอบ ไม่ใช่ธนาคาร ไม่รับฝากเงินจริง และไม่โอนเงินจริงจากภายในแอป ผู้ใช้ยังต้องโอนเงินผ่านธนาคารหรือส่งเงินสดตามวิธีปฏิบัตินอกระบบ แล้วบันทึกหลักฐานใน ParaWallet

## 1. ภาพรวมการทำงาน

ParaWallet แยกความรับผิดชอบเป็นสี่ส่วนอย่างชัดเจน หน้า PWA บน GitHub Pages ใช้สำหรับการเข้าสู่ระบบและแสดงผลบนมือถือ Google Apps Script ทำหน้าที่เป็น backend/API และเป็นแหล่งคำนวณการแบ่งเงิน Google Sheets เป็นฐานข้อมูลแบบตาราง และ Google Drive ใช้เก็บไฟล์หลักฐาน เช่น ภาพบิลหรือสลิป ระบบไม่ควรให้ frontend เขียน Google Sheets โดยตรง เพราะจะข้ามการตรวจสิทธิ์ การล็อกข้อมูล และประวัติการตรวจสอบ

| ส่วนประกอบ | หน้าที่ | สิ่งที่ผู้ใช้ต้องดูแล |
|---|---|---|
| GitHub Pages PWA | หน้าจอ Owner/Tapper, ฟอร์ม, รายงาน, mobile navigation | ใช้ URL deployment ล่าสุดและเปิดผ่าน HTTPS |
| Google Apps Script | API, OAuth verification, calculation, authorization, LockService, RequestID, audit | ต้อง deploy `Code.gs` revision ล่าสุด |
| Google Sheets | Users, Gardens, GardenMembers, Agreements, Sales, Settlements, WalletEntries และ audit tabs | สำรองข้อมูลและห้ามแก้แถวการเงินโดยตรง |
| Google Drive | เก็บภาพบิล สลิป และหลักฐาน | จำกัดสิทธิ์โฟลเดอร์และไม่แชร์เป็นสาธารณะ |

## 2. สิ่งที่ต้องเตรียมก่อนเปิดใช้จริง

ผู้ดูแลต้องมี Google Account สำหรับ Owner และ Tapper, Google Spreadsheet สำหรับระบบ, Google Apps Script project ที่ผูกกับ Spreadsheet หรือเปิดใช้งาน Spreadsheet ID ผ่าน Script Properties, Google Drive folder สำหรับหลักฐาน และ OAuth Web Client ID ที่อนุญาต origin ของ GitHub Pages ระบบใช้ Google OAuth แบบ ID token แทน `Session.getEffectiveUser` เพื่อให้ผู้ใช้เข้าสู่ระบบด้วยบัญชี Google มาตรฐาน [1] [2]

ค่าที่เกี่ยวข้องกับ backend ควรเก็บใน **Script Properties** ไม่ควรเขียน secret ลงใน `Code.gs` หรือ frontend ตัวอย่างเช่น Spreadsheet ID, Drive root folder ID, OAuth client ID, Gemini/Vision API key และค่าควบคุมระบบควรอยู่ใน `PropertiesService` ซึ่งเป็นพื้นที่เก็บค่าคอนฟิกของ Apps Script [3]

### รายการตรวจสอบการตั้งค่า

| รายการ | ต้องมีค่า | วิธีตรวจ |
|---|---:|---|
| Spreadsheet ID | ใช่ | ตรงกับไฟล์ Google Sheets ที่ใช้จริง |
| Drive root/evidence folder ID | ใช่ | โฟลเดอร์มีอยู่และ Script มีสิทธิ์เขียน |
| Google OAuth Client ID | ใช่ | ตรงกับ Client ID ที่ฝังใน PWA |
| GitHub Pages origin | ใช่ | เช่น `https://aodxx.github.io` อยู่ใน Authorized JavaScript origins |
| Owner ใน Users | ใช่ | email, role และ status ถูกต้อง |
| Tapper ใน Users | ใช่ | email, role และ status ถูกต้อง |
| GardenMembers | ใช่ | Owner และ Tapper ผูกกับ garden เดียวกันและ active |
| Production schema | ใช่ | diagnostics ต้องรายงาน `financialSchemaReady=true` และ `schemaVersion=2026-08-production-v3` |
| Web App deployment | ใช่ | health ต้องรายงาน `release=2026.08.24-phase-d2` |

## 3. การเตรียม Apps Script และ Google Sheets

ให้นำ `appsscript/Code.gs` จาก repository ไปไว้ใน Apps Script project เดิม แล้วกด Save จากนั้น deploy เป็น Web App โดยเลือกให้ Web App execute as เจ้าของสคริปต์ และกำหนดการเข้าถึงตามนโยบายบัญชีของโครงการ การ deploy ใหม่ควรสร้าง version ใหม่ ไม่ควรแก้ deployment โดยไม่บันทึก revision เพราะ GitHub และ Apps Script ไม่ซิงค์กันโดยอัตโนมัติ [4]

เมื่อเริ่มระบบใหม่ ให้รัน bootstrap ที่มีอยู่ใน `Code.gs` เพื่อสร้างแท็บตาม Data Model จากนั้นตรวจชื่อแท็บและหัวคอลัมน์ทุกแท็บ ห้ามสรุปว่า bootstrap สำเร็จเพียงเพราะมีชื่อแท็บ เพราะ Google Sheets ที่มี header เก่าอยู่แล้วอาจไม่ถูกปรับอัตโนมัติ

ต้องตรวจ `Agreements`, `Gardens`, `Buyers`, `Sales` และ `Settlements` เป็นพิเศษ ระบบรุ่นล่าสุดจะรายงาน mismatch และบล็อก mutation ทางการเงินไว้ก่อน การแก้ schema ต้องทำผ่าน migration ใน Apps Script เท่านั้น ไม่ควรแก้ตำแหน่งคอลัมน์ด้วยมือใน Google Sheets

รุ่น `2026.08.24-phase-d2` เพิ่ม `previewParaWalletProductionSchemaRepair()` แบบ read-only และ `repairParaWalletProductionSchema()` ซึ่งสำรองทุกชีต legacy เป็น `*_Backup_*` ก่อนย้ายค่าตามความหมาย รองรับเฉพาะ header รุ่นเก่าที่ระบบรู้จักและปฏิเสธรูปแบบอื่น ห้ามลบชีตสำรองจนกว่าจะผ่าน Production E2E และตรวจยอดย้อนหลังครบถ้วน

## 4. การตั้งค่าโฟลเดอร์หลักฐานใน Google Drive

สร้างโฟลเดอร์หลักสำหรับระบบ เช่น `ParaWallet Evidence` ภายในโฟลเดอร์โครงการยางพารา แล้วกำหนดให้ Apps Script เขียนไฟล์เข้าโฟลเดอร์ดังกล่าว ผู้ใช้ควรเก็บภาพบิลและสลิปต้นฉบับไว้ในระบบ ไม่ควรส่งไฟล์ผ่านแชตส่วนตัวแล้วปล่อยให้ไม่มี reference กลับมายังรายการขายหรือรายการส่งเงิน

ให้ตรวจสิทธิ์ว่า Apps Script account สามารถสร้างและอ่านไฟล์ได้ และผู้ใช้ทั่วไปไม่มีสิทธิ์ลบหลักฐาน หากต้องแชร์หลักฐาน ให้แชร์เฉพาะผู้มีสิทธิ์ที่เกี่ยวข้อง ห้ามเปิดโฟลเดอร์หลักเป็น public โดยไม่จำเป็น

## 5. การเข้าสู่ระบบครั้งแรก

เปิด PWA จาก GitHub Pages ด้วย HTTPS แล้วกด Google Sign-In ระบบจะส่ง ID token ไปยัง Apps Script API เพื่อยืนยัน email และค้นหา user ที่ลงทะเบียนไว้ ผู้ใช้ต้องเข้าสู่ระบบด้วยบัญชีที่มีอยู่ในแท็บ `Users` เท่านั้น หากบัญชียังไม่ลงทะเบียน จะพบข้อผิดพลาด `USER_NOT_REGISTERED`

หลัง login ให้ตรวจชื่อผู้ใช้ บทบาท และสวนที่แสดงบนหน้าจอ หากเป็น Owner ต้องเห็นสวนที่ตนเป็นเจ้าของ หากเป็น Tapper ต้องเห็นเฉพาะสวนที่ผูกใน `GardenMembers` การสลับบทบาทในหน้าจอไม่ควรทำให้ผู้ใช้ได้รับสิทธิ์เกินกว่าบทบาทที่ backend ตรวจสอบ

## 6. ลำดับตั้งค่าข้อมูลธุรกิจ

### 6.1 สร้างสวน

Owner เปิดเมนู **สวนและแปลง** แล้วกรอกชื่อสวน จังหวัด อำเภอ พื้นที่ และจำนวนต้นยาง ควรใช้ข้อมูลจริงที่ตรวจสอบได้ เช่น ชื่อสวน `ป่าพะยอม` จังหวัดพัทลุง อำเภอป่าพะยอม พื้นที่ 10 ไร่ และจำนวนต้นยาง 1,000 ต้นเป็นค่าตัวอย่างที่เคยใช้ในชุดทดสอบ ห้ามนำค่าตัวอย่างไปใช้แทนข้อมูลจริงโดยไม่แก้ไข

### 6.2 ผูกสมาชิก

Owner ต้องตรวจว่าบัญชี Tapper อยู่ใน `Users` แล้ว และมีแถวใน `GardenMembers` ที่มี `gardenId` ตรงกัน, `userId` ตรงกัน, `role=tapper` และ `status=active` การมี email ใน Users อย่างเดียวไม่ทำให้ Tapper เข้าถึงสวนได้ หากไม่ได้ผูกสมาชิกกับสวน

### 6.3 สร้าง Agreement

Owner สร้างข้อตกลงโดยระบุ Tapper ID, สัดส่วน Owner, สัดส่วน Tapper, วันที่เริ่มมีผล และกฎค่าใช้จ่าย สัดส่วนต้องรวมกันเท่ากับ 100% เช่น 60/40 หรือ 50/50 เมื่อสร้าง version ใหม่ ระบบต้องทำให้ version เดิมไม่ active ต่อไป และรายการขายต้องเก็บ snapshot ของ Agreement ที่ใช้ ณ วันที่ขาย ตามหลัก versioning [5]

ก่อนบันทึก Agreement ให้ตรวจสามเรื่อง ได้แก่ Tapper เป็น active member ของสวน, วันที่เริ่มมีผลเป็นวันที่ที่ถูกต้อง และสัดส่วนรวม 100% หาก schema diagnostics ไม่พร้อม ระบบรุ่นล่าสุดจะบล็อกการเขียนและไม่ควรฝืนดำเนินการต่อ

## 7. Workflow ของ Tapper: บันทึกรายการขาย

### 7.1 สแกนบิล

Tapper กด **สแกนบิล** แล้วถ่ายรูปหรือเลือกภาพจากโทรศัพท์ ระบบอัปโหลดหลักฐานไปยัง backend/Drive และเรียก OCR เพื่อดึงวันที่ขาย ร้านรับซื้อ ประเภทสินค้า น้ำหนัก ราคา ยอดก่อนหัก และรายการหัก ระบบจะแสดงหน้าตรวจสอบ OCR ให้แก้ไขข้อมูลได้ก่อนสร้าง Sale

ผู้ใช้ต้องตรวจข้อมูลที่ OCR อ่านได้ทุกครั้ง โดยเฉพาะวันที่ น้ำหนัก ราคา และยอดก่อนหัก หากคะแนน OCR ต่ำ ระบบจะแสดงสถานะให้ตรวจสอบเพิ่มเติม ไม่ควรกดสร้างรายการเพียงเพราะระบบอ่านข้อมูลได้ครบทุกช่อง

### 7.2 บันทึกขายด้วยมือ

กรณีไม่มีบิลหรือภาพอ่านไม่ได้ Tapper ใช้ **บันทึกขายเอง** และกรอกข้อมูลจากหลักฐานที่มีอยู่ให้ครบ ระบุเหตุผลหรือหมายเหตุเมื่อเป็นรายการ manual เพื่อให้ Owner ทราบว่ารายการไม่ได้มาจาก OCR

### 7.3 ตรวจสูตรก่อนส่ง

สูตรพื้นฐานคือ:

```text
gross_sale - buyer_deductions - shared_expenses = split_base
owner_share = split_base × owner_percentage
tapper_share = split_base × tapper_percentage
```

ตัวเลขที่แสดงในหน้าจอเป็น preview เท่านั้น แหล่งคำนวณสุดท้ายคือ Apps Script backend ผู้ใช้ต้องตรวจว่ารายการหักมีหลักฐานและไม่กรอกซ้ำกับค่าใช้จ่ายที่ถูกหักจากร้านรับซื้อแล้ว

### 7.4 Duplicate check และสถานะรอตรวจ

ก่อนสร้าง Sale ระบบตรวจรายการที่อาจซ้ำจากวันที่ ร้านรับซื้อ จำนวนเงิน น้ำหนัก หรือ ticket number หากพบความคล้ายกัน ให้เปิดรายการเดิมตรวจสอบก่อนเสมอ เมื่อส่งรายการสำเร็จ Sale จะมีสถานะ `pending_owner_review` และ Owner จะได้รับ notification รายการยังไม่ควรถือเป็นยอดยืนยันจนกว่า Owner จะตรวจ

## 8. Workflow ของ Owner: ตรวจและยืนยัน Sale

Owner เปิดเมนูรายการขาย อ่านภาพบิลหรือหลักฐาน ตรวจวันที่ ร้านรับซื้อ น้ำหนัก ราคา รายการหัก และ Agreement snapshot จากนั้นตรวจยอดแบ่งเงิน หากข้อมูลถูกต้องจึงกด **ยืนยันรายการ** หากไม่ถูกต้องให้ใช้การคัดค้านและระบุเหตุผล

ก่อนเปลี่ยนเป็น `confirmed` backend จะตรวจ schema และตรวจ ledger equality แบบปัดเศษมาตรฐาน กล่าวคือ gross sale ต้องเท่ากับผลรวมของ deductions, owner share และ tapper share ตามข้อมูลของรายการ หากไม่สมดุล ระบบจะหยุดและไม่ยืนยันรายการ

เมื่อยืนยันสำเร็จ WalletEntries ของทั้ง Owner และ Tapper จะเปลี่ยนเป็น confirmed และมี AuditLog ของเหตุการณ์ `sale_confirmed` การยืนยันซ้ำหรือส่ง RequestID ซ้ำต้องไม่สร้างรายการบัญชีเพิ่ม

## 9. Workflow ของ Tapper: ส่งเงินให้ Owner

Tapper เปิดเมนู **การส่งเงิน** เลือกสวน กรอกยอดที่ส่ง วิธีส่ง เช่น โอนธนาคารหรือเงินสด วันที่ส่ง เลขอ้างอิง และแนบสลิปถ้ามี ระบบจะตรวจว่ายอดไม่เกิน outstanding ของ Owner และสร้าง Settlement เป็น `pending_owner_confirmation`

Tapper ควรส่งเงินตามยอดคงค้างที่แสดง แต่สามารถส่งบางส่วนได้ ระบบจะจัดสรร Settlement ให้กับ Sale ที่ยืนยันแล้วตามลำดับวันที่และเขียน `SettlementAllocations` เพื่อให้ตรวจย้อนกลับได้ การส่งเงินนอกระบบ เช่น โอนผ่านธนาคาร ต้องเก็บเลขอ้างอิงให้ตรงกับหลักฐานใน Drive

## 10. Workflow ของ Owner: ยืนยัน Settlement

Owner ตรวจยอดใน Settlement, วิธีส่ง, วันที่, เลขอ้างอิง และสลิปหรือหมายเหตุ หากได้รับเงินจริงและข้อมูลถูกต้องให้กด **ยืนยันการรับเงิน** ระบบจะตรวจ outstanding อีกครั้ง สร้าง allocation, เขียน WalletEntry ของ Owner และเพิ่ม AuditLog `settlement_confirmed`

หากข้อมูลไม่ถูกต้อง Owner ใช้ **ปฏิเสธ** พร้อมเหตุผล ส่วน Tapper ใช้ **ยกเลิก** ได้เฉพาะ Settlement ที่ยังรอ Owner ยืนยัน การเปลี่ยนสถานะหลังยืนยันแล้วไม่ควรแก้ด้วยการลบแถว แต่ต้องใช้ flow ของ dispute หรือ adjustment ที่มี audit trail

## 11. การดู Wallet และรายงาน

Owner ใช้ Dashboard เพื่อตรวจยอดส่วนแบ่งของตน ยอดที่ยังอยู่กับ Tapper ยอดที่ได้รับแล้ว รายการรอตรวจ และรายการคัดค้าน Tapper ใช้ Dashboard เพื่อตรวจรายได้ของตนและยอด Owner ที่กำลังถืออยู่

รายงานสามารถกรองช่วงวันที่และ export CSV ได้ ผู้ใช้ควรเปรียบเทียบรายงานกับบิลต้นฉบับและรายการโอนเงินจริงเป็นระยะ การเห็นยอดใน Wallet ไม่ได้แปลว่าเงินถูกโอนแล้ว ต้องดูสถานะ Sale, Settlement และ WalletEntry ประกอบกัน

## 12. การแก้ไขและข้อพิพาท

ห้ามแก้ตัวเลขใน Google Sheets โดยตรงเพื่อแก้ปัญหายอดไม่ตรง หาก Sale ผิด ให้เปิด dispute พร้อมเหตุผลและหลักฐาน หากเป็นความคลาดเคลื่อนที่ยืนยันแล้ว ให้ใช้ Adjustment ที่ระบุประเภท owner/tapper credit/debit, จำนวนเงิน และเหตุผล ระบบจะสร้าง audit event และ WalletEntry ที่สัมพันธ์กัน

ทุกการแก้ไขควรตอบได้ว่าใครเป็นผู้ดำเนินการ เมื่อใด แก้รายการใด ด้วยเหตุผลอะไร และมีหลักฐานใดรองรับ หลักการนี้เป็นส่วนหนึ่งของความน่าเชื่อถือของบัญชีคู่ ไม่ใช่เพียงคุณสมบัติเสริม

## 13. กฎความปลอดภัยในการใช้งานจริง

| กฎ | การปฏิบัติ |
|---|---|
| ห้ามเขียน Sheet จาก frontend | ใช้ PWA เรียก Apps Script API เท่านั้น |
| ห้ามแก้แถวการเงินด้วยมือ | ใช้ Sale confirmation, Settlement, dispute หรือ adjustment |
| ห้ามใช้ข้อมูลตัวอย่างเป็นข้อมูลจริง | ลบหรือแยก garden ทดสอบตามนโยบาย audit ก่อนเปิดใช้จริง |
| ห้ามแชร์ OAuth token | Token เป็นข้อมูลลับและมีอายุจำกัด |
| ห้ามข้าม schema diagnostics | หาก `financialSchemaReady` เป็น false ให้หยุด mutation |
| ห้ามยืนยันรายการโดยไม่ดูหลักฐาน | ตรวจบิลและสลิปทุกครั้ง |
| ห้ามรัน one-time test runner ใน production โดยไม่ตั้งใจ | Runner ใช้เฉพาะ sandbox หรือขั้นตอนที่อนุมัติ |
| ห้ามทำลายข้อมูลด้วยการลบแถว | ใช้สถานะและ audit trail แทน |

## 14. Checklist ก่อนเปิดใช้งานจริง

| ตรวจสอบ | ผ่านเมื่อ |
|---|---|
| Deployment | Web App ใช้ `Code.gs` revision ล่าสุดจาก repository |
| Health | endpoint ตอบ `status=ok`, `release=2026.08.24-phase-d2` และ `schemaVersion=2026-08-production-v3` |
| Diagnostics | `financialSchemaReady=true` และไม่มี schema mismatch |
| OAuth | Owner และ Tapper login ด้วยบัญชีที่ลงทะเบียนได้ |
| Authorization | Owner เห็นเฉพาะสวนของตน และ Tapper เห็นเฉพาะสวนที่ผูก |
| Garden | ข้อมูลสวนจริงถูกต้องครบถ้วน |
| Members | Owner/Tapper มีสถานะ active และ gardenId ถูกต้อง |
| Agreement | มี active agreement เพียงรายการที่ต้องใช้และวันที่มีผลถูกต้อง |
| Evidence | Drive folder เขียน/อ่านได้และไม่ public โดยไม่จำเป็น |
| Sale | ทดสอบด้วยข้อมูลควบคุมและตรวจ calculation ได้ |
| Settlement | ตรวจ partial payment และ allocation ได้ |
| Idempotency | ส่ง RequestID เดิมซ้ำแล้วไม่เกิดแถวซ้ำ |
| Audit | เห็น event ของการสร้าง ยืนยัน คัดค้าน และส่งเงิน |
| Backup | มีแผนสำรอง Google Sheets ก่อนเปิดใช้จริง |
| Training | Owner และ Tapper เข้าใจสถานะ pending/confirmed/disputed |

## 15. ปัญหาที่พบบ่อย

### `USER_NOT_REGISTERED`

ตรวจ email ที่ใช้ login ให้ตรงกับแท็บ Users และตรวจ status ของผู้ใช้ หากเป็น Tapper ให้ตรวจ GardenMembers เพิ่มเติม เพราะการลงทะเบียน Users ไม่ได้ผูกสวนให้อัตโนมัติ

### `MISSING_SCRIPT_PROPERTY`

ตรวจชื่อ property ให้ตรงทุกตัวอักษร เช่น Spreadsheet ID, OAuth Client ID, Drive folder ID และ API key อย่าใส่ค่าลงใน frontend แทน Script Properties

### `AGREEMENT_NOT_ACTIVE` หรือ `AGREEMENT_DATE_OUT_OF_RANGE`

ตรวจ `status`, `effectiveFrom`, `effectiveTo`, `gardenId`, `tapperId` และ version ของ Agreement หาก header ผิดตำแหน่ง ห้ามแก้ค่าทีละแถว ให้ซ่อม schema ผ่าน Apps Script migration/repair ที่มี guard แล้วรัน diagnostics ใหม่

### `AGREEMENTS_SCHEMA_UNEXPECTED`

แสดงว่า header ที่อ่านได้ไม่ตรง contract รวมถึงกรณีมีข้อความไม่ว่างต่อท้ายหัวตาราง legacy ให้ใช้ `Code.gs` revision ล่าสุดที่รองรับ trailing blank cells และตรวจ diagnostics ก่อนทำ mutation

### `LEDGER_IMBALANCE`

อย่ายืนยันรายการ ให้คำนวณ gross sale, buyer deductions, shared expenses, owner share และ tapper share ใหม่ ตรวจ rounding และตรวจว่าค่าใช้จ่ายไม่ถูกหักซ้ำ หากยังไม่ตรง ให้คัดค้านรายการพร้อมเหตุผล

### Web App ตอบ `status=ok` แต่ทำรายการไม่ได้

Health แปลว่า endpoint ตอบสนองเท่านั้น รุ่นปัจจุบันจึงส่ง `release` และ `schemaVersion` กลับมาด้วย ต้องตรวจให้ตรงกับ repository แล้วตรวจ `financialSchemaReady` และ Apps Script execution log แยกกัน

### PWA แสดงหน้าว่างหรือยังไม่เชื่อมต่อฐานข้อมูล

ตรวจ console/network, Web App URL, OAuth origin และข้อความ error ที่แสดงบนหน้า อย่าใส่ยอดเงินตัวอย่างเพื่อกลบปัญหา ระบบควรแสดง empty/error state จนกว่าจะเชื่อมต่อข้อมูลจริงได้

## 16. ขอบเขตความพร้อมของรุ่นปัจจุบัน

Repository รุ่นล่าสุดผ่าน automated verification 58 tests, TypeScript, Apps Script syntax และ production build แล้ว และ sandbox E2E ผ่านครบ Sale → Owner confirmation → Settlement → Owner confirmation อย่างไรก็ตามการรับรอง Production E2E บน Google Sheets จริงยังต้องยืนยันว่า Web App deployment ใช้ `Code.gs` revision ล่าสุดและทำ authenticated smoke test ในบัญชีจริงได้สำเร็จ

จึงควรเปิดใช้แบบควบคุมในระยะแรก โดยให้ Owner ตรวจทุก Sale และทุก Settlement ก่อนยืนยัน และยังไม่ควรถือว่า health response เพียงอย่างเดียวเป็นหลักฐานว่า financial schema พร้อม

## References

[1]: https://developers.google.com/identity/gsi/web "Google Identity Services for Web"

[2]: https://developers.google.com/apps-script/guides/web "Google Apps Script Web Apps"

[3]: https://developers.google.com/apps-script/guides/properties "Google Apps Script Properties Service"

[4]: https://developers.google.com/apps-script/concepts/deployments "Google Apps Script Deployments"

[5]: https://developers.google.com/apps-script/reference/lock/lock-service "Google Apps Script Lock Service"
