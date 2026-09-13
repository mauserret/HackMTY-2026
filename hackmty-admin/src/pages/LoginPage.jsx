import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// Importación del logotipo real
import logoApp from "../assets/logo.png";

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
    <main style={{ display: 'flex', minHeight: '100vh', width: '100vw', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      
      {/* Animación CSS para el logo al hacer login */}
      <style>{`
        @keyframes logoPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        .logo-animating {
          animation: logoPulse 0.9s infinite ease-in-out;
        }
      `}</style>

      {/* LADO IZQUIERDO: Fondo BLANCO con la imagen real del logotipo */}
      <section style={{ 
        flex: 1, 
        backgroundColor: '#FFFFFF', 
        padding: '60px 54px', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between', 
        color: '#0F172A',
        borderRight: '1px solid #E2E8F0'
      }}>
        {/* IMAGEN REAL DEL LOGO CON ANIMACIÓN DE CARGA */}
        <div>
          <img 
            src={logoApp} 
            alt="Banorte Logo" 
            className={loading ? "logo-animating" : ""}
            style={{ 
              width: '180px', 
              height: 'auto', 
              objectFit: 'contain',
              transition: 'transform 0.3s ease'
            }} 
          />
        </div>
        
        <div style={{ maxWidth: '500px' }}>
          <span style={{ color: '#EB0029', fontWeight: '800', letterSpacing: '1.5px', fontSize: '11px', display: 'block', marginBottom: '12px' }}>
            AUDITORÍA OPERATIVA
          </span>
          <h1 style={{ fontSize: '42px', fontWeight: '800', lineHeight: '1.15', margin: '0 0 20px 0', color: '#0F172A' }}>
            Entiende cada interfaz generada y cómo fue evaluada.
          </h1>
          <p style={{ fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
            Un espacio privado y seguro para revisar la actividad, el contenido A2UI y los resultados de los usuarios de la app.
          </p>
        </div>

        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
          HackMTY 2026 · Portal interno de administración
        </div>
      </section>

      {/* LADO DERECHO: Fondo ROJO INSTITUCIONAL con la tarjeta blanca */}
      <section style={{ 
        width: '520px', 
        backgroundColor: '#EB0029', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '40px' 
      }}>
        <form onSubmit={submit} style={{ 
          width: '100%', 
          maxWidth: '400px',
          backgroundColor: '#FFFFFF', 
          padding: '40px', 
          borderRadius: '20px', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}>
          <div style={{ marginBottom: '28px' }}>
            <span style={{ color: '#EB0029', fontWeight: '800', fontSize: '10px', letterSpacing: '1.2px', display: 'block', marginBottom: '6px' }}>
              ACCESO RESTRINGIDO
            </span>
            <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#0F172A', margin: '0 0 6px 0' }}>
              Panel administrativo
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Ingresa con tu cuenta autorizada
            </p>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="username" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
              Usuario
            </label>
            <input
              autoComplete="username"
              autoFocus
              id="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Usuario administrador"
              value={username}
              style={{ 
                width: '100%', 
                padding: '13px 16px', 
                borderRadius: '10px', 
                border: '1px solid #CBD5E1', 
                fontSize: '14px', 
                outline: 'none',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
              Contraseña
            </label>
            <input
              autoComplete="current-password"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••"
              type="password"
              value={password}
              style={{ 
                width: '100%', 
                padding: '13px 16px', 
                borderRadius: '10px', 
                border: '1px solid #CBD5E1', 
                fontSize: '14px', 
                outline: 'none',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error ? (
            <div role="alert" style={{ 
              padding: '12px 16px', 
              backgroundColor: '#FEE2E2', 
              color: '#B91C1C', 
              borderRadius: '10px', 
              fontSize: '13px', 
              marginBottom: '20px',
              fontWeight: '500'
            }}>
              {error}
            </div>
          ) : null}

          <button
            disabled={loading || !username.trim() || !password}
            type="submit"
            style={{ 
              width: '100%', 
              padding: '14px', 
              backgroundColor: '#EB0029', 
              color: '#FFFFFF', 
              border: 'none', 
              borderRadius: '10px', 
              fontWeight: '700', 
              fontSize: '14px', 
              cursor: (loading || !username.trim() || !password) ? 'not-allowed' : 'pointer', 
              opacity: (loading || !username.trim() || !password) ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(235, 0, 41, 0.3)',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? "Validando acceso..." : "Entrar al portal"}
          </button>
        </form>
      </section>
    </main>
  );
}