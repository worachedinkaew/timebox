-- =====================================================================
-- Timebox — Supabase schema (personal app, multi-tenant by user)
-- โมเดล "แบบ A": ต่างคนต่างมี task ของตัวเอง แยกขาดกันด้วย RLS
-- รันไฟล์นี้ใน Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---- ENUMS (สถานะ / priority ให้ค่าคงที่ ป้องกันพิมพ์มั่ว) ----
create type task_status   as enum ('todo','doing','review','done');
create type task_priority as enum ('low','med','high','urgent');
create type field_type    as enum ('text','number','select','date','checkbox');

-- =====================================================================
-- TABLES
-- ทุกตารางมี user_id ชี้ไปที่เจ้าของ (auth.users) — คือแกนของ RLS
-- =====================================================================

-- นิยาม custom field ของแต่ละ user
create table field_defs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null,
  type       field_type not null default 'text',
  options    jsonb not null default '[]'::jsonb,   -- ใช้เฉพาะ type = select
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

-- งาน
create table tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  description text not null default '',
  start_date  date,
  end_date    date,
  status      task_status   not null default 'todo',
  priority    task_priority not null default 'med',
  manday      numeric(5,3)  not null default 1,      -- 1 manday = 8 ชม.
  color_idx   int  not null default 0,
  custom      jsonb not null default '{}'::jsonb,     -- ค่า custom field: { "<field_id>": value }
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint end_after_start check (end_date is null or start_date is null or end_date >= start_date)
);

-- บล็อกเวลาใน timebox (1 แถว = 1 ช่อง 30 นาที)
-- task_id เป็น NULL = "เวลาเผื่องานแทรก" (buffer) ไม่ผูกกับ task ไหน
create table blocks (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  task_id  uuid references tasks(id) on delete cascade,
  date     date not null,
  slot     int  not null,     -- index ช่อง 30 นาที (0 = เวลาเริ่มของวัน)
  created_at timestamptz not null default now(),
  unique (user_id, date, slot)   -- 1 ช่องมีได้งานเดียว
);

-- indexes ที่ query บ่อย
create index tasks_user_idx      on tasks(user_id);
create index tasks_user_status   on tasks(user_id, status);
create index blocks_user_date    on blocks(user_id, date);
create index blocks_task_idx     on blocks(task_id);
create index field_defs_user_idx on field_defs(user_id);

-- อัปเดต updated_at อัตโนมัติ
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger tasks_touch before update on tasks
  for each row execute function touch_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- เปิด RLS แล้วให้ทุก action ผ่านเฉพาะแถวที่ user_id = คนที่ล็อกอิน
-- นี่คือสิ่งที่ทำให้ "หลายคนใช้ แต่เห็นแค่ของตัวเอง" ปลอดภัยระดับ DB
-- =====================================================================

alter table field_defs enable row level security;
alter table tasks      enable row level security;
alter table blocks     enable row level security;

-- field_defs
create policy "own field_defs (select)" on field_defs for select using (auth.uid() = user_id);
create policy "own field_defs (insert)" on field_defs for insert with check (auth.uid() = user_id);
create policy "own field_defs (update)" on field_defs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own field_defs (delete)" on field_defs for delete using (auth.uid() = user_id);

-- tasks
create policy "own tasks (select)" on tasks for select using (auth.uid() = user_id);
create policy "own tasks (insert)" on tasks for insert with check (auth.uid() = user_id);
create policy "own tasks (update)" on tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks (delete)" on tasks for delete using (auth.uid() = user_id);

-- blocks
create policy "own blocks (select)" on blocks for select using (auth.uid() = user_id);
create policy "own blocks (insert)" on blocks for insert with check (auth.uid() = user_id);
create policy "own blocks (update)" on blocks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own blocks (delete)" on blocks for delete using (auth.uid() = user_id);

-- =====================================================================
-- (ทางเลือก) ใส่ user_id อัตโนมัติจากคนที่ล็อกอิน เวลา insert
-- ทำให้ฝั่ง client ไม่ต้องส่ง user_id เอง — insert แล้ว trigger เติมให้
-- =====================================================================
create or replace function set_user_id() returns trigger as $$
begin
  if new.user_id is null then new.user_id = auth.uid(); end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger tasks_set_user      before insert on tasks      for each row execute function set_user_id();
create trigger blocks_set_user     before insert on blocks     for each row execute function set_user_id();
create trigger field_defs_set_user before insert on field_defs for each row execute function set_user_id();
