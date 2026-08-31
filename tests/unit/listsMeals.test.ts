import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DbHandle } from '../../src/main/db/client'
import { createListsService, type ListsService } from '../../src/main/services/listsService'
import { createMealsService, type MealsService } from '../../src/main/services/mealsService'
import { createRecipesService } from '../../src/main/services/recipesService'

describe('lists', () => {
  let handle: DbHandle
  let lists: ListsService

  beforeEach(() => {
    handle = openDatabase(':memory:')
    lists = createListsService(handle.db)
  })

  it('creates lists and adds items in order', () => {
    const list = lists.create({ name: 'Groceries', color: '#46A758', kind: 'grocery' })
    lists.addItem(list.id, 'Milk')
    lists.addItem(list.id, 'Eggs')
    const [loaded] = lists.getAll()
    expect(loaded.items.map((i) => i.text)).toEqual(['Milk', 'Eggs'])
  })

  it('toggling sinks checked items to the bottom', () => {
    const list = lists.create({ name: 'Groceries', color: '#46A758', kind: 'grocery' })
    const milk = lists.addItem(list.id, 'Milk')
    lists.addItem(list.id, 'Eggs')
    lists.toggleItem(milk.id)
    const [loaded] = lists.getAll()
    expect(loaded.items.map((i) => i.text)).toEqual(['Eggs', 'Milk'])
    expect(loaded.items[1].checked).toBe(true)
    lists.toggleItem(milk.id)
    expect(lists.getAll()[0].items[0].checked).toBe(false)
  })

  it('clearChecked removes only checked items', () => {
    const list = lists.create({ name: 'Todo', color: '#0091FF', kind: 'todo' })
    const a = lists.addItem(list.id, 'A')
    lists.addItem(list.id, 'B')
    lists.toggleItem(a.id)
    lists.clearChecked(list.id)
    const [loaded] = lists.getAll()
    expect(loaded.items.map((i) => i.text)).toEqual(['B'])
  })

  it('soft-deletes lists', () => {
    const list = lists.create({ name: 'Temp', color: '#0091FF', kind: 'custom' })
    lists.remove(list.id)
    expect(lists.getAll()).toHaveLength(0)
  })
})

describe('meals', () => {
  let handle: DbHandle
  let meals: MealsService

  beforeEach(() => {
    handle = openDatabase(':memory:')
    meals = createMealsService(handle.db)
  })

  it('sets, overwrites, and clears slots with one row per (date, slot)', () => {
    meals.set('2026-06-10', 'dinner', 'Tacos')
    meals.set('2026-06-10', 'dinner', 'Pizza')
    meals.set('2026-06-10', 'lunch', 'Sandwiches')
    expect(meals.getRange('2026-06-10', '2026-06-10')).toHaveLength(2)
    expect(meals.getRange('2026-06-10', '2026-06-10').find((m) => m.slot === 'dinner')?.text).toBe('Pizza')
    meals.set('2026-06-10', 'dinner', null)
    expect(meals.getRange('2026-06-10', '2026-06-10')).toHaveLength(1)
  })

  it('range queries are inclusive and date-scoped', () => {
    meals.set('2026-06-08', 'dinner', 'Soup')
    meals.set('2026-06-14', 'dinner', 'Stew')
    meals.set('2026-06-15', 'dinner', 'Out of range')
    const week = meals.getRange('2026-06-08', '2026-06-14')
    expect(week.map((m) => m.text).sort()).toEqual(['Soup', 'Stew'])
  })

  it('links a meal to a library recipe and reports its title', () => {
    const recipes = createRecipesService(handle.db)
    const recipe = recipes.create({ title: 'Big Pot of Chili', ingredients: ['beans'] })
    // Free-text still wins when both a recipe and text are given.
    meals.set('2026-06-10', 'dinner', null, recipe.id)
    const linked = meals.getRange('2026-06-10', '2026-06-10')[0]
    expect(linked.text).toBe('')
    expect(linked.recipe).toEqual({ id: recipe.id, title: 'Big Pot of Chili' })
  })

  it('free-text overrides a recipe link', () => {
    const recipes = createRecipesService(handle.db)
    const recipe = recipes.create({ title: 'Pizza', ingredients: [] })
    meals.set('2026-06-10', 'dinner', 'Leftovers', recipe.id)
    const meal = meals.getRange('2026-06-10', '2026-06-10')[0]
    expect(meal.text).toBe('Leftovers')
    expect(meal.recipe).toBeNull()
  })
})
