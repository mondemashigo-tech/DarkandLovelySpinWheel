export default function BudgetBar({ budget }) {
  if (!budget) return <div className="text-muted text-sm">Loading budget...</div>;
  const spent = budget.spent_zar / 100;
  const total = budget.budget_zar / 100;
  const pct = Math.min(100, (spent / total) * 100);
  const color = pct > 80 ? '#FF3D8A' : pct > 60 ? '#FFC83D' : '#4DFF9F';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">Weekly Budget</span>
        <span>R{spent.toFixed(0)} / R{total.toFixed(0)}</span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        ></div>
      </div>
      <div className="text-xs text-muted mt-1">R{(total - spent).toFixed(0)} remaining</div>
    </div>
  );
}
