# PRD: ระบบบันทึกรายรับ-รายจ่ายผ่าน LINE (Modern Stack Edition)

## 1. บทสรุปโครงการ (Executive Summary)
พัฒนาระบบ LINE Bot อัจฉริยะเพื่อบันทึกธุรกรรมการเงิน โดยใช้สถาปัตยกรรม Modern Web (Next.js + Vercel + Supabase) เน้นความรวดเร็วในการพัฒนา ความเสถียร และความสามารถในการขยายตัวเพื่อรองรับผู้ใช้งานระดับ 100,000 คน

## 2. คุณสมบัติหลัก (Key Features)
*   **Natural Language Entry:** ผู้ใช้พิมพ์แชท (เช่น "กาแฟ 50 บาท") ระบบประมวลผลผ่าน AI API เพื่อแยกข้อมูลอัตโนมัติ
*   **Smart Auto-Categorization:** ระบบเรียนรู้และบันทึก Keyword ของผู้ใช้แต่ละรายลง Supabase เพื่อใช้ในการคัดแยกอัตโนมัติในอนาคต (ลดการเรียก AI API)
*   **Personal Dashboard (LIFF):** ใช้ Next.js สร้างหน้าเว็บ LIFF เพื่อแสดงสรุปรายรับ-รายจ่ายแบบ Real-time
*   **Personalization:** ระบบจดจำพฤติกรรมการใช้จ่ายเฉพาะบุคคล (User-Specific Mapping)
*   **Automated Email Parsing:** เชื่อมต่อ Gmail ของผู้ใช้เพื่อดึงข้อมูลธุรกรรมจากอีเมลแจ้งเตือนการชำระเงินโดยอัตโนมัติ

## 3. สถาปัตยกรรมทางเทคนิค (Technical Stack)
*   **Frontend & API:** Next.js (App Router)
*   **Deployment:** Vercel (ใช้ Serverless Functions)
*   **Database & Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
*   **Messaging:** LINE Messaging API
*   **Email Integration:** Gmail API (OAuth 2.0)
*   **Intelligence:** AI API (เช่น OpenAI GPT-4o-mini หรือ Gemini API) เพื่อสกัดข้อมูลจากแชทและอีเมล

## 4. แผนผังการทำงานของระบบ (System Workflow)
1.  **Webhook Trigger:** LINE ส่งข้อมูลผ่าน Webhook มาที่ `Next.js API Route`
2.  **Validation:** ตรวจสอบความถูกต้องของ LINE Signature
3.  **Parsing Engine:**
    *   ค้นหาในฐานข้อมูล `Keywords` (Supabase) ว่าคำนี้คือหมวดหมู่ไหน
    *   หากไม่พบ ให้ส่งไปประมวลผลที่ `AI API` เพื่อจำแนกประเภท
    *   บันทึกผลลัพธ์ลง `Keywords` Table เพื่อการใช้งานครั้งต่อไป
4.  **Transaction Storage:** บันทึกข้อมูลลงตาราง `Transactions` ใน Supabase
5.  **Email Sync (Gmail API):**
    *   ผู้ใช้ยินยอมผ่าน OAuth 2.0
    *   ระบบตรวจสอบอีเมลใหม่ (Gmail Push หรือ Polling)
    *   AI API สกัดข้อมูลจากอีเมล -> บันทึกอัตโนมัติ

## 5. การจัดการข้อมูลและการขยายตัว (Scalability & Data)
*   **Database Optimization:** ใช้ Supabase Connection Pooling (PgBouncer)
*   **Cost Efficiency:** เน้นการใช้ `Keyword Mapping` ใน Supabase เป็นลำดับแรก
*   **Monitoring:** ใช้ Vercel Analytics และ Supabase Dashboard

## 6. ข้อกำหนดด้านความปลอดภัย (Security & Compliance)
*   **PDPA Compliance:** จัดเก็บข้อมูลอย่างปลอดภัยบน Supabase
*   **Auth:** ใช้ LINE User ID และ Google OAuth 2.0 สำหรับเชื่อมต่ออีเมล
*   **Sensitive Data:** ข้อมูลอีเมลจะถูกสกัดเฉพาะรายการธุรกรรม (จำนวนเงิน, ร้านค้า, วันที่) และไม่เก็บเนื้อหาอีเมลที่ไม่เกี่ยวข้อง

## 7. แผนพัฒนาอนาคต (Future Roadmap)
*   **Phase 1 (MVP):** LINE Bot บันทึกข้อความแชทพื้นฐาน
*   **Phase 2 (Automation):** ระบบเชื่อมต่อ Gmail API เพื่อดึงข้อมูลรายจ่ายอัตโนมัติ
*   **Phase 3 (Intelligence):** ระบบสรุปยอดรายเดือน (Monthly Report) และแนะนำการออมอัจฉริยะ
