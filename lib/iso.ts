// lib/iso.ts
export function getIsoWeekKey(d: Date) {
  const nd = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (nd.getUTCDay() + 6) % 7; // lunes=0
  nd.setUTCDate(nd.getUTCDate() - dayNum + 3); // jueves
  const firstThursday = new Date(Date.UTC(nd.getUTCFullYear(), 0, 4));
  const diff = (nd.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  const year = nd.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function isoYearWeekToMonday(year: number, week: number): Date {
  // lunes de la semana ISO
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // lunes=1..dom=7
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

export function diffIsoWeeks(from: Date, to: Date): number {
  // diferencia en semanas enteras (lunes a lunes)
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}
