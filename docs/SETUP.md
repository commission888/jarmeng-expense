# การตั้งค่า

ทำตามลำดับนี้ ทุกค่าที่ได้มาให้ใส่ใน `.env.local` (ดู `.env.example`)

## 1. Supabase

1. สร้าง project แล้วเปิด **SQL Editor**
2. รัน [`supabase/schema.sql`](../supabase/schema.sql) ทั้งไฟล์
3. **Project Settings → API** คัดลอก:
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

> ทุกตารางเปิด RLS ไว้โดยไม่มี policy ใดอนุญาต — การเข้าถึงทั้งหมดผ่าน server
> ด้วย service-role key หลังยืนยันตัวตน LINE แล้วเท่านั้น
> **ห้ามนำ service-role key ไปใช้ฝั่ง browser เด็ดขาด**

## 2. Gemini

1. รับ API key ที่ https://aistudio.google.com/apikey
2. `GEMINI_API_KEY` — ส่วน `GEMINI_MODEL` ใช้ค่า default `gemini-2.5-flash` ได้

## 3. LINE Messaging API

1. https://developers.line.biz/console → สร้าง **Messaging API channel**
2. **Basic settings** → Channel secret → `LINE_CHANNEL_SECRET`
3. **Messaging API** → Issue channel access token → `LINE_CHANNEL_ACCESS_TOKEN`
4. **Messaging API** → ตั้งค่า:
   - Webhook URL: `https://<โดเมนของคุณ>/api/line/webhook`
   - Use webhook: **เปิด**
   - Auto-reply messages: **ปิด** (ไม่งั้นบอทจะตอบซ้อนกับข้อความอัตโนมัติ)

### ทดสอบ webhook บนเครื่อง

LINE ต้องการ HTTPS สาธารณะ จึงต้องเปิด tunnel:

```bash
npm run dev
npx localtunnel --port 3000     # หรือ ngrok http 3000
```

เอา URL ที่ได้ไปใส่เป็น Webhook URL แล้วกด **Verify**

## 4. LIFF Dashboard

1. สร้าง **LINE Login channel** แล้วเพิ่ม LIFF app
   - Endpoint URL: `https://<โดเมนของคุณ>/liff`
   - Scope: `profile`, `openid`
2. LIFF ID → `NEXT_PUBLIC_LIFF_ID`
3. Channel ID ของ LINE Login channel → `LINE_LOGIN_CHANNEL_ID`

> `LINE_LOGIN_CHANNEL_ID` ไม่ใช่ค่าที่ข้ามได้ — เป็นตัวที่ LINE ใช้ตรวจว่า
> ID token ออกให้แอปเรา ถ้าไม่ตั้ง server จะปฏิเสธการยืนยันทั้งหมด

## 5. Deploy บน Vercel

1. push ขึ้น GitHub แล้ว import เข้า Vercel
2. ใส่ env ทุกตัวใน **Settings → Environment Variables**
3. อัปเดต Webhook URL และ LIFF Endpoint ให้ชี้โดเมน production

## Phase 2 — Gmail (ยังไม่เสร็จ)

OAuth flow ใช้งานได้แล้ว แต่ตัว sync ยังเป็นโครง — ดู TODO ใน
[`src/app/api/cron/gmail-sync/route.ts`](../src/app/api/cron/gmail-sync/route.ts)

ถ้าจะทำต่อ:

1. Google Cloud Console → เปิด **Gmail API** → สร้าง OAuth client (Web)
2. Authorized redirect URI: `https://<โดเมน>/api/gmail/callback`
3. ใส่ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

> **ก่อนขึ้น production:** ตอนนี้ `gmail_accounts.refresh_token` เก็บเป็น plaintext
> ในตารางที่เข้าถึงได้เฉพาะ service-role ซึ่งเพียงพอสำหรับ dev แต่ token นี้คือสิทธิ์
> อ่านเมลระยะยาว ควรเข้ารหัสก่อนเก็บ (เช่น Supabase Vault) ตามข้อกำหนด PDPA ใน PRD

## Phase 3 — Monthly report (ยังไม่เสร็จ)

ฟังก์ชันสรุปพร้อมแล้ว (`summarize()`, `bangkokMonthRange()`) เหลือส่วนวน user
และ push message — ดู TODO ใน
[`src/app/api/cron/monthly-report/route.ts`](../src/app/api/cron/monthly-report/route.ts)

เมื่อทำเสร็จให้เพิ่ม schedule ใน `vercel.json` และตั้ง `CRON_SECRET`
(route จะปฏิเสธการเรียกทั้งหมดจนกว่าจะตั้งค่า — fail closed โดยตั้งใจ)
