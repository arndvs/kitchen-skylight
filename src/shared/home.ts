import type { HomeTile, HomeTileType } from './types'

/**
 * Pure grid math for the customizable home screen. Shared by the renderer
 * (drag/resize validation) and the tests; no DOM, no Electron.
 */

export const HOME_COLS = 12
export const HOME_ROWS = 6

export interface TileSpec {
  minW: number
  minH: number
  defaultW: number
  defaultH: number
  allowMultiple: boolean
}

export const TILE_SPECS: Record<HomeTileType, TileSpec> = {
  todayEvents: { minW: 3, minH: 3, defaultW: 4, defaultH: 6, allowMultiple: false },
  weekAgenda: { minW: 4, minH: 3, defaultW: 5, defaultH: 4, allowMultiple: false },
  weather: { minW: 2, minH: 2, defaultW: 3, defaultH: 2, allowMultiple: false },
  choresProgress: { minW: 3, minH: 2, defaultW: 3, defaultH: 2, allowMultiple: false },
  starBalances: { minW: 2, minH: 2, defaultW: 2, defaultH: 2, allowMultiple: false },
  list: { minW: 2, minH: 3, defaultW: 3, defaultH: 4, allowMultiple: true },
  meals: { minW: 2, minH: 2, defaultW: 3, defaultH: 2, allowMultiple: false },
  clock: { minW: 2, minH: 2, defaultW: 2, defaultH: 2, allowMultiple: false },
  photo: { minW: 2, minH: 2, defaultW: 3, defaultH: 4, allowMultiple: true },
  news: { minW: 3, minH: 2, defaultW: 4, defaultH: 3, allowMultiple: true },
  camera: { minW: 3, minH: 2, defaultW: 4, defaultH: 3, allowMultiple: true }
}

/** Tiles the full 12x6 grid with no gaps; list/photo stay in the Add Tile sheet. */
export const DEFAULT_HOME_LAYOUT: HomeTile[] = [
  { id: 'default-todayEvents', type: 'todayEvents', x: 0, y: 0, w: 4, h: 6 },
  { id: 'default-weekAgenda', type: 'weekAgenda', x: 4, y: 0, w: 5, h: 4 },
  { id: 'default-weather', type: 'weather', x: 9, y: 0, w: 3, h: 2 },
  { id: 'default-clock', type: 'clock', x: 9, y: 2, w: 3, h: 2 },
  { id: 'default-meals', type: 'meals', x: 4, y: 4, w: 3, h: 2 },
  { id: 'default-choresProgress', type: 'choresProgress', x: 7, y: 4, w: 3, h: 2 },
  { id: 'default-starBalances', type: 'starBalances', x: 10, y: 4, w: 2, h: 2 }
]

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function inBounds(r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= HOME_COLS && r.y + r.h <= HOME_ROWS
}

/** Can `rect` be placed without leaving the grid or hitting another tile? */
export function canPlace(layout: HomeTile[], rect: Rect, excludeId?: string): boolean {
  if (!inBounds(rect)) return false
  return layout.every((t) => t.id === excludeId || !rectsOverlap(t, rect))
}

/** First free w×h spot scanning row-major, or null when the grid is full. */
export function findFreeSpot(layout: HomeTile[], w: number, h: number): { x: number; y: number } | null {
  for (let y = 0; y + h <= HOME_ROWS; y++) {
    for (let x = 0; x + w <= HOME_COLS; x++) {
      if (canPlace(layout, { x, y, w, h })) return { x, y }
    }
  }
  return null
}

const TILE_TYPES = new Set<string>(Object.keys(TILE_SPECS))

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Make any stored value safe to render: drop garbage, clamp coords, enforce
 * per-type minimum sizes, dedupe ids, and resolve overlaps deterministically.
 * Returns DEFAULT_HOME_LAYOUT when the value isn't an array at all.
 */
export function sanitizeLayout(raw: unknown): HomeTile[] {
  if (!Array.isArray(raw)) return DEFAULT_HOME_LAYOUT
  const out: HomeTile[] = []
  const seenIds = new Set<string>()

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const t = entry as Partial<HomeTile>
    if (typeof t.type !== 'string' || !TILE_TYPES.has(t.type)) continue
    if (typeof t.id !== 'string' || t.id.length === 0 || seenIds.has(t.id)) continue
    const spec = TILE_SPECS[t.type as HomeTileType]

    let w = clamp(Math.round(Number(t.w) || spec.defaultW), spec.minW, HOME_COLS)
    let h = clamp(Math.round(Number(t.h) || spec.defaultH), spec.minH, HOME_ROWS)
    let x = clamp(Math.round(Number(t.x) || 0), 0, HOME_COLS - 1)
    let y = clamp(Math.round(Number(t.y) || 0), 0, HOME_ROWS - 1)
    // shift left/up before shrinking
    x = Math.min(x, HOME_COLS - w)
    y = Math.min(y, HOME_ROWS - h)

    let rect: Rect = { x, y, w, h }
    if (!canPlace(out, rect)) {
      const spot = findFreeSpot(out, w, h) ?? findFreeSpot(out, spec.minW, spec.minH)
      if (!spot) continue // grid full — drop the tile
      const fitsDefault = canPlace(out, { ...spot, w, h })
      rect = fitsDefault ? { ...spot, w, h } : { ...spot, w: spec.minW, h: spec.minH }
    }

    seenIds.add(t.id)
    let config: HomeTile['config']
    if (t.config && typeof t.config === 'object') {
      const raw = t.config as Record<string, unknown>
      config = {
        ...(typeof raw.listId === 'string' ? { listId: raw.listId } : {}),
        ...(typeof raw.feedId === 'string' ? { feedId: raw.feedId } : {}),
        ...(typeof raw.cameraId === 'string' ? { cameraId: raw.cameraId } : {})
      }
    }
    out.push({
      id: t.id,
      type: t.type as HomeTileType,
      ...rect,
      ...(config && Object.keys(config).length > 0 ? { config } : {})
    })
  }
  return out
}
