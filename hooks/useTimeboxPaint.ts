'use client';

import { useEffect, useRef } from 'react';
import { blockApi } from '@/lib/db';
import { BUFID, cellKey } from '@/lib/slots';
import type { Block } from '@/lib/types';

type Op =
  | { kind: 'set'; taskId: string | null; date: string; slot: number }
  | { kind: 'del'; date: string; slot: number };

// engine ลากระบายเวลาในกริด Timebox — อัปเดต optimistic ระหว่างลาก แล้วบันทึกทั้ง stroke ตอนปล่อย
export function useTimeboxPaint({ blockMap, sel, erase, updateBlocks, onError, onEmptyPick }: {
  blockMap: Map<string, Block>;                          // map จาก db.blocks (key = cellKey)
  sel: string | null;                                    // task id | BUFID | null
  erase: boolean;
  updateBlocks: (up: (blocks: Block[]) => Block[]) => void;
  onError: () => void;
  onEmptyPick: () => void;                               // กดกริดโดยยังไม่เลือกงาน/ยางลบ
}) {
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
    // โดน label ในช่อง (ไม่มี data-date) ให้ขยับขึ้นไปที่ตัวช่อง — เช็กจาก dataset ไม่ผูกกับชื่อ class
    if (el && el.dataset.date == null) el = el.parentElement;
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
      onEmptyPick();
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

  return { onPointerDown, onPointerMove };
}
