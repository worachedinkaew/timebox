'use client';

import { useState } from 'react';
import { TASK_COLORS } from '../lib/types';
import type { DB, Task } from '../lib/types';
import { THDOW, THMON, addDays, iso, mondayOf, todayDate } from '../lib/dates';
import { getParam, setParam } from '../lib/urlstate';

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
                {tasksOn(ds).map((t) => (
                  <div key={t.id} className="cev" style={{ background: color(t) }} onClick={() => onEdit(t)}>{t.title}</div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {mode === 'day' && (
        <div className="dayview">
          {tasksOn(iso(anchor)).map((t) => (
            <div key={t.id} className="cev big" style={{ background: color(t) }} onClick={() => onEdit(t)}>
              {t.title}
              {t.desc && <div className="dvd">{t.desc}</div>}
            </div>
          ))}
          {!tasksOn(iso(anchor)).length && <div className="placeholder">ไม่มีงานในวันนี้</div>}
        </div>
      )}
    </div>
  );
}

const i7 = (d: Date) => (d.getDay() + 6) % 7;
