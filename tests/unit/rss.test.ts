import { describe, expect, it } from 'vitest'
import { parseFeedXml } from '../../src/main/services/rssService'
import { PRESET_FEEDS, presetById } from '../../src/shared/rss'

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Test Wire</title>
  <item>
    <title><![CDATA[Breaking: CDATA headline & ampersand]]></title>
    <link>https://example.com/a</link>
    <pubDate>Wed, 10 Jun 2026 14:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Plain headline</title>
    <link>https://example.com/b</link>
  </item>
  <item><description>no title — should be skipped</description></item>
</channel></rss>`

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Wire</title>
  <entry>
    <title>Atom headline one</title>
    <link rel="alternate" href="https://example.com/atom1"/>
    <published>2026-06-10T12:30:00Z</published>
  </entry>
  <entry>
    <title>Atom headline two</title>
    <link href="https://example.com/atom2"/>
    <updated>2026-06-10T13:00:00Z</updated>
  </entry>
</feed>`

const RDF_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://example.com"><title>RDF Wire</title></channel>
  <item rdf:about="https://example.com/r1">
    <title>RDF headline</title>
    <link>https://example.com/r1</link>
    <dc:date>2026-06-10T11:00:00Z</dc:date>
  </item>
</rdf:RDF>`

describe('parseFeedXml', () => {
  it('parses RSS 2.0 with CDATA titles and skips title-less items', () => {
    const result = parseFeedXml(RSS_FIXTURE)
    expect(result.title).toBe('Test Wire')
    expect(result.items).toHaveLength(2)
    expect(result.items[0].title).toBe('Breaking: CDATA headline & ampersand')
    expect(result.items[0].publishedAt).toBe('2026-06-10T14:00:00Z')
    expect(result.items[0].link).toBe('https://example.com/a')
    expect(result.items[1].publishedAt).toBeNull()
  })

  it('parses Atom feeds with link hrefs', () => {
    const result = parseFeedXml(ATOM_FIXTURE)
    expect(result.title).toBe('Atom Wire')
    expect(result.items).toHaveLength(2)
    expect(result.items[0].link).toBe('https://example.com/atom1')
    expect(result.items[0].publishedAt).toBe('2026-06-10T12:30:00Z')
    expect(result.items[1].link).toBe('https://example.com/atom2')
  })

  it('parses RSS 1.0 / RDF feeds (DW style)', () => {
    const result = parseFeedXml(RDF_FIXTURE)
    expect(result.title).toBe('RDF Wire')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].publishedAt).toBe('2026-06-10T11:00:00Z')
  })

  it('never throws on garbage', () => {
    expect(parseFeedXml('not xml at all').items).toEqual([])
    expect(parseFeedXml('<html><body>404</body></html>').items).toEqual([])
    expect(parseFeedXml('').items).toEqual([])
  })

  it('respects the item limit', () => {
    const many = `<rss version="2.0"><channel><title>X</title>${Array.from(
      { length: 40 },
      (_, i) => `<item><title>H${i}</title></item>`
    ).join('')}</channel></rss>`
    expect(parseFeedXml(many, 5).items).toHaveLength(5)
    expect(parseFeedXml(many).items).toHaveLength(15)
  })
})

describe('PRESET_FEEDS invariants', () => {
  it('has exactly 10 feeds covering both regions with unique ids', () => {
    expect(PRESET_FEEDS).toHaveLength(10)
    expect(new Set(PRESET_FEEDS.map((f) => f.id)).size).toBe(10)
    expect(PRESET_FEEDS.some((f) => f.region === 'us')).toBe(true)
    expect(PRESET_FEEDS.some((f) => f.region === 'world')).toBe(true)
    for (const f of PRESET_FEEDS) {
      expect(f.url).toMatch(/^https?:\/\//)
      expect(f.label.length).toBeGreaterThan(2)
    }
  })

  it('looks up presets by id', () => {
    expect(presetById('npr')?.label).toBe('NPR News')
    expect(presetById('nope')).toBeUndefined()
  })
})
