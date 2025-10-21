import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense } from "react";
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import RolesPage from "./pages/RolesPage";
import AuditLogPage from "./pages/AuditLogPage";
import HealthPage from "./pages/HealthPage";
import LoginPage from "./pages/LoginPage";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
