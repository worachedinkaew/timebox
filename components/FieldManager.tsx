'use client';

import { useState } from 'react';
import { fieldApi } from '../lib/db';
import type { DB, FieldType } from '../lib/types';

const FIELD_TYPES: { id: FieldType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'select', label: 'Select' },
  { id: 'date', label: 'Date' },
  { id: 'checkbox', label: 'Checkbox' },
];

export default function FieldManager({ db, onClose, onChanged }: {
  db: DB;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [opts, setOpts] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      await fieldApi.create({
        label: label.trim(),
        type,
        options: type === 'select' ? opts.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      setLabel('');
      setOpts('');
      setType('text');
      onChanged();
    } catch (e) {
      console.error(e);
      alert('เพิ่มฟิลด์ไม่สำเร็จ');
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm('ลบฟิลด์นี้? ค่าที่กรอกไว้ในงานจะไม่แสดงอีก')) return;
    try {
      await fieldApi.remove(id);
      onChanged();
    } catch (e) {
      console.error(e);
      alert('ลบฟิลด์ไม่สำเร็จ');
    }
  }

  return (
    <div className="ov" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="mhd"><h3>จัดการ custom field</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="mbd">
          {db.fields.map((f) => (
            <div className="fitem" key={f.id}>
              <b>{f.label}</b>
              <span className="ft">{f.type}</span>
              <button className="rm" onClick={() => remove(f.id)}>×</button>
            </div>
          ))}
          {!db.fields.length && <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>ยังไม่มี custom field</div>}

          <div style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 13 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 9 }}>เพิ่มฟิลด์ใหม่</div>
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
            <button className="btn pri" style={{ width: '100%' }} onClick={add} disabled={busy}>+ เพิ่มฟิลด์</button>
          </div>
        </div>
        <div className="mft">
          <div className="sp" />
          <button className="btn pri" onClick={onClose}>เสร็จ</button>
        </div>
      </div>
    </div>
  );
}
