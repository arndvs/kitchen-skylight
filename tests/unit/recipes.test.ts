import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DbHandle } from '../../src/main/db/client'
import { createRecipesService, type RecipesService } from '../../src/main/services/recipesService'

describe('recipes', () => {
  let handle: DbHandle
  let recipes: RecipesService

  beforeEach(() => {
    handle = openDatabase(':memory:')
    recipes = createRecipesService(handle.db)
  })

  it('creates and lists a recipe with parsed ingredients and tags', () => {
    const recipe = recipes.create({
      title: 'Pancakes',
      ingredients: ['1 cup flour', '2 eggs'],
      instructions: 'Mix and cook',
      tags: ['breakfast'],
      servings: 4,
      prepMinutes: 5,
      cookMinutes: 10
    })
    expect(recipe.title).toBe('Pancakes')
    expect(recipe.ingredients).toEqual(['1 cup flour', '2 eggs'])
    expect(recipe.tags).toEqual(['breakfast'])
    expect(recipe.servings).toBe(4)
    expect(recipes.list()).toHaveLength(1)
  })

  it('gets a single recipe by id', () => {
    const recipe = recipes.create({ title: 'Soup', ingredients: ['stock'] })
    expect(recipes.get(recipe.id).title).toBe('Soup')
  })

  it('updates a recipe', () => {
    const recipe = recipes.create({ title: 'Soup', ingredients: ['stock'] })
    const updated = recipes.update({ id: recipe.id, title: 'Hearty Soup', cookMinutes: 45 })
    expect(updated.title).toBe('Hearty Soup')
    expect(updated.cookMinutes).toBe(45)
    expect(updated.ingredients).toEqual(['stock']) // unchanged fields preserved
  })

  it('soft-deletes: recipe disappears from list but get throws', () => {
    const recipe = recipes.create({ title: 'Gone', ingredients: [] })
    recipes.remove(recipe.id)
    expect(recipes.list()).toHaveLength(0)
    expect(() => recipes.get(recipe.id)).toThrow()
  })

  it('update/remove on a missing recipe throws', () => {
    expect(() => recipes.update({ id: 'nope' })).toThrow()
    expect(() => recipes.remove('nope')).toThrow()
  })
})