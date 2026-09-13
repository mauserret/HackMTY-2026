import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (admin) return <Navigate replace to="/" />;

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password || loading) return;
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand brand--login">
          <span className="brand__name">BANORTE</span>
          <span className="brand__area">INTELIGENTE</span>
        </div>
        <div>
          <span className="eyebrow eyebrow--light">AUDITORÍA OPERATIVA</span>
          <h1>Entiende cada interfaz generada y cómo fue evaluada.</h1>
          <p>
            Un espacio privado para revisar actividad, contenido A2UI y
            resultados de los usuarios.
          </p>
        </div>
        <small>HackMTY 2026 · Portal interno</small>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={submit}>
          <span className="eyebrow">ACCESO RESTRINGIDO</span>
          <h2>Panel administrativo</h2>
          <p>Ingresa con la cuenta sembrada en MongoDB.</p>

          <label htmlFor="username">Usuario</label>
          <input
            autoComplete="username"
            autoFocus
            id="username"
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Usuario administrador"
            value={username}
          />

          <label htmlFor="password">Contraseña</label>
          <input
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña"
            type="password"
            value={password}
          />

          {error ? (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          ) : null}

          <button
            className="button button--primary button--wide"
            disabled={loading || !username.trim() || !password}
            type="submit"
          >
            {loading ? "Validando…" : "Entrar al portal"}
          </button>
        </form>
      </section>
    </main>
  );
}
