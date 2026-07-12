'use client';

import { useState } from 'react';
import { TASK_COLORS } from '../lib/types';
import type { DB, Task } from '../lib/types';
import { THDOW, THMON, addDays, iso, mondayOf, pad, todayDate } from '../lib/dates';
import { getParam, setParam } from '../lib/urlstate';
import { loadHours } from '../lib/hours';

const color = (t: Task) => TASK_COLORS[(t.cIdx || 0) % TASK_COLORS.length];

type CalMode = 'month' | 'week' | 'day';
const MODES: { id: CalMode; label: string }[] = [
  { id: 'month', label: 'เดือน' },
  { id: 'week', label: 'สัปดาห์' },
  { id: 'day', label: 'วัน' },
];

export default function CalendarView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  // component นี้ mount ฝั่ง client เท่านั้น (หลัง auth gate) อ่าน URL ใน initializer ได้เลย
  const [mode, setModeRaw] = useState<CalMode>(() => {
    const m = getParam('cm');
    return m === 'week' || m === 'day' ? m : 'month';
  });
  const [anchor, setAnchorRaw] = useState<Date>(() => {
    const m = getParam('m');
    if (m && /^\d{4}-\d{2}-\d{2}$/.test(m)) { const p = m.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    if (m && /^\d{4}-\d{2}$/.test(m)) { const p = m.split('-'); return new Date(+p[0], +p[1] - 1, 1); }
    return todayDate();
  });
  const setMode = (m: CalMode) => { setModeRaw(m); setParam('cm', m === 'month' ? null : m); };
  const setAnchor = (d: Date) => { setAnchorRaw(d); setParam('m', iso(d)); };
  const nav = (dir: 1 | -1) => {
    if (mode === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, dir * (mode === 'week' ? 7 : 1)));
  };

  const tdy = iso(todayDate());
  const tasksOn = (ds: string) => db.tasks.filter((t) => t.start && t.end && ds >= t.start && ds <= t.end);

  // เวลาไม่ได้อยู่ที่ตัวงาน แต่อยู่ที่บล็อกที่ระบายไว้ใน Timebox — รวม slot ติดกันเป็นช่วง เช่น 11:30–13:00
  const slotTime = (s: number) => `${pad(Math.floor(s / 2))}:${s % 2 ? '30' : '00'}`;
  const timesFor = (taskId: string | null, ds: string) => {
    const slots = db.blocks.filter((b) => b.taskId === taskId && b.date === ds).map((b) => b.slot).sort((a, b) => a - b);
    const out: string[] = [];
    let i = 0;
    while (i < slots.length) {
      let j = i;
      while (j + 1 < slots.length && slots[j + 1] === slots[j] + 1) j++;
      out.push(`${slotTime(slots[i])}–${slotTime(slots[j] + 1)}`);
      i = j + 1;
    }
    return out;
  };

  const ws = mondayOf(anchor);
  const title =
    mode === 'month' ? `${THMON[anchor.getMonth()]} ${anchor.getFullYear()}`
    : mode === 'week' ? `${ws.getDate()} ${THMON[ws.getMonth()]} – ${addDays(ws, 6).getDate()} ${THMON[addDays(ws, 6).getMonth()]} ${addDays(ws, 6).getFullYear()}`
    : `${THDOW[(anchor.getDay() + 6) % 7]} ${anchor.getDate()} ${THMON[anchor.getMonth()]} ${anchor.getFullYear()}`;

  return (
    <div className="cal">
      <div className="calnav">
        <button onClick={() => nav(-1)}>‹</button>
        <span className="mo">{title}</span>
        <button onClick={() => nav(1)}>›</button>
        <div className="sp" />
        <div className="calmode">
          {MODES.map((m) => (
            <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>
      </div>

      {mode === 'month' && (
        <div className="calgrid">
          {THDOW.map((d) => <div key={d} className="cdow">{d}</div>)}
          {Array.from({ length: 42 }, (_, i) => addDays(mondayOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1)), i)).map((d) => {
            const ds = iso(d);
            const evs = tasksOn(ds);
            const shown = evs.slice(0, 3);
            return (
              <div key={ds} className={'ccell' + (d.getMonth() !== anchor.getMonth() ? ' out' : '') + (ds === tdy ? ' tdy' : '')}>
                <div className="dn">{d.getDate()}</div>
                {shown.map((t) => (
                  <div key={t.id} className="cev" style={{ background: color(t) }} onClick={() => onEdit(t)}>{t.title}</div>
                ))}
                {evs.length > shown.length && <div className="muted" style={{ fontSize: 10 }}>+{evs.length - shown.length}</div>}
              </div>
            );
          })}
        </div>
      )}

      {mode === 'week' && (
        <div className="calgrid">
          {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => {
            const ds = iso(d);
            return (
              <div key={'h' + ds} className={'cdow' + (ds === tdy ? ' now' : '')}>{THDOW[i7(d)]} {d.getDate()}</div>
            );
          })}
          {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => {
            const ds = iso(d);
            return (
              <div key={ds} className={'ccell tall' + (ds === tdy ? ' tdy' : '')}>
                <div className="dn">{d.getDate()}</div>
                {tasksOn(ds).map((t) => {
                  const tm = timesFor(t.id, ds);
                  return (
                    <div key={t.id} className="cev" style={{ background: color(t) }} onClick={() => onEdit(t)}>
                      {t.title}
                      {tm.length > 0 && <div className="cevt">{tm.join(' · ')}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {mode === 'day' && (() => {
        const ds = iso(anchor);
        const evs = tasksOn(ds);
        // แปลงบล็อก 30 นาทีของวันนั้นเป็นช่วงต่อเนื่องต่องาน แล้ววางบน timeline
        const byTask = new Map<string | null, number[]>();
        db.blocks.filter((b) => b.date === ds).forEach((b) => {
          const l = byTask.get(b.taskId) ?? [];
          l.push(b.slot);
          byTask.set(b.taskId, l);
        });
        const segs: { key: string; taskId: string | null; s0: number; s1: number }[] = [];
        byTask.forEach((slots, taskId) => {
          slots.sort((a, b) => a - b);
          let i = 0;
          while (i < slots.length) {
            let j = i;
            while (j + 1 < slots.length && slots[j + 1] === slots[j] + 1) j++;
            segs.push({ key: `${taskId}-${slots[i]}`, taskId, s0: slots[i], s1: slots[j] });
            i = j + 1;
          }
        });
        // กรอบชั่วโมงเดียวกับที่ตั้งไว้ในแท็บ Timebox — ขยายอัตโนมัติถ้ามีบล็อกนอกช่วง
        const base = loadHours();
        const hourStart = segs.length ? Math.min(base.start, Math.floor(Math.min(...segs.map((s) => s.s0)) / 2)) : base.start;
        const hourEnd = segs.length ? Math.max(base.end, Math.ceil((Math.max(...segs.map((s) => s.s1)) + 1) / 2)) : base.end;
        const HH = 44; // px ต่อ 1 ชั่วโมง
        const taskById = new Map(db.tasks.map((t) => [t.id, t]));
        return (
          <div className="dayview">
            {evs.length > 0 && (
              <div className="dallday">
                <span className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>งานช่วงนี้:</span>
                {evs.map((t) => (
                  <div key={t.id} className="cev" style={{ background: color(t), marginBottom: 0 }} onClick={() => onEdit(t)}>{t.title}</div>
                ))}
              </div>
            )}
            <div className="dtl" style={{ height: (hourEnd - hourStart) * HH }}>
              {Array.from({ length: hourEnd - hourStart + 1 }, (_, h) => (
                <div key={h} className="dtlrow" style={{ top: h * HH }}>
                  <span>{pad(hourStart + h)}:00</span>
                </div>
              ))}
              {segs.map((seg) => {
                const t = seg.taskId ? taskById.get(seg.taskId) : undefined;
                const isBuf = seg.taskId === null;
                return (
                  <div
                    key={seg.key}
                    className={'dtlev' + (isBuf ? ' buf' : '')}
                    style={{
                      top: (seg.s0 / 2 - hourStart) * HH + 1,
                      height: ((seg.s1 - seg.s0 + 1) / 2) * HH - 2,
                      background: isBuf ? undefined : t ? color(t) : '#8A93A0',
                    }}
                    onClick={t ? () => onEdit(t) : undefined}
                  >
                    <b>{isBuf ? 'เวลาเผื่องานแทรก' : t?.title ?? '—'}</b>
                    <span className="dtlt">{slotTime(seg.s0)}–{slotTime(seg.s1 + 1)}</span>
                  </div>
                );
              })}
              {!segs.length && (
                <div className="dtlempty">ยังไม่ได้จองเวลาในวันนี้ — ไประบายเวลาให้งานในแท็บ Timebox</div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const i7 = (d: Date) => (d.getDay() + 6) % 7;
