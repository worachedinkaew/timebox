'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { authApi, loadAll, taskApi } from '@/lib/db';
import type { Block, DB, Task, Status } from '@/lib/types';
import { getParam, setParam } from '@/lib/urlstate';
import { VIEWS } from '@/components/views/config';
import type { View } from '@/components/views/config';
import ListView from '@/components/views/ListView';
import KanbanView from '@/components/views/KanbanView';
import GanttView from '@/components/views/GanttView';
import TimeboxView from '@/components/views/TimeboxView';
import CalendarView from '@/components/views/CalendarView';
import DashboardView from '@/components/views/DashboardView';
import TaskModal from '@/components/modals/TaskModal';
import FieldManager from '@/components/modals/FieldManager';
import MultiSelect from '@/components/ui/MultiSelect';
import Login from '@/components/Login';

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
