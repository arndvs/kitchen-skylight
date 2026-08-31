import { useState } from 'react'
import type { RecipeDto } from '@shared/types'
import { useRecipes, useRecipeMutations, useAuthStatus } from '../../api/hooks'
import { BigButton, Dialog, FieldLabel } from '../../components/ui'
import { OskInput } from '../../components/Osk'
import { PlusIcon, TrashIcon } from '../../components/icons'

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

function RecipeCard({
  recipe,
  onCook,
  onEdit,
  onDelete
}: {
  recipe: RecipeDto
  onCook: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const times = [
    minutesLabel(recipe.prepMinutes) && `Prep ${minutesLabel(recipe.prepMinutes)}`,
    minutesLabel(recipe.cookMinutes) && `Cook ${minutesLabel(recipe.cookMinutes)}`,
    recipe.servings && `${recipe.servings} servings`,
    recipe.ingredients.length > 0 && `${recipe.ingredients.length} ingredients`
  ].filter(Boolean) as string[]

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <button type="button" onClick={onEdit} className="pressable text-left">
        <span className="font-display text-2xl font-semibold">{recipe.title}</span>
      </button>
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recipe.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded-full bg-paper-deep px-2 py-0.5 text-xs font-bold text-ink-faint">
              {t}
            </span>
          ))}
        </div>
      )}
      {times.length > 0 && <p className="text-sm font-semibold text-ink-faint">{times.join(' · ')}</p>}
      <div className="mt-auto flex gap-2">
        <BigButton onClick={onCook} className="min-h-12 flex-1 px-4 text-base">
          Cook
        </BigButton>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete recipe"
          className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-line text-ink-soft hover:bg-paper-deep"
        >
          <TrashIcon size={20} />
        </button>
      </div>
    </div>
  )
}

function CookMode({ recipe, onClose }: { recipe: RecipeDto; onClose: () => void }) {
  const steps = toSteps(recipe.instructions)
  const [phase, setPhase] = useState<'ingredients' | 'cooking'>(
    recipe.ingredients.length > 0 ? 'ingredients' : 'cooking'
  )
  const [step, setStep] = useState(0)

  if (phase === 'ingredients') {
    return (
      <Dialog open onClose={onClose} title={recipe.title}>
        <FieldLabel>Ingredients</FieldLabel>
        <ul className="mb-5 space-y-2">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex items-center gap-2 text-lg font-semibold">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-ember" />
              {ing}
            </li>
          ))}
        </ul>
        <BigButton onClick={() => setPhase('cooking')}>Start cooking →</BigButton>
      </Dialog>
    )
  }

  const done = step >= steps.length - 1
  return (
    <Dialog open onClose={onClose} title={`${recipe.title} — Step ${step + 1}`}>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-paper-deep">
        <div
          className="h-full bg-ember transition-all"
          style={{ width: `${((step + 1) / Math.max(steps.length, 1)) * 100}%` }}
        />
      </div>
      <p className="min-h-24 text-xl font-semibold leading-relaxed">
        {steps[step] ?? 'Nice work — that’s the last step!'}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <BigButton variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </BigButton>
        {done ? (
          <BigButton onClick={onClose}>Done</BigButton>
        ) : (
          <BigButton onClick={() => setStep((s) => s + 1)}>Next step</BigButton>
        )}
      </div>
    </Dialog>
  )
}

function RecipeEditor({ initial, onClose }: { initial: RecipeDto | null; onClose: () => void }) {
  const mutations = useRecipeMutations()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [ingredientsText, setIngredientsText] = useState((initial?.ingredients ?? []).join('\n'))
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [servings, setServings] = useState(initial?.servings ? String(initial.servings) : '')
  const [prep, setPrep] = useState(initial?.prepMinutes ? String(initial.prepMinutes) : '')
  const [cook, setCook] = useState(initial?.cookMinutes ? String(initial.cookMinutes) : '')
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '))
  const [srcUrl, setSrcUrl] = useState(initial?.srcUrl ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = (): void => {
    if (!title.trim()) {
      setError('Give the recipe a title')
      return
    }
    const ingredients = ingredientsText.split('\n').map((s) => s.trim()).filter(Boolean)
    const tags = tagsText.split(',').map((s) => s.trim()).filter(Boolean)
    const num = (s: string): number | null => (s ? Number(s) : null)
    const payload = {
      title: title.trim(),
      ingredients,
      instructions: instructions.trim() || null,
      tags,
      servings: num(servings),
      prepMinutes: num(prep),
      cookMinutes: num(cook),
      srcUrl: srcUrl.trim() || null
    }
    if (initial) mutations.update.mutate({ id: initial.id, ...payload }, { onSuccess: onClose })
    else mutations.create.mutate(payload, { onSuccess: onClose })
  }

  return (
    <Dialog open onClose={onClose} title={initial ? 'Edit recipe' : 'New recipe'}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Title</FieldLabel>
          <OskInput value={title} onChange={setTitle} placeholder="Pancakes" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <FieldLabel>Servings</FieldLabel>
            <OskInput value={servings} onChange={(v) => setServings(v.replace(/\D/g, ''))} placeholder="4" />
          </div>
          <div>
            <FieldLabel>Prep min</FieldLabel>
            <OskInput value={prep} onChange={(v) => setPrep(v.replace(/\D/g, ''))} placeholder="10" />
          </div>
          <div>
            <FieldLabel>Cook min</FieldLabel>
            <OskInput value={cook} onChange={(v) => setCook(v.replace(/\D/g, ''))} placeholder="20" />
          </div>
        </div>
        <div>
          <FieldLabel>Ingredients (one per line)</FieldLabel>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            rows={4}
            className="min-h-24 w-full rounded-2xl bg-paper-deep px-4 py-2 text-base outline-none focus:ring-2 focus:ring-ember/40"
          />
        </div>
        <div>
          <FieldLabel>Steps (one per line)</FieldLabel>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            className="min-h-28 w-full rounded-2xl bg-paper-deep px-4 py-2 text-base outline-none focus:ring-2 focus:ring-ember/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Tags (comma-separated)</FieldLabel>
            <OskInput value={tagsText} onChange={setTagsText} placeholder="breakfast, easy" />
          </div>
          <div>
            <FieldLabel>Source URL</FieldLabel>
            <OskInput value={srcUrl} onChange={setSrcUrl} placeholder="https://…" />
          </div>
        </div>
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <BigButton variant="ghost" onClick={onClose}>
            Cancel
          </BigButton>
          <BigButton onClick={save}>{initial ? 'Save changes' : 'Add recipe'}</BigButton>
        </div>
      </div>
    </Dialog>
  )
}

export function RecipesView() {
  const { data: recipes } = useRecipes()
  const mutations = useRecipeMutations()
  const { data: auth } = useAuthStatus()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<RecipeDto | 'new' | null>(null)
  const [cooking, setCooking] = useState<RecipeDto | null>(null)

  const locked = (auth?.pinSet ?? false) && !(auth?.unlocked ?? false)
  // Without a parent PIN set, the app is fail-open (kids can edit everything).
  const canEdit = !locked

  const filtered = (recipes ?? []).filter((r) => {
    const q = query.toLowerCase().trim()
    if (!q) return true
    return r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q))
  })

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-ink-faint">
            🔍
          </span>
          <OskInput value={query} onChange={setQuery} placeholder="Search recipes…" className="pl-10" />
        </div>
        <BigButton onClick={() => canEdit && setEditing('new')} disabled={!canEdit}>
          <span className="flex items-center gap-1.5">
            <PlusIcon size={20} /> New recipe
          </span>
        </BigButton>
      </div>

      {(recipes?.length ?? 0) === 0 ? (
        <p className="my-auto text-center text-lg font-semibold text-ink-faint">
          No recipes yet — add your first one. 🍳
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onCook={() => setCooking(r)}
              onEdit={() => canEdit && setEditing(r)}
              onDelete={() => canEdit && mutations.remove.mutate({ id: r.id })}
            />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-lg font-semibold text-ink-faint">
              No recipes match “{query}”.
            </p>
          )}
        </div>
      )}

      {editing && <RecipeEditor initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {cooking && <CookMode recipe={cooking} onClose={() => setCooking(null)} />}
    </div>
  )
}