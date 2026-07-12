# Timebox — Next.js + Supabase (Phase 0)

โปรเจกต์ตั้งต้นที่ **รันได้จริง**: ล็อกอิน + List view + ต่อ Supabase (cross-device, หลายคนแยกกันด้วย RLS)
Kanban / Gantt / Timebox / Calendar เตรียม tab ไว้แล้ว ต่อในเฟสถัดไป (logic อยู่ในไฟล์ prototype)

> เขียนลงเครื่องคุณตรงๆ จากแชทไม่ได้ ทำตามขั้นตอนนี้ในโฟลเดอร์
> `/Users/worachedinkaew/Desktop/Ufriend/Repositories/timebox`

---

## 1) สร้าง Next.js project

```bash
cd /Users/worachedinkaew/Desktop/Ufriend/Repositories
npx create-next-app@latest timebox --typescript --app --eslint --no-src-dir --import-alias "@/*"
cd timebox
npm install @supabase/supabase-js
```
(ถ้าโฟลเดอร์ timebox มีอยู่แล้วและว่าง ให้รัน `create-next-app` ในนั้นได้เลย หรือสร้างชื่ออื่นแล้วย้ายไฟล์)

## 2) วางไฟล์จากชุดนี้ทับ

คัดลอกไฟล์เหล่านี้เข้าโปรเจกต์ (ทับของเดิมถ้าซ้ำ):

```
lib/supabase.ts
lib/types.ts
lib/db.ts
app/layout.tsx
app/page.tsx
app/globals.css        ← ทับ globals.css เดิมของ create-next-app
supabase/01_schema.sql
.env.local.example
```

## 3) ตั้งค่า Supabase

1. สร้าง project ที่ supabase.com
2. **SQL Editor** → วาง `supabase/01_schema.sql` → Run
3. **Authentication → Providers** → เปิด Google (หรือใช้ magic link ทางอีเมลได้เลยไม่ต้องตั้ง)
4. **Authentication → URL Configuration** → ใส่ Site URL `http://localhost:3000`
5. คัดลอก `.env.local.example` เป็น `.env.local` แล้วเติมค่าจาก **Settings → API**
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

## 4) รัน

```bash
npm run dev
```
เปิด http://localhost:3000 → ล็อกอิน → กด "+ งานใหม่" → เพิ่มงาน ข้อมูลจะเข้า Supabase จริง
ลองเปิดในมือถือ (ผ่าน IP เครื่อง) ล็อกอินบัญชีเดียวกัน จะเห็นข้อมูลตรงกัน

---

## โครงไฟล์

```
lib/supabase.ts   client (anon key)
lib/types.ts      types + STATUSES/PRIORITIES/TASK_COLORS
lib/db.ts         auth + loadAll + taskApi/blockApi/fieldApi
app/page.tsx      auth gate + tabs + List view + task modal
app/globals.css   design tokens + styles
supabase/         schema + RLS
```

## เฟสถัดไป (แนะนำให้ทำใน Claude Code ในโฟลเดอร์นี้เลย)

1. **Kanban** — คอลัมน์ตาม status + drag (ใช้ @dnd-kit สำหรับ touch บนมือถือ)
2. **Gantt** — แท่งตาม start/end (logic คำนวณ pixel อยู่ใน prototype)
3. **Timebox** — พอร์ตกริดระบายเวลา + `blockApi` (manday × 8 = ชม.)
4. **Calendar** — เดือน grid ตามช่วงวันที่
5. **Field manager** — เพิ่ม/ลบ custom field (`fieldApi`)
6. เก็บ view/สัปดาห์ที่เลือกไว้ใน URL query เพื่อแชร์ลิงก์/refresh ไม่หลุด

โค้ดทั้ง 5 view เขียนไว้ครบแล้วในไฟล์ prototype (`timebox-task-manager.html`) —
งานคือย้าย render logic มาเป็น React component แล้วต่อ `db.ts` แทน in-memory
