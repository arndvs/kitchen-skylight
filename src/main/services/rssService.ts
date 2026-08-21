import { XMLParser } from 'fast-xml-parser'
import { DateTime } from 'luxon'
import { presetById, type NewsFeedDto, type NewsItemDto } from '@shared/rss'
import { notFound } from './errors'

const CACHE_TTL_MS = 15 * 60 * 1000
const FETCH_TIMEOUT_MS = 10_000
const MAX_ITEMS = 15

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // some feeds CDATA-wrap titles; fast-xml-parser unwraps automatically
  trimValues: true
})

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

function text(v: unknown): string | null {
  if (typeof v === 'string') return v || null
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && '#text' in v) {
    const t = (v as { '#text': unknown })['#text']
    return typeof t === 'string' || typeof t === 'number' ? String(t) : null
  }
  return null
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null
  for (const parse of [
    () => DateTime.fromRFC2822(raw),
    () => DateTime.fromISO(raw),
    () => DateTime.fromHTTP(raw)
  ]) {
    const dt = parse()
    if (dt.isValid) return dt.toUTC().toISO({ suppressMilliseconds: true })
  }
  return null
}

/** Parse RSS 2.0, RSS 1.0 (RDF), or Atom into a flat headline list. Never throws. */
export function parseFeedXml(xml: string, limit = MAX_ITEMS): { title: string | null; items: NewsItemDto[] } {
  let doc: Record<string, unknown>
  try {
    doc = parser.parse(xml) as Record<string, unknown>
  } catch {
    return { title: null, items: [] }
  }

  const rss = doc.rss as { channel?: Record<string, unknown> } | undefined
  const rdf = doc['rdf:RDF'] as Record<string, unknown> | undefined
  const atom = doc.feed as Record<string, unknown> | undefined

  let feedTitle: string | null = null
  const items: NewsItemDto[] = []

  if (rss?.channel) {
    feedTitle = text(rss.channel.title)
    for (const item of asArray(rss.channel.item as Record<string, unknown> | Record<string, unknown>[])) {
      const title = text(item.title)
      if (!title) continue
      items.push({
        title,
        link: text(item.link),
        publishedAt: parseDate(text(item.pubDate) ?? text(item['dc:date']))
      })
    }
  } else if (rdf) {
    const channel = rdf.channel as Record<string, unknown> | undefined
    feedTitle = channel ? text(channel.title) : null
    for (const item of asArray(rdf.item as Record<string, unknown> | Record<string, unknown>[])) {
      const title = text(item.title)
      if (!title) continue
      items.push({
        title,
        link: text(item.link),
        publishedAt: parseDate(text(item['dc:date']) ?? text(item.pubDate))
      })
    }
  } else if (atom) {
    feedTitle = text(atom.title)
    for (const entry of asArray(atom.entry as Record<string, unknown> | Record<string, unknown>[])) {
      const title = text(entry.title)
      if (!title) continue
      const links = asArray(entry.link as Record<string, unknown> | Record<string, unknown>[])
      const alt = links.find((l) => l['@_rel'] === 'alternate' || l['@_rel'] === undefined)
      items.push({
        title,
        link: alt ? ((alt['@_href'] as string) ?? null) : null,
        publishedAt: parseDate(text(entry.published) ?? text(entry.updated))
      })
    }
  }

  return { title: feedTitle, items: items.slice(0, limit) }
}

export function createRssService() {
  const cache = new Map<string, { data: NewsFeedDto; atMs: number }>()

  async function getFeed(feedId: string): Promise<NewsFeedDto> {
    const preset = presetById(feedId)
    if (!preset) throw notFound('News feed')

    const cached = cache.get(feedId)
    if (cached && Date.now() - cached.atMs < CACHE_TTL_MS) return cached.data

    try {
      const res = await fetch(preset.url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'KitchenSkylight/1.0 (family calendar display)' }
      })
      if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`)
      const parsed = parseFeedXml(await res.text())
      if (parsed.items.length === 0) throw new Error('Feed had no readable headlines')
      const data: NewsFeedDto = {
        feedId,
        label: preset.label,
        items: parsed.items,
        fetchedAt: new Date().toISOString()
      }
      cache.set(feedId, { data, atMs: Date.now() })
      return data
    } catch (err) {
      // serve stale headlines over an error if we have any
      if (cached) return cached.data
      throw err
    }
  }

  return { getFeed }
}

export type RssService = ReturnType<typeof createRssService>
