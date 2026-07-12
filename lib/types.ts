// status/priority เป็น string เพราะผู้ใช้กำหนดชุดตัวเลือกเองได้ (เก็บใน user_options)
export type Status = string;
export type Priority = string;
export type FieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox';

export interface OptionDef {
  id: string;
  label: string;
  color: string;
  done?: boolean;   // เฉพาะ status: นับเป็น "จบงานแล้ว" (ไม่ขึ้น rail ใน Timebox)
}

export interface Task {
  id: string;
  title: string;
  desc: string;
  start: string | null;   // YYYY-MM-DD
  end: string | null;
  status: Status;
  priority: Priority;
  manday: number;
  cIdx: number;
  custom: Record<string, unknown>;
}

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  options: string[];
}

export interface Block {
  id: string;
  taskId: string | null;   // null = เวลาเผื่องานแทรก (buffer)
  date: string;   // YYYY-MM-DD
  slot: number;   // index ช่อง 30 นาทีจากเที่ยงคืน (16 = 08:00)
}

export interface DB {
  tasks: Task[];
  fields: FieldDef[];
  blocks: Block[];
  statuses: OptionDef[];
  priorities: OptionDef[];
}

export const DEFAULT_STATUSES: OptionDef[] = [
  { id: 'todo', label: 'To do', color: '#64748B' },
  { id: 'doing', label: 'In progress', color: '#4A8FC7' },
  { id: 'review', label: 'Review', color: '#7B6CB3' },
  { id: 'done', label: 'Done', color: '#2A9D8F', done: true },
];
// สีเทากลาง — ใช้เป็น fallback ของ option ที่หาไม่เจอ และสีเริ่มต้นของ option ใหม่
export const GREY = '#8A93A0';

export const DEFAULT_PRIORITIES: OptionDef[] = [
  { id: 'low', label: 'Low', color: GREY },
  { id: 'med', label: 'Med', color: '#4A8FC7' },
  { id: 'high', label: 'High', color: '#E9A23B' },
  { id: 'urgent', label: 'Urgent', color: '#E76F51' },
];
export const TASK_COLORS = ['#2A9D8F', '#E76F51', '#E9A23B', '#7B6CB3', '#4A8FC7', '#64748B'];

// หา option จาก id — ไม่เจอ (เช่น option ถูกลบ) ได้ chip เทาแต่แอปไม่พัง
export const optById = (list: OptionDef[], id: string): OptionDef =>
  list.find((o) => o.id === id) ?? { id, label: id || '—', color: GREY };
