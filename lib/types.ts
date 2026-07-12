export type Status = 'todo' | 'doing' | 'review' | 'done';
export type Priority = 'low' | 'med' | 'high' | 'urgent';
export type FieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox';

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
  slot: number;
}

export interface DB {
  tasks: Task[];
  fields: FieldDef[];
  blocks: Block[];
}

export const STATUSES: { id: Status; label: string; color: string }[] = [
  { id: 'todo', label: 'To do', color: '#64748B' },
  { id: 'doing', label: 'In progress', color: '#4A8FC7' },
  { id: 'review', label: 'Review', color: '#7B6CB3' },
  { id: 'done', label: 'Done', color: '#2A9D8F' },
];
export const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: 'low', label: 'Low', color: '#8A93A0' },
  { id: 'med', label: 'Med', color: '#4A8FC7' },
  { id: 'high', label: 'High', color: '#E9A23B' },
  { id: 'urgent', label: 'Urgent', color: '#E76F51' },
];
export const TASK_COLORS = ['#2A9D8F', '#E76F51', '#E9A23B', '#7B6CB3', '#4A8FC7', '#64748B'];
