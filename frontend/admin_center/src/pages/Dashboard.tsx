import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import { AdminPermission } from "../utils/permissions";
import styles from "./Page.module.css";

export default function Dashboard() {
  const { token, permissions } = useAuth();
  const canViewHealth = permissions.includes(AdminPermission.VIEW_HEALTH);

  const { data, error, isError } = useQuery({
    queryKey: ["admin", "overview", token],
    enabled: !!token,
    queryFn: async () => {
      const res = await apiClient("/api/admin/audit-events/?limit=5", { token });
      if (!res.ok) return { events: [] };
      const payload = await res.json();
      return { events: payload.results || payload };
    },
  });

  return (
    <div className={styles.page}>
      <h2>Overview</h2>
      <div className={styles.grid}>
      <section className={styles.card}>
        <h3>Recent Audit Events</h3>
        {isError && (
          <p className={styles.note}>
            {(error as Error)?.message || "Unable to load audit events."}
          </p>
        )}
        <ul className={styles.list}>
          {(data?.events ?? []).slice(0, 5).map((event: any) => (
            <li key={event.id}>
              <strong>{event.event_type}</strong>
                <span>{new Date(event.created_at).toLocaleString()}</span>
              </li>
            ))}
            {(data?.events ?? []).length === 0 && <li>No audit events yet.</li>}
          </ul>
        </section>
        <section className={styles.card}>
          <h3>System Health</h3>
          <p>
            {canViewHealth
              ? "Health dashboards coming soon."
              : "Request the 'view health' permission to see this panel."}
          </p>
        </section>
      </div>
    </div>
  );
}
