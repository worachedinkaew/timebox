'use client';

import { useState } from 'react';
import { optById } from '@/lib/types';
import type { DB, Task } from '@/lib/types';
import { THDOW, THMON, addDays, dayDiff, dowIndex, fmtShort, iso, mondayOf, parseISO, todayDate } from '@/lib/dates';
import { getParam, setParam } from '@/lib/urlstate';

const DW = 36;    // px ต่อ 1 วัน
const DAYS = 28;  // หน้าต่างครั้งละ 4 สัปดาห์ เลื่อนทีละสัปดาห์ด้วย ‹ ›

const defaultStart = () => iso(addDays(mondayOf(todayDate()), -7));

export default function GanttView({ db, onEdit }: { db: DB; onEdit: (t: Task) => void }) {
  // component นี้ mount ฝั่ง client เท่านั้น (หลัง auth gate) อ่าน URL ใน initializer ได้เลย
  const [start, setStart] = useState(() => {
    const g = getParam('g');
    return g && /^\d{4}-\d{2}-\d{2}$/.test(g) ? iso(mondayOf(parseISO(g))) : defaultStart();
  });
  const s0 = parseISO(start);
  const endIso = iso(addDays(s0, DAYS - 1));
  const nav = (days: number) => {
    const ns = iso(addDays(s0, days));
    setStart(ns);
    setParam('g', ns === defaultStart() ? null : ns);
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
      <div className="tbnav" style={{ padding: '10px 12px 8px' }}>
        <button onClick={() => nav(-7)}>‹</button>
        <span className="wk">{fmtShort(start)} – {fmtShort(endIso)} {parseISO(endIso).getFullYear()}</span>
        <button onClick={() => nav(7)}>›</button>
        {start !== defaultStart() && (
          <button style={{ width: 'auto', padding: '0 10px' }} onClick={() => nav(dayDiff(start, defaultStart()))}>วันนี้</button>
        )}
      </div>
      <div className="scroll" style={{ maxHeight: 600 }}>
        <div className="gantt">
          <div className="grow ghead">
            <div className="gname">งาน</div>
            <div className="gtrack" style={{ width: DAYS * DW }}>
              <div className="gmons">
                {monthSegs.map((m, i) => <span key={i} style={{ width: m.span * DW }}>{m.label}</span>)}
              </div>
              <div>
                {dayCells.map((c, i) => (
                  <span key={i} className={'gcell' + (c.we ? ' we' : '') + (c.td ? ' tdy' : '')} style={{ width: DW }}>
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
              <div className="grow" key={t.id}>
                <div className="gname">{t.title}</div>
                <div className="gtrack" style={{ width: DAYS * DW }}>
                  <div className="gbarrow">
                    {dayCells.map((c, j) => (
                      <div key={j} className={'gbg' + (c.we ? ' we' : '') + (c.td ? ' td' : '')} style={{ left: j * DW, width: DW }} />
                    ))}
                    {toff >= 0 && toff < DAYS && <div className="gtoday" style={{ left: toff * DW + DW / 2 }} />}
                    <div
                      className="gbar"
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
