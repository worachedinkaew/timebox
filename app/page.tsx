'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { authApi, loadAll, taskApi } from '../lib/db';
import { TASK_COLORS, optById } from '../lib/types';
import type { Block, DB, Task, Status, Priority } from '../lib/types';
import MultiSelect from '../components/MultiSelect';
import { fmtShort } from '../lib/dates';
import KanbanView from '../components/KanbanView';
import GanttView from '../components/GanttView';
import TimeboxView from '../components/TimeboxView';
import CalendarView from '../components/CalendarView';
import FieldManager from '../components/FieldManager';
import DashboardView from '../components/DashboardView';
import { getParam, setParam } from '../lib/urlstate';

const VIEWS = [
  ['dash', '▩ Dashboard'],
  ['list', '≣ List'],
  ['kanban', '▤ Kanban'],
  ['gantt', '▥ Gantt'],
  ['timebox', '▦ Timebox'],
  ['calendar', '▧ Calendar'],
] as const;
type View = (typeof VIEWS)[number][0];

export default function Page() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<DB | null>(null);
  // อ่าน view จาก URL ใน initializer ได้ ไม่มี hydration mismatch —
  // HTML ที่ prerender คือหน้า "กำลังโหลด…" (ready=false) แถบ tab ยัง render ฝั่ง client หลัง auth เท่านั้น
  const [view, setView] = useState<View>(() => {
    const v = getParam('v');
    return v && VIEWS.some(([id]) => id === v) ? (v as View) : 'dash';
  });
  const [editing, setEditing] = useState<{ task: Task | null; defaults?: Partial<Task> } | null>(null);
  const [showFields, setShowFields] = useState(false);

  // filter ใช้ร่วมกันทุก view — เก็บใน URL ด้วย (?q= ?st=a,b ?pr=x,y)
  const [q, setQ] = useState(() => getParam('q') ?? '');
  const [fStatus, setFStatus] = useState<string[]>(() => (getParam('st') ?? '').split(',').filter(Boolean));
  const [fPriority, setFPriority] = useState<string[]>(() => (getParam('pr') ?? '').split(',').filter(Boolean));

  const switchView = (v: View) => {
    setView(v);
    setParam('v', v === 'dash' ? null : v);
  };

  const fdb = useMemo(() => {
    if (!db) return null;
    const qq = q.trim().toLowerCase();
    if (!qq && !fStatus.length && !fPriority.length) return db;
    // ค้นทั้งชื่อ รายละเอียด และค่าใน custom fields
    const matchQ = (t: Task) =>
      !qq ||
      t.title.toLowerCase().includes(qq) ||
      t.desc.toLowerCase().includes(qq) ||
      Object.values(t.custom || {}).some((v) => v != null && String(v).toLowerCase().includes(qq));
    return {
      ...db,
      tasks: db.tasks.filter((t) =>
        matchQ(t) &&
        (!fStatus.length || fStatus.includes(t.status)) &&
        (!fPriority.length || fPriority.includes(t.priority))
      ),
    };
  }, [db, q, fStatus, fPriority]);

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
            <button key={v} className={view === v ? 'on' : ''} onClick={() => switchView(v)}>{label}</button>
          ))}
        </div>
        <div className="sp" />
        <button className="btn" onClick={() => setShowFields(true)}>⚙ ตั้งค่า</button>
        <button className="btn" onClick={() => authApi.signOut()}>ออกจากระบบ</button>
        <button className="btn pri" onClick={() => setEditing({ task: null })}>+ งานใหม่</button>
      </div>

      <div className="fbar">
        <input
          type="search"
          placeholder="🔍 ค้นหางาน…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setParam('q', e.target.value || null); }}
        />
        <MultiSelect
          placeholder="สถานะ"
          options={db?.statuses ?? []}
          value={fStatus}
          onChange={(v) => { setFStatus(v); setParam('st', v.length ? v.join(',') : null); }}
        />
        <MultiSelect
          placeholder="Priority"
          options={db?.priorities ?? []}
          value={fPriority}
          onChange={(v) => { setFPriority(v); setParam('pr', v.length ? v.join(',') : null); }}
        />
        {(q || fStatus.length > 0 || fPriority.length > 0) && (
          <button
            className="btn"
            onClick={() => {
              setQ(''); setFStatus([]); setFPriority([]);
              setParam('q', null); setParam('st', null); setParam('pr', null);
            }}
          >
            ✕ ล้าง{fdb && db && fdb.tasks.length < db.tasks.length ? ` (${fdb.tasks.length}/${db.tasks.length})` : ''}
          </button>
        )}
      </div>

      <div className="panel">
        {!db || !fdb ? (
          <div className="placeholder">กำลังโหลดข้อมูล…</div>
        ) : view === 'list' ? (
          <ListView db={fdb} onEdit={(t) => setEditing({ task: t })} />
        ) : view === 'kanban' ? (
          <KanbanView
            db={fdb}
            onEdit={(t) => setEditing({ task: t })}
            onAdd={(status) => setEditing({ task: null, defaults: { status } })}
            onMove={moveTask}
          />
        ) : view === 'gantt' ? (
          <GanttView db={fdb} onEdit={(t) => setEditing({ task: t })} />
        ) : view === 'timebox' ? (
          <TimeboxView db={fdb} allTasks={db.tasks} updateBlocks={updateBlocks} onError={refresh} />
        ) : view === 'dash' ? (
          <DashboardView db={fdb} onEdit={(t) => setEditing({ task: t })} />
        ) : (
          <CalendarView db={fdb} onEdit={(t) => setEditing({ task: t })} />
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

      {showFields && db && (
        <FieldManager db={db} onClose={() => setShowFields(false)} onChanged={refresh} />
      )}
    </div>
  );
}

// ---------------- LIST ----------------
const PAGE_SIZES = [10, 25, 50, 100];

function ListView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: 'status', dir: 1 });
  const [page, setPage] = useState(0);
  // component นี้ render ฝั่ง client หลัง auth เท่านั้น — อ่าน localStorage ใน initializer ได้
  const [pageSize, setPageSize] = useState(() => {
    const n = parseInt(localStorage.getItem('timebox:pagesize') || '', 10);
    return PAGE_SIZES.includes(n) ? n : 25;
  });

  const color = (t: Task) => TASK_COLORS[(t.cIdx || 0) % TASK_COLORS.length];
  const clickSort = (k: string) =>
    setSort((s) => (s.k === k ? { k, dir: -s.dir as 1 | -1 } : { k, dir: 1 }));

  const stOrder = db.statuses.map((s) => s.id);
  const prOrder = db.priorities.map((p) => p.id);
  const fieldType = new Map(db.fields.map((f) => [f.id, f.type]));
  const sortVal = (t: Task): string | number => {
    const k = sort.k;
    if (k === 'status') return stOrder.indexOf(t.status);
    if (k === 'priority') return prOrder.indexOf(t.priority);
    if (k === 'manday') return t.manday;
    if (k === 'title') return t.title.toLowerCase();
    if (k.startsWith('cf_')) {
      const fid = k.slice(3);
      const v = t.custom?.[fid];
      if (v == null || v === '') return fieldType.get(fid) === 'number' ? -Infinity : '';
      return fieldType.get(fid) === 'number' ? Number(v) || 0 : String(v).toLowerCase();
    }
    return (t[k as 'start' | 'end'] ?? '') as string; // วันที่ ISO เรียงแบบ string ได้เลย
  };
  const rows = [...db.tasks].sort((a, b) => {
    const va = sortVal(a), vb = sortVal(b);
    return va < vb ? -sort.dir : va > vb ? sort.dir : 0;
  });

  const total = rows.length;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const cur = Math.min(page, maxPage); // filter เปลี่ยนแล้วหน้าเกิน ให้หนีบกลับหน้าสุดท้ายเอง
  const pageRows = rows.slice(cur * pageSize, (cur + 1) * pageSize);

  const COLS: [string, string][] = [
    ['title', 'งาน'], ['status', 'สถานะ'], ['priority', 'Priority'],
    ['start', 'เริ่ม'], ['end', 'จบ'], ['manday', 'Manday'],
  ];
  const arrow = (k: string) => sort.k === k && <span className="ar">{sort.dir > 0 ? '▲' : '▼'}</span>;

  return (
    <div>
      <div className="scroll">
        <table className="lst">
          <thead>
            <tr>
              {COLS.map(([k, label]) => <th key={k} onClick={() => clickSort(k)}>{label}{arrow(k)}</th>)}
              {db.fields.map((f) => <th key={f.id} onClick={() => clickSort('cf_' + f.id)}>{f.label}{arrow('cf_' + f.id)}</th>)}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => {
              const s = optById(db.statuses, t.status), p = optById(db.priorities, t.priority);
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
      <div className="lfoot">
        <span className="muted">
          {total ? `${cur * pageSize + 1}–${Math.min((cur + 1) * pageSize, total)} จาก ${total} งาน` : 'ไม่มีงาน'}
        </span>
        <div className="sp" />
        <select value={pageSize} onChange={(e) => { const n = +e.target.value; setPageSize(n); localStorage.setItem('timebox:pagesize', String(n)); setPage(0); }}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}/หน้า</option>)}
        </select>
        <button onClick={() => setPage(Math.max(0, cur - 1))} disabled={cur === 0}>‹</button>
        <span className="mono">{cur + 1}/{maxPage + 1}</span>
        <button onClick={() => setPage(Math.min(maxPage, cur + 1))} disabled={cur >= maxPage}>›</button>
      </div>
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
