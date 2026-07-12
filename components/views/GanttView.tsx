'use client';

import { optById } from '@/lib/types';
import type { DB, Task } from '@/lib/types';
import { THDOW, THMON, addDays, dayDiff, dowIndex, fmtShort, iso, mondayOf, parseISO, todayDate } from '@/lib/dates';
import { useUrlDate } from '@/hooks/useUrlDate';
import nav from '@/components/ui/nav.module.css';
import styles from './GanttView.module.css';

const DW = 36;    // px ต่อ 1 วัน
const DAYS = 28;  // หน้าต่างครั้งละ 4 สัปดาห์ เลื่อนทีละสัปดาห์ด้วย ‹ ›

const defaultStart = () => iso(addDays(mondayOf(todayDate()), -7));

export default function GanttView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  const [start, setStart] = useUrlDate('g', defaultStart);
  const s0 = parseISO(start);
  const endIso = iso(addDays(s0, DAYS - 1));
  // กลับมาช่วง default ให้ลบ ?g= ออกจาก URL
  const navTo = (days: number) => {
    const ns = iso(addDays(s0, days));
    setStart(ns, ns === defaultStart() ? null : ns);
  };

  const tasks = db.tasks.filter((t) => t.start && t.end && t.start <= endIso && t.end >= start);
  const tdy = iso(todayDate());
  const toff = dayDiff(start, tdy);
  const st = (id: string) => optById(db.statuses, id);

  const dayCells = Array.from({ length: DAYS }, (_, i) => {
    const d = addDays(s0, i);
    return { d, we: d.getDay() === 0 || d.getDay() === 6, td: iso(d) === tdy };
  });
  // แถวเดือนคาดบนหัววัน — รวมวันติดกันที่อยู่เดือนเดียวกันเป็นแถบเดียว
  const monthSegs: { label: string; span: number }[] = [];
  dayCells.forEach((c) => {
    const label = `${THMON[c.d.getMonth()]} ${c.d.getFullYear()}`;
    const last = monthSegs[monthSegs.length - 1];
    if (last && last.label === label) last.span++;
    else monthSegs.push({ label, span: 1 });
  });

  return (
    <div>
      <div className={nav.tbnav} style={{ padding: '10px 12px 8px' }}>
        <button onClick={() => navTo(-7)}>‹</button>
        <span className={nav.wk}>{fmtShort(start)} – {fmtShort(endIso)} {parseISO(endIso).getFullYear()}</span>
        <button onClick={() => navTo(7)}>›</button>
        {start !== defaultStart() && (
          <button style={{ width: 'auto', padding: '0 10px' }} onClick={() => navTo(dayDiff(start, defaultStart()))}>วันนี้</button>
        )}
      </div>
      <div className="scroll" style={{ maxHeight: 600 }}>
        <div className={styles.gantt}>
          <div className={`${styles.grow} ${styles.ghead}`}>
            <div className={styles.gname}>งาน</div>
            <div className={styles.gtrack} style={{ width: DAYS * DW }}>
              <div className={styles.gmons}>
                {monthSegs.map((m, i) => <span key={i} style={{ width: m.span * DW }}>{m.label}</span>)}
              </div>
              <div>
                {dayCells.map((c, i) => (
                  <span key={i} className={`${styles.gcell}${c.we ? ' ' + styles.we : ''}${c.td ? ' ' + styles.tdy : ''}`} style={{ width: DW }}>
                    {THDOW[dowIndex(c.d)]}<br /><b>{c.d.getDate()}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
          {!tasks.length && <div className="placeholder">ไม่มีงานในช่วงนี้ — เลื่อนดูช่วงอื่นด้วยปุ่ม ‹ ›</div>}
          {tasks.map((t) => {
            // clamp แท่งที่ยื่นออกนอกหน้าต่างให้ชนขอบพอดี
            const off = Math.max(0, dayDiff(start, t.start!));
            const last = Math.min(DAYS - 1, dayDiff(start, t.end!));
            const len = last - off + 1;
            const s = st(t.status);
            return (
              <div className={styles.grow} key={t.id}>
                <div className={styles.gname}>{t.title}</div>
                <div className={styles.gtrack} style={{ width: DAYS * DW }}>
                  <div className={styles.gbarrow}>
                    {dayCells.map((c, j) => (
                      <div key={j} className={`${styles.gbg}${c.we ? ' ' + styles.we : ''}${c.td ? ' ' + styles.td : ''}`} style={{ left: j * DW, width: DW }} />
                    ))}
                    {toff >= 0 && toff < DAYS && <div className={styles.gtoday} style={{ left: toff * DW + DW / 2 }} />}
                    <div
                      className={styles.gbar}
                      title={`${t.title} · ${fmtShort(t.start)} – ${fmtShort(t.end)}`}
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
    </div>
  );
}
