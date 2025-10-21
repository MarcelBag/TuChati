import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useAuth, useHasPermission } from "../context/AuthContext";
import { AdminPermission } from "../utils/permissions";
import styles from "./UsersPage.module.css";

type AdminUser = {
  id: string;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  last_login: string | null;
  roles: string[];
};

export default function UsersPage() {
  const { token } = useAuth();
  const canView = useHasPermission(AdminPermission.VIEW_USERS);
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "users", search, token],
    enabled: !!token && canView,
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiClient(`/api/admin/users/${params}`, { token });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail || "Unable to load users");
      }
      return res.json();
    },
  });

  const users: AdminUser[] = useMemo(() => data ?? [], [data]);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2>Users</h2>
          <p>Review staff access and admin center permissions.</p>
        </div>
        <button type="button" onClick={() => refetch()}>
          Reload
        </button>
      </div>

      {!canView && (
        <p className={styles.error}>
          You need the "view users" permission to see this section.
        </p>
      )}

      <div className={styles.filters}>
        <input
          type="search"
          placeholder="Search username or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoading && canView && <p className={styles.note}>Loading users…</p>}
      {error instanceof Error && canView && (
        <p className={styles.error}>{error.message}</p>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Roles</th>
            <th>Last login</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className={styles.userCell}>
                  <span className={styles.username}>{user.username}</span>
                  <span className={styles.email}>{user.email}</span>
                </div>
              </td>
              <td>
                <span className={styles.tag}>{user.is_superuser ? "Superuser" : user.is_staff ? "Staff" : "User"}</span>
              </td>
              <td>
                <div className={styles.roleTags}>
                  {user.roles.length === 0 && <span className={styles.muted}>None</span>}
                  {user.roles.map((role) => (
                    <span key={role} className={styles.tag}>
                      {role}
                    </span>
                  ))}
                </div>
              </td>
              <td>{user.last_login ? new Date(user.last_login).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && !isLoading && canView && (
        <p className={styles.note}>No users found.</p>
      )}
    </div>
  );
}
