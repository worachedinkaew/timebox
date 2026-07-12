'use client';

import { useEffect, useState, useCallback } from 'react';
import { authApi, loadAll, taskApi } from '../lib/db';
import { STATUSES, PRIORITIES, TASK_COLORS } from '../lib/types';
import type { Block, DB, Task, Status, Priority } from '../lib/types';
import { fmtShort } from '../lib/dates';
import KanbanView from '../components/KanbanView';
import GanttView from '../components/GanttView';
import TimeboxView from '../components/TimeboxView';
import CalendarView from '../components/CalendarView';

const VIEWS = [
  ['list', '≣ List'],
  ['kanban', '▤ Kanban'],
  ['gantt', '▥ Gantt'],
  ['timebox', '▦ Timebox'],
  ['calendar', '▧ Calendar'],
] as const;
type View = (typeof VIEWS)[number][0];

const st = (id: string) => STATUSES.find((x) => x.id === id) ?? STATUSES[0];
const pr = (id: string) => PRIORITIES.find((x) => x.id === id) ?? PRIORITIES[0];

export default function Page() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<DB | null>(null);
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<{ task: Task | null; defaults?: Partial<Task> } | null>(null);

  useEffect(() => {
    authApi.getUser().then((u) => { setUserId(u?.id ?? null); setReady(true); });
    const { data } = authApi.onChange((id) => setUserId(id));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try { setDb(await loadAll()); } catch (e) { console.error(e); }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadAll().then(setDb).catch(console.error);
  }, [userId]);

  // optimistic update: อัปเดตหน้าจอทันที ยิง API ตามหลัง พังค่อยโหลดใหม่
  const moveTask = useCallback((task: Task, status: Status) => {
    const updated = { ...task, status };
    setDb((d) => d && { ...d, tasks: d.tasks.map((t) => (t.id === task.id ? updated : t)) });
    taskApi.save(updated).catch((e) => { console.error(e); refresh(); });
  }, [refresh]);

  const updateBlocks = useCallback((up: (blocks: Block[]) => Block[]) => {
    setDb((d) => d && { ...d, blocks: up(d.blocks) });
  }, []);

  if (!ready) return <div className="placeholder">กำลังโหลด…</div>;
  if (!userId) return <Login />;

  return (
    <div className="app">
      <div className="top">
        <div className="brand"><span className="mk" />Timebox</div>
        <div className="tabs">
          {VIEWS.map(([v, label]) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
        <div className="sp" />
        <button className="btn" onClick={() => authApi.signOut()}>ออกจากระบบ</button>
        <button className="btn pri" onClick={() => setEditing({ task: null })}>+ งานใหม่</button>
      </div>

      <div className="panel">
        {!db ? (
          <div className="placeholder">กำลังโหลดข้อมูล…</div>
        ) : view === 'list' ? (
          <ListView db={db} onEdit={(t) => setEditing({ task: t })} />
        ) : view === 'kanban' ? (
          <KanbanView
            db={db}
            onEdit={(t) => setEditing({ task: t })}
            onAdd={(status) => setEditing({ task: null, defaults: { status } })}
            onMove={moveTask}
          />
        ) : view === 'gantt' ? (
          <GanttView db={db} onEdit={(t) => setEditing({ task: t })} />
        ) : view === 'timebox' ? (
          <TimeboxView db={db} updateBlocks={updateBlocks} onError={refresh} />
        ) : (
          <CalendarView db={db} onEdit={(t) => setEditing({ task: t })} />
        )}
      </div>

      {editing && (
        <TaskModal
          task={editing.task}
          defaults={editing.defaults}
          db={db!}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh(); }}
        />
      )}
    </div>
  );
}

// ---------------- LIST ----------------
function ListView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  const order = STATUSES.map((s) => s.id);
  const rows = [...db.tasks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const color = (t: Task) => TASK_COLORS[(t.cIdx || 0) % TASK_COLORS.length];
  return (
    <div className="scroll">
      <table className="lst">
        <thead>
          <tr>
            <th>งาน</th><th>สถานะ</th><th>Priority</th><th>เริ่ม</th><th>จบ</th><th>Manday</th>
            {db.fields.map((f) => <th key={f.id}>{f.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const s = st(t.status), p = pr(t.priority);
            return (
              <tr key={t.id} onClick={() => onEdit(t)}>
                <td><div className="ttl"><span className="pbar" style={{ background: color(t) }} />{t.title}</div></td>
                <td><span className="chip" style={{ background: s.color + '22', color: s.color }}><span className="dot" style={{ background: s.color }} />{s.label}</span></td>
                <td><span className="chip" style={{ background: p.color + '22', color: p.color }}>{p.label}</span></td>
                <td className="mono muted">{fmtShort(t.start)}</td>
                <td className="mono muted">{fmtShort(t.end)}</td>
                <td className="mono">{t.manday} md</td>
                {db.fields.map((f) => <td key={f.id}>{renderCustom(t, f)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderCustom(t: Task, f: DB['fields'][number]) {
  const v = t.custom?.[f.id];
  if (v == null || v === '') return <span className="muted">—</span>;
  if (f.type === 'checkbox') return v ? '✓' : <span className="muted">—</span>;
  if (f.type === 'select') return <span className="chip" style={{ background: '#eef1f5', color: '#5b6472' }}>{String(v)}</span>;
  if (f.type === 'date') return <span className="mono muted">{fmtShort(String(v))}</span>;
  return <span className={f.type === 'number' ? 'mono' : ''}>{String(v)}</span>;
}

// ---------------- TASK MODAL ----------------
function TaskModal({ task, defaults, db, onClose, onSaved }: { task: Task | null; defaults?: Partial<Task>; db: DB; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Task>(
    task ?? { id: crypto.randomUUID(), title: '', desc: '', start: today, end: today, status: 'todo', priority: 'med', manday: 1, cIdx: db.tasks.length, custom: {}, ...defaults }
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
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="fld"><label>Priority</label>
              <select value={f.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
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

// ---------------- LOGIN ----------------
function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className="login">
      <div className="brand"><span className="mk" />Timebox</div>
      <p>เข้าสู่ระบบเพื่อจัดการ task ของคุณ</p>
      <button className="btn pri" onClick={() => authApi.signInWithGoogle()}>ล็อกอินด้วย Google</button>
      <div className="muted" style={{ margin: '12px 0', fontSize: 12 }}>หรือ</div>
      {sent ? (
        <p style={{ color: 'var(--accent)' }}>ส่งลิงก์เข้าอีเมลแล้ว เช็กกล่องจดหมาย</p>
      ) : (
        <>
          <input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" onClick={async () => { if (email) { await authApi.signInWithEmail(email); setSent(true); } }}>ส่งลิงก์เข้าอีเมล</button>
        </>
      )}
    </div>
  );
}
