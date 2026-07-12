'use client';

import { useState } from 'react';
import { taskApi } from '@/lib/db';
import type { DB, Priority, Status, Task } from '@/lib/types';

export default function TaskModal({ task, defaults, db, onClose, onSaved }: { task: Task | null; defaults?: Partial<Task>; db: DB; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Task>(
    task ?? {
      id: crypto.randomUUID(), title: '', desc: '', start: today, end: today,
      status: db.statuses[0]?.id ?? 'todo',
      priority: db.priorities[Math.min(1, db.priorities.length - 1)]?.id ?? 'med',
      manday: 1, cIdx: db.tasks.length, custom: {}, ...defaults,
    }
  );
  const set = (patch: Partial<Task>) => setF((prev) => ({ ...prev, ...patch }));
  const setCustom = (id: string, v: unknown) => setF((prev) => ({ ...prev, custom: { ...prev.custom, [id]: v } }));

  async function save() {
    const t = { ...f, title: f.title || '(ไม่มีชื่อ)' };
    if (t.end && t.start && t.end < t.start) t.end = t.start;
    try { await taskApi.save(t); onSaved(); } catch (e) { console.error(e); alert('บันทึกไม่สำเร็จ'); }
  }
  async function remove() {
    if (!task) return;
    if (confirm('ลบงานนี้?')) { try { await taskApi.remove(task.id); onSaved(); } catch (e) { console.error(e); } }
  }

  return (
    <div className="ov" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="mhd"><h3>{task ? 'แก้ไขงาน' : 'งานใหม่'}</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="mbd">
          <div className="fld"><label>งาน</label><input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="ชื่องาน" /></div>
          <div className="fld"><label>Description</label><textarea value={f.desc} onChange={(e) => set({ desc: e.target.value })} /></div>
          <div className="row2">
            <div className="fld"><label>Status</label>
              <select value={f.status} onChange={(e) => set({ status: e.target.value as Status })}>
                {db.statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="fld"><label>Priority</label>
              <select value={f.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
                {db.priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="row2">
            <div className="fld"><label>Start date</label><input type="date" value={f.start ?? ''} onChange={(e) => set({ start: e.target.value })} /></div>
            <div className="fld"><label>End date</label><input type="date" value={f.end ?? ''} onChange={(e) => set({ end: e.target.value })} /></div>
          </div>
          <div className="fld"><label>Manday (1 = 8 ชม.)</label><input type="number" min={0} step={0.125} value={f.manday} onChange={(e) => set({ manday: parseFloat(e.target.value) || 0 })} /></div>
          {db.fields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 9 }}>CUSTOM FIELDS</div>
              {db.fields.map((fd) => (
                <div className="fld" key={fd.id}>
                  <label>{fd.label}</label>
                  {fd.type === 'select' ? (
                    <select value={String(f.custom?.[fd.id] ?? '')} onChange={(e) => setCustom(fd.id, e.target.value)}>
                      <option value="">—</option>
                      {fd.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : fd.type === 'checkbox' ? (
                    <label style={{ fontWeight: 400 }}><input type="checkbox" checked={!!f.custom?.[fd.id]} onChange={(e) => setCustom(fd.id, e.target.checked)} /> ใช่</label>
                  ) : (
                    <input type={fd.type === 'number' ? 'number' : fd.type === 'date' ? 'date' : 'text'} value={String(f.custom?.[fd.id] ?? '')} onChange={(e) => setCustom(fd.id, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mft">
          {task && <button className="btn del" onClick={remove}>ลบงาน</button>}
          <div className="sp" />
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn pri" onClick={save}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}
