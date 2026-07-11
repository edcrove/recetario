import { eq } from 'drizzle-orm'
import { normalizeIngredientKey, resolveCanonical } from '@recetario/shared'
import { getDb, schema } from './index.js'

export interface CanonicalMaps {
  /** normalized synonym → canonical normalized name */
  synonyms: Map<string, string>
  /** set of canonical normalized names */
  canonicals: Set<string>
  /** canonical normalized name → display name */
  displayByKey: Map<string, string>
  /** canonical normalized name → familyId (null if none) */
  familyByKey: Map<string, string | null>
}

export interface CanonicalListItem {
  id: string
  name: string
  normalizedName: string
  familyId: string | null
  familyName: string | null
  isSystem: boolean
  synonyms: { id: string; synonym: string; isSystem: boolean }[]
}

export class IngredientRepository {
  private get db() {
    return getDb()
  }

  /** Loads everything the canonical resolver needs in one pass (for consumers). */
  async loadCanonicalMaps(): Promise<CanonicalMaps> {
    const db = this.db
    const canon = await db
      .select({
        id: schema.canonicalIngredients.id,
        name: schema.canonicalIngredients.name,
        normalizedName: schema.canonicalIngredients.normalizedName,
        familyId: schema.canonicalIngredients.familyId,
      })
      .from(schema.canonicalIngredients)
    const syn = await db
      .select({
        synonym: schema.ingredientSynonyms.synonym,
        canonicalId: schema.ingredientSynonyms.canonicalId,
      })
      .from(schema.ingredientSynonyms)

    const canonicals = new Set<string>()
    const displayByKey = new Map<string, string>()
    const familyByKey = new Map<string, string | null>()
    const normByCanonicalId = new Map<string, string>()
    for (const c of canon) {
      canonicals.add(c.normalizedName)
      displayByKey.set(c.normalizedName, c.name)
      familyByKey.set(c.normalizedName, c.familyId)
      normByCanonicalId.set(c.id, c.normalizedName)
    }
    const synonyms = new Map<string, string>()
    for (const s of syn) {
      const canonicalNorm = normByCanonicalId.get(s.canonicalId)
      if (canonicalNorm) synonyms.set(s.synonym, canonicalNorm)
    }
    return { synonyms, canonicals, displayByKey, familyByKey }
  }

  /** Canonicals with their synonyms and family name, for the config UI/CRUD. */
  async listCanonicals(): Promise<CanonicalListItem[]> {
    const db = this.db
    const canon = await db
      .select({
        id: schema.canonicalIngredients.id,
        name: schema.canonicalIngredients.name,
        normalizedName: schema.canonicalIngredients.normalizedName,
        familyId: schema.canonicalIngredients.familyId,
        isSystem: schema.canonicalIngredients.isSystem,
      })
      .from(schema.canonicalIngredients)
    const families = await db
      .select({ id: schema.ingredientFamilies.id, name: schema.ingredientFamilies.name })
      .from(schema.ingredientFamilies)
    const familyName = new Map(families.map((f) => [f.id, f.name]))

    const syn = await db
      .select({
        id: schema.ingredientSynonyms.id,
        synonym: schema.ingredientSynonyms.synonym,
        canonicalId: schema.ingredientSynonyms.canonicalId,
        isSystem: schema.ingredientSynonyms.isSystem,
      })
      .from(schema.ingredientSynonyms)
    const synByCanonical = new Map<string, CanonicalListItem['synonyms']>()
    for (const s of syn) {
      const list = synByCanonical.get(s.canonicalId) ?? []
      list.push({ id: s.id, synonym: s.synonym, isSystem: s.isSystem })
      synByCanonical.set(s.canonicalId, list)
    }

    return canon
      .map((c) => ({
        id: c.id,
        name: c.name,
        normalizedName: c.normalizedName,
        familyId: c.familyId,
        // familyId is an FK (onDelete: set null), so a non-null id always resolves.
        familyName: c.familyId ? familyName.get(c.familyId)! : null,
        isSystem: c.isSystem,
        synonyms: (synByCanonical.get(c.id) ?? []).sort((a, b) =>
          a.synonym.localeCompare(b.synonym),
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Distinct ingredient names from the caller's recipes that do NOT resolve to a
   * canonical (nor a synonym), with how often each appears — the agent's
   * curation worklist. Grouped by normalized key; the first spelling is shown.
   */
  async listUnmatchedIngredients(
    ownerId: string,
  ): Promise<{ name: string; normalized: string; count: number }[]> {
    const rows = await this.db
      .select({ name: schema.ingredients.name })
      .from(schema.ingredients)
      .innerJoin(schema.recipes, eq(schema.ingredients.recipeId, schema.recipes.id))
      .where(eq(schema.recipes.ownerId, ownerId))

    const maps = await this.loadCanonicalMaps()
    const counts = new Map<string, { name: string; count: number }>()
    for (const r of rows) {
      const { matched, key } = resolveCanonical(r.name, maps.synonyms, maps.canonicals)
      if (matched || !key) continue
      const cur = counts.get(key)
      if (cur) cur.count += 1
      else counts.set(key, { name: r.name.trim(), count: 1 })
    }
    return [...counts.entries()]
      .map(([normalized, v]) => ({ normalized, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count || a.normalized.localeCompare(b.normalized))
  }

  /** Finds a family by name (case-insensitive) or creates it. */
  async findOrCreateFamily(name: string): Promise<string> {
    const trimmed = name.trim()
    const existing = await this.db
      .select({ id: schema.ingredientFamilies.id, name: schema.ingredientFamilies.name })
      .from(schema.ingredientFamilies)
    const hit = existing.find((f) => f.name.toLowerCase() === trimmed.toLowerCase())
    if (hit) return hit.id
    const [row] = await this.db
      .insert(schema.ingredientFamilies)
      .values({ name: trimmed, isSystem: false })
      .returning({ id: schema.ingredientFamilies.id })
    return row!.id
  }

  /** Resolves a canonical by its display name (case-insensitive). */
  async findCanonicalByName(name: string): Promise<{ id: string } | null> {
    const key = normalizeIngredientKey(name)
    const [row] = await this.db
      .select({ id: schema.canonicalIngredients.id })
      .from(schema.canonicalIngredients)
      .where(eq(schema.canonicalIngredients.normalizedName, key))
    return row ?? null
  }

  /** Creates a non-system canonical (idempotent on the normalized name). */
  async createCanonical(
    name: string,
    familyId: string | null,
  ): Promise<{ id: string; name: string; normalizedName: string }> {
    const normalizedName = normalizeIngredientKey(name)
    const [row] = await this.db
      .insert(schema.canonicalIngredients)
      .values({ name, normalizedName, familyId, isSystem: false })
      .onConflictDoNothing()
      .returning({ id: schema.canonicalIngredients.id })
    if (row) return { id: row.id, name, normalizedName }
    // Already existed — return the existing one.
    const [existing] = await this.db
      .select({ id: schema.canonicalIngredients.id, name: schema.canonicalIngredients.name })
      .from(schema.canonicalIngredients)
      .where(eq(schema.canonicalIngredients.normalizedName, normalizedName))
    return { id: existing!.id, name: existing!.name, normalizedName }
  }

  /** Points a surface string at a canonical (idempotent on the normalized synonym). */
  async setSynonym(
    surface: string,
    canonicalId: string,
  ): Promise<{ id: string; synonym: string } | null> {
    const synonym = normalizeIngredientKey(surface)
    if (!synonym) return null
    const [row] = await this.db
      .insert(schema.ingredientSynonyms)
      .values({ synonym, canonicalId, isSystem: false })
      .onConflictDoUpdate({
        target: schema.ingredientSynonyms.synonym,
        set: { canonicalId },
      })
      .returning({ id: schema.ingredientSynonyms.id })
    // An upsert always returns its row (inserted or updated).
    return { id: row!.id, synonym }
  }

  async getCanonicalById(id: string) {
    const [row] = await this.db
      .select()
      .from(schema.canonicalIngredients)
      .where(eq(schema.canonicalIngredients.id, id))
    return row ?? null
  }

  async getSynonymById(id: string) {
    const [row] = await this.db
      .select()
      .from(schema.ingredientSynonyms)
      .where(eq(schema.ingredientSynonyms.id, id))
    return row ?? null
  }

  /** Deletes a non-system canonical (and its synonyms, via cascade). Returns false if system/missing. */
  async deleteCanonical(id: string): Promise<boolean> {
    const row = await this.getCanonicalById(id)
    if (!row || row.isSystem) return false
    await this.db.delete(schema.canonicalIngredients).where(eq(schema.canonicalIngredients.id, id))
    return true
  }

  /** Deletes a non-system synonym. Returns false if system/missing. */
  async deleteSynonym(id: string): Promise<boolean> {
    const row = await this.getSynonymById(id)
    if (!row || row.isSystem) return false
    await this.db.delete(schema.ingredientSynonyms).where(eq(schema.ingredientSynonyms.id, id))
    return true
  }
}

export const ingredientRepository = new IngredientRepository()
