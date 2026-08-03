interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}

export function StatCard({ label, value, hint, accent }: StatCardProps) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p
        className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
          accent ? 'text-base-blue' : 'text-white'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-base-muted">{hint}</p> : null}
    </div>
  );
}
