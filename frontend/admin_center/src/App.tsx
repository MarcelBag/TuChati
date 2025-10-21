import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense } from "react";
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import RolesPage from "./pages/RolesPage";
import AuditLogPage from "./pages/AuditLogPage";
import HealthPage from "./pages/HealthPage";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Suspense fallback={<div className="page">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="/audit" element={<AuditLogPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="*" element={<div className="page">Not found</div>} />
          </Routes>
        </Suspense>
      </Layout>
    </AuthProvider>
  );
}
