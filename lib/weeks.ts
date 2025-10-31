
export function isoWeekRange(isoWeek: string) {
  const m = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!m) throw new Error(`ISO week inválida: ${isoWeek}`);
  const year = Number(m[1]);
  const week = Number(m[2]);

  const simple = Date.UTC(year, 0, 4);
  const date = new Date(simple);
  const dayOfWeek = (new Date(simple).getUTCDay() + 6) % 7;
  const firstThursday = new Date(simple - dayOfWeek * 86400000 + 3 * 86400000);
  const targetThursday = new Date(firstThursday.getTime() + (week - 1) * 7 * 86400000);

  const monday = new Date(targetThursday.getTime() - 3 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);

  const start = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0, 0));
  const end   = new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate(), 23, 59, 59, 999));

  return { start, end };
}

export function getIsoWeekKey(d: Date) {
  const nd = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (nd.getUTCDay() + 6) % 7;
  nd.setUTCDate(nd.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(nd.getUTCFullYear(), 0, 4));
  const diff = (nd.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  const year = nd.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function growthWeekFor(dateRef: Date, sowingDate: Date) {
  const ms = dateRef.getTime() - sowingDate.getTime();
  const days = Math.floor(ms / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

export function isActiveInRange(start: Date, end: Date, sowing: Date, harvest: Date) {
  return sowing.getTime() <= end.getTime() && harvest.getTime() >= start.getTime();
}
