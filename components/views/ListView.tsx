'use client';

import { useState } from 'react';
import { optById } from '@/lib/types';
import type { DB, Task } from '@/lib/types';
import { chipStyle, taskColor } from '@/lib/colors';
import { fmtShort } from '@/lib/dates';
import styles from './ListView.module.css';

const PAGE_SIZES = [10, 25, 50, 100];

export default function ListView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: 'status', dir: 1 });
  const [page, setPage] = useState(0);
  // component นี้ render ฝั่ง client หลัง auth เท่านั้น — อ่าน localStorage ใน initializer ได้
  const [pageSize, setPageSize] = useState(() => {
    const n = parseInt(localStorage.getItem('timebox:pagesize') || '', 10);
    return PAGE_SIZES.includes(n) ? n : 25;
  });

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
  const arrow = (k: string) => sort.k === k && <span className={styles.ar}>{sort.dir > 0 ? '▲' : '▼'}</span>;

  return (
    <div>
      <div className="scroll">
        <table className={styles.lst}>
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
                  <td><div className={styles.ttl}><span className="pbar" style={{ background: taskColor(t) }} />{t.title}</div></td>
                  <td><span className="chip" style={chipStyle(s)}><span className="dot" style={{ background: s.color }} />{s.label}</span></td>
                  <td><span className="chip" style={chipStyle(p)}>{p.label}</span></td>
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
      <div className={styles.lfoot}>
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
