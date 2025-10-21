import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import styles from "./Page.module.css";

export default function AuditLogPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit"],
    enabled: !!token,
    queryFn: async () => {
      const res = await apiClient("/api/admin/audit-events/", { token });
      if (!res.ok) {
        throw new Error("Unable to load audit events");
      }
      return res.json();
    },
  });

  const events = data?.results ?? data ?? [];

  return (
    <div className={styles.page}>
      <h2>Audit Events</h2>
      {isLoading && <p>Loading…</p>}
      {!isLoading && (
        <div className={styles.timeline}>
          {events.map((event: any) => (
            <article key={event.id} className={styles.event}>
              <header>
                <strong>{event.event_type}</strong>
                <span>{new Date(event.created_at).toLocaleString()}</span>
              </header>
              {event.actor && (
                <p className={styles.actor}>Actor: {event.actor.name || event.actor.username}</p>
              )}
              {event.message && <p>{event.message}</p>}
              {event.target && <p className={styles.target}>Target: {event.target}</p>}
            </article>
          ))}
          {events.length === 0 && <p>No audit events yet.</p>}
        </div>
      )}
    </div>
  );
}
