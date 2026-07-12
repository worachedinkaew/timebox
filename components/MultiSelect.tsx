'use client';

import { useEffect, useRef, useState } from 'react';
import type { OptionDef } from '@/lib/types';

export default function MultiSelect({ placeholder, options, value, onChange }: {
  placeholder: string;
  options: OptionDef[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const label =
    value.length === 0 ? placeholder
    : value.length <= 2 ? options.filter((o) => value.includes(o.id)).map((o) => o.label).join(', ')
    : `${placeholder} · ${value.length}`;

  return (
    <div className="msel" ref={ref}>
      <button type="button" className={'msbtn' + (value.length ? ' active' : '')} onClick={() => setOpen(!open)}>
        {label} <span className="car">▾</span>
      </button>
      {open && (
        <div className="mpanel">
          {options.map((o) => (
            <label key={o.id} className="mopt">
              <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
              <span className="dot" style={{ background: o.color }} />
              {o.label}
            </label>
          ))}
          {value.length > 0 && (
            <button type="button" className="mclear" onClick={() => onChange([])}>ล้างที่เลือก</button>
          )}
        </div>
      )}
    </div>
  );
}
