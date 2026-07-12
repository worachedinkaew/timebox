import { TASK_COLORS } from '@/lib/types';
import type { OptionDef, Task } from '@/lib/types';

// สีประจำงาน — วนตาม cIdx ที่กำหนดตอนสร้างงาน
export const taskColor = (t: Task): string => TASK_COLORS[(t.cIdx || 0) % TASK_COLORS.length];

// สไตล์ chip ของ status/priority — พื้นหลังคือสีเดิมจางลง (เติม alpha 22)
export const chipStyle = (o: OptionDef): { background: string; color: string } => ({
  background: o.color + '22',
  color: o.color,
});
