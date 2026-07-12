import type { OptionDef, Task } from '@/lib/types';

// เซ็ต id ของ status ที่ติดธง done — ใช้กรองงานที่จบแล้ว
export const doneStatusIds = (statuses: OptionDef[]): Set<string> =>
  new Set(statuses.filter((s) => s.done).map((s) => s.id));

// งานคาบเกี่ยววันนี้ไหม (ds เป็น YYYY-MM-DD — เทียบ string ได้เลย)
export const taskOnDay = (t: Task, ds: string): boolean =>
  !!(t.start && t.end && ds >= t.start && ds <= t.end);
