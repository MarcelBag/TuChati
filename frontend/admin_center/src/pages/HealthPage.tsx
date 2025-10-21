import styles from "./Page.module.css";
import { useHasPermission } from "../context/AuthContext";
import { AdminPermission } from "../utils/permissions";

export default function HealthPage() {
  const canView = useHasPermission(AdminPermission.VIEW_HEALTH);

  return (
    <div className={styles.page}>
      <h2>System Health</h2>
      {canView ? (
        <p>Health dashboards and live metrics will be displayed here.</p>
      ) : (
        <p>You need the "view health" permission to access this page.</p>
      )}
    </div>
  );
}
