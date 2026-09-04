import { useMemo, useState } from 'react'
import type { RecipeDto } from '@shared/types'
import { useRecipes } from '../api/hooks'
import { Card, EmptyNote, TextInput } from '../components/ui'

/** Split free-form instructions into numbered steps for cook mode. */
function toSteps(instructions: string | null): string[] {
  return (instructions ?? '')
    .split(/\n+/)
    .map((s) => s.replace(/^\s*(?:step\s*)?\d+[.)]\s*/i, '').trim())
    .filter(Boolean)
}

function minutesLabel(min: number | null): string | null {
  if (min == null) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`
  return `${m}m`
}

function RecipeDetail({ recipe, onClose }: { recipe: RecipeDto; onClose: () => void }) {
  const steps = toSteps(recipe.instructions)
  const [phase, setPhase] = useState<'ingredients' | 'cooking'>(recipe.ingredients.length > 0 ? 'ingredients' : 'cooking')
  const [step, setStep] = useState(0)

  const header = (
    <div className="mb-3 flex items-baseline gap-2">
      <button type="button" onClick={onClose} className="pressable shrink-0 text-base font-extrabold text-ember">
        ← Back
      </button>
      <h2 className="min-w-0 flex-1 truncate font-display text-xl font-semibold">{recipe.title}</h2>
    </div>
  )

  if (phase === 'ingredients') {
    return (
      <Card>
        {header}
        <ul className="space-y-2">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex items-center gap-2 text-base font-semibold">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-ember" />
              <span className="min-w-0 flex-1">{ing}</span>
            </li>
          ))}
        </ul>
        {steps.length > 0 && (
          <button type="button" onClick={() => setPhase('cooking')} className="pressable mt-4 min-h-11 w-full rounded-xl bg-ember px-4 text-base font-extrabold text-white">
            Start cooking →
          </button>
        )}
      </Card>
    )
  }

  const done = step >= steps.length - 1
  return (
    <Card>
      {header}
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-paper-deep">
        <div
          className="h-full bg-ember transition-all"
          style={{ width: `${((step + 1) / Math.max(steps.length, 1)) * 100}%` }}
        />
      </div>
      <p className="min-h-20 text-lg font-semibold leading-relaxed">{steps[step] ?? 'Nice work — that’s the last step!'}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="pressable min-h-11 rounded-xl bg-paper-deep px-4 text-base font-extrabold text-ink-soft disabled:opacity-40"
        >
          Back
        </button>
        {done ? (
          <button type="button" onClick={onClose} className="pressable min-h-11 rounded-xl bg-ember px-4 text-base font-extrabold text-white">
            Done
          </button>
        ) : (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="pressable min-h-11 flex-1 rounded-xl bg-ember px-4 text-base font-extrabold text-white">
            Next step
          </button>
        )}
      </div>
    </Card>
  )
}

export function RecipesPage() {
  const { data: recipes = [], isPending } = useRecipes()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<RecipeDto | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return recipes
    return recipes.filter((r) => r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)))
  }, [recipes, query])

  if (open) return <RecipeDetail recipe={open} onClose={() => setOpen(null)} />

  return (
    <div className="flex flex-col gap-4">
      {isPending && <EmptyNote>Loading…</EmptyNote>}
      {!isPending && recipes.length === 0 && <EmptyNote>No recipes yet — add them on the kiosk. 🍳</EmptyNote>}

      {recipes.length > 0 && (
        <TextInput value={query} onChange={setQuery} placeholder="Search recipes…" autoFocus={false} />
      )}

      {filtered.map((recipe) => {
        const times = [
          minutesLabel(recipe.prepMinutes) && `Prep ${minutesLabel(recipe.prepMinutes)}`,
          minutesLabel(recipe.cookMinutes) && `Cook ${minutesLabel(recipe.cookMinutes)}`,
          recipe.servings && `${recipe.servings} servings`,
          recipe.ingredients.length > 0 && `${recipe.ingredients.length} ingredients`
        ].filter(Boolean) as string[]

        return (
          <Card key={recipe.id} className="pressable">
            <button type="button" onClick={() => setOpen(recipe)} className="w-full text-left">
              <h2 className="font-display text-xl font-semibold">{recipe.title}</h2>
              {recipe.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {recipe.tags.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-paper-deep px-2 py-0.5 text-xs font-bold text-ink-faint">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {times.length > 0 && <p className="mt-1.5 text-sm font-semibold text-ink-faint">{times.join(' · ')}</p>}
            </button>
          </Card>
        )
      })}

      {recipes.length > 0 && filtered.length === 0 && <EmptyNote>No recipes match “{query}”.</EmptyNote>}
    </div>
  )
}