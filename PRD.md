# PRD: Rubber Dual Wallet System
## ระบบกระเป๋าคู่สำหรับเจ้าของสวนยางและคนกรีดยาง

**Document Type:** Product Requirements Document (PRD)  
**Version:** 1.1  
**Date:** 21 August 2026  
**Status:** MVP mobile design synchronized; implementation and production hardening continue  
**Primary Language:** Thai  
**Target Platform:** Mobile-first Web Application / PWA

---

## 1. Product Overview

Rubber Dual Wallet System คือเว็บแอปสำหรับบริหารรายได้จากการขายยางพาราระหว่าง **เจ้าของสวน** และ **คนกรีดยาง** โดยออกแบบให้ทั้งสองฝ่ายเห็นข้อมูลชุดเดียวกัน โปร่งใส ตรวจสอบย้อนหลังได้ และลดปัญหาการจำยอด การคำนวณผิด และความไม่ชัดเจนเรื่องเงินที่ยังค้างส่งให้เจ้าของสวน

จุดสำคัญของระบบคือ เมื่อคนกรีดยางนำยางไปขายและได้รับเงินจากร้านรับซื้อแล้ว คนกรีดสามารถถ่ายภาพหรืออัปโหลดบิล ระบบจะอ่านข้อมูลจากบิล คำนวณยอดขาย หักค่าใช้จ่าย และแบ่งเงินตามข้อตกลงของสวนทันที ก่อนบันทึกยอดเข้าสู่ “กระเป๋าบัญชี” ของทั้งสองฝ่าย

กระเป๋าใน MVP เป็น **บัญชีดิจิทัลสำหรับติดตามสิทธิในเงิน** ไม่ใช่กระเป๋าเงินจริง ไม่รับฝากเงินจริง และไม่โอนเงินจริงออกจากระบบ

---

## 2. Product Vision

สร้างระบบกลางที่ทำให้เจ้าของสวนและคนกรีดยางสามารถตอบคำถามสำคัญได้ทันทีว่า:

- วันนี้ขายยางได้เท่าไร
- ขายยางชนิดใด
- แต่ละฝ่ายได้ส่วนแบ่งเท่าไร
- มีค่าใช้จ่ายอะไรถูกหักไปบ้าง
- เงินส่วนของเจ้าของสวนที่ยังอยู่กับคนกรีดเหลือเท่าไร
- เจ้าของได้รับเงินแล้วเท่าไร
- มีรายการใดยังรอตรวจสอบหรือมีข้อโต้แย้ง
- ยอดทั้งหมดอ้างอิงกลับไปยังบิลต้นฉบับได้หรือไม่

---

## 3. Problem Statement

การแบ่งรายได้จากการกรีดยางในสถานการณ์จริงมีความซับซ้อนกว่าการแบ่งเปอร์เซ็นต์ธรรมดา เนื่องจาก:

1. คนกรีดยางเป็นผู้เอายางไปขายและเป็นผู้รับเงินจริงจากร้านรับซื้อ
2. เจ้าของสวนไม่ได้เก็บเงินทุกวัน
3. บางครั้งเจ้าของไปรับเงินสดเอง
4. บางครั้งคนกรีดโอนเงินให้เจ้าของภายหลัง
5. มีการจ่ายบางส่วนและคงยอดไว้หลายรอบขาย
6. ราคายางแต่ละชนิดแตกต่างกัน
7. รูปแบบบิลของร้านรับซื้อแตกต่างกัน
8. อาจมีค่าขนส่ง ค่าหักร้านรับซื้อ ค่าแรง เงินเบิก หรือค่าใช้จ่ายอื่น
9. การแก้ไขย้อนหลังโดยไม่มีประวัติอาจทำให้เกิดข้อขัดแย้ง
10. ทั้งสองฝ่ายต้องเห็นข้อมูลเดียวกันเพื่อสร้างความเชื่อมั่น

ระบบจึงต้องแยกให้ชัดเจนระหว่าง:

- **สิทธิในเงิน**
- **เงินที่ถืออยู่จริง**
- **เงินที่ส่งมอบแล้ว**
- **ยอดที่ยังรอตรวจสอบ**
- **ยอดที่มีข้อโต้แย้ง**

---

## 4. Product Goals

### 4.1 Primary Goals

1. สแกนบิลขายยางและแปลงข้อมูลเป็นรายการขาย
2. รองรับยางหลายประเภท เช่น:
   - น้ำยางสด
   - ขี้ยาง / ยางก้อนถ้วย
   - ยางแผ่น
   - ประเภทอื่นที่กำหนดเองได้
3. คำนวณรายได้และแบ่งเงินอัตโนมัติตามข้อตกลง
4. แสดงกระเป๋าเจ้าของสวนและกระเป๋าคนกรีดแบบโปร่งใส
5. ติดตามเงินส่วนเจ้าของที่ยังอยู่กับคนกรีด
6. รองรับการส่งเงินทั้งเงินสดและโอนธนาคาร
7. รองรับการจ่ายบางส่วน
8. มีระบบยืนยัน คัดค้าน และ audit trail
9. ตรวจสอบยอดให้สมดุลทุกธุรกรรม
10. ใช้งานง่ายบนมือถือ

### 4.2 Success Definition

MVP ถือว่าประสบความสำเร็จเมื่อผู้ใช้สามารถ:

- สร้างสวนและข้อตกลงแบ่งเงิน
- เพิ่มคนกรีด
- สแกนบิล
- ตรวจข้อมูล OCR
- คำนวณส่วนแบ่ง
- เห็นเงินในกระเป๋าของทั้งสองฝ่าย
- บันทึกการส่งเงิน
- ติดตามยอดคงค้าง
- ตรวจประวัติย้อนหลัง
- Export รายงานได้

---

## 5. Non-Goals for MVP

MVP จะยังไม่รองรับ:

- รับฝากเงินจริงในระบบ
- ถอนเงินจริง
- โอนเงินจริงจากกระเป๋าในแอป
- ระบบธนาคาร
- ระบบสินเชื่อ
- คิดดอกเบี้ย
- ตลาดซื้อขายยาง
- ระบบคาดการณ์ราคายาง
- ระบบภาษีเต็มรูปแบบ
- ระบบบัญชีบริษัทเต็มรูปแบบ
- ระบบประเมินเครดิตเจ้าของ/คนกรีด
- Public marketplace

---

## 6. Target Users

### 6.1 เจ้าของสวน

สามารถ:

- สร้างสวน
- สร้างแปลง
- กำหนดข้อตกลงแบ่งรายได้
- เชิญหรือจับคู่คนกรีด
- ดูยอดขายทุกวัน
- ดูภาพบิล
- ดูสูตรแบ่งเงิน
- ยืนยันหรือคัดค้านรายการ
- ดูเงินส่วนของตนที่ยังอยู่กับคนกรีด
- ยืนยันการรับเงิน
- ดูรายงานรายวัน/เดือน/ช่วงเวลา

### 6.2 คนกรีดยาง

สามารถ:

- ดูสวนที่ตนรับผิดชอบ
- ถ่ายรูปบิล
- อัปโหลดภาพบิล
- ตรวจและแก้ OCR
- บันทึกขายเอง
- ดูส่วนแบ่งของตนเอง
- ดูเงินส่วนเจ้าของที่ตนถืออยู่
- บันทึกการโอนเงิน
- บันทึกการส่งเงินสด
- ดูประวัติรายการ

### 6.3 ผู้ดูแลสวน

Post-MVP

สามารถดูข้อมูลตามสิทธิที่ได้รับ แต่ไม่มีสิทธิเปลี่ยนข้อตกลงหลัก เว้นแต่เจ้าของมอบสิทธิ

---

## 7. Core Product Concept: Dual Wallet

ระบบประกอบด้วย 3 บัญชีสำคัญ

### 7.1 Shared Sale Ledger

บัญชีกลางของรายการขาย

เก็บ:

- รูปบิล
- วันที่ขาย
- ร้านรับซื้อ
- ชนิดยาง
- น้ำหนัก
- DRC
- ราคา
- ยอดก่อนหัก
- รายการหัก
- ฐานแบ่ง
- สูตรแบ่ง
- ส่วนเจ้าของ
- ส่วนคนกรีด
- สถานะ
- ประวัติการแก้ไข

### 7.2 Owner Wallet

แสดง:

- ส่วนแบ่งวันนี้
- ส่วนแบ่งเดือนนี้
- รายได้สะสม
- เงินที่ยังอยู่กับคนกรีด
- เงินที่ได้รับแล้ว
- ยอดรอตรวจสอบ
- ยอดคัดค้าน
- ประวัติรับเงิน

### 7.3 Tapper Wallet

แสดง:

- รายได้วันนี้
- รายได้เดือนนี้
- รายได้สะสม
- เงินส่วนเจ้าของที่กำลังถืออยู่
- เงินที่ส่งให้เจ้าของแล้ว
- เงินเบิก
- ค่าใช้จ่าย
- รายการปรับปรุง
- รายการรอเจ้าของตรวจ

---

## 8. Supported Rubber Products

ระบบต้องไม่ผูกสูตรกับยางชนิดเดียว

### 8.1 น้ำยางสด

ข้อมูลที่อาจพบ:

- น้ำหนัก
- DRC
- ราคาอ้างอิง
- ราคาเนื้อยางแห้ง
- ยอดสุทธิ
- รายการหัก

### 8.2 ยางก้อนถ้วย / ขี้ยาง

ข้อมูลที่อาจพบ:

- น้ำหนักรวม
- น้ำหนักหัก
- น้ำหนักสุทธิ
- ราคา/กิโลกรัม
- เปอร์เซ็นต์หัก
- ยอดสุทธิ

### 8.3 ยางแผ่น

ข้อมูลที่อาจพบ:

- จำนวน/น้ำหนัก
- เกรด
- ราคาต่อกิโลกรัม
- ยอดรวม

### 8.4 Custom Product Type

Admin/Owner สามารถสร้างประเภทเพิ่มเติมได้

เช่น:

- ชื่อสินค้า
- หน่วย
- วิธีคำนวณ
- required fields
- optional fields

---

## 9. Agreement Model

แต่ละสวนต้องมี Agreement ที่มี version และ effective date

### Required Fields

- Agreement ID
- Garden ID
- Owner ID
- Tapper ID
- Owner Percentage
- Tapper Percentage
- Effective From
- Effective To
- Expense Rules
- Advance Deduction Rules
- Rounding Rule
- Status

### ตัวอย่าง

- 60 / 40
- 50 / 50
- 70 / 30
- Custom Percentage

### Rule

ห้ามเปลี่ยน Agreement ย้อนหลังแล้วกระทบรายการที่ขายไปแล้ว

ทุกรายการขายต้องบันทึก snapshot ของ Agreement ที่ใช้ ณ วันขาย

---

## 10. Calculation Engine

### 10.1 Core Formula

```text
gross_sale
- buyer_deductions
- shared_expenses
= split_base
```

```text
owner_gross_share = split_base × owner_percentage
tapper_gross_share = split_base × tapper_percentage
```

```text
owner_net_share =
owner_gross_share
+ owner_adjustments
- owner_expenses
```

```text
tapper_net_share =
tapper_gross_share
+ tapper_adjustments
- tapper_expenses
- due_advances
```

### 10.2 Ledger Balancing Rule

ระบบต้องตรวจว่า:

```text
gross_sale
=
all_deductions
+ owner_net_share
+ tapper_net_share
+ traceable_adjustments
```

หากไม่สมดุล:

- ห้าม mark เป็น confirmed
- แสดง error
- บันทึก diagnostic log

### 10.3 Rounding

ระบบต้องกำหนดมาตรฐาน rounding เช่น:

- 2 decimal places
- HALF_UP

และต้องใช้เหมือนกันทุก client/server

---

## 11. Sale Capture Workflow

### Flow A: Scan Receipt

1. คนกรีดกด “สแกนบิล”
2. เปิดกล้องหรือเลือกภาพ
3. Upload ภาพ
4. OCR วิเคราะห์
5. Extract structured fields
6. แสดง OCR Review Screen
7. highlight field ที่ confidence ต่ำ
8. ผู้ใช้แก้ไขข้อมูลได้
9. กด Confirm Receipt
10. ระบบตรวจ duplicate
11. ระบบตรวจ calculation
12. สร้าง Sale
13. คำนวณ Wallet Entries
14. สถานะ = `pending_owner_review`
15. เจ้าของได้รับ notification
16. เจ้าของเปิดรายการ
17. ยืนยัน หรือ คัดค้าน

### Flow B: Manual Sale

กรณีไม่มีบิล:

- กรอกวันที่
- ร้านรับซื้อ
- ชนิดยาง
- น้ำหนัก
- ราคา
- ยอดขาย
- ค่าใช้จ่าย
- หมายเหตุ

ระบบ mark:

`manual_entry = true`

และสามารถตั้ง requirement ให้เจ้าของตรวจเป็นพิเศษ

---

## 12. OCR Requirements

OCR ต้องออกแบบแบบ flexible schema

### 12.1 Required Fields

- sale_date
- buyer_name
- net_received_amount

### 12.2 Conditional Fields

- ticket_number
- product_type
- gross_weight
- tare_weight
- net_weight
- drc
- price_per_unit
- gross_amount
- deductions

### 12.3 Metadata

- OCR confidence
- OCR raw output
- extracted by
- extraction timestamp
- manually corrected fields

### 12.4 Low Confidence

ถ้า field ต่ำกว่า threshold:

- highlight
- require manual review

### 12.5 Missing Net Amount

ถ้า OCR ไม่พบยอดสุทธิ:

- ผู้ใช้กรอกเอง
- mark `manual_net_amount`
- force owner review

---

## 13. Duplicate Receipt Detection

ระบบตรวจ duplicate จากหลาย signal:

- ticket number
- buyer
- sale date
- total amount
- net weight
- image hash
- OCR fingerprint

### Possible Duplicate

ถ้าพบความคล้ายสูง:

- ห้าม auto-save ซ้ำ
- แสดงรายการที่ใกล้เคียง
- ให้ผู้ใช้เลือก:
  - ยกเลิก
  - เปิดรายการเดิม
  - ยืนยันว่าเป็นคนละบิล

---

## 14. Owner Review Workflow

### Status

- pending_owner_review
- confirmed
- disputed

### Owner Can

- ดูภาพบิล
- ดู OCR
- ดูค่าที่มีการแก้
- ดูสูตร
- ดู Agreement
- ดู deductions
- ดู wallet allocation

### Confirm

เมื่อยืนยัน:

- จำนวนเงินไม่ควรถูกคำนวณใหม่ถ้า input ไม่เปลี่ยน
- status = confirmed
- audit log created

### Dispute

ต้องกรอก:

- reason
- optional image
- optional note

status = disputed

---

## 15. Money Custody Model

หลังขายยาง:

**เงินจริงอยู่กับคนกรีด**

ระบบจึงต้องสร้าง liability/accounting state:

```text
owner_money_held_by_tapper
```

ตัวอย่าง:

ยอดขาย = 10,000  
ค่าขนส่ง = 200  
ฐานแบ่ง = 9,800  
Owner = 60%  
Tapper = 40%

Owner Share = 5,880  
Tapper Share = 3,920

ระบบแสดง:

- Owner Wallet entitlement = 5,880
- Tapper income = 3,920
- Owner money held by tapper = 5,880

---

## 16. Settlement System

รองรับ:

### 16.1 Bank Transfer

Fields:

- amount
- transfer date
- bank
- reference number
- slip image
- note

### 16.2 Cash

Fields:

- amount
- handover date
- location
- note

เงินสดจะถือว่า settled เมื่อเจ้าของกดยืนยันรับเงิน

### 16.3 Settlement Types

- Full settlement
- Partial settlement
- Batch settlement
- Multi-sale allocation

### 16.4 Allocation

Settlement สามารถนำไปตัด:

- oldest first
- selected sales
- manual allocation

MVP แนะนำ default = oldest confirmed outstanding first

แต่ต้องเก็บ allocation รายการต่อรายการ

---

## 17. Wallet Rules

### Owner Wallet Metrics

```text
owner_total_entitlement
owner_total_received
owner_outstanding
owner_pending
owner_disputed
```

### Tapper Wallet Metrics

```text
tapper_total_income
tapper_confirmed_income
owner_money_held
owner_money_transferred
tapper_expenses
tapper_advances
```

### Important Rule

รายได้ของคนกรีดต้องไม่ลดลงเมื่อคนกรีดส่งเงินส่วนของเจ้าของ

เพราะการส่งเงินเป็นการลด `owner_money_held` ไม่ใช่การลด `tapper_income`

---

## 18. Status Model

### Sale Status

- draft
- ocr_processing
- ocr_review
- pending_owner_review
- confirmed
- disputed
- reversed

### Settlement Status

- pending_owner_confirmation
- partially_confirmed
- confirmed
- rejected
- reversed

### Display

ห้ามใช้สีอย่างเดียว

ทุกสถานะต้องมี:

- label
- icon
- color

---

## 19. Audit Trail

ทุก action สำคัญต้องมี log:

- actor_id
- actor_role
- action
- entity_type
- entity_id
- old_value
- new_value
- timestamp
- device/session metadata

### Events ที่ต้องเก็บ

- sale created
- OCR corrected
- sale confirmed
- sale disputed
- agreement changed
- settlement created
- settlement confirmed
- settlement rejected
- adjustment created
- reversal created

---

## 20. Immutable Accounting Principle

เมื่อ Sale ถูกลงบัญชีแล้ว:

**ห้าม hard delete**

หากผิด:

สร้าง:

- reversal entry
- correction entry
- replacement entry

เพื่อให้ตรวจสอบประวัติได้

---

## 21. Functional Requirements

### FR-001 Authentication

ระบบต้องรองรับ:

- register
- login
- logout
- password reset
- session management

### FR-002 User Role

- Owner
- Tapper

### FR-003 Pairing

เจ้าของสามารถเชิญคนกรีดด้วย:

- QR
- invite code
- link

### FR-004 Garden

สร้าง:

- garden
- plot
- optional location/name

### FR-005 Agreement

สร้างและ version ข้อตกลง

### FR-006 Receipt Upload

Camera + gallery

### FR-007 OCR

Extract structured data

### FR-008 OCR Review

แก้ก่อน submit

### FR-009 Sale Calculation

คำนวณอัตโนมัติ

### FR-010 Wallet Posting

ลง ledger ทันทีหลังคนกรีดยืนยันข้อมูล

### FR-011 Owner Review

Confirm / Dispute

### FR-012 Settlement

Transfer / Cash

### FR-013 Partial Settlement

รองรับจ่ายบางส่วน

### FR-014 Wallet Dashboard

Owner + Tapper dashboard

### FR-015 History

ค้นหาและ filter

### FR-016 Export

PDF/CSV หรือ report format ที่กำหนดภายหลัง

### FR-017 Notifications

แจ้ง:

- บิลใหม่
- รอตรวจ
- คัดค้าน
- ส่งเงิน
- รับเงิน
- ยอดค้างเกินกำหนด

---

## 22. Main Screens

### 22.1 Login

- Google Sign-In via OpenID Connect ID token
- explicit signed-out, loading, invalid-token, unregistered-user, and retry states
- role-aware redirect after server-side user and garden-membership verification
- no password storage in the PWA or Apps Script Web App

### 22.2 Owner Home

Cards:

1. ส่วนของฉันวันนี้
2. เงินของฉันที่ยังอยู่กับคนกรีด
3. เงินที่ได้รับเดือนนี้
4. รายการรอตรวจ

Recent Sales:

- buyer
- product
- amount
- owner share
- tapper share
- status
- thumbnail

### 22.3 Tapper Home

Cards:

1. รายได้ของฉันวันนี้
2. เงินเจ้าของที่ฉันถืออยู่
3. ยอดรอเจ้าของตรวจ
4. เงินที่ส่งเจ้าของเดือนนี้

Actions:

- Scan Receipt
- Manual Sale
- Transfer Money
- Hand Over Cash
- History

### 22.4 Receipt Scanner

- camera
- gallery
- image preview

### 22.5 OCR Review

- image
- extracted data
- low confidence highlight
- edit
- confirm

### 22.6 Sale Detail

Sections:

- receipt
- sale data
- rubber type
- calculation
- deductions
- agreement snapshot
- owner wallet entry
- tapper wallet entry
- timeline
- confirm/dispute

### 22.7 Settlement

- amount
- method
- attachment
- allocation
- remaining balance

### 22.8 Wallet

- balance
- pending
- confirmed
- received/sent
- transaction history

### 22.9 Agreement

- percentages
- expenses
- effective date
- history

### 22.10 Mobile Navigation and Context

บน smartphone ระบบต้องใช้โครงสร้างการนำทางที่เข้าถึงได้ด้วยนิ้วโป้งและไม่พึ่งพา sidebar เป็นหลัก:

- compact top bar แสดงชื่อระบบ ผู้ใช้ สถานะการเชื่อมต่อ และทางออกจากระบบ
- garden context switcher อยู่ใต้ top bar และแสดงสวนที่กำลังดูอยู่เสมอ
- fixed bottom navigation สำหรับ `ภาพรวม`, `รายการ`, `กระเป๋า`, `แจ้งเตือน`, และ `เพิ่มเติม`
- creation actions อยู่ใน quick-action area ที่เห็นได้จากหน้าแรก ไม่ซ่อนอยู่ในเมนูหลายชั้น
- Owner เห็นลำดับงานหลักเป็นรายการรอตรวจ เงินเจ้าของที่ยังอยู่กับคนกรีด การยืนยัน settlement และการจัดการสวน/สมาชิก
- Tapper เห็นลำดับงานหลักเป็นสแกนบิล บันทึกขาย เงินเจ้าของที่ถืออยู่ การส่งเงิน และประวัติของตนเอง
- desktop sidebar อาจใช้ได้เมื่อหน้าจอกว้าง แต่ต้องคงลำดับงานและชื่อ action แบบเดียวกับ mobile

### 22.11 Mobile Interaction Patterns

- หน้ารายการใช้แถวข้อมูลสองบรรทัด โดยยอดเงินและสถานะอยู่ด้านขวา และกดเปิดรายละเอียดได้ทั้งแถว
- หน้ารายละเอียดใช้ timeline ประกอบด้วยหลักฐาน การคำนวณ ผลกระทบต่อ wallet สถานะ และ action ที่ทำได้
- ฟอร์มแบ่งเป็นส่วนสั้น ๆ มี calculated split แสดงก่อน submit และใช้ sticky action bar เมื่อฟอร์มยาว
- บนมือถือใช้ bottom sheet แทน centered desktop modal สำหรับงานสร้าง/แก้ไข
- primary action ใช้ปุ่มเต็มความกว้างเมื่อเหมาะสม และทุก touch target ต้องกดได้ชัดเจน

---

## 23. Dashboard Analytics

### Owner

- revenue today
- monthly revenue
- outstanding custody
- received this month
- pending confirmation
- disputed amount

### Tapper

- personal income today
- monthly income
- owner funds held
- amount remitted
- outstanding sales
- pending owner reviews

### Shared

- total sales
- product breakdown
- buyer breakdown
- average price
- total deductions

---

## 24. Data Model

### users

- id
- name
- phone
- email
- role
- status
- created_at
- updated_at

### gardens

- id
- owner_id
- name
- location_text
- status

### plots

- id
- garden_id
- name
- notes

### garden_members

- id
- garden_id
- user_id
- role
- active_from
- active_to

### agreements

- id
- garden_id
- owner_id
- tapper_id
- owner_percentage
- tapper_percentage
- shared_expense_rules_json
- owner_expense_rules_json
- tapper_expense_rules_json
- advance_rule_json
- effective_from
- effective_to
- status
- created_at

### product_types

- id
- name
- unit
- calculation_type
- config_json
- active

### buyers

- id
- name
- branch
- contact
- notes

### receipts

- id
- file_url
- image_hash
- ocr_raw_json
- ocr_confidence_json
- created_by
- created_at

### sales

- id
- garden_id
- plot_id
- tapper_id
- receipt_id
- agreement_id
- buyer_id
- sale_date
- ticket_number
- product_type_id
- gross_weight
- tare_weight
- net_weight
- drc
- price_per_unit
- gross_sale
- buyer_deductions
- shared_expenses
- split_base
- owner_share
- tapper_share
- net_received
- status
- manual_entry
- created_at
- updated_at

### sale_deductions

- id
- sale_id
- deduction_type
- description
- amount
- responsibility
- created_at

### wallet_entries

- id
- wallet_owner_user_id
- sale_id
- settlement_id
- entry_type
- direction
- amount
- status
- created_at

### settlements

- id
- garden_id
- tapper_id
- owner_id
- method
- amount
- transfer_date
- bank
- reference_no
- slip_url
- location
- note
- status
- created_at

### settlement_allocations

- id
- settlement_id
- sale_id
- amount

### disputes

- id
- sale_id
- opened_by
- reason
- note
- evidence_url
- status
- resolved_at

### adjustments

- id
- sale_id
- user_id
- adjustment_type
- amount
- reason
- status
- created_at

### audit_logs

- id
- actor_id
- action
- entity_type
- entity_id
- old_value_json
- new_value_json
- created_at

### notifications

- id
- user_id
- type
- entity_type
- entity_id
- read_at
- created_at

---

## 25. API Requirements

Example API domains:

```text
/auth
/users
/gardens
/plots
/members
/agreements
/products
/buyers
/receipts
/ocr
/sales
/wallets
/settlements
/disputes
/notifications
/reports
```

### Example

```http
POST /receipts
POST /receipts/:id/ocr
POST /sales
GET  /sales/:id
POST /sales/:id/confirm
POST /sales/:id/dispute
POST /settlements
POST /settlements/:id/confirm
GET  /wallets/me
```

---

## 26. Permission Matrix

| Feature | Owner | Tapper |
|---|---:|---:|
| ดูบิล | ✓ | ✓ |
| สร้างบิลขาย | - | ✓ |
| แก้ OCR ก่อน submit | - | ✓ |
| ยืนยันรายการ | ✓ | - |
| คัดค้าน | ✓ | ✓* |
| ดูสูตร | ✓ | ✓ |
| ดูกระเป๋าตนเอง | ✓ | ✓ |
| ดูยอดร่วม | ✓ | ✓ |
| สร้าง settlement | ✓ | ✓ |
| ยืนยันรับเงิน | ✓ | - |
| เปลี่ยน agreement | ✓ | - |

\* Tapper สามารถแจ้งปัญหาหรือร้องขอแก้ไขรายการได้

---

## 27. Security Requirements

### Authentication

- secure session/token
- password hashing
- rate limiting
- logout invalidation

### Authorization

ทุก request ต้องตรวจ:

- user
- garden membership
- role
- permission

### File Security

Receipt/slip image:

- private storage
- signed URL
- ห้าม public bucket โดย default

### Privacy

ข้อมูลต่อไปนี้ห้ามแชร์ข้ามฝ่ายโดยไม่จำเป็น:

- password
- auth token
- full bank credentials
- identity verification secrets

---

## 28. Fraud & Error Prevention

ระบบต้องมี:

- duplicate receipt check
- OCR anomaly detection
- calculation validation
- agreement snapshot
- immutable audit log
- settlement confirmation
- image evidence
- timestamp
- reversal accounting
- unusual outstanding alert

### Alert Examples

- เงินเจ้าของค้างเกิน 7 วัน
- เงินเจ้าของที่คนกรีดถือเกิน X บาท
- บิลซ้ำ
- OCR ยอดเงินไม่ตรงสูตร
- มีการแก้ข้อมูลหลัง OCR จำนวนมากผิดปกติ

---

## 29. Notification Requirements

Notify Owner:

- มีบิลใหม่
- มีรายการรอตรวจ
- มี settlement
- มี dispute

Notify Tapper:

- เจ้าของยืนยันบิล
- เจ้าของคัดค้าน
- เจ้าของยืนยันรับเงิน
- มี outstanding alert

Channels MVP:

- in-app

Post-MVP:

- LINE
- Push Notification
- Email

---

## 30. Search & Filters

Sale History ต้องค้นหา:

- วันที่
- ผู้ซื้อ
- คนกรีด
- สวน
- แปลง
- ประเภทสินค้า
- สถานะ
- ช่วงยอดเงิน

Sort:

- latest
- oldest
- highest amount
- lowest amount

---

## 31. Reports

MVP:

### Daily Summary

- sales
- owner share
- tapper share
- deductions
- settlement
- outstanding

### Monthly Summary

- total sales
- product breakdown
- total owner entitlement
- total tapper income
- total received by owner
- outstanding

### Settlement Statement

แสดง:

- opening outstanding
- new owner entitlement
- transfers
- cash
- adjustments
- closing outstanding

---

## 32. Non-Functional Requirements

### Mobile First

รองรับ smartphone เป็นหลัก

### Performance

- หน้า dashboard initial load < 3 sec ในเครือข่ายปกติ
- sale save response < 2 sec ไม่รวม OCR
- OCR target complete flow < 60 sec

### Reliability

- wallet ledger must be transactional
- ห้ามเกิด half-posting

### Availability

MVP target 99.5%

### Localization

- Thai UI
- THB
- Asia/Bangkok timezone
- Thai date display option
- internal timestamp ISO / UTC recommended

### Accessibility

- touch targets ≥ 44px รวมปุ่มใน bottom navigation, quick actions, list rows และ modal/bottom sheet
- readable text ที่มี contrast เพียงพอสำหรับการใช้งานกลางแจ้ง
- status not represented by color only; ทุกสถานะต้องมี label และ icon
- semantic buttons, labels, focus-visible states และ keyboard navigation บน tablet/desktop
- รองรับ `prefers-reduced-motion`
- ห้ามใช้ข้อความสีจางหรือข้อมูลจำนวนเงินที่อ่านยากบนหน้าจอขนาดเล็ก

### Mobile Responsive Requirements

- 375–430px: single-column field layout, bottom navigation, full-width primary actions
- 431–767px: single-column layout; ใช้ two-column metric cluster ได้เมื่อข้อความและจำนวนเงินยังอ่านได้ครบ
- 768–1023px: tablet split layout พร้อม garden context และ list rows ที่กว้างขึ้น
- 1024px ขึ้นไป: desktop sidebar ใช้ได้ แต่ต้องคง task hierarchy และ action labels เดียวกับ mobile
- page gutters บนมือถือประมาณ 16px และต้องไม่เกิด horizontal overflow ใน flow หลัก
- content ต้องไม่ถูก bottom navigation หรือ safe-area inset บัง
- first viewport ต้องเน้นหนึ่ง decision และไม่วาง metric cards จำนวนมากก่อนงานหลัก

### Mobile State and Reliability Requirements

- ทุกหน้าต้องมี loading, empty, connected, disconnected/offline, retry และ runtime-error state ที่มองเห็นได้
- ห้ามแสดง fallback money values เป็นข้อมูลจริงจาก Google Sheets
- runtime error ต้องแสดง recovery screen แทน white screen
- Service Worker ต้องมี versioned cache และ network-first navigation เพื่อไม่ให้ HTML รุ่นเก่าค้างจนโหลด asset ไม่ได้
- offline shell เปิดได้ แต่ final ledger posting ต้อง online และต้องระบุสถานะ draft อย่างชัดเจน

---

## 33. PWA Requirements

- installable on Android
- responsive
- camera access
- file upload
- basic offline shell
- retry upload when network returns

### Install and Icon Requirements

- installable on Android, iOS/iPadOS และ desktop browser ที่รองรับ PWA
- manifest ต้องมี normal PNG icons และ maskable icons อย่างน้อย 192x192 และ 512x512
- ต้องมี favicon และ Apple touch icon
- `start_url`, `scope`, `theme_color`, `background_color` และ safe-area behavior ต้องสอดคล้องกับ subpath deployment

### Offline MVP Boundary

อนุญาต:

- เปิด app shell
- draft receipt locally

แต่ final ledger posting ต้อง online

---

## 34. MVP Acceptance Criteria

### AC-001

Given คนกรีดอยู่ในสวนที่จับคู่แล้ว  
When อัปโหลดบิล  
Then ระบบสามารถสร้าง OCR review screen ได้

### AC-002

Given ผู้ใช้ยืนยัน OCR  
When ระบบสร้าง sale  
Then ระบบคำนวณ owner/tapper share ได้

### AC-003

When sale ถูกสร้าง  
Then wallet ของทั้งสองฝ่ายต้องแสดงยอดทันทีในสถานะ pending

### AC-004

Given Owner confirm sale  
Then status เปลี่ยนเป็น confirmed และจำนวนเงินไม่เปลี่ยน

### AC-005

Given Owner dispute sale  
Then ต้องบันทึกเหตุผลและ timeline

### AC-006

Given owner entitlement = 5,880  
When tapper ส่ง 3,000  
Then owner outstanding = 2,880

### AC-007

Tapper personal income ต้องไม่ลดลงจาก settlement ของ owner

### AC-008

ระบบต้องไม่ยอมให้ confirmed sale ถูก hard delete

### AC-009

Agreement ใหม่ต้องไม่เปลี่ยน calculation ของ sale เดิม

### AC-010

ทุก wallet entry ต้อง trace กลับไปยัง sale/settlement/adjustment ได้

### AC-011

ระบบต้องรองรับ partial settlement

### AC-012

ทั้ง Owner และ Tapper ต้องเห็นสูตร calculation เดียวกัน

### AC-013

ระบบต้องตรวจ ledger balance ก่อน confirm

### AC-014

บิลที่สงสัยว่า duplicate ต้องแจ้งเตือนก่อนบันทึก

### AC-015

ผู้ใช้ต้องสามารถดูภาพบิลต้นฉบับจาก sale detail ได้

### AC-016 — Mobile Primary Navigation

Given ผู้ใช้เปิดระบบบน smartphone  
When ระบบโหลดหน้าใช้งานสำเร็จ  
Then ผู้ใช้ต้องเข้าถึง `ภาพรวม`, `รายการ`, `กระเป๋า`, `แจ้งเตือน`, และ `เพิ่มเติม` ผ่าน fixed bottom navigation ได้ โดยไม่มีการใช้ sidebar เป็นข้อกำหนดหลัก

### AC-017 — Role-aware Mobile Action

Given ผู้ใช้เป็น Owner หรือ Tapper  
When เปิดหน้า dashboard  
Then primary action ต้องสอดคล้องกับบทบาท โดย Owner เห็นงานตรวจรายการรอ และ Tapper เห็นงานสแกนบิล/บันทึกขายก่อน action รอง

### AC-018 — Garden Context

Given ผู้ใช้มีสวนที่ได้รับสิทธิ์อย่างน้อยหนึ่งสวน  
When เปิดหน้าหลักหรือเปลี่ยนสวน  
Then selected garden และสถานะการเชื่อมต่อ ต้องมองเห็นได้โดยไม่ต้องเปิด sidebar

### AC-019 — Mobile State Safety

Given API, Apps Script หรือ network มีปัญหา  
When หน้าโหลดหรือบันทึกข้อมูล  
Then ระบบต้องแสดง loading/empty/error/offline/retry state ที่ชัดเจน และต้องไม่แสดง fallback money values เป็นข้อมูลจริง

### AC-020 — Mobile Touch and Safe Area

Given ผู้ใช้เปิดระบบที่ความกว้าง 375–430px  
When ใช้ navigation, quick actions, forms หรือ bottom sheets  
Then touch targets ต้องไม่น้อยกว่า 44px, ไม่มี horizontal overflow และเนื้อหาต้องไม่ถูก bottom navigation หรือ safe-area inset บัง

### AC-021 — Responsive Layout

Given ผู้ใช้เปิดระบบที่ smartphone, tablet หรือ desktop  
When เปลี่ยน viewport ระหว่าง 375px, 390px, 412px, 768px และ 1024px ขึ้นไป  
Then layout ต้องคงลำดับงานหลัก อ่านยอดเงินได้ และเปลี่ยนระหว่าง bottom navigation กับ sidebar ตาม breakpoint ที่กำหนด

### AC-022 — Installable Icon Set

Given ผู้ใช้ติดตั้ง PWA บน Android, iOS/iPadOS หรือ desktop browser  
When ระบบอ่าน manifest และ icon metadata  
Then ต้องพบ normal icon, maskable icon, favicon และ Apple touch icon ที่โหลดได้และไม่ถูกตัดขอบใน adaptive shape

---

## 35. MVP Release Scope

### Phase 0 — Foundation

- repository
- project structure
- environment config
- authentication
- database
- storage
- CI/CD
- design tokens

### Phase 1 — Garden & Agreement

- users
- roles
- owner/tapper pairing
- garden
- plot
- agreement
- product types

### Phase 2 — Sale & OCR

- camera/upload
- receipt storage
- OCR
- OCR review
- manual sale
- duplicate detection

### Phase 3 — Calculation & Dual Wallet

- calculation engine
- shared ledger
- owner wallet
- tapper wallet
- balance validation

### Phase 4 — Review & Dispute

- owner review
- confirm
- dispute
- audit history
- notifications

### Phase 5 — Settlement

- bank transfer
- cash
- partial settlement
- allocation
- confirmation

### Phase 6 — Reporting, Mobile UX & PWA

- history
- filters
- reports
- export
- mobile-first dashboard and task hierarchy
- fixed mobile bottom navigation
- garden context switcher
- role-aware mobile quick actions
- responsive breakpoints for smartphone, tablet, and desktop
- loading/empty/offline/error/retry states
- runtime error recovery screen
- installable PWA
- normal and maskable icon set
- offline draft

### Phase 7 — Production Hardening

- security review
- permission tests
- accounting consistency tests
- backup
- monitoring
- error logging
- E2E tests

---

## 36. Recommended Technical Architecture

PRD นี้ไม่บังคับ technology stack แต่ระบบควรใช้ architecture ที่รองรับ:

### Frontend

- mobile-first SPA/PWA
- camera access
- receipt preview
- offline draft

### Backend

- authenticated API
- transaction-safe database
- OCR orchestration
- calculation service
- audit service

### Database

ต้องเป็น relational database ที่รองรับ transaction

Recommended examples:

- PostgreSQL
- Supabase PostgreSQL

### Storage

Private object storage สำหรับ:

- receipts
- transfer slips
- dispute evidence

### OCR / AI

แยก OCR provider เป็น adapter เพื่อเปลี่ยน provider ได้ภายหลัง

ตัวอย่าง:

```text
OCRProvider
  ├─ GeminiProvider
  ├─ GoogleVisionProvider
  └─ FutureProvider
```

---

## 37. Engineering Rules

1. Money ใช้ decimal/numeric ห้ามใช้ floating point แบบ binary
2. Calculation ฝั่ง server เป็น source of truth
3. Client calculation ใช้เพื่อ preview เท่านั้น
4. Ledger posting ต้อง transaction เดียว
5. Confirmed records ห้าม hard delete
6. Agreement ต้อง versioned
7. File evidence ต้อง private
8. Permission check ต้องอยู่ server
9. Audit event ต้อง append-only
10. ทุก business rule สำคัญต้องมี automated test

---

## 38. Required Automated Tests

### Calculation

- 60/40
- 50/50
- 70/30
- custom split
- deduction before split
- owner expense
- tapper expense
- advance deduction
- rounding

### Settlement

- full
- partial
- multiple partial
- batch
- overpayment prevention

### Ledger

- balanced
- reversed
- adjusted
- immutable confirmed sale

### Permission

- Owner cannot edit tapper-only draft actions
- Tapper cannot confirm owner receipt
- unrelated users cannot access garden

### Duplicate

- same ticket
- same image
- similar receipt

---

## 39. Edge Cases

ระบบต้องรองรับอย่างน้อย:

- ไม่มีเลขบิล
- OCR อ่านวันที่ผิด
- น้ำหนักไม่ครบ
- ไม่มี DRC
- ไม่มีราคาต่อหน่วย
- มีแต่ยอดสุทธิ
- เจ้าของหลายวันค่อยรับเงิน
- จ่ายบางส่วนหลายครั้ง
- จ่ายเงินรวมหลายบิล
- เปลี่ยนคนกรีด
- เปลี่ยนเปอร์เซ็นต์
- คนกรีดหยุดทำงาน
- settlement ผิด
- sale ถูก dispute หลังบันทึก
- internet หลุดระหว่าง upload
- OCR timeout
- image ซ้ำ

---

## 40. Future Roadmap

### Phase 2+

- LINE notification
- multiple tappers per garden
- manager role
- farm expense ledger
- advanced analytics
- buyer price comparison
- receipt template learning
- automated slip verification
- GPS optional
- digital signature
- QR settlement confirmation
- multi-owner garden
- seasonal analytics
- payroll integration
- payment provider integration

---

## 41. Product Success Metrics

### Usage

- receipts scanned/day
- active gardens
- active owner-tapper pairs
- percentage OCR completed without re-entry

### Accuracy

- OCR correction rate
- calculation mismatch rate
- duplicate detection rate
- ledger imbalance incidents

### Trust

- dispute rate
- dispute resolution time
- outstanding owner funds
- average settlement delay

### UX

- median scan-to-wallet time
- task completion rate
- return usage

---

## 42. MVP Definition of Done

MVP จะถือว่า “พร้อมใช้งานจริง” เมื่อ:

- Owner และ Tapper สมัครและจับคู่กันได้
- สร้างสวนและ Agreement ได้
- เพิ่มประเภทสินค้าได้
- อัปโหลดบิลได้
- OCR ทำงานได้
- Manual correction ได้
- Sale calculation ถูกต้อง
- Dual Wallet ทำงานแบบ transaction-safe
- Owner review ได้
- Dispute ได้
- Transfer/Cash settlement ได้
- Partial settlement ถูกต้อง
- Outstanding คำนวณถูกต้อง
- มี audit trail
- ดู receipt ย้อนหลังได้
- export summary ได้
- responsive บนมือถือ
- PWA install ได้
- critical automated tests ผ่านทั้งหมด
- security permission tests ผ่าน
- ไม่มี ledger imbalance ใน test suite

---

## 43. Final Product Principle

ระบบนี้ต้องยึดหลัก 5 ข้อเสมอ:

1. **ข้อมูลชุดเดียวกัน** — เจ้าของและคนกรีดเห็นธุรกรรมเดียวกัน
2. **คำนวณตรวจสอบได้** — ทุกยอดแสดงสูตรและที่มา
3. **เงินกับสิทธิในเงินต้องแยกกัน** — กระเป๋าไม่ใช่ธนาคาร
4. **แก้ไขต้องมีร่องรอย** — ห้ามลบประวัติทางบัญชี
5. **ทุกบาทต้องอธิบายได้** — ยอดทั้งหมดต้อง balance และ trace กลับไปยังหลักฐานได้
