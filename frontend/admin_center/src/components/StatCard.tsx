import styles from "./StatCard.module.css";

export type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  action?: React.ReactNode;
};

export default function StatCard({ label, value, hint, action }: StatCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.body}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </article>
  );
}
