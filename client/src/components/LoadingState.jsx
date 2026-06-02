export default function LoadingState({ message = 'Fetching signals...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="spinner" />
      <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--cyan)' }}>
        {message}
      </p>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="text-4xl">⚠</div>
      <p className="text-sm" style={{ color: 'var(--pink)' }}>{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-md text-xs tracking-widest uppercase border"
          style={{ borderColor: 'var(--pink)', color: 'var(--pink)' }}
        >
          RETRY
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(232,228,255,0.3)' }}>
        {message}
      </p>
      {action && (
        <p className="text-xs" style={{ color: 'var(--cyan)' }}>{action}</p>
      )}
    </div>
  );
}
