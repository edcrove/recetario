import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'

const skip = process.env['SKIP_INTEGRATION'] === 'true'

// The deploy runs release() (migrations + base seed) on every start, so running it
// again must never add rows: system taxonomy rows have owner_id NULL, and the unique
// constraint has to treat those NULLs as equal (migration 0014).
describe.skipIf(skip).sequential('release step', () => {
  it('is idempotent: a second and third run add no taxonomy rows', async () => {
    const { release } = await import('../../scripts/release.js')
    const { getDb } = await import('../../db/index.js')
    const db = getDb()
    const counts = async () => {
      const [row] = await db.execute<{ ft: number; mc: number; dup: number }>(sql`
        select
          (select count(*)::int from food_types where owner_id is null) as ft,
          (select count(*)::int from meal_categories where owner_id is null) as mc,
          (select count(*)::int from (
            select slug from food_types where owner_id is null group by slug having count(*) > 1
          ) d) as dup`)
      return row
    }

    await release(db)
    const first = await counts()
    await release(db)
    await release(db)

    expect(await counts()).toEqual(first)
    expect(first?.ft).toBeGreaterThan(0)
    expect(first?.mc).toBeGreaterThan(0)
    expect(first?.dup).toBe(0)
  })

  it('links the tags of recipes saved before tags were linked', async () => {
    const { release } = await import('../../scripts/release.js')
    const { getDb, schema } = await import('../../db/index.js')
    const db = getDb()
    const [legacy] = await db
      .insert(schema.recipes)
      .values({
        ownerId: 'release-owner',
        title: 'Vieja',
        servings: 1,
        category: 'Cena',
        tags: ['antigua'],
      })
      .returning()
    await release(db)
    const [row] = await db.execute<{ name: string }>(sql`
      select t.name from recipe_tags rt join tags t on t.id = rt.tag_id
      where rt.recipe_id = ${legacy!.id} and t.owner_id = 'release-owner'`)
    expect(row?.name).toBe('antigua')
  })

  it('rejects a duplicate system food type at the database level', async () => {
    const { getDb } = await import('../../db/index.js')
    const db = getDb()
    await expect(
      db.execute(sql`insert into food_types (name, slug, is_system) values ('Guiso', 'guiso', 1)`),
    ).rejects.toThrow()
  })
})
