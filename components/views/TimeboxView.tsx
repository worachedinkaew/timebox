'use client';

import { Fragment, useMemo, useState } from 'react';
import type { Block, DB, Task } from '@/lib/types';
import { THDOW, THMON, addDays, fmtShort, iso, mondayOf, pad, parseISO, todayDate } from '@/lib/dates';
import { BUFID, cellKey } from '@/lib/slots';
import { taskColor } from '@/lib/colors';
import { doneStatusIds } from '@/lib/tasks';
import { useHours } from '@/hooks/useHours';
import { useUrlDate } from '@/hooks/useUrlDate';
import { useTimeboxPaint } from '@/hooks/useTimeboxPaint';
import nav from '@/components/ui/nav.module.css';
import styles from './TimeboxView.module.css';

export default function TimeboxView({ db, allTasks, updateBlocks, onError }: {
  db: DB;               // tasks ผ่าน filter แล้ว — ใช้กับ rail
  allTasks: Task[];     // tasks ทั้งหมด — block ที่ระบายไว้ต้องหาเจ้าของเจอเสมอ
  updateBlocks: (up: (blocks: Block[]) => Block[]) => void;
  onError: () => void;
}) {
  const [hours, setHours] = useHours();
  const [weekStart, setWeekStart] = useUrlDate('w', () => iso(mondayOf(todayDate())));
  const [sel, setSel] = useState<string | null>(null);
  const [erase, setErase] = useState(false);
  const [warn, setWarn] = useState(false);

  const blockMap = useMemo(() => {
    const m = new Map<string, Block>();
    db.blocks.forEach((b) => m.set(cellKey(b.date, b.slot), b));
    return m;
  }, [db.blocks]);

  const { onPointerDown, onPointerMove } = useTimeboxPaint({
    blockMap, sel, erase, updateBlocks, onError,
    onEmptyPick: () => { setWarn(true); setTimeout(() => setWarn(false), 800); },
  });

  const ws = parseISO(weekStart);
  // ตัดงานที่ status ติดธง done ออกจาก rail (ชุด status ผู้ใช้กำหนดเองได้)
  const doneIds = doneStatusIds(db.statuses);
  const railTasks = db.tasks.filter((t) => !doneIds.has(t.status));
  const taskById = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const plannedHours = useMemo(() => {
    const m = new Map<string, number>();
    db.blocks.forEach((b) => {
      const k = b.taskId ?? BUFID;
      m.set(k, (m.get(k) || 0) + 0.5);
    });
    return m;
  }, [db.blocks]);

  // สรุปเฉพาะสัปดาห์ที่แสดงอยู่
  const weekDates = Array.from({ length: 7 }, (_, i) => iso(addDays(ws, i)));
  const weekSet = new Set(weekDates);
  let weekTaskH = 0, weekBufH = 0;
  const dayTotals = new Map<string, number>();
  db.blocks.forEach((b) => {
    if (!weekSet.has(b.date)) return;
    if (b.taskId) weekTaskH += 0.5; else weekBufH += 0.5;
    dayTotals.set(b.date, (dayTotals.get(b.date) || 0) + 0.5);
  });

  return (
    <div className={styles.tbwrap}>
      <div className={styles.tbrail}>
        <h4>งาน (manday → ชั่วโมง)</h4>
        <p className={styles.hint} style={warn ? { color: 'var(--coral)' } : undefined}>
          เลือกงาน แล้ว<b>ลากบนตาราง</b>เพื่อจองเวลา · ลากทับซ้ำ = ลบ · 1 ช่อง = 30 นาที
        </p>
        {railTasks.map((t) => {
          const est = t.manday * 8;
          const planned = plannedHours.get(t.id) || 0;
          const rem = est - planned;
          const pct = est > 0 ? Math.min(100, (planned / est) * 100) : 0;
          const over = rem < -0.001;
          return (
            <div
              key={t.id}
              className={`${styles.trow}${sel === t.id ? ' ' + styles.sel : ''}`}
              onClick={() => { setErase(false); setSel(sel === t.id ? null : t.id); }}
            >
              <div className={styles.r1}>
                <span className={styles.sw} style={{ background: taskColor(t) }} />
                <span className={styles.nm}>{t.title}</span>
              </div>
              <div className={styles.r2}>
                {planned} / {est} ชม.
                <span className={`${styles.rem}${over ? ' ' + styles.warn : ''}`}>{over ? `เกิน ${-rem}` : `เหลือ ${rem}`}</span>
              </div>
              <div className={styles.gz}><span style={{ width: `${pct}%`, background: taskColor(t) }} /></div>
            </div>
          );
        })}
        <div
          className={`${styles.trow} ${styles.buf}${sel === BUFID ? ' ' + styles.sel : ''}`}
          onClick={() => { setErase(false); setSel(sel === BUFID ? null : BUFID); }}
        >
          <div className={styles.r1}>
            <span className={styles.sw} style={{ background: 'repeating-linear-gradient(45deg,#e9a23b 0 4px,#f2c777 4px 8px)' }} />
            <span className={styles.nm}>เวลาเผื่องานแทรก</span>
          </div>
          <div className={styles.r2}>
            กันไว้ให้งานด่วน
            <span className={styles.rem}>{plannedHours.get(BUFID) || 0} ชม.</span>
          </div>
        </div>
        <div className={styles.tbtool}>
          <button className={erase ? styles.on : ''} onClick={() => { setErase(!erase); if (!erase) setSel(null); }}>
            🧽 ยางลบ
          </button>
        </div>
      </div>

      <div className={styles.tbmain}>
        <div className={nav.tbnav}>
          <button onClick={() => setWeekStart(iso(addDays(ws, -7)))}>‹</button>
          <span className={nav.wk}>{fmtShort(weekStart)} – {fmtShort(iso(addDays(ws, 6)))}</span>
          <button onClick={() => setWeekStart(iso(addDays(ws, 7)))}>›</button>
          <div className="sp" />
          <select value={hours.start} onChange={(e) => { const s = +e.target.value; setHours({ start: s, end: Math.max(hours.end, s + 1) }); }}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}:00</option>)}
          </select>
          <span className="muted">–</span>
          <select value={hours.end} onChange={(e) => setHours({ ...hours, end: +e.target.value })}>
            {Array.from({ length: 24 - hours.start }, (_, i) => { const h = hours.start + 1 + i; return <option key={h} value={h}>{pad(h)}:00</option>; })}
          </select>
        </div>
        <div className={styles.tbsum}>
          จองสัปดาห์นี้ <b>{weekTaskH + weekBufH} ชม.</b>
          {weekBufH > 0 && <span className="muted"> — งาน {weekTaskH} · เผื่อแทรก {weekBufH}</span>}
        </div>
        <div className="scroll">
          <div
            className={styles.tgrid}
            style={{
              gridTemplateColumns: '44px repeat(7, minmax(70px, 1fr))',
              // ล็อก touch เฉพาะตอนพร้อมระบาย — ไม่งั้นมือถือจะเลื่อน/แพนกริดไม่ได้เลย
              touchAction: sel || erase ? 'none' : 'auto',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
          >
            <div />
            {Array.from({ length: 7 }, (_, dd) => {
              const d = addDays(ws, dd);
              const isToday = iso(d) === iso(todayDate());
              const tot = dayTotals.get(iso(d)) || 0;
              return (
                <div key={dd} className={`${styles.tgh}${isToday ? ' ' + styles.now : ''}`}>
                  {THDOW[dd]}{isToday ? ' • วันนี้' : ''}
                  <small>{d.getDate()} {THMON[d.getMonth()]}</small>
                  <small className="dtot">{tot > 0 ? `${tot} ชม.` : ' '}</small>
                </div>
              );
            })}
            {Array.from({ length: (hours.end - hours.start) * 2 }, (_, i) => {
              const s = hours.start * 2 + i;
              const hr = s % 2 === 0;
              return (
                <Fragment key={s}>
                  <div className={`${styles.tgl}${hr ? ' ' + styles.hr : ''}`}>{hr ? `${pad(s / 2)}:00` : ''}</div>
                  {Array.from({ length: 7 }, (_, dz) => {
                    const date = iso(addDays(ws, dz));
                    const blk = blockMap.get(cellKey(date, s));
                    const isBuf = !!blk && blk.taskId === null;
                    const t = blk?.taskId ? taskById.get(blk.taskId) : undefined;
                    const above = blk ? blockMap.get(cellKey(date, s - 1)) : undefined;
                    const showLabel = t && (!above || above.taskId !== blk!.taskId);
                    return (
                      <div
                        key={dz}
                        className={`${styles.tcell}${hr ? ' ' + styles.hr : ''}${isBuf ? ' ' + styles.bf : ''}${date === iso(todayDate()) ? ' ' + styles.td : ''}`}
                        data-date={date}
                        data-slot={s}
                        style={t ? { background: taskColor(t) } : undefined}
                      >
                        {showLabel && <span className={styles.lb}>{t!.title}</span>}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
