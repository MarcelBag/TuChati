import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import StatCard from "../components/StatCard";
import EventList from "../components/EventList";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const { token } = useAuth();
  const { t } = useTranslation();

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
          <h2>{t("dashboard.heading")}</h2>
          <p>{t("dashboard.description")}</p>
        </div>
        <span className={styles.timestamp}>
          {isLoading ? t("topbar.refresh") : new Date().toLocaleString()}
        </span>
      </div>

      {error instanceof Error && <p className={styles.error}>{error.message}</p>}

      <div className={styles.statsGrid}>
        <StatCard
          label={t("dashboard.stats.users")}
          value={stats.total_users ?? "—"}
          hint={t("dashboard.stats.staffHint", {
            staff: stats.staff_users ?? 0,
            super: stats.superusers ?? 0,
          })}
        />
        <StatCard
          label={t("dashboard.stats.active")}
          value={stats.active_today ?? "—"}
          hint={t("dashboard.stats.loginHint")}
        />
        <StatCard
          label={t("dashboard.stats.rooms")}
          value={stats.total_rooms ?? "—"}
          hint={t("dashboard.stats.rolesHint", { count: stats.total_roles ?? 0 })}
        />
      </div>

      <div className={styles.panelGrid}>
        <EventList
          title={t("dashboard.events.recent")}
          items={recentEvents.map((event: any) => ({
            id: event.id,
            title: event.event_type,
            subtitle: event.message,
            badge: event.severity,
            timestamp: event.created_at
              ? new Date(event.created_at).toLocaleString()
              : undefined,
          }))}
          emptyText={t("dashboard.events.none")}
        />
        <EventList
          title={t("dashboard.events.users")}
          items={latestUsers.map((user: any) => ({
            id: user.id,
            title: user.username,
            subtitle: user.email,
            timestamp: user.date_joined
              ? new Date(user.date_joined).toLocaleString()
              : undefined,
          }))}
          emptyText={t("dashboard.events.noUsers")}
        />
        <EventList
          title={t("dashboard.events.roles")}
          items={topRoles.map((role: any) => ({
            id: role.id,
            title: role.name,
            badge: t("dashboard.events.rolesBadge", { count: role.user_count }),
          }))}
          emptyText={t("dashboard.events.noRoles")}
        />
      </div>
    </div>
  );
}
