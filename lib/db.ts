import { supabase } from './supabase';
import type { DB, Task, FieldDef } from './types';

// ---------------- AUTH ----------------
export const authApi = {
  signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
  },
  signInWithEmail(email: string) {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
  },
  signOut() { return supabase.auth.signOut(); },
  async getUser() { const { data } = await supabase.auth.getUser(); return data.user; },
  onChange(cb: (userId: string | null) => void) {
    return supabase.auth.onAuthStateChange((_e, session) => cb(session?.user?.id ?? null));
  },
};

// ---------------- MAPPERS ----------------
/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToTask(r: any): Task {
  return {
    id: r.id, title: r.title, desc: r.description,
    start: r.start_date, end: r.end_date,
    status: r.status, priority: r.priority,
    manday: Number(r.manday), cIdx: r.color_idx, custom: r.custom || {},
  };
}
function taskToRow(t: Task) {
  return {
    id: t.id, title: t.title, description: t.desc || '',
    start_date: t.start || null, end_date: t.end || null,
    status: t.status, priority: t.priority,
    manday: t.manday, color_idx: t.cIdx || 0, custom: t.custom || {},
  };
}

// ---------------- LOAD ----------------
export async function loadAll(): Promise<DB> {
  const [tasks, fields, blocks] = await Promise.all([
    supabase.from('tasks').select('*').order('sort'),
    supabase.from('field_defs').select('*').order('sort'),
    supabase.from('blocks').select('*'),
  ]);
  if (tasks.error) throw tasks.error;
  if (fields.error) throw fields.error;
  if (blocks.error) throw blocks.error;
  return {
    tasks: (tasks.data || []).map(rowToTask),
    fields: (fields.data || []).map((f: any) => ({ id: f.id, label: f.label, type: f.type, options: f.options || [] })),
    blocks: (blocks.data || []).map((b: any) => ({ id: b.id, taskId: b.task_id, date: b.date, slot: b.slot })),
  };
}

// ---------------- MUTATIONS ----------------
export const taskApi = {
  async save(task: Task): Promise<Task> {
    const { data, error } = await supabase.from('tasks').upsert(taskToRow(task)).select().single();
    if (error) throw error;
    return rowToTask(data);
  },
  async remove(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },
};

export const blockApi = {
  async add(taskId: string, date: string, slot: number) {
    const { error } = await supabase.from('blocks')
      .upsert({ task_id: taskId, date, slot }, { onConflict: 'user_id,date,slot' });
    if (error) throw error;
  },
  async removeAt(date: string, slot: number) {
    const { error } = await supabase.from('blocks').delete().eq('date', date).eq('slot', slot);
    if (error) throw error;
  },
};

export const fieldApi = {
  async create(field: Omit<FieldDef, 'id'>): Promise<FieldDef> {
    const { data, error } = await supabase.from('field_defs')
      .insert({ label: field.label, type: field.type, options: field.options || [] })
      .select().single();
    if (error) throw error;
    return { id: data.id, label: data.label, type: data.type, options: data.options || [] };
  },
  async remove(id: string) {
    const { error } = await supabase.from('field_defs').delete().eq('id', id);
    if (error) throw error;
  },
};
