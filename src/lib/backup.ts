import Database from '@tauri-apps/plugin-sql'
import { invoke } from '@tauri-apps/api/core'
import { closeDb, getDb } from './db'

/** Latest migration applied to a database (see migrations() in src-tauri/src/db.rs). */
async function schemaVersion(db: Database): Promise<number | null> {
  const rows = await db.select<{ version: number | null }[]>(
    'SELECT MAX(version) AS version FROM _sqlx_migrations',
  )
  return rows[0]?.version ?? null
}

/**
 * Saves a copy of the database to a file the user picks.
 * Returns the path, or null if the user cancelled.
 */
export async function exportDatabase(): Promise<string | null> {
  const path = await invoke<string | null>('pick_export_path')
  if (!path) return null
  // VACUUM INTO writes a clean, self-contained copy, even while the app is using the database.
  await (await getDb()).execute('VACUUM INTO $1', [path])
  return path
}

/**
 * Checks that a file is a Taskhop backup with the same schema as this version.
 * Migrations only run once per app session, so an older or newer file can't be
 * upgraded on the fly and is rejected instead.
 */
async function checkBackup(path: string) {
  const expected = await schemaVersion(await getDb())
  const backup = await Database.load(`sqlite:${path}`)
  try {
    let version: number | null
    try {
      version = await schemaVersion(backup)
      await backup.select('SELECT id FROM tasks LIMIT 1')
    } catch {
      throw new Error('That file is not a Taskhop backup.')
    }
    if (version !== expected) {
      throw new Error(`That backup is from a different Taskhop version (schema ${version}, this app uses ${expected}).`)
    }
  } finally {
    await backup.close()
  }
}

/**
 * Replaces all tasks and settings with a backup the user picks, then reloads.
 * Returns false if the user cancelled.
 */
export async function importDatabase(): Promise<boolean> {
  const path = await invoke<string | null>('pick_import_file')
  if (!path) return false
  await checkBackup(path)
  await closeDb()
  // On failure the current database is untouched and getDb() simply reopens it.
  await invoke('replace_database', { source: path })
  window.location.reload()
  return true
}
