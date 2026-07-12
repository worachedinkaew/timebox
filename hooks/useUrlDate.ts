'use client';

import { useState } from 'react';
import { iso, mondayOf, parseISO } from '@/lib/dates';
import { getParam, setParam } from '@/lib/urlstate';

// state วันจันทร์ต้นสัปดาห์ (ISO) hydrate จาก URL param
// ผู้เรียกทุกตัว mount ฝั่ง client เท่านั้น (หลัง auth gate) อ่าน URL ใน initializer ได้เลย
// setter รับ urlValue แยกได้ — ส่ง null เพื่อลบ param ออกจาก URL (เช่น Gantt เมื่อกลับมาช่วง default)
export function useUrlDate(key: string, fallback: () => string) {
  const [value, setValueRaw] = useState(() => {
    const v = getParam(key);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? iso(mondayOf(parseISO(v))) : fallback();
  });
  const setValue = (v: string, urlValue: string | null = v) => {
    setValueRaw(v);
    setParam(key, urlValue);
  };
  return [value, setValue] as const;
}
