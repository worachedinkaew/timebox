import { pad } from '@/lib/dates';

// slot = index ช่อง 30 นาทีจากเที่ยงคืน (16 = 08:00)

// ค่า sel ตอนเลือกแถว buffer — ใน DB บล็อก buffer คือแถวที่ taskId เป็น null
export const BUFID = '__buffer__';

export const cellKey = (date: string, slot: number) => `${date}|${slot}`;

export const slotTime = (s: number) => `${pad(Math.floor(s / 2))}:${s % 2 ? '30' : '00'}`;

// รวม slot ที่ติดกันเป็นช่วง [s0, s1] (inclusive) — เรียงให้ก่อน ไม่แก้ array เดิม
export function mergeSlots(slots: number[]): { s0: number; s1: number }[] {
  const sorted = [...slots].sort((a, b) => a - b);
  const out: { s0: number; s1: number }[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push({ s0: sorted[i], s1: sorted[j] });
    i = j + 1;
  }
  return out;
}

// ป้ายช่วงเวลา เช่น 11:30–13:00 (s1 เป็น slot สุดท้ายแบบ inclusive จึง +1)
export const slotRangeLabel = (s0: number, s1: number) => `${slotTime(s0)}–${slotTime(s1 + 1)}`;
