-- =====================================================================
-- Migration 04 — status/priority ปรับแต่งได้ต่อ user (เช่นเพิ่ม Cancel)
-- 1) แปลงคอลัมน์ enum → text เพื่อรองรับค่าที่ผู้ใช้กำหนดเอง
-- 2) ตาราง user_options เก็บชุดตัวเลือกของแต่ละคน (ว่าง = ใช้ค่า default ของแอป)
-- รันใน Supabase → SQL Editor (สำหรับ DB ที่รัน 01_schema.sql ไปแล้ว)
-- =====================================================================

alter table tasks alter column status drop default;
alter table tasks alter column status type text using status::text;
alter table tasks alter column status set default 'todo';

alter table tasks alter column priority drop default;
alter table tasks alter column priority type text using priority::text;
alter table tasks alter column priority set default 'med';

drop type if exists task_status;
drop type if exists task_priority;

create table user_options (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  statuses   jsonb not null default '[]'::jsonb,   -- [{id,label,color,done?}]
  priorities jsonb not null default '[]'::jsonb,   -- [{id,label,color}]
  updated_at timestamptz not null default now()
);

alter table user_options enable row level security;
create policy "own options (select)" on user_options for select using (auth.uid() = user_id);
create policy "own options (insert)" on user_options for insert with check (auth.uid() = user_id);
create policy "own options (update)" on user_options for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own options (delete)" on user_options for delete using (auth.uid() = user_id);

create trigger user_options_set_user before insert on user_options for each row execute function set_user_id();
