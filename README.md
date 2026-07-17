# จาเหมง รายรับรายจ่าย (Jarmeng Expense)

LINE Bot บันทึกรายรับ-รายจ่ายด้วยภาษาธรรมชาติ — พิมพ์ `กาแฟ 50` แล้วระบบแยกจำนวนเงิน
หมวดหมู่ และประเภทให้อัตโนมัติ

Stack: **Next.js (App Router) · Vercel · Supabase · LINE Messaging API · Gemini**

## สถานะการพัฒนา

| Phase | ขอบเขต | สถานะ |
|---|---|---|
| 1 | LINE Bot บันทึกแชท + keyword learning + LIFF dashboard | ✅ พร้อมใช้ (ยังไม่ผ่านการทดสอบกับ LINE จริง) |
| 2 | Gmail sync | 🟡 OAuth เสร็จ · ตัว sync ยังเป็นโครง (คืน 501) |
| 3 | Monthly report | 🟡 โครง + ฟังก์ชันสรุปพร้อมแล้ว (คืน 501) |

> Phase 1 ผ่าน unit test และ smoke test ระดับ HTTP แล้ว แต่ยังไม่เคยรันกับ LINE
> channel และ Supabase จริง — ดู [docs/SETUP.md](docs/SETUP.md) เพื่อเชื่อมต่อ

## เริ่มต้น

```bash
npm install
cp .env.example .env.local   # แล้วกรอกค่าให้ครบ
npm run dev
```

รัน SQL ใน [supabase/schema.sql](supabase/schema.sql) บน Supabase ก่อนใช้งาน

## คำสั่งของบอท

| พิมพ์ | ผลลัพธ์ |
|---|---|
| `กาแฟ 50` / `ค่าน้ำ 300 บาท` | บันทึกรายจ่าย |
| `+30000 ฟรีแลนซ์` / `เงินเดือน 45000` | บันทึกรายรับ |
| `สรุป` | ยอดรวมเดือนนี้ + หมวดที่ใช้มากสุด |
| `ลบ` | ลบรายการล่าสุด |
| `ช่วยเหลือ` | ดูคำสั่งทั้งหมด |

## สถาปัตยกรรม

Parsing engine เป็น **pure function** แยกจาก LINE/Supabase/HTTP ทั้งหมด จึงทดสอบได้
โดยไม่ต้องต่อ service จริง:

```
ข้อความ  →  extractDraft()      จำนวนเงิน + คำอธิบาย + ทิศทาง (ไม่มี I/O)
         →  categorize()        1. keywords ของ user  ← ไม่เรียก AI
                                2. Gemini             ← เรียกเมื่อ miss แล้วจำไว้
                                3. หมวด "อื่นๆ"        ← เมื่อ AI ล่ม ไม่ทิ้งรายการ
         →  insertTransaction()
```

ขั้นที่ 1 คือหัวใจเรื่องต้นทุนตาม PRD — ยิ่งใช้ ยิ่งเรียก AI น้อยลง
และ mapping เป็น **per-user** เพราะ "แมค" ของแต่ละคนไม่เหมือนกัน

| ไฟล์ | หน้าที่ |
|---|---|
| [src/lib/parser/draft.ts](src/lib/parser/draft.ts) | สกัดจำนวนเงิน/คำอธิบาย (pure) |
| [src/lib/parser/categorize.ts](src/lib/parser/categorize.ts) | keyword → AI → fallback |
| [src/lib/line/handler.ts](src/lib/line/handler.ts) | ประกอบทุกอย่างเข้าด้วยกัน |
| [src/app/api/line/webhook/route.ts](src/app/api/line/webhook/route.ts) | Webhook + ตรวจ signature |
| [src/app/liff/page.tsx](src/app/liff/page.tsx) | LIFF dashboard |

## คำสั่งที่ใช้บ่อย

```bash
npm test          # unit tests
npm run typecheck
npm run lint
npm run build
```

## เอกสาร

- [docs/SETUP.md](docs/SETUP.md) — ตั้งค่า LINE, Supabase, Gemini, deploy
- [docs/PRD_Expense_Tracker_Updated.md](docs/PRD_Expense_Tracker_Updated.md) — PRD ต้นฉบับ
