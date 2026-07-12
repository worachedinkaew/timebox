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

  // ชั่วโมงที่จองในสัปดาห์นี้ (จากบล็อก Timebox) แยกงานจริง / buffer
  const ws = mondayOf(todayDate());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekIso = weekDays.map(iso);
  const idxByDate = new Map(weekIso.map((d, i) => [d, i] as const));
  const perDay = weekIso.map(() => ({ task: 0, buf: 0, total: 0 }));
  db.blocks.forEach((b) => {
    const i = idxByDate.get(b.date);
    if (i === undefined) return;
    if (b.taskId) perDay[i].task += 0.5; else perDay[i].buf += 0.5;
    perDay[i].total += 0.5;
  });
  const weekH = perDay.reduce((a, d) => a + d.total, 0);
  const rawMax = Math.max(...perDay.map((d) => d.total));
  const step = rawMax <= 4 ? 1 : rawMax <= 8 ? 2 : Math.ceil(rawMax / 4);
  const niceMax = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks = Array.from({ length: niceMax / step }, (_, i) => (i + 1) * step);
  const weekEmpty = rawMax === 0;

  const byStatus = db.statuses.map((s) => ({ s, n: db.tasks.filter((t) => t.status === s.id).length }));
  const donutTotal = byStatus.reduce((a, x) => a + x.n, 0);
  const R = 52, SW = 16, C = 2 * Math.PI * R; // viewBox 140×140, จุดกลาง 70
  const activeSegs = byStatus.filter((x) => x.n > 0);
  const segGap = activeSegs.length > 1 ? 3 : 0; // ช่องคั่นสีพื้น; วงเดียวเต็ม 100% ไม่ต้องมี
  let acc = 0;
  const segs = activeSegs.map(({ s, n }) => {
    const len = (n / donutTotal) * C;
    const seg = { color: s.color, dash: Math.max(len - segGap, 0.5), offset: acc + segGap / 2 };
    acc += len;
    return seg;
  });

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
          <div className={styles.donutbox}>
            <div className={styles.donutwrap}>
              <svg viewBox="0 0 140 140" className={styles.donut} role="img" aria-label={`งานทั้งหมด ${donutTotal}`}>
                <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f3f6" strokeWidth={SW} />
                {segs.map((g, i) => (
                  <circle
                    key={i} cx="70" cy="70" r={R} fill="none" stroke={g.color} strokeWidth={SW}
                    strokeLinecap="butt" strokeDasharray={`${g.dash} ${C - g.dash}`}
                    strokeDashoffset={-g.offset} transform="rotate(-90 70 70)"
                  />
                ))}
              </svg>
              <div className={styles.dcenter}><b>{donutTotal}</b><span>งาน</span></div>
            </div>
            <div className={styles.dlegend}>
              {byStatus.map(({ s, n }) => (
                <div key={s.id} className={`${styles.lgrow}${n === 0 ? ' ' + styles.zero : ''}`}>
                  <i className={styles.lgdot} style={{ background: s.color }} />
                  <span className={styles.lglab}>{s.label}</span>
                  <span className={styles.lgval}>{n}</span>
                </div>
              ))}
              {donutTotal === 0 && <div className={styles.dempty}>ยังไม่มีงาน — เพิ่มงานเพื่อดูสัดส่วนสถานะ</div>}
            </div>
          </div>
        </div>

        <div className={styles.dcard}>
          <h4>ชั่วโมงที่จอง สัปดาห์นี้ ({ws.getDate()} – {addDays(ws, 6).getDate()} {THMON[addDays(ws, 6).getMonth()]})</h4>
          <div className={styles.wplot}>
            {!weekEmpty && ticks.map((t) => (
              <div key={t} className={styles.gline} style={{ bottom: `${(t / niceMax) * 100}%` }}>
                <span className={styles.gtick}>{t}</span>
              </div>
            ))}
            {perDay.map((d, i) => {
              const day = weekDays[i];
              const isT = weekIso[i] === today;
              return (
                <div className={styles.wcol} key={i} title={`${THDOW[i]} ${day.getDate()} ${THMON[day.getMonth()]} — งาน ${d.task} ชม. · Buffer ${d.buf} ชม.`}>
                  {d.total > 0 ? (
                    <div className={styles.wstack} style={{ height: `${(d.total / niceMax) * 100}%` }} data-today={isT || undefined}>
                      <span className={styles.wval}>{d.total}</span>
                      {d.buf > 0 && <div className={styles.wbuf} style={{ flex: d.buf }} />}
                      {d.task > 0 && <div className={styles.wtask} style={{ flex: d.task }} />}
                    </div>
                  ) : (
                    <div className={styles.wstub} />
                  )}
                </div>
              );
            })}
            {weekEmpty && <div className={styles.wempty}>ยังไม่ได้จองเวลาในสัปดาห์นี้</div>}
          </div>
          <div className={styles.wdays}>
            {weekIso.map((d, i) => (
              <span key={i} className={d === today ? styles.now : undefined}>{THDOW[i]}</span>
            ))}
          </div>
          {!weekEmpty && (
            <div className={styles.wlegend}>
              <span><i className={styles.lgTask} /> งาน</span>
              <span><i className={styles.lgBuf} /> Buffer</span>
            </div>
          )}
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
