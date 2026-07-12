-- =====================================================================
-- Migration 02 — buffer blocks ("เวลาเผื่องานแทรก")
-- block ที่ task_id เป็น NULL = เวลาที่กันไว้ให้งานแทรก ไม่ผูกกับ task ไหน
-- รันใน Supabase → SQL Editor (สำหรับ DB ที่รัน 01_schema.sql ไปแล้ว)
-- =====================================================================

alter table blocks alter column task_id drop not null;
