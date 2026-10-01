import { AsyncLocalStorage } from 'node:async_hooks'
import { getDb } from './index.js'

type Db = ReturnType<typeof getDb>

const txStore = new AsyncLocalStorage<Db>()

/**
 * Runs `fn` inside one database transaction: if anything throws, every write in
 * it is rolled back. Nested calls (e.g. upsert → create) join the outer one.
 * Repositories read the active handle through `currentDb()`.
 */
export async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn()
  return getDb().transaction((tx) => txStore.run(tx as unknown as Db, fn))
}

/** The transaction in progress, or the shared pool outside one. */
export function currentDb(): Db {
  return txStore.getStore() ?? getDb()
}

/** A write referenced rows that don't exist or the caller can't use (→ 400). */
export class InvalidReferenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidReferenceError'
  }
}
