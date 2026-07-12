export const VIEWS = [
  ['dash', '▩ Dashboard'],
  ['list', '≣ List'],
  ['kanban', '▤ Kanban'],
  ['gantt', '▥ Gantt'],
  ['timebox', '▦ Timebox'],
  ['calendar', '▧ Calendar'],
] as const;
export type View = (typeof VIEWS)[number][0];
