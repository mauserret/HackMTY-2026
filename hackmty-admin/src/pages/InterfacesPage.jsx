import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { adminApi, errorMessage } from "../api/client";
import InteractionDrawer from "../components/InteractionDrawer";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import Pagination from "../components/Pagination";
import {
  componentLabel,
  formatDate,
  ratingLabel,
} from "../utils/format";

export default function InterfacesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const userName = searchParams.get("userName") || "";
  const [result, setResult] = useState({
    items: [],
    page: 1,
    total: 0,
    total_pages: 1,
  });
  const [components, setComponents] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [component, setComponent] = useState("");
  const [ratingStatus, setRatingStatus] = useState("all");
  const [selectedInteraction, setSelectedInteraction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({
    page = 1,
    nextSearch = "",
    nextComponent = "",
    nextRatingStatus = "all",
    nextUserId = "",
  } = {}) => {
    setLoading(true);
    setError("");
    try {
      setResult(
        await adminApi.interactions({
          page,
          page_size: 25,
          search: nextSearch || undefined,
          component: nextComponent || undefined,
          rating_status: nextRatingStatus,
          user_id: nextUserId || undefined,
        }),
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminApi
      .overview()
      .then((overview) => {
        if (active) setComponents(overview.components);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    load({
      page: 1,
      nextSearch: search,
      nextComponent: component,
      nextRatingStatus: ratingStatus,
      nextUserId: userId,
    });
  }, [userId, load]);

  const filters = {
    nextSearch: search,
    nextComponent: component,
    nextRatingStatus: ratingStatus,
    nextUserId: userId,
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    setSearch(nextSearch);
    load({ ...filters, page: 1, nextSearch });
  };

  const changeComponent = (event) => {
    const nextComponent = event.target.value;
    setComponent(nextComponent);
    load({ ...filters, page: 1, nextComponent });
  };

  const changeRating = (event) => {
    const nextRatingStatus = event.target.value;
    setRatingStatus(nextRatingStatus);
    load({ ...filters, page: 1, nextRatingStatus });
  };

  const clearUser = () => {
    setSearchParams({});
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">EXPLORADOR A2UI</span>
          <h1>Interfaces generadas</h1>
          <p>Prompt, componente, estructura persistida y evaluación asociada.</p>
        </div>
      </header>

      {userId ? (
        <div className="active-filter">
          <span>
            Mostrando actividad de <strong>{userName || userId}</strong>
          </span>
          <button onClick={clearUser} type="button">
            Ver todos ×
          </button>
        </div>
      ) : null}

      <section className="panel">
        <div className="toolbar toolbar--filters">
          <form className="search-form" onSubmit={submitSearch}>
            <input
              aria-label="Buscar prompts"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar texto del prompt"
              type="search"
              value={searchInput}
            />
            <button className="button button--dark" type="submit">
              Buscar
            </button>
          </form>
          <label className="select-field">
            <span>Componente</span>
            <select onChange={changeComponent} value={component}>
              <option value="">Todos</option>
              {components.map((item) => (
                <option key={item.component} value={item.component}>
                  {componentLabel(item.component)} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span>Calificación</span>
            <select onChange={changeRating} value={ratingStatus}>
              <option value="all">Todas</option>
              <option value="rated">Calificadas</option>
              <option value="unrated">Pendientes</option>
            </select>
          </label>
          <span className="result-count">{result.total} resultados</span>
        </div>

        {error ? (
          <ErrorState
            message={error}
            onRetry={() => load({ ...filters, page: result.page })}
          />
        ) : null}
        {loading && !result.items.length ? <LoadingState /> : null}

        {!loading && !result.items.length ? (
          <EmptyState title="No hay interfaces">
            No existen resultados para los filtros seleccionados.
          </EmptyState>
        ) : null}

        {result.items.length ? (
          <div className="data-table-wrapper">
            <table className="data-table data-table--interfaces">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Componente</th>
                  <th>Prompt</th>
                  <th>Calificación</th>
                  <th>Generada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.interaction_id}>
                    <td>
                      <strong>{item.user.name}</strong>
                      <small>@{item.user.username || "sin-usuario"}</small>
                    </td>
                    <td>
                      <span className="badge">
                        {componentLabel(item.component)}
                      </span>
                    </td>
                    <td className="data-table__prompt">{item.prompt}</td>
                    <td>
                      <span
                        className={`rating-pill ${
                          Number.isInteger(item.rating)
                            ? "rating-pill--rated"
                            : ""
                        }`}
                      >
                        {ratingLabel(item.rating)}
                      </span>
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td className="data-table__action">
                      <button
                        className="button button--small button--ghost"
                        onClick={() =>
                          setSelectedInteraction(item.interaction_id)
                        }
                        type="button"
                      >
                        Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <Pagination
          onChange={(page) => load({ ...filters, page })}
          page={result.page}
          totalPages={result.total_pages}
        />
      </section>

      <InteractionDrawer
        interactionId={selectedInteraction}
        onClose={() => setSelectedInteraction(null)}
      />
    </main>
  );
}
