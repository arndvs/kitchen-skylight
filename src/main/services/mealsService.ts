import { and, eq, gte, lte } from 'drizzle-orm'
import type { AppDb } from '../db/client'
import { mealSlots, recipes } from '../db/schema'
import { uuidv7 } from '@shared/uuid'
import type { MealSlotDto, MealSlotKind } from '@shared/types'

export function createMealsService(db: AppDb) {
  /** Inclusive date range of meal entries. */
  function getRange(start: string, end: string): MealSlotDto[] {
    return db
      .select()
      .from(mealSlots)
      .where(and(gte(mealSlots.date, start), lte(mealSlots.date, end)))
      .all()
      .filter((r) => (r.freeText ?? '').length > 0 || r.recipeId !== null)
      .map((r) => {
        // Resolve the linked recipe title. One query per slot is fine here —
        // meal ranges are small (a couple of weeks) and the DB is local SQLite.
        let recipe: MealSlotDto['recipe'] = null
        if (r.recipeId) {
          const [row] = db.select().from(recipes).where(eq(recipes.id, r.recipeId)).all()
          // Skip a link whose recipe was soft-deleted rather than showing a dangle.
          if (row && !row.deletedAt) recipe = { id: row.id, title: row.title }
        }
        return { date: r.date, slot: r.slot, text: r.freeText ?? '', recipe }
      })
  }

  /**
   * Set a meal slot. `text` is the legacy free-text value; when non-empty it is
   * shown as-is. `recipeId` optionally links a library recipe (title appears in
   * the strip). Passing both uses free-text and clears the link.
   */
  function set(date: string, slot: MealSlotKind, text: string | null, recipeId?: string | null): void {
    const [existing] = db
      .select()
      .from(mealSlots)
      .where(and(eq(mealSlots.date, date), eq(mealSlots.slot, slot)))
      .all()
    const hasText = text !== null && text.trim() !== ''
    if (!hasText && recipeId === undefined) {
      if (existing) db.delete(mealSlots).where(eq(mealSlots.id, existing.id)).run()
      return
    }
    // Only keep the recipe link when there's no free-text (free-text wins the display).
    const recipeIdToStore = !hasText ? recipeId || null : null
    if (existing) {
      db.update(mealSlots)
        .set({ freeText: hasText ? text.trim() : null, recipeId: recipeIdToStore })
        .where(eq(mealSlots.id, existing.id))
        .run()
    } else {
      db.insert(mealSlots)
        .values({ id: uuidv7(), date, slot, freeText: hasText ? text.trim() : null, recipeId: recipeIdToStore })
        .run()
    }
  }

  return { getRange, set }
}

export type MealsService = ReturnType<typeof createMealsService>
