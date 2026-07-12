'use client';

import { useState } from 'react';
import { fieldApi, optionsApi, taskBulkApi } from '@/lib/db';
import { GREY } from '@/lib/types';
import type { DB, FieldType, OptionDef } from '@/lib/types';

const FIELD_TYPES: { id: FieldType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'select', label: 'Select' },
  { id: 'date', label: 'Date' },
  { id: 'checkbox', label: 'Checkbox' },
];

const newId = () => 'o' + Math.random().toString(36).slice(2, 8);

// อยู่นอก FieldManager — ประกาศข้างในจะกลายเป็น component ใหม่ทุก render แล้ว input หลุดโฟกัส
function OptionRows({ list, onList, withDone }: {
  list: OptionDef[];
  onList: (l: OptionDef[]) => void;
  withDone?: boolean;
}) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const l = [...list];
    [l[i], l[j]] = [l[j], l[i]];
    onList(l);
  };
  return (
    <>
      {list.map((o, i) => (
        <div className="orow" key={o.id}>
          <input type="color" value={o.color} onChange={(e) => onList(list.map((x, k) => (k === i ? { ...x, color: e.target.value } : x)))} />
          <input className="olabel" value={o.label} placeholder="ชื่อตัวเลือก" onChange={(e) => onList(list.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
          {withDone && (
            <label className="odone" title='นับเป็น "จบงานแล้ว" — ไม่ขึ้นรายการใน Timebox'>
              <input type="checkbox" checked={!!o.done} onChange={(e) => onList(list.map((x, k) => (k === i ? { ...x, done: e.target.checked } : x)))} /> เสร็จ
            </label>
          )}
          <button className="onav" onClick={() => move(i, -1)} disabled={i === 0}>▲</button>
          <button className="onav" onClick={() => move(i, 1)} disabled={i === list.length - 1}>▼</button>
          <button className="rm" onClick={() => onList(list.filter((_, k) => k !== i))}>×</button>
        </div>
      ))}
    </>
  );
}

export default function FieldManager({ db, onClose, onChanged }: {
  db: DB;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [opts, setOpts] = useState('');
  const [busy, setBusy] = useState(false);

  // แก้ในสำเนา local แล้วค่อยกด "บันทึกตัวเลือก" ทีเดียว
  const [statuses, setStatuses] = useState<OptionDef[]>(() => db.statuses.map((s) => ({ ...s })));
  const [priorities, setPriorities] = useState<OptionDef[]>(() => db.priorities.map((p) => ({ ...p })));
  const [optDirty, setOptDirty] = useState(false);

  async function addField() {
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      await fieldApi.create({
        label: label.trim(),
        type,
        options: type === 'select' ? opts.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      setLabel(''); setOpts(''); setType('text');
      onChanged();
    } catch (e) { console.error(e); alert('เพิ่มฟิลด์ไม่สำเร็จ'); }
    setBusy(false);
  }

  async function removeField(id: string) {
    if (!confirm('ลบฟิลด์นี้? ค่าที่กรอกไว้ในงานจะไม่แสดงอีก')) return;
    try { await fieldApi.remove(id); onChanged(); } catch (e) { console.error(e); alert('ลบฟิลด์ไม่สำเร็จ'); }
  }

  async function saveOptions() {
    if (busy) return;
    const cleanSt = statuses.map((s) => ({ ...s, label: s.label.trim() })).filter((s) => s.label);
    const cleanPr = priorities.map((p) => ({ ...p, label: p.label.trim() })).filter((p) => p.label);
    if (!cleanSt.length || !cleanPr.length) { alert('สถานะและ priority ต้องมีอย่างน้อยอย่างละ 1 ตัวเลือก'); return; }
    setBusy(true);
    try {
      // option ที่ถูกลบแต่ยังมีงานใช้อยู่ → ย้ายงานไปตัวเลือกแรกก่อน
      for (const old of db.statuses) {
        if (!cleanSt.some((s) => s.id === old.id) && db.tasks.some((t) => t.status === old.id)) {
          await taskBulkApi.reassignStatus(old.id, cleanSt[0].id);
        }
      }
      for (const old of db.priorities) {
        if (!cleanPr.some((p) => p.id === old.id) && db.tasks.some((t) => t.priority === old.id)) {
          await taskBulkApi.reassignPriority(old.id, cleanPr[0].id);
        }
      }
      await optionsApi.save(cleanSt, cleanPr);
      setOptDirty(false);
      onChanged();
    } catch (e) { console.error(e); alert('บันทึกตัวเลือกไม่สำเร็จ — เช็กว่ารัน supabase/04_custom_options.sql แล้วหรือยัง'); }
    setBusy(false);
  }

  return (
    <div className="ov" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="mhd"><h3>ตั้งค่า</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="mbd">

          <div className="shead">สถานะ (คอลัมน์ Kanban)</div>
          <OptionRows list={statuses} onList={(l) => { setStatuses(l); setOptDirty(true); }} withDone />
          <button className="oadd" onClick={() => { setStatuses([...statuses, { id: newId(), label: '', color: GREY }]); setOptDirty(true); }}>+ เพิ่มสถานะ (เช่น Cancel)</button>

          <div className="shead" style={{ marginTop: 16 }}>Priority</div>
          <OptionRows list={priorities} onList={(l) => { setPriorities(l); setOptDirty(true); }} />
          <button className="oadd" onClick={() => { setPriorities([...priorities, { id: newId(), label: '', color: GREY }]); setOptDirty(true); }}>+ เพิ่ม priority</button>

          {optDirty && (
            <button className="btn pri" style={{ width: '100%', marginTop: 12 }} onClick={saveOptions} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึกตัวเลือก'}
            </button>
          )}

          <div className="shead" style={{ marginTop: 18 }}>Custom fields</div>
          {db.fields.map((f) => (
            <div className="fitem" key={f.id}>
              <b>{f.label}</b>
              <span className="ft">{f.type}</span>
              <button className="rm" onClick={() => removeField(f.id)}>×</button>
            </div>
          ))}
          {!db.fields.length && <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>ยังไม่มี custom field</div>}

          <div className="row2">
            <div className="fld">
              <label>ชื่อฟิลด์</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น Sprint, Repo" />
            </div>
            <div className="fld">
              <label>ชนิด</label>
              <select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
                {FIELD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          {type === 'select' && (
            <div className="fld">
              <label>ตัวเลือก (คั่นด้วย ,)</label>
              <input value={opts} onChange={(e) => setOpts(e.target.value)} placeholder="Frontend, Backend, QA" />
            </div>
          )}
          <button className="btn" style={{ width: '100%' }} onClick={addField} disabled={busy}>+ เพิ่มฟิลด์</button>

        </div>
        <div className="mft">
          <div className="sp" />
          <button className="btn pri" onClick={onClose}>เสร็จ</button>
        </div>
      </div>
    </div>
  );
}
