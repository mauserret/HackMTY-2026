export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginación">
      <button
        className="button button--ghost"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        type="button"
      >
        Anterior
      </button>
      <span>
        Página <strong>{page}</strong> de <strong>{totalPages}</strong>
      </span>
      <button
        className="button button--ghost"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        type="button"
      >
        Siguiente
      </button>
    </nav>
  );
}
