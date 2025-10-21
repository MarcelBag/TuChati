import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import styles from "./Page.module.css";

export default function AuditLogPage() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "audit", token],
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
      <div className={styles.headerRow}>
        <h2>{t("audit.heading")}</h2>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => refetch()}>
            {t("audit.reload")}
          </button>
        </div>
      </div>
      {isError && (
        <p className={styles.note}>
          {(error as Error)?.message || t("audit.error")}
        </p>
      )}
      {isLoading && <p>{t("users.loading")}</p>}
      {!isLoading && (
        <div className={styles.timeline}>
          {events.map((event: any) => (
            <article key={event.id} className={styles.event}>
              <header>
                <strong>{event.event_type}</strong>
                <span>{new Date(event.created_at).toLocaleString()}</span>
              </header>
              {event.actor && (
                <p className={styles.actor}>
                  {t("audit.actor")}: {event.actor.name || event.actor.username}
                </p>
              )}
              {event.message && <p>{event.message}</p>}
              {event.target && (
                <p className={styles.target}>
                  {t("audit.target")}: {event.target}
                </p>
              )}
            </article>
          ))}
          {events.length === 0 && <p>{t("dashboard.events.none")}</p>}
        </div>
      )}
    </div>
  );
}
