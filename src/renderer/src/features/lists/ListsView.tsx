import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { ListDto, ListKind } from '@shared/types'
import { PERSON_COLORS } from '@shared/types'
import { useListMutations, useLists } from '../../api/hooks'
import { BigButton, Dialog, FieldLabel, SegmentedControl } from '../../components/ui'
import { OskInput } from '../../components/Osk'
import { CheckIcon, PencilIcon, PlusIcon, XIcon } from '../../components/icons'
import { textOn } from '../../lib/format'

const DRAG_SLOP_PX = 8
/** Card width (w-80 = 320px) + container gap (gap-4 = 16px) — the horizontal slot pitch. */
const CARD_STRIDE_PX = 336

interface DragState {
  id: string
  pointerId: number
  startX: number
  startY: number
  dx: number
  dy: number
  started: boolean
}

function AddItemRow({ listId }: { listId: string }) {
  const [text, setText] = useState('')
  const mutations = useListMutations()
  const add = (): void => {
    if (!text.trim()) return
    mutations.addItem.mutate({ listId, text: text.trim() }, { onSuccess: () => setText('') })
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <OskInput value={text} onChange={setText} placeholder="Add item…" className="min-h-12 text-base" />
      <button
        type="button"
        onClick={add}
        disabled={!text.trim()}
        className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ember text-white disabled:opacity-30"
        aria-label="Add item"
      >
        <PlusIcon size={22} />
      </button>
    </div>
  )
}

function ListCard({
  list,
  onEdit,
  dragHandlers,
  dragStyle
}: {
  list: ListDto
  onEdit: () => void
  dragHandlers: { onPointerDown: (e: PointerEvent) => void; onPointerMove: (e: PointerEvent) => void; onPointerUp: (e: PointerEvent) => void; onPointerCancel: (e: PointerEvent) => void }
  dragStyle: CSSProperties
}) {
  const mutations = useListMutations()
  const checkedCount = list.items.filter((i) => i.checked).length
  return (
    <div className="flex max-h-full w-80 shrink-0 flex-col rounded-card bg-card p-4 shadow-card" style={dragStyle}>
      {/* the whole header is the drag handle — grab anywhere on it to reorder */}
      <div
        {...dragHandlers}
        style={{ touchAction: 'none' }}
        className="mb-2 flex cursor-grab items-center gap-2.5 select-none"
      >
        <span className="h-5 w-5 shrink-0 rounded-full" style={{ backgroundColor: list.color }} />
        <span className="min-w-0 flex-1 truncate font-display text-2xl font-semibold">{list.name}</span>
        <span className="text-sm font-extrabold text-ink-faint">
          {list.items.length - checkedCount}
        </span>
        <button
          type="button"
          aria-label={`Edit ${list.name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onEdit}
          className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-ink-faint hover:bg-paper-deep"
        >
          <PencilIcon size={18} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {list.items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-paper-deep/40">
            <button
              type="button"
              onClick={() => mutations.toggleItem.mutate({ id: item.id })}
              className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[2.5px]"
              style={{
                borderColor: list.color,
                backgroundColor: item.checked ? list.color : 'transparent'
              }}
              aria-label={item.checked ? 'Uncheck' : 'Check'}
            >
              {item.checked && <CheckIcon size={18} style={{ color: textOn(list.color) }} />}
            </button>
            <span className={`min-w-0 flex-1 text-lg font-semibold ${item.checked ? 'text-ink-faint line-through' : ''}`}>
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => mutations.removeItem.mutate({ id: item.id })}
              className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-paper-deep"
              aria-label="Delete item"
            >
              <XIcon size={16} />
            </button>
          </div>
        ))}
        {list.items.length === 0 && <p className="px-1 py-2 text-base font-semibold text-ink-faint">Nothing here yet</p>}
      </div>
      {checkedCount > 0 && (
        <button
          type="button"
          onClick={() => mutations.clearChecked.mutate({ listId: list.id })}
          className="pressable mt-2 self-start rounded-full border-2 border-line px-3.5 py-1.5 text-sm font-bold text-ink-soft"
        >
          Clear {checkedCount} done
        </button>
      )}
      <AddItemRow listId={list.id} />
    </div>
  )
}

export function ListsView() {
  const { data: lists = [] } = useLists()
  const mutations = useListMutations()
  const [editing, setEditing] = useState<ListDto | 'new' | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PERSON_COLORS[4])
  const [kind, setKind] = useState<ListKind>('grocery')
  const [drag, setDrag] = useState<DragState | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  // The gesture is tracked in a ref so move/end handlers always read the
  // latest state — a trailing pointermove after pointerup must not resurrect
  // a finished drag (which previously blocked every subsequent drag).
  const dragRef = useRef<DragState | null>(null)

  const openEditor = (l: ListDto | 'new'): void => {
    setEditing(l)
    setName(l === 'new' ? '' : l.name)
    setColor(l === 'new' ? PERSON_COLORS[(lists.length + 4) % PERSON_COLORS.length] : l.color)
    setKind(l === 'new' ? 'grocery' : l.kind)
  }

  const save = (): void => {
    if (!name.trim()) return
    if (editing === 'new') mutations.create.mutate({ name: name.trim(), color, kind })
    else if (editing) mutations.update.mutate({ id: editing.id, name: name.trim(), color })
    setEditing(null)
  }

  // Drag-and-drop reorder. The dragged card is lifted with a transient
  // transform; the others slide to make room via a reordered render order.
  const beginDrag = (id: string, e: PointerEvent): void => {
    if (editing || dragRef.current || !e.isPrimary) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const g: DragState = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      started: false
    }
    dragRef.current = g
    setDrag(g)
  }

  const moveDrag = (e: PointerEvent): void => {
    const g = dragRef.current
    if (!g || e.pointerId !== g.pointerId) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    const started = g.started || Math.hypot(dx, dy) > DRAG_SLOP_PX
    if (!started) return
    const from = lists.findIndex((l) => l.id === g.id)
    const to = Math.min(Math.max(from + Math.round(dx / CARD_STRIDE_PX), 0), lists.length - 1)
    const next = { ...g, dx, dy, started }
    dragRef.current = next
    setDrag(next)
    setOverIndex(to)
  }

  const endDrag = (e: PointerEvent, commit: boolean): void => {
    const g = dragRef.current
    if (!g || e.pointerId !== g.pointerId) return
    // clear the ref FIRST so a trailing pointermove can't resurrect the drag
    dragRef.current = null
    if (commit && g.started && overIndex !== null) {
      const from = lists.findIndex((l) => l.id === g.id)
      if (from !== -1 && from !== overIndex) {
        const next = [...lists]
        const [moved] = next.splice(from, 1)
        next.splice(overIndex, 0, moved)
        mutations.reorder.mutate({ ids: next.map((l) => l.id) })
      }
    }
    setDrag(null)
    setOverIndex(null)
  }

  const dragHandlers = (id: string) => ({
    onPointerDown: (e: PointerEvent) => beginDrag(id, e),
    onPointerMove: moveDrag,
    onPointerUp: (e: PointerEvent) => endDrag(e, true),
    onPointerCancel: (e: PointerEvent) => endDrag(e, false)
  })

  // The dragged card snaps to its slot: the `ordered` render order already
  // places it where it's being dropped, so we only lift it (scale + shadow +
  // slight rise) instead of free-following the pointer.
  const dragStyle = (id: string): CSSProperties => {
    if (!drag?.started || drag.id !== id) return {}
    return {
      transform: 'translateY(-6px) scale(1.03)',
      zIndex: 20,
      boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
      transition: 'transform 120ms ease'
    }
  }

  // Render order: the dragged card is pulled out and re-inserted at the hover
  // slot so the others visibly slide out of the way while dragging.
  const ordered = useMemo(() => {
    if (!drag?.started || overIndex === null) return lists
    const from = lists.findIndex((l) => l.id === drag.id)
    if (from === -1) return lists
    const next = [...lists]
    const [moved] = next.splice(from, 1)
    next.splice(overIndex, 0, moved)
    return next
  }, [lists, drag?.started, overIndex])

  return (
    <div className="flex h-full items-start gap-4 overflow-x-auto px-6 pb-6">
      {ordered.map((list, i) => (
        <div key={list.id} data-list-id={list.id} className="animate-rise flex max-h-full" style={{ animationDelay: `${i * 60}ms` }}>
          <ListCard
            list={list}
            onEdit={() => openEditor(list)}
            dragHandlers={dragHandlers(list.id)}
            dragStyle={dragStyle(list.id)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => openEditor('new')}
        className="animate-rise pressable flex h-44 w-64 shrink-0 flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line text-ink-faint hover:bg-paper-deep/40"
        style={{ animationDelay: `${lists.length * 60}ms` }}
      >
        <PlusIcon size={28} />
        <span className="text-lg font-bold">New list</span>
      </button>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New list' : 'Edit list'}>
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <OskInput value={name} onChange={setName} placeholder="e.g. Groceries" autoFocus={editing === 'new'} />
          </div>
          {editing === 'new' && (
            <div>
              <FieldLabel>Type</FieldLabel>
              <SegmentedControl
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'grocery', label: 'Groceries' },
                  { value: 'todo', label: 'To-do' },
                  { value: 'custom', label: 'Other' }
                ]}
              />
            </div>
          )}
          <div>
            <FieldLabel>Color</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {PERSON_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`pressable h-12 w-12 rounded-full ${color === c ? 'ring-4 ring-ink ring-offset-2 ring-offset-card' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="mt-1 flex gap-3">
            {editing !== 'new' && editing && (
              <BigButton
                variant="danger"
                onClick={() => {
                  mutations.remove.mutate({ id: editing.id })
                  setEditing(null)
                }}
              >
                Delete
              </BigButton>
            )}
            <div className="flex-1" />
            <BigButton variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </BigButton>
            <BigButton onClick={save} disabled={!name.trim()}>
              Save
            </BigButton>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
