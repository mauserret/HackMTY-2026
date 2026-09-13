import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { adminApi, errorMessage } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import Pagination from "../components/Pagination";
import { averageLabel, formatDate } from "../utils/format";

export default function UsersPage() {
  const [result, setResult] = useState({
    items: [],
    page: 1,
    total: 0,
    total_pages: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (page = 1, nextSearch = "") => {
    setLoading(true);
    setError("");
    try {
      setResult(
        await adminApi.users({
          page,
          page_size: 25,
          search: nextSearch || undefined,
        }),
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = (event) => {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    setSearch(nextSearch);
    load(1, nextSearch);
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">DIRECTORIO</span>
          <h1>Usuarios y actividad</h1>
          <p>Quién usa la plataforma y cuántas interfaces ha generado.</p>
        </div>
      </header>

      <section className="panel">
        <div className="toolbar">
          <form className="search-form" onSubmit={submit}>
            <input
              aria-label="Buscar usuarios"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre, usuario o correo"
              type="search"
              value={searchInput}
            />
            <button className="button button--dark" type="submit">
              Buscar
            </button>
          </form>
          <span className="result-count">{result.total} usuarios</span>
        </div>

        {error ? <ErrorState message={error} onRetry={() => load(1, search)} /> : null}
        {loading && !result.items.length ? <LoadingState /> : null}

        {!loading && !result.items.length ? (
          <EmptyState title="No se encontraron usuarios">
            Ajusta la búsqueda para consultar otros perfiles.
          </EmptyState>
        ) : null}

        {result.items.length ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Cuentas</th>
                  <th>Interfaces</th>
                  <th>Calificadas</th>
                  <th>Promedio</th>
                  <th>Última actividad</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.items.map((user) => {
                  const query = new URLSearchParams({
                    userId: user.id,
                    userName: user.name,
                  });
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar">
                            {user.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>{user.name}</strong>
                            <small>
                              @{user.username || "sin-usuario"} · {user.email}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{user.account_count}</td>
                      <td>
                        <strong>{user.interaction_count}</strong>
                      </td>
                      <td>{user.rated_count}</td>
                      <td>{averageLabel(user.average_rating)}</td>
                      <td>{formatDate(user.last_activity)}</td>
                      <td className="data-table__action">
                        <Link
                          className="button button--small button--ghost"
                          to={`/interfaces?${query}`}
                        >
                          Auditar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <Pagination
          onChange={(page) => load(page, search)}
          page={result.page}
          totalPages={result.total_pages}
        />
      </section>
    </main>
  );
}
