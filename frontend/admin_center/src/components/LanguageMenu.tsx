import { useTranslation } from "react-i18next";
import styles from "./LanguageMenu.module.css";

const LANG_KEY = "tuchati_admin_lang";

export default function LanguageMenu() {
  const { i18n, t } = useTranslation();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = event.target.value;
    i18n.changeLanguage(lang).catch(() => undefined);
    localStorage.setItem(LANG_KEY, lang);
  };

  const currentLang = i18n.language.split("-")[0];

  return (
    <label className={styles.wrapper}>
      <span>{t("topbar.language")}</span>
      <select value={currentLang} onChange={handleChange}>
        <option value="en">English</option>
        <option value="fr">Français</option>
      </select>
    </label>
  );
}
