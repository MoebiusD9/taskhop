import { getDb } from './db'
import { addDays, localDate } from './dates'

/** What Rust's HistoryItem expects. Titles only: notes and ids are never sent. */
export interface HistoryItem {
  title: string
  weekday: string
  status: 'pending' | 'done' | 'dropped'
}

interface Row {
  title: string
  scheduled_date: string
  status: HistoryItem['status']
}

const MAX_ITEMS = 20
const MAX_MATCHES = 12
const RECENT_DAYS = 60

/** "fix login bug" -> ["fix", "login", "bug"] (words of 3+ letters, at most 5). */
function words(text: string): string[] {
  const unique = new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
  return [...unique].slice(0, 5)
}

/** Escapes % and _ so typed text is matched literally by LIKE. */
const likePattern = (word: string) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}

/**
 * Picks up to 20 past tasks to give the AI as context, all chosen locally:
 * titles sharing words with `text` first, then the most frequent titles of
 * the last 60 days. Duplicate titles are sent once.
 */
export async function loadHistory(text: string): Promise<HistoryItem[]> {
  try {
    const db = await getDb()

    const terms = words(text)
    const matches = terms.length
      ? await db.select<Row[]>(
          `SELECT title, scheduled_date, status FROM tasks
           WHERE ${terms.map((_, i) => `title LIKE $${i + 1} ESCAPE '\\'`).join(' OR ')}
           ORDER BY created_at DESC LIMIT ${MAX_MATCHES}`,
          terms.map(likePattern),
        )
      : []

    const since = `${addDays(localDate(), -RECENT_DAYS)}T00:00:00`
    const recent = await db.select<Row[]>(
      `SELECT title, scheduled_date, status FROM tasks
       WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 300`,
      [since],
    )

    // Rank recent titles by how often they were added; ties keep recency order.
    const counts = new Map<string, number>()
    for (const row of recent) {
      const key = row.title.toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const frequent = [...recent].sort(
      (a, b) => (counts.get(b.title.toLowerCase()) ?? 0) - (counts.get(a.title.toLowerCase()) ?? 0),
    )

    const seen = new Set<string>()
    const items: HistoryItem[] = []
    for (const row of [...matches, ...frequent]) {
      const key = row.title.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      items.push({ title: row.title, weekday: weekday(row.scheduled_date), status: row.status })
      if (items.length === MAX_ITEMS) break
    }
    return items
  } catch (err) {
    console.warn('Could not load task history', err)
    return []
  }
}
