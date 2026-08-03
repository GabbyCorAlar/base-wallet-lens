'use client';

import type { DayBucket } from '@/lib/types';

const DAY_MS = 86_400_000;
const WEEKS = 53;

/**
 * Contribution-graph style view of the last 53 weeks. Columns are weeks,
 * rows are weekdays (Sunday at top), matching the layout people already know.
 */
export function ActivityHeatmap({ heatmap }: { heatmap: DayBucket[] }) {
  const counts = new Map(heatmap.map((d) => [d.date, d.count]));
  const max = heatmap.reduce((m, d) => Math.max(m, d.count), 0);

  // Anchor the grid to the most recent Saturday so the last column is current.
  const today = new Date();
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const columns: Array<Array<{ date: string; count: number }>> = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const week: Array<{ date: string; count: number }> = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(end.getTime() - (w * 7 + d) * DAY_MS).toISOString().slice(0, 10);
      week.push({ date, count: counts.get(date) ?? 0 });
    }
    columns.push(week);
  }

  const intensity = (count: number): string => {
    if (count === 0) return 'bg-base-line';
    const ratio = max > 0 ? count / max : 0;
    if (ratio > 0.66) return 'bg-base-blue';
    if (ratio > 0.33) return 'bg-base-blue/70';
    return 'bg-base-blue/40';
  };

  return (
    <div className="card overflow-x-auto">
      <p className="label">Activity — last 12 months</p>
      <div className="mt-4 flex gap-[3px]">
        {columns.map((week, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} ${day.count === 1 ? 'tx' : 'txs'}`}
                className={`h-[10px] w-[10px] rounded-[2px] ${intensity(day.count)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-base-muted">
        <span>Less</span>
        <span className="h-[10px] w-[10px] rounded-[2px] bg-base-line" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-base-blue/40" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-base-blue/70" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-base-blue" />
        <span>More</span>
      </div>
    </div>
  );
}
