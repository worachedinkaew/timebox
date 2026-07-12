'use client';

import { STATUSES } from '../lib/types';
import type { DB, Task } from '../lib/types';
import { THDOW, addDays, dayDiff, iso, mondayOf, parseISO, todayDate } from '../lib/dates';

const DW = 34; // px ต่อ 1 วัน

export default function GanttView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  const tasks = db.tasks.filter((t) => t.start && t.end);
  if (!tasks.length) return <div className="placeholder">ยังไม่มีงานที่มีช่วงวันที่</div>;

  const starts = tasks.map((t) => t.start!).sort();
  const ends = tasks.map((t) => t.end!).sort();
  const r0 = mondayOf(parseISO(starts[0]));
  const r1 = addDays(parseISO(ends[ends.length - 1]), 2);
  const days = Math.max(14, Math.round((r1.getTime() - r0.getTime()) / 86400000) + 1);
  const tdy = iso(todayDate());
  const toff = Math.round((todayDate().getTime() - r0.getTime()) / 86400000);
  const st = (id: string) => STATUSES.find((s) => s.id === id) ?? STATUSES[0];

  const dayCells = Array.from({ length: days }, (_, i) => {
    const d = addDays(r0, i);
    return { d, we: d.getDay() === 0 || d.getDay() === 6, td: iso(d) === tdy };
  });

  return (
    <div className="scroll" style={{ maxHeight: 600 }}>
      <div className="gantt">
        <div className="grow ghead">
          <div className="gname">งาน</div>
          <div className="gtrack" style={{ width: days * DW }}>
            {dayCells.map((c, i) => (
              <span key={i} className={'gcell' + (c.we ? ' we' : '') + (c.td ? ' tdy' : '')} style={{ width: DW }}>
                {THDOW[(c.d.getDay() + 6) % 7]}<br />{c.d.getDate()}
              </span>
            ))}
          </div>
        </div>
        {tasks.map((t) => {
          const off = Math.round((parseISO(t.start!).getTime() - r0.getTime()) / 86400000);
          const len = dayDiff(t.start!, t.end!) + 1;
          const s = st(t.status);
          return (
            <div className="grow" key={t.id}>
              <div className="gname">{t.title}</div>
              <div className="gtrack" style={{ width: days * DW }}>
                <div className="gbarrow">
                  {dayCells.map((c, j) => (
                    <div key={j} className={'gbg' + (c.we ? ' we' : '')} style={{ left: j * DW, width: DW }} />
                  ))}
                  {toff >= 0 && toff < days && <div className="gtoday" style={{ left: toff * DW + DW / 2 }} />}
                  <div
                    className="gbar"
                    style={{ left: off * DW + 2, width: len * DW - 4, background: s.color }}
                    onClick={() => onEdit(t)}
                  >
                    {t.title}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
