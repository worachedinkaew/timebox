'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { blockApi } from '../lib/db';
import { TASK_COLORS } from '../lib/types';
import type { Block, DB, Task } from '../lib/types';
import { THDOW, THMON, addDays, fmtShort, iso, mondayOf, pad, parseISO, todayDate } from '../lib/dates';
import { getParam, setParam } from '../lib/urlstate';
import { loadHours, saveHours } from '../lib/hours';

// slot = index ช่อง 30 นาทีจากเที่ยงคืน (16 = 08:00) — ช่วงที่แสดงเลือกได้ เก็บใน localStorage
const cellKey = (date: string, slot: number) => `${date}|${slot}`;
const color = (t: Task) => TASK_COLORS[(t.cIdx || 0) % TASK_COLORS.length];

// ค่า sel ตอนเลือกแถว buffer — ใน DB บล็อก buffer คือแถวที่ taskId เป็น null
const BUFID = '__buffer__';

type Op =
  | { kind: 'set'; taskId: string | null; date: string; slot: number }
  | { kind: 'del'; date: string; slot: number };

export default function TimeboxView({ db, allTasks, updateBlocks, onError }: {
  db: DB;               // tasks ผ่าน filter แล้ว — ใช้กับ rail
  allTasks: Task[];     // tasks ทั้งหมด — block ที่ระบายไว้ต้องหาเจ้าของเจอเสมอ
  updateBlocks: (up: (blocks: Block[]) => Block[]) => void;
  onError: () => void;
}) {
  const [hours, setHoursRaw] = useState(loadHours);
  const setHours = (h: { start: number; end: number }) => {
    setHoursRaw(h);
    saveHours(h);
  };
  // component นี้ mount ฝั่ง client เท่านั้น (หลัง auth gate) อ่าน URL ใน initializer ได้เลย
  const [weekStart, setWeekStartRaw] = useState(() => {
    const w = getParam('w');
    return w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? iso(mondayOf(parseISO(w))) : iso(mondayOf(todayDate()));
  });
  const setWeekStart = (ws: string) => {
    setWeekStartRaw(ws);
    setParam('w', ws);
  };
  const [sel, setSel] = useState<string | null>(null);
  const [erase, setErase] = useState(false);
  const [warn, setWarn] = useState(false);

  const blockMap = useMemo(() => {
    const m = new Map<string, Block>();
    db.blocks.forEach((b) => m.set(cellKey(b.date, b.slot), b));
    return m;
  }, [db.blocks]);

  // สำเนาที่แก้ได้ทันทีระหว่างลากระบาย — pointermove มาถี่กว่ารอบ render ของ React
  const mapRef = useRef(blockMap);
  useEffect(() => { mapRef.current = new Map(blockMap); }, [blockMap]);

  const paintRef = useRef<{ painting: boolean; mode: 'paint' | 'erase'; ops: Map<string, Op> }>(
    { painting: false, mode: 'paint', ops: new Map() },
  );
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  // บันทึกทั้ง stroke ทีเดียวตอนปล่อยนิ้ว/เมาส์ (เหมือน save-on-pointerup ของ prototype)
  useEffect(() => {
    async function flush() {
      const p = paintRef.current;
      if (!p.painting) return;
      p.painting = false;
      const ops = [...p.ops.values()];
      p.ops.clear();
      if (!ops.length) return;
      const paints = ops.filter((o) => o.kind === 'set') as Extract<Op, { kind: 'set' }>[];
      const erases = ops.filter((o) => o.kind === 'del');
      try {
        if (paints.length) await blockApi.setMany(paints);
        if (erases.length) await blockApi.removeMany(erases);
      } catch (e) {
        console.error(e);
        // 23502 = not-null violation (task_id) — DB ยังไม่รัน migration รองรับ buffer
        alert((e as { code?: string })?.code === '23502'
          ? 'บันทึกไม่สำเร็จ: ฐานข้อมูลยังไม่รองรับ "เวลาเผื่องานแทรก"\nไปที่ Supabase → SQL Editor แล้วรันไฟล์ supabase/02_buffer_blocks.sql ก่อน'
          : 'บันทึกเวลาไม่สำเร็จ ลองใหม่อีกครั้ง');
        onErrorRef.current();
      }
    }
    window.addEventListener('pointerup', flush);
    return () => window.removeEventListener('pointerup', flush);
  }, []);

  function cellFromPoint(x: number, y: number): HTMLElement | null {
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (el && el.classList.contains('lb')) el = el.parentElement;
    return el?.dataset.date && el.dataset.slot != null ? el : null;
  }

  // block ในช่องนี้ตรงกับสิ่งที่เลือกอยู่ไหม (งานปกติ หรือแถว buffer)
  const selMatches = (b: Block | undefined) =>
    !!b && (sel === BUFID ? b.taskId === null : b.taskId === sel);

  function applyCell(el: HTMLElement | null) {
    if (!el) return;
    const p = paintRef.current;
    const date = el.dataset.date!, slot = +el.dataset.slot!;
    const k = cellKey(date, slot);
    const ex = mapRef.current.get(k);
    let op: Op | null = null;
    if (erase) {
      if (ex) op = { kind: 'del', date, slot };
    } else if (sel) {
      if (p.mode === 'erase') {
        if (selMatches(ex)) op = { kind: 'del', date, slot };
      } else if (!selMatches(ex)) {
        op = { kind: 'set', taskId: sel === BUFID ? null : sel, date, slot };
      }
    }
    if (!op) return;
    p.ops.set(k, op);
    if (op.kind === 'del') {
      mapRef.current.delete(k);
      updateBlocks((bs) => bs.filter((b) => !(b.date === date && b.slot === slot)));
    } else {
      const nb: Block = { id: `local-${k}`, taskId: op.taskId, date, slot };
      mapRef.current.set(k, nb);
      updateBlocks((bs) => [...bs.filter((b) => !(b.date === date && b.slot === slot)), nb]);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    const el = cellFromPoint(e.clientX, e.clientY);
    if (!el) return;
    if (!sel && !erase) {
      setWarn(true);
      setTimeout(() => setWarn(false), 800);
      return;
    }
    const p = paintRef.current;
    p.painting = true;
    p.ops.clear();
    const ex = mapRef.current.get(cellKey(el.dataset.date!, +el.dataset.slot!));
    p.mode = !erase && selMatches(ex) ? 'erase' : 'paint';
    applyCell(el);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!paintRef.current.painting) return;
    applyCell(cellFromPoint(e.clientX, e.clientY));
    e.preventDefault();
  }

  const ws = parseISO(weekStart);
  // ตัดงานที่ status ติดธง done ออกจาก rail (ชุด status ผู้ใช้กำหนดเองได้)
  const doneIds = new Set(db.statuses.filter((s) => s.done).map((s) => s.id));
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

  return (
    <div className="tbwrap">
      <div className="tbrail">
        <h4>งาน (manday → ชั่วโมง)</h4>
        <p className="hint" style={warn ? { color: 'var(--coral)' } : undefined}>
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
              className={'trow' + (sel === t.id ? ' sel' : '')}
              onClick={() => { setErase(false); setSel(sel === t.id ? null : t.id); }}
            >
              <div className="r1">
                <span className="sw" style={{ background: color(t) }} />
                <span className="nm">{t.title}</span>
              </div>
              <div className="r2">
                {planned} / {est} ชม.
                <span className={'rem' + (over ? ' warn' : '')}>{over ? `เกิน ${-rem}` : `เหลือ ${rem}`}</span>
              </div>
              <div className="gz"><span style={{ width: `${pct}%`, background: color(t) }} /></div>
            </div>
          );
        })}
        <div
          className={'trow buf' + (sel === BUFID ? ' sel' : '')}
          onClick={() => { setErase(false); setSel(sel === BUFID ? null : BUFID); }}
        >
          <div className="r1">
            <span className="sw" style={{ background: 'repeating-linear-gradient(45deg,#e9a23b 0 4px,#f2c777 4px 8px)' }} />
            <span className="nm">เวลาเผื่องานแทรก</span>
          </div>
          <div className="r2">
            กันไว้ให้งานด่วน
            <span className="rem">{plannedHours.get(BUFID) || 0} ชม.</span>
          </div>
        </div>
        <div className="tbtool">
          <button className={erase ? 'on' : ''} onClick={() => { setErase(!erase); if (!erase) setSel(null); }}>
            🧽 ยางลบ
          </button>
        </div>
      </div>

      <div className="tbmain">
        <div className="tbnav">
          <button onClick={() => setWeekStart(iso(addDays(ws, -7)))}>‹</button>
          <span className="wk">{fmtShort(weekStart)} – {fmtShort(iso(addDays(ws, 6)))}</span>
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
        <div className="scroll">
          <div
            className="tgrid"
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
              return (
                <div key={dd} className={'tgh' + (isToday ? ' now' : '')}>
                  {THDOW[dd]}{isToday ? ' • วันนี้' : ''}
                  <small>{d.getDate()} {THMON[d.getMonth()]}</small>
                </div>
              );
            })}
            {Array.from({ length: (hours.end - hours.start) * 2 }, (_, i) => {
              const s = hours.start * 2 + i;
              const hr = s % 2 === 0;
              return (
                <Fragment key={s}>
                  <div className={'tgl' + (hr ? ' hr' : '')}>{hr ? `${pad(s / 2)}:00` : ''}</div>
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
                        className={'tcell' + (hr ? ' hr' : '') + (isBuf ? ' bf' : '') + (date === iso(todayDate()) ? ' td' : '')}
                        data-date={date}
                        data-slot={s}
                        style={t ? { background: color(t) } : undefined}
                      >
                        {showLabel && <span className="lb">{t!.title}</span>}
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
