import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { adminApi, errorMessage } from "../api/client";
import InteractionDrawer from "../components/InteractionDrawer";
import { ErrorState, LoadingState } from "../components/PageState";
import {
  averageLabel,
  componentLabel,
  formatDate,
  ratingLabel,
} from "../utils/format";

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedInteraction, setSelectedInteraction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, interactions] = await Promise.all([
        adminApi.overview(),
        adminApi.interactions({ page: 1, page_size: 6 }),
      ]);
      setOverview(summary);
      setRecent(interactions.items);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxRatingCount = Math.max(
    1,
    ...(overview?.rating_distribution || []).map((item) => item.count),
  );

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">VISIÓN GENERAL</span>
          <h1>Actividad generativa</h1>
          <p>Estado de usuarios, interfaces y retroalimentación registrada.</p>
        </div>
        <button className="button button--ghost" onClick={load} type="button">
          Actualizar
        </button>
      </header>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading && !overview ? <LoadingState /> : null}

      {overview ? (
        <>
          {!overview.persistent ? (
            <div className="alert alert--warning">
              <strong>Almacenamiento efímero.</strong> Configura MongoDB para
              conservar la actividad después de reiniciar el backend.
            </div>
          ) : null}

          <section className="metrics-grid">
            <article className="metric-card">
              <span>Usuarios</span>
              <strong>{overview.totals.users}</strong>
              <small>perfiles registrados</small>
            </article>
            <article className="metric-card">
              <span>Interfaces</span>
              <strong>{overview.totals.interfaces}</strong>
              <small>respuestas A2UI persistidas</small>
            </article>
            <article className="metric-card">
              <span>Calificadas</span>
              <strong>{overview.totals.rated}</strong>
              <small>{overview.totals.unrated} pendientes</small>
            </article>
            <article className="metric-card metric-card--accent">
              <span>Promedio</span>
              <strong>{averageLabel(overview.totals.average_rating)}</strong>
              <small>
                {overview.latest_activity
                  ? `Última: ${formatDate(overview.latest_activity)}`
                  : "Sin actividad"}
              </small>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel__header">
                <div>
                  <h2>Distribución de calificaciones</h2>
                  <p>Frecuencia por puntuación de 1 a 10.</p>
                </div>
                <Link className="text-link" to="/ratings">
                  Analizar
                </Link>
              </div>
              <div className="rating-chart">
                {overview.rating_distribution.map((item) => (
                  <div className="rating-bar" key={item.rating}>
                    <span>{item.rating}</span>
                    <div className="rating-bar__track">
                      <div
                        className="rating-bar__fill"
                        style={{
                          width: `${(item.count / maxRatingCount) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel__header">
                <div>
                  <h2>Componentes generados</h2>
                  <p>Composición del catálogo A2UI.</p>
                </div>
                <Link className="text-link" to="/interfaces">
                  Explorar
                </Link>
              </div>
              <div className="component-list">
                {overview.components.length ? (
                  overview.components.slice(0, 7).map((item) => (
                    <div className="component-list__item" key={item.component}>
                      <span className="badge">
                        {componentLabel(item.component)}
                      </span>
                      <div>
                        <strong>{item.count}</strong>
                        <small>{item.rated_count} calificadas</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Aún no hay interfaces generadas.</p>
                )}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Actividad reciente</h2>
                <p>Últimas interfaces creadas por los usuarios.</p>
              </div>
              <Link className="text-link" to="/interfaces">
                Ver todas
              </Link>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Componente</th>
                    <th>Prompt</th>
                    <th>Calificación</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item) => (
                    <tr
                      className="data-table__clickable"
                      key={item.interaction_id}
                      onClick={() => setSelectedInteraction(item.interaction_id)}
                    >
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
                      <td>{ratingLabel(item.rating)}</td>
                      <td>{formatDate(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <InteractionDrawer
        interactionId={selectedInteraction}
        onClose={() => setSelectedInteraction(null)}
      />
    </main>
  );
}
