import { useEffect, useState } from "react";

import { adminApi, errorMessage } from "../api/client";
import GeneratedUiPreview from "./GeneratedUiPreview";
import {
  componentLabel,
  formatDate,
  ratingLabel,
} from "../utils/format";

export default function InteractionDrawer({ interactionId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!interactionId) return undefined;
    let active = true;
    setDetail(null);
    setError("");
    adminApi
      .interaction(interactionId)
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError));
      });
    const escape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => {
      active = false;
      window.removeEventListener("keydown", escape);
    };
  }, [interactionId, onClose]);

  if (!interactionId) return null;

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        aria-label="Detalle de interfaz"
        aria-modal="true"
        className="drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="drawer__header">
          <div>
            <span className="eyebrow">DETALLE DE INTERFAZ</span>
            <h2>{componentLabel(detail?.component)}</h2>
          </div>
          <button
            aria-label="Cerrar detalle"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {!detail && !error ? (
          <div className="loading-state">
            <span className="spinner" />
            <p>Cargando estructura persistida…</p>
          </div>
        ) : null}

        {error ? <div className="alert alert--error">{error}</div> : null}

        {detail ? (
          <div className="drawer__content">
            <div className="detail-grid">
              <div>
                <span>Usuario</span>
                <strong>
                  {detail.user.name}
                  {detail.user.username ? ` · @${detail.user.username}` : ""}
                </strong>
              </div>
              <div>
                <span>Calificación</span>
                <strong>{ratingLabel(detail.rating)}</strong>
              </div>
              <div>
                <span>Generada</span>
                <strong>{formatDate(detail.created_at)}</strong>
              </div>
            </div>

            <section className="detail-section">
              <h3>Prompt del usuario</h3>
              <blockquote>{detail.prompt}</blockquote>
            </section>

            <section className="detail-section">
              <h3>UI generada</h3>
              <p className="muted">
                Vista previa de solo lectura con los datos persistidos.
              </p>
              <GeneratedUiPreview
                component={detail.component}
                response={detail.response}
              />
            </section>

            <section className="detail-section">
              <h3>Estructura A2UI</h3>
              <pre>{JSON.stringify(detail.response, null, 2)}</pre>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
