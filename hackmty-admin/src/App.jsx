import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import AdminLayout from "./components/AdminLayout";
import DashboardPage from "./pages/DashboardPage";
import InterfacesPage from "./pages/InterfacesPage";
import LoginPage from "./pages/LoginPage";
import RatingsPage from "./pages/RatingsPage";
import UsersPage from "./pages/UsersPage";

function ProtectedRoute() {
  const { admin, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <main className="boot-screen">
        <span className="spinner spinner--red" />
        <p>Validando sesión administrativa…</p>
      </main>
    );
  }
  return admin ? (
    <Outlet />
  ) : (
    <Navigate replace state={{ from: location.pathname }} to="/login" />
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route element={<DashboardPage />} index />
          <Route element={<UsersPage />} path="users" />
          <Route element={<InterfacesPage />} path="interfaces" />
          <Route element={<RatingsPage />} path="ratings" />
        </Route>
      </Route>
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
