export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

export function weekDates(start: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)));
}
