// frontend/web/src/shared/utils.ts
export function getInitials(
  first?: string | null,
  last?: string | null,
  fallback?: string
) {
  const a = (first || '').trim()
  const b = (last || '').trim()
  if (a || b) return `${a[0] ?? ''}${b[0] ?? ''}`.toUpperCase() || (fallback ?? 'TU')
  return (fallback ?? 'TU').slice(0, 2).toUpperCase()
}

