import styles from "./EventList.module.css";

export type EventItem = {
  id: string;
  title: string;
  subtitle?: string;
  timestamp?: string;
  badge?: string;
};

export type EventListProps = {
  title: string;
  items: EventItem[];
  emptyText?: string;
};

export default function EventList({ title, items, emptyText }: EventListProps) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h3>{title}</h3>
      </header>
      <div className={styles.list}>
        {items.length === 0 && <p className={styles.empty}>{emptyText || "Nothing yet."}</p>}
        {items.map((item) => (
          <article key={item.id} className={styles.item}>
            <div className={styles.meta}>
              <span className={styles.title}>{item.title}</span>
              {item.subtitle && <span className={styles.subtitle}>{item.subtitle}</span>}
            </div>
            <div className={styles.badgeGroup}>
              {item.badge && <span className={styles.badge}>{item.badge}</span>}
              {item.timestamp && <time>{item.timestamp}</time>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
