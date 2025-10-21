import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AdminPermission } from "../utils/permissions";
import styles from "./Page.module.css";

export default function RolesPage() {
  const { token, permissions, refreshProfile } = useAuth();
  const canManage = permissions.includes(AdminPermission.MANAGE_ROLES);
  const { t } = useTranslation();

  const { data, error, isError, refetch } = useQuery({
    queryKey: ["admin", "roles", token],
    enabled: !!token,
    queryFn: async () => {
      const res = await apiClient("/api/admin/roles/", { token });
      if (!res.ok) {
        return { results: [] };
      }
      return res.json();
    },
  });

  const roles = useMemo(() => data?.results ?? data ?? [], [data]);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2>{t("roles.heading")}</h2>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => { void refetch(); }}>
            {t("roles.reload")}
          </button>
          <button type="button" onClick={() => refreshProfile()}>
            {t("topbar.refresh")}
          </button>
        </div>
      </div>
      {isError && (
        <p className={styles.note}>
          {(error as Error)?.message || t("audit.error")}
        </p>
      )}
      <p className={styles.note}>
        {canManage
          ? t("roles.subtitle")
          : t("roles.subtitleReadOnly")}
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("roles.columns.name")}</th>
            <th>{t("roles.columns.description")}</th>
            <th>{t("roles.columns.permissions")}</th>
            <th>{t("roles.columns.members")}</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role: any) => (
            <tr key={role.id}>
              <td>{role.name}</td>
              <td>{role.description || t("roles.noDescription")}</td>
              <td>
                <ul className={styles.tagList}>
                  {role.permissions.map((perm: string) => (
                    <li key={perm} className={styles.tag}>
                      {perm}
                    </li>
                  ))}
                </ul>
              </td>
              <td>{role.user_ids.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
