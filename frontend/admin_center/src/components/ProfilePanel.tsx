import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import LanguageMenu from "./LanguageMenu";
import styles from "./ProfilePanel.module.css";

export type ProfilePanelProps = {
  open: boolean;
  onClose: () => void;
};

export default function ProfilePanel({ open, onClose }: ProfilePanelProps) {
  const { user, permissions, isStaff, isSuperuser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const status = useMemo(() => {
    if (isSuperuser) return t("users.status.superuser");
    if (isStaff) return t("users.status.staff");
    return t("users.status.user");
  }, [isStaff, isSuperuser, t]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.identity}>
            <h3>{user?.name || user?.username || "—"}</h3>
            <p>{user?.email}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            ×
          </button>
        </header>

        <div className={styles.scrollArea}>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>{t("topbar.profile")}</span>
            <div className={styles.badges}>
              <span className={styles.badge}>{status}</span>
              <span className={styles.badge}>
                {t("profile.permissions", { count: permissions.length })}
              </span>
            </div>
            {permissions.length > 0 && (
              <ul className={styles.permissionList}>
                {permissions.slice(0, 6).map((perm) => (
                  <li key={perm}>{perm}</li>
                ))}
                {permissions.length > 6 && (
                  <li>+{permissions.length - 6} more…</li>
                )}
              </ul>
            )}
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>{t("topbar.theme")}</span>
            <button
              type="button"
              className={styles.toggle}
              onClick={toggleTheme}
            >
              {theme === "dark" ? t("topbar.light") : t("topbar.dark")}
            </button>
          </div>

          <div className={styles.section}>
            <LanguageMenu />
          </div>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.logout} onClick={logout}>
            {t("topbar.logout")}
          </button>
        </footer>
      </div>
    </div>
  );
}
