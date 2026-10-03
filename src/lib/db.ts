import Database from '@tauri-apps/plugin-sql'
import { invoke } from '@tauri-apps/api/core'

let connection: Promise<Database> | null = null

/**
 * Opens the database once (running any pending migrations) and reuses it.
 * Rust decides where the file lives (src-tauri/src/db.rs) and returns the
 * exact URL its migrations are registered under.
 */
export function getDb(): Promise<Database> {
  connection ??= invoke<string>('db_url')
    .then((url) => Database.load(url))
    .catch((err) => {
      connection = null
      throw err
    })
  return connection
}

/** Closes the connection (before Import swaps the file). getDb() reopens it. */
export async function closeDb() {
  const open = connection
  connection = null
  if (open) await (await open).close()
}
