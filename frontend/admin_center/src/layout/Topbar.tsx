import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import styles from "./Topbar.module.css";
import ProfilePanel from "../components/ProfilePanel";

export default function Topbar() {
  const { permissions, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <header className={styles.topbar}>
        <div>
          <h1 className={styles.title}>{t("topbar.title")}</h1>
          <p className={styles.subtitle}>{t("topbar.subtitle")}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => refreshProfile()}>
            {t("topbar.refresh")}
          </button>
          <button
            type="button"
            className={styles.profileButton}
            onClick={() => setProfileOpen(true)}
          >
            {t("topbar.profile")} · {permissions.length}
          </button>
        </div>
      </header>
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
