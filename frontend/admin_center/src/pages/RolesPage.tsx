import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AdminPermission } from "../utils/permissions";
import styles from "./Page.module.css";

export default function RolesPage() {
  const { token, permissions, refreshProfile } = useAuth();
  const canManage = permissions.includes(AdminPermission.MANAGE_ROLES);

  const { data } = useQuery({
    queryKey: ["admin", "roles"],
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
        <h2>Roles</h2>
        <button type="button" onClick={() => refreshProfile()}>
          Refresh
        </button>
      </div>
      <p className={styles.note}>
        {canManage
          ? "Manage role descriptions and ensure each has the correct permissions."
          : "You have read-only access. Request the 'manage roles' permission for edits."}
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Permissions</th>
            <th>Members</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role: any) => (
            <tr key={role.id}>
              <td>{role.name}</td>
              <td>{role.description || "—"}</td>
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
