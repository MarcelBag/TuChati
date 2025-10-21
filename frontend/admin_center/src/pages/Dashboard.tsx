import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import StatCard from "../components/StatCard";
import EventList from "../components/EventList";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "metrics", token],
    enabled: !!token,
    queryFn: async () => {
      const res = await apiClient("/api/admin/metrics/", { token });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail || "Unable to load metrics");
      }
      return res.json();
    },
  });

  const stats = data?.stats || {};
  const recentEvents = data?.recent_events || [];
  const latestUsers = data?.latest_users || [];
  const topRoles = data?.top_roles || [];

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2>Control Center</h2>
          <p>Snapshot of user activity and admin signals.</p>
        </div>
        <span className={styles.timestamp}>
          {isLoading ? "Refreshing…" : new Date().toLocaleString()}
        </span>
      </div>

      {error instanceof Error && <p className={styles.error}>{error.message}</p>}

      <div className={styles.statsGrid}>
        <StatCard
          label="Total users"
          value={stats.total_users ?? "—"}
          hint={`${stats.staff_users ?? 0} staff / ${stats.superusers ?? 0} superusers`}
        />
        <StatCard
          label="Active today"
          value={stats.active_today ?? "—"}
          hint="Users with a recent login"
        />
        <StatCard
          label="Chat rooms"
          value={stats.total_rooms ?? "—"}
          hint={`${stats.total_roles ?? 0} admin roles configured`}
        />
      </div>

      <div className={styles.panelGrid}>
        <EventList
          title="Recent audit events"
          items={recentEvents.map((event: any) => ({
            id: event.id,
            title: event.event_type,
            subtitle: event.message,
            badge: event.severity,
            timestamp: event.created_at
              ? new Date(event.created_at).toLocaleString()
              : undefined,
          }))}
          emptyText="No audit activity yet."
        />
        <EventList
          title="Newest users"
          items={latestUsers.map((user: any) => ({
            id: user.id,
            title: user.username,
            subtitle: user.email,
            timestamp: user.date_joined
              ? new Date(user.date_joined).toLocaleString()
              : undefined,
          }))}
          emptyText="No recent signups."
        />
        <EventList
          title="Top roles"
          items={topRoles.map((role: any) => ({
            id: role.id,
            title: role.name,
            badge: `${role.user_count} users`,
          }))}
          emptyText="No roles configured."
        />
      </div>
    </div>
  );
}
