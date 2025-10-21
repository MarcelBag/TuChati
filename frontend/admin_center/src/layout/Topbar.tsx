import { useAuth } from "../context/AuthContext";
import styles from "./Topbar.module.css";

export default function Topbar() {
  const { permissions, refreshProfile } = useAuth();

  return (
    <header className={styles.topbar}>
      <div>
        <h1 className={styles.title}>Control Center</h1>
        <p className={styles.subtitle}>
          Monitor chat health, manage roles, and audit key events.
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => refreshProfile()}>
          Refresh Access
        </button>
        <span className={styles.perms}>Permissions: {permissions.length}</span>
      </div>
    </header>
  );
}
