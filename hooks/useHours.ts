'use client';

import { useState } from 'react';
import { loadHours, saveHours } from '@/lib/hours';

// ช่วงชั่วโมงที่แสดงของ Timebox — state + persist ลง localStorage ทุกครั้งที่แก้
export function useHours() {
  const [hours, setHoursRaw] = useState(loadHours);
  const setHours = (h: { start: number; end: number }) => {
    setHoursRaw(h);
    saveHours(h);
  };
  return [hours, setHours] as const;
}
