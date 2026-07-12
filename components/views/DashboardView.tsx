'use client';

import { optById } from '@/lib/types';
import type { DB, Task } from '@/lib/types';
import { THDOW, THMON, addDays, fmtShort, iso, mondayOf, todayDate } from '@/lib/dates';
import { chipStyle, taskColor } from '@/lib/colors';
import { doneStatusIds } from '@/lib/tasks';
import styles from './DashboardView.module.css';

export default function DashboardView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  const today = iso(todayDate());
  const doneIds = doneStatusIds(db.statuses);

  const total = db.tasks.length;
  const doneCount = db.tasks.filter((t) => doneIds.has(t.status)).length;
  const overdue = db.tasks.filter((t) => t.end && t.end < today && !doneIds.has(t.status));

  // ชั่วโมงที่จองในสัปดาห์นี้ (จากบล็อก Timebox)
  const ws = mondayOf(todayDate());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const perDay = weekDays.map((d) => db.blocks.filter((b) => b.date === iso(d)).length * 0.5);
  const weekH = perDay.reduce((a, b) => a + b, 0);
  const maxDay = Math.max(1, ...perDay);

  const byStatus = db.statuses.map((s) => ({ s, n: db.tasks.filter((t) => t.status === s.id).length }));
  const maxSt = Math.max(1, ...byStatus.map((x) => x.n));

  const soonEnd = iso(addDays(todayDate(), 7));
  const upcoming = db.tasks
    .filter((t) => t.end && t.end >= today && t.end <= soonEnd && !doneIds.has(t.status))
    .sort((a, b) => (a.end! < b.end! ? -1 : 1));

  return (
    <div className={styles.dash}>
      <div className={styles.tiles}>
        <div className={styles.tile}><div className={styles.tv}>{total}</div><div className={styles.tl}>งานทั้งหมด</div></div>
        <div className={styles.tile}><div className={styles.tv}>{total - doneCount}</div><div className={styles.tl}>ยังไม่เสร็จ</div></div>
        <div className={styles.tile}><div className={styles.tv}>{doneCount}</div><div className={styles.tl}>เสร็จแล้ว</div></div>
        <div className={`${styles.tile}${overdue.length ? ' ' + styles.warn : ''}`}>
          <div className={styles.tv}>{overdue.length}</div><div className={styles.tl}>เกินกำหนด</div>
        </div>
        <div className={styles.tile}><div className={styles.tv}>{weekH}<span className={styles.tu}> ชม.</span></div><div className={styles.tl}>จองเวลาสัปดาห์นี้</div></div>
      </div>

      <div className={styles.dcards}>
        <div className={styles.dcard}>
          <h4>งานตามสถานะ</h4>
          {byStatus.map(({ s, n }) => (
            <div className={styles.hbar} key={s.id}>
              <span className={styles.hlab}>{s.label}</span>
              <div className={styles.htrack}>
                {n > 0 && <div className={styles.hfill} style={{ width: `${(n / maxSt) * 100}%`, background: s.color }} />}
              </div>
              <span className={styles.hval}>{n}</span>
            </div>
          ))}
        </div>

        <div className={styles.dcard}>
          <h4>ชั่วโมงที่จอง สัปดาห์นี้ ({ws.getDate()} – {addDays(ws, 6).getDate()} {THMON[addDays(ws, 6).getMonth()]})</h4>
          <div className={styles.cols}>
            {perDay.map((h, i) => {
              const d = weekDays[i];
              const isT = iso(d) === today;
              return (
                <div className={styles.col} key={i} title={`${THDOW[i]} ${d.getDate()} ${THMON[d.getMonth()]} — ${h} ชม.`}>
                  <div className={styles.cwrap}>
                    {h > 0 && <span className={styles.cval}>{h}</span>}
                    <div className={styles.cbar} style={{ height: `${(h / maxDay) * 100}%` }} data-today={isT || undefined} />
                  </div>
                  <span className={`${styles.clab}${isT ? ' ' + styles.now : ''}`}>{THDOW[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.dcard}>
        <h4>ใกล้ถึงกำหนดใน 7 วัน</h4>
        {upcoming.map((t) => {
          const s = optById(db.statuses, t.status);
          const isToday = t.end === today;
          return (
            <div className={styles.uprow} key={t.id} onClick={() => onEdit(t)}>
              <span className="pbar" style={{ background: taskColor(t) }} />
              <span className={styles.upt}>{t.title}</span>
              <span className="chip" style={chipStyle(s)}>{s.label}</span>
              <span className={'mono' + (isToday ? '' : ' muted')} style={isToday ? { color: 'var(--coral)', fontWeight: 600 } : undefined}>
                {isToday ? 'วันนี้' : fmtShort(t.end)}
              </span>
            </div>
          );
        })}
        {!upcoming.length && <div className="muted" style={{ fontSize: 12.5 }}>ไม่มีงานครบกำหนดใน 7 วันนี้ 🎉</div>}
      </div>
    </div>
  );
}
