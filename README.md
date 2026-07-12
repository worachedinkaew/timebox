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
app/
  page.tsx (+ page.module.css)   auth gate + state + filter + tab routing
  globals.css                    design tokens + shared primitives (.btn .chip .mono …)
components/
  views/                         view ละไฟล์ + .module.css คู่กัน
    config.ts                    รายชื่อ tab (VIEWS)
    ListView / KanbanView / GanttView / TimeboxView / CalendarView / DashboardView
  modals/
    TaskModal.tsx                ฟอร์มเพิ่ม/แก้งาน
    FieldManager.tsx             ตั้งค่า status/priority + custom fields
    Modal.module.css             โครง modal ที่ใช้ร่วมกัน
  ui/
    MultiSelect.tsx              dropdown เลือกหลายค่า (filter bar)
    nav.module.css               แถบเลื่อนสัปดาห์ (Timebox + Gantt)
  Login.tsx                      หน้าล็อกอิน
hooks/
  useUrlDate.ts                  state วันที่ sync กับ URL param (?w= ?g=)
  useHours.ts                    ช่วงชั่วโมง Timebox (localStorage)
  useTimeboxPaint.ts             engine ลากระบายเวลาในกริด Timebox
lib/
  supabase.ts                    client (anon key)
  types.ts                       types + DEFAULT_STATUSES/PRIORITIES/TASK_COLORS
  db.ts                          auth + loadAll + taskApi/blockApi/fieldApi
  dates.ts / hours.ts / urlstate.ts / slots.ts / colors.ts / tasks.ts   utils
supabase/                        schema + RLS + migrations
```

สไตล์เป็น **CSS Modules** ต่อ component — globals.css เหลือเฉพาะ design tokens
กับ shared primitives ที่ใช้ร่วมกันหลายที่ (`.btn .chip .dot .mono .muted .sp .scroll .placeholder .pbar .brand`)

## สถานะ view

1. ✅ **Kanban** — คอลัมน์ตาม status + drag (@dnd-kit รองรับ touch) — `components/views/KanbanView.tsx`
2. ✅ **Gantt** — แท่งตาม start/end + เส้นวันนี้ เลื่อนช่วงวันที่ได้ครั้งละสัปดาห์ (`?g=`) — `components/views/GanttView.tsx`
3. ✅ **Timebox** — กริดลากระบายเวลา บันทึกเป็น batch ตอนปล่อยนิ้ว, "เวลาเผื่องานแทรก" (buffer),
   ช่วงชั่วโมงที่แสดงปรับได้ (เก็บใน localStorage) — `components/views/TimeboxView.tsx`
4. ✅ **Calendar** — มุมมองเดือน / สัปดาห์ / วัน (`?cm=`) — `components/views/CalendarView.tsx`
5. ✅ **Filter** — ค้นหาชื่อ/รายละเอียด + กรอง status/priority แบบ multi-select ใช้ร่วมกันทุก view (`?q= ?st=a,b ?pr=x,y`)
6. ✅ **Custom status/priority** — ปุ่ม "⚙ ตั้งค่า" เพิ่ม/ลบ/เปลี่ยนชื่อ/สี/ลำดับได้ (เช่นเพิ่ม Cancel)
   สถานะติดธง "เสร็จ" ได้เพื่อไม่ให้ขึ้น rail ใน Timebox — เก็บใน `user_options` ต่อ user

migration สำหรับ DB ที่สร้างก่อนหน้า (รันตามลำดับใน SQL Editor):

- `supabase/02_buffer_blocks.sql` — ทำ `blocks.task_id` เป็น nullable (buffer)
- `supabase/03_absolute_slots.sql` — เปลี่ยน slot เป็น index จากเที่ยงคืน (รันครั้งเดียว!)
- `supabase/04_custom_options.sql` — status/priority เป็น text + ตาราง `user_options`

และครบตามแผนเฟสแรกแล้ว:

- ✅ **Field manager** — ปุ่ม "⚙ ฟิลด์" เพิ่ม/ลบ custom field — `components/modals/FieldManager.tsx`
- ✅ **URL query** — view (`?v=`), สัปดาห์ timebox (`?w=`), เดือนปฏิทิน (`?m=`) อยู่ใน URL แชร์ลิงก์/refresh ไม่หลุด

prototype ต้นทางอยู่ที่ `docs/timebox-task-manager.html`
