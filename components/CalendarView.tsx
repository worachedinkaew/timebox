'use client';

import { useState } from 'react';
import { TASK_COLORS } from '../lib/types';
import type { DB, Task } from '../lib/types';
import { THDOW, THMON, addDays, iso, mondayOf, todayDate } from '../lib/dates';

const color = (t: Task) => TASK_COLORS[(t.cIdx || 0) % TASK_COLORS.length];

export default function CalendarView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  const [month, setMonth] = useState(() => {
    const t = todayDate();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const gridStart = mondayOf(new Date(month.y, month.m, 1));
  const tdy = iso(todayDate());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const nav = (d: number) => setMonth(({ y, m }) => {
    const x = new Date(y, m + d, 1);
    return { y: x.getFullYear(), m: x.getMonth() };
  });

  return (
    <div className="cal">
      <div className="calnav">
        <button onClick={() => nav(-1)}>‹</button>
        <span className="mo">{THMON[month.m]} {month.y}</span>
        <button onClick={() => nav(1)}>›</button>
      </div>
      <div className="calgrid">
        {THDOW.map((d) => <div key={d} className="cdow">{d}</div>)}
        {cells.map((d) => {
          const ds = iso(d);
          const evs = db.tasks.filter((t) => t.start && t.end && ds >= t.start && ds <= t.end);
          const shown = evs.slice(0, 3);
          return (
            <div key={ds} className={'ccell' + (d.getMonth() !== month.m ? ' out' : '') + (ds === tdy ? ' tdy' : '')}>
              <div className="dn">{d.getDate()}</div>
              {shown.map((t) => (
                <div key={t.id} className="cev" style={{ background: color(t) }} onClick={() => onEdit(t)}>{t.title}</div>
              ))}
              {evs.length > shown.length && <div className="muted" style={{ fontSize: 10 }}>+{evs.length - shown.length}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
