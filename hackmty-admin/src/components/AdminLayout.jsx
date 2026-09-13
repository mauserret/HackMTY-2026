import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

// Importación del logotipo real de Banorte para el admin
import logoApp from "../assets/logo.png";

const links = [
  { to: "/", label: "Resumen", icon: "⌂", end: true },
  { to: "/users", label: "Usuarios", icon: "◎" },
  { to: "/interfaces", label: "Interfaces", icon: "◇" },
  { to: "/ratings", label: "Calificaciones", icon: "☆" },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        {/* LOGOTIPO REAL EN LA BARRA LATERAL */}
        <div className="brand" style={{ padding: "20px 24px" }}>
          <img 
            src={logoApp} 
            alt="Banorte Logo" 
            style={{ 
              width: "130px", 
              height: "auto", 
              objectFit: "contain",
              filter: "brightness(0) invert(1)" // Vuelve el logo blanco puro sobre el fondo rojo de la barra
            }} 
          />
        </div>

        <nav className="nav" aria-label="Navegación administrativa">
          {links.map((link) => (
            <NavLink
              className={({ isActive }) =>
                `nav__link ${isActive ? "nav__link--active" : ""}`
              }
              end={link.end}
              key={link.to}
              onClick={() => setMenuOpen(false)}
              to={link.to}
            >
              <span aria-hidden="true" className="nav__icon">
                {link.icon}
              </span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="admin-identity">
            <span className="admin-identity__avatar">
              {admin.username.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{admin.username}</strong>
              <span>Administrador</span>
            </div>
          </div>
          <button className="logout-link" onClick={logout} type="button">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {menuOpen ? (
        <button
          aria-label="Cerrar menú"
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}

      <div className="admin-main">
        <header className="mobile-header">
          <button
            aria-label="Abrir menú"
            className="icon-button icon-button--light"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            ☰
          </button>
          <span>BANORTE · ADMIN</span>
        </header>
        <Outlet />
      </div>
    </div>
  );
}