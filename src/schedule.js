export const TRACKS = {
  math:  { label: 'Math',        target: 9.25, color: 'text-blue-400',    bar: 'bg-blue-500',    dot: 'bg-blue-500' },
  ml:    { label: 'SD/ML',       target: 7,    color: 'text-violet-400',  bar: 'bg-violet-500',  dot: 'bg-violet-500' },
  build: { label: 'Building',    target: 5,    color: 'text-cyan-400',    bar: 'bg-cyan-500',    dot: 'bg-cyan-500' },
  dsa:   { label: 'DSA/Prep',    target: 9.5,  color: 'text-amber-400',   bar: 'bg-amber-500',   dot: 'bg-amber-500' },
  job:   { label: 'Job Hunt',    target: 11.5, color: 'text-emerald-400', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  data:  { label: 'Data Sci',    target: 5,    color: 'text-pink-400',    bar: 'bg-pink-500',    dot: 'bg-pink-500' },
  os:    { label: 'Open Source', target: 6,    color: 'text-orange-400',  bar: 'bg-orange-500',  dot: 'bg-orange-500' },
  read:  { label: 'Reading',     target: 4,    color: 'text-rose-400',    bar: 'bg-rose-500',    dot: 'bg-rose-500' },
};

export const SCHEDULES = {
  workday: [
    { id: 'wd-1', time: '06:30-08:00', name: 'Gym',                       track: null,    hrs: 0 },
    { id: 'wd-2', time: '08:30-09:30', name: 'Job Hunt Sprint 1',         track: 'job',   hrs: 1.0 },
    { id: 'wd-3', time: '09:30-10:45', name: 'Math',                      track: 'math',  hrs: 1.25 },
    { id: 'wd-4', time: '10:45-11:15', name: 'Commute + DSA review',      track: 'dsa',   hrs: 0.5 },
    { id: 'wd-5', time: '11:00-17:00', name: 'Work (PT job)',             track: null,    hrs: 0 },
    { id: 'wd-6', time: '17:00-17:35', name: 'Commute + Reading',         track: 'read',  hrs: 0.5 },
    { id: 'wd-7', time: '17:35-19:30', name: 'SD or ML Theory',           track: 'ml',    hrs: 2.0 },
    { id: 'wd-8', time: '20:15-21:45', name: 'DSA + Interview Prep',      track: 'dsa',   hrs: 1.5 },
    { id: 'wd-9', time: '21:45-22:45', name: 'Job Hunt Sprint 2',         track: 'job',   hrs: 1.0 },
  ],
  deepday: [
    { id: 'dd-1', time: '06:30-08:00', name: 'Gym',                       track: null,    hrs: 0 },
    { id: 'dd-2', time: '08:00-09:30', name: 'Job Hunt',                  track: 'job',   hrs: 1.5 },
    { id: 'dd-3', time: '10:00-12:00', name: 'Math (deep)',               track: 'math',  hrs: 2.0 },
    { id: 'dd-4', time: '13:00-16:00', name: 'Project Building',          track: 'build', hrs: 3.0 },
    { id: 'dd-5', time: '16:30-19:00', name: 'Data Science / Generation', track: 'data',  hrs: 2.5 },
    { id: 'dd-6', time: '20:00-21:30', name: 'DSA + Interview Prep',      track: 'dsa',   hrs: 1.5 },
    { id: 'dd-7', time: '21:30-22:30', name: 'Reading + Follow-ups',      track: 'read',  hrs: 1.0 },
  ],
  saturday: [
    { id: 'sa-1', time: '06:30-08:00', name: 'Gym',                       track: null,    hrs: 0 },
    { id: 'sa-2', time: '08:00-09:00', name: 'Job Hunt + Research',       track: 'job',   hrs: 1.0 },
    { id: 'sa-3', time: '10:00-13:00', name: 'Open Source',               track: 'os',    hrs: 3.0 },
    { id: 'sa-4', time: '14:00-16:30', name: 'Math / DSA Catchup',        track: 'math',  hrs: 2.5 },
    { id: 'sa-5', time: '17:00-22:00', name: 'Work (PT job)',             track: null,    hrs: 0 },
    { id: 'sa-6', time: '22:30-23:00', name: 'Reading',                   track: 'read',  hrs: 0.5 },
  ],
  sunday: [
    { id: 'su-1', time: '06:30-08:00', name: 'Gym',                       track: null,    hrs: 0 },
    { id: 'su-2', time: '08:00-09:00', name: 'Job Hunt + Week Planning',  track: 'job',   hrs: 1.0 },
    { id: 'su-3', time: '10:00-13:00', name: 'Open Source',               track: 'os',    hrs: 3.0 },
    { id: 'su-4', time: '14:00-17:00', name: 'SD/ML Building',            track: 'build', hrs: 3.0 },
    { id: 'su-5', time: '17:00-19:00', name: 'Mock Interview + Hard DSA', track: 'dsa',   hrs: 2.0 },
    { id: 'su-6', time: '20:00-21:30', name: 'Reading + Plan Week',       track: 'read',  hrs: 1.5 },
  ],
};

export const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const STATUS_OPTIONS = ['Applied', 'OA', 'Phone Screen', 'Onsite', 'Offer', 'Rejected', 'Ghosted'];

export function getDayType(date) {
  const d = date.getDay();
  if (d === 0) return 'sunday';
  if (d === 6) return 'saturday';
  if (d === 3 || d === 4) return 'deepday';
  return 'workday';
}

export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
