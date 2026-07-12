'use client';

import { useRef } from 'react';
import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { optById } from '@/lib/types';
import type { DB, OptionDef, Status, Task } from '@/lib/types';
import { fmtShort } from '@/lib/dates';
import { chipStyle } from '@/lib/colors';

export default function KanbanView({ db, onEdit, onAdd, onMove }: {
  db: DB;
  onEdit: (t: Task) => void;
  onAdd: (status: Status) => void;
  onMove: (t: Task, status: Status) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  // กัน click ที่ browser ยิงตามหลัง pointerup ของการลาก ไม่ให้เปิด modal
  const suppressClick = useRef(false);

  function onDragEnd(e: DragEndEvent) {
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 150);
    const task = db.tasks.find((t) => t.id === e.active.id);
    const status = e.over?.id as Status | undefined;
    if (task && status && task.status !== status) onMove(task, status);
  }

  return (
    <div className="scroll">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="kb">
          {db.statuses.map((s) => (
            <Column
              key={s.id}
              status={s}
              tasks={db.tasks.filter((t) => t.status === s.id)}
              priorities={db.priorities}
              onAdd={onAdd}
              onCardClick={(t) => { if (!suppressClick.current) onEdit(t); }}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ status, tasks, priorities, onAdd, onCardClick }: {
  status: OptionDef;
  tasks: Task[];
  priorities: OptionDef[];
  onAdd: (status: Status) => void;
  onCardClick: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div className={'kcol' + (isOver ? ' drag' : '')}>
      <div className="khead">
        <span className="dot" style={{ background: status.color }} />
        {status.label}
        <span className="ct">{tasks.length}</span>
      </div>
      <div className="kbody" ref={setNodeRef}>
        {tasks.map((t) => <Card key={t.id} task={t} priorities={priorities} onClick={() => onCardClick(t)} />)}
      </div>
      <button className="kadd" onClick={() => onAdd(status.id)}>+ เพิ่มงาน</button>
    </div>
  );
}

function Card({ task, priorities, onClick }: { task: Task; priorities: OptionDef[]; onClick: () => void }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({ id: task.id });
  const p = optById(priorities, task.priority);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={'kcard' + (isDragging ? ' dragging' : '')}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
    >
      <div className="kt">{task.title}</div>
      <div className="meta">
        <span className="chip" style={chipStyle(p)}>{p.label}</span>
        <span className="mono" style={{ color: 'var(--ink-soft)' }}>{task.manday} md</span>
      </div>
      <div className="meta"><span className="dts">{fmtShort(task.start)} → {fmtShort(task.end)}</span></div>
    </div>
  );
}
