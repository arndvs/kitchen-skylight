import { and, asc, eq, isNull } from 'drizzle-orm'
import { DateTime } from 'luxon'
import type { AppDb } from '../db/client'
import { recipes } from '../db/schema'
import { uuidv7 } from '@shared/uuid'
import { isoUtc } from '@shared/dates'
import type { RecipeCreateInput, RecipeDto, RecipeUpdateInput } from '@shared/types'
import { notFound } from './errors'

type RecipeRow = typeof recipes.$inferSelect

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function createRecipesService(db: AppDb) {
  function toDto(row: RecipeRow): RecipeDto {
    return {
      id: row.id,
      title: row.title,
      ingredients: parseJsonArray(row.ingredients),
      instructions: row.instructions,
      imagePath: row.imagePath,
      tags: parseJsonArray(row.tags),
      servings: row.servings,
      prepMinutes: row.prepMinutes,
      cookMinutes: row.cookMinutes,
      srcUrl: row.srcUrl,
      createdAt: row.createdAt
    }
  }

  function list(): RecipeDto[] {
    return db
      .select()
      .from(recipes)
      .where(isNull(recipes.deletedAt))
      .orderBy(asc(recipes.createdAt))
      .all()
      .map(toDto)
  }

  function get(id: string): RecipeDto {
    const [row] = db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, id), isNull(recipes.deletedAt)))
      .all()
    if (!row) throw notFound('Recipe')
    return toDto(row)
  }

  function create(input: RecipeCreateInput): RecipeDto {
    const id = uuidv7()
    db.insert(recipes)
      .values({
        id,
        title: input.title,
        ingredients: JSON.stringify(input.ingredients ?? []),
        instructions: input.instructions ?? null,
        imagePath: input.imagePath ?? null,
        tags: JSON.stringify(input.tags ?? []),
        servings: input.servings ?? null,
        prepMinutes: input.prepMinutes ?? null,
        cookMinutes: input.cookMinutes ?? null,
        srcUrl: input.srcUrl ?? null,
        createdAt: isoUtc(DateTime.utc())
      })
      .run()
    return get(id)
  }

  function update(input: RecipeUpdateInput): RecipeDto {
    const patch: Partial<typeof recipes.$inferInsert> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.ingredients !== undefined) patch.ingredients = JSON.stringify(input.ingredients)
    if (input.instructions !== undefined) patch.instructions = input.instructions
    if (input.imagePath !== undefined) patch.imagePath = input.imagePath
    if (input.tags !== undefined) patch.tags = JSON.stringify(input.tags)
    if (input.servings !== undefined) patch.servings = input.servings
    if (input.prepMinutes !== undefined) patch.prepMinutes = input.prepMinutes
    if (input.cookMinutes !== undefined) patch.cookMinutes = input.cookMinutes
    if (input.srcUrl !== undefined) patch.srcUrl = input.srcUrl
    const result = db
      .update(recipes)
      .set(patch)
      .where(and(eq(recipes.id, input.id), isNull(recipes.deletedAt)))
      .run()
    if (result.changes === 0) throw notFound('Recipe')
    return get(input.id)
  }

  function remove(id: string): void {
    const result = db
      .update(recipes)
      .set({ deletedAt: isoUtc(DateTime.utc()) })
      .where(and(eq(recipes.id, id), isNull(recipes.deletedAt)))
      .run()
    if (result.changes === 0) throw notFound('Recipe')
  }

  return { list, get, create, update, remove }
}

export type RecipesService = ReturnType<typeof createRecipesService>