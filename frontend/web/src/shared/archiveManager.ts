// src/shared/archiveManager.ts
// Centralized helpers for managing archived chat rooms on the client.
// For now we persist the archive list in localStorage so both dev/prod
// builds keep behavior consistent without needing immediate backend support.

const STORAGE_KEY = 'tuchati.archivedRooms'

function safeParse(value: string | null): Set<string> {
  if (!value) return new Set()
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item) => typeof item === 'string'))
    }
  } catch {
    // ignore parse errors and fallback to empty set
  }
  return new Set()
}

function loadSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  return safeParse(window.localStorage.getItem(STORAGE_KEY))
}

function persist(set: Set<string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)))
}

export function getArchivedRoomIds(): string[] {
  return Array.from(loadSet())
}

export function isRoomArchived(roomId: string | number): boolean {
  const id = String(roomId)
  return loadSet().has(id)
}

export function archiveRoom(roomId: string | number) {
  const id = String(roomId)
  const set = loadSet()
  if (!set.has(id)) {
    set.add(id)
    persist(set)
  }
}

export function unarchiveRoom(roomId: string | number) {
  const id = String(roomId)
  const set = loadSet()
  if (set.delete(id)) {
    persist(set)
  }
}

export function toggleArchive(roomId: string | number, archived: boolean) {
  if (archived) archiveRoom(roomId)
  else unarchiveRoom(roomId)
}

export function clearArchive() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
