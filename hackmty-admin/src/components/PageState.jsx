export function LoadingState({ label = "Cargando información…" }) {
  return (
    <div className="loading-state">
      <span className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="alert alert--error">
      <span>{message}</span>
      {onRetry ? (
        <button className="alert__action" onClick={onRetry} type="button">
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">◇</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
