import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./Sidebar.module.css";

const links = [
  { to: "/dashboard", label: "nav.dashboard" },
  { to: "/users", label: "nav.users" },
  { to: "/roles", label: "nav.roles" },
  { to: "/audit", label: "nav.audit" },
  { to: "/health", label: "nav.health" },
];

export default function Sidebar() {
  const { t } = useTranslation();
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo}>TuChati</span>
        <span className={styles.subtitle}>Admin Center</span>
      </div>
      <nav className={styles.nav}>
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            {t(item.label)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
