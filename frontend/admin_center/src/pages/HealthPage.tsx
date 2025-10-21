import styles from "./Page.module.css";
import { useHasPermission } from "../context/AuthContext";
import { AdminPermission } from "../utils/permissions";
import { useTranslation } from "react-i18next";

export default function HealthPage() {
  const canView = useHasPermission(AdminPermission.VIEW_HEALTH);
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <h2>{t("health.heading")}</h2>
      {canView ? (
        <p>{t("health.placeholder")}</p>
      ) : (
        <p>{t("health.requiresPermission")}</p>
      )}
    </div>
  );
}
