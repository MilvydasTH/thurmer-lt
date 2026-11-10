export interface StepTimer {
  label: string;
  seconds: number;
}

const UNIT =
  '(hours?|hrs?|h|timer|time|t|valand\\p{L}*|val\\.?|minutes?|mins?|min\\.?|minutter|minut\\p{L}*|seconds?|secs?|sek\\.?|sekund\\p{L}*)';
const RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?)(?:\\s*(?:-|–|to|til|iki)\\s*(\\d+(?:[.,]\\d+)?))?\\s*${UNIT}(?![\\p{L}])`,
  'giu',
);

function unitSeconds(u: string): number {
  const s = u.toLowerCase();
  if (/^(h|hr|hrs|hour|hours|time|timer|t|val)/.test(s)) return 3600;
  if (/^(s|sec|sek)/.test(s)) return 1;
  return 60;
}

/** Finds durations mentioned in a step ("simmer for 10–12 minutes", "bag i 25 min", "kepkite 1 val."). */
export function findTimers(step: string): StepTimer[] {
  const out: StepTimer[] = [];
  for (const m of step.matchAll(RE)) {
    const n = parseFloat(m[1].replace(',', '.'));
    const seconds = Math.round(n * unitSeconds(m[3]));
    if (seconds >= 10 && seconds <= 24 * 3600) out.push({ label: m[0].trim(), seconds });
  }
  return out;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
