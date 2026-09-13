import { useCallback, useEffect, useState } from "react";

import { adminApi, errorMessage } from "../api/client";
import InteractionDrawer from "../components/InteractionDrawer";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import Pagination from "../components/Pagination";
import {
  averageLabel,
  componentLabel,
  formatDate,
  ratingLabel,
} from "../utils/format";

export default function RatingsPage() {
  const [result, setResult] = useState({
    items: [],
    page: 1,
    total: 0,
    total_pages: 1,
    average_rating: null,
    rated: 0,
    unrated: 0,
    distribution: [],
  });
  const [selectedRating, setSelectedRating] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedInteraction, setSelectedInteraction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({
    page = 1,
    rating = "",
    nextSearch = "",
  } = {}) => {
    setLoading(true);
    setError("");
    try {
      setResult(
        await adminApi.ratings({
          page,
          page_size: 25,
          rating: rating || undefined,
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

  const maxCount = Math.max(
    1,
    ...result.distribution.map((item) => item.count),
  );

  const chooseRating = (rating) => {
    const nextRating = selectedRating === rating ? "" : rating;
    setSelectedRating(nextRating);
    load({ page: 1, rating: nextRating, nextSearch: search });
  };

  const submit = (event) => {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    setSearch(nextSearch);
    load({ page: 1, rating: selectedRating, nextSearch });
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">CALIDAD PERCIBIDA</span>
          <h1>Análisis de calificaciones</h1>
          <p>Distribución 1–10 y detalle de la retroalimentación recibida.</p>
        </div>
      </header>

      <section className="metrics-grid metrics-grid--three">
        <article className="metric-card metric-card--accent">
          <span>Promedio general</span>
          <strong>{averageLabel(result.average_rating)}</strong>
          <small>sobre 10 puntos</small>
        </article>
        <article className="metric-card">
          <span>Evaluadas</span>
          <strong>{result.rated}</strong>
          <small>interfaces con calificación</small>
        </article>
        <article className="metric-card">
          <span>Pendientes</span>
          <strong>{result.unrated}</strong>
          <small>interfaces sin evaluar</small>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Distribución por puntuación</h2>
            <p>Selecciona una barra para filtrar el detalle.</p>
          </div>
          {selectedRating ? (
            <button
              className="text-link text-link--button"
              onClick={() => chooseRating(selectedRating)}
              type="button"
            >
              Limpiar filtro
            </button>
          ) : null}
        </div>
        <div className="score-chart">
          {result.distribution.map((item) => (
            <button
              aria-label={`${item.rating} puntos: ${item.count} respuestas`}
              className={`score-column ${
                selectedRating === item.rating ? "score-column--active" : ""
              }`}
              key={item.rating}
              onClick={() => chooseRating(item.rating)}
              type="button"
            >
              <strong>{item.count}</strong>
              <span
                style={{ height: `${Math.max(4, (item.count / maxCount) * 150)}px` }}
              />
              <small>{item.rating}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="toolbar">
          <form className="search-form" onSubmit={submit}>
            <input
              aria-label="Buscar prompts calificados"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar en prompts evaluados"
              type="search"
              value={searchInput}
            />
            <button className="button button--dark" type="submit">
              Buscar
            </button>
          </form>
          <span className="result-count">
            {result.total} evaluaciones
            {selectedRating ? ` con ${selectedRating}/10` : ""}
          </span>
        </div>

        {error ? (
          <ErrorState
            message={error}
            onRetry={() =>
              load({
                page: result.page,
                rating: selectedRating,
                nextSearch: search,
              })
            }
          />
        ) : null}
        {loading && !result.items.length ? <LoadingState /> : null}

        {!loading && !result.items.length ? (
          <EmptyState title="No hay calificaciones">
            Aún no existen evaluaciones para el criterio seleccionado.
          </EmptyState>
        ) : null}

        {result.items.length ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Puntuación</th>
                  <th>Usuario</th>
                  <th>Componente</th>
                  <th>Prompt</th>
                  <th>Evaluada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.interaction_id}>
                    <td>
                      <span className="score-badge">{item.rating}/10</span>
                    </td>
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
                    <td>{formatDate(item.rated_at || item.created_at)}</td>
                    <td className="data-table__action">
                      <button
                        className="button button--small button--ghost"
                        onClick={() =>
                          setSelectedInteraction(item.interaction_id)
                        }
                        type="button"
                      >
                        {ratingLabel(item.rating)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <Pagination
          onChange={(page) =>
            load({ page, rating: selectedRating, nextSearch: search })
          }
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
