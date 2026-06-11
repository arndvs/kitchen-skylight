/** Curated free news feeds selectable for the News home-screen tile. */

export interface PresetFeed {
  id: string
  label: string
  url: string
  region: 'us' | 'world'
}

export const PRESET_FEEDS: PresetFeed[] = [
  // United States
  { id: 'npr', label: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', region: 'us' },
  { id: 'cnn', label: 'CNN Top Stories', url: 'http://rss.cnn.com/rss/cnn_topstories.rss', region: 'us' },
  { id: 'fox', label: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/latest.xml', region: 'us' },
  { id: 'nbc', label: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/news', region: 'us' },
  { id: 'abc', label: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories', region: 'us' },
  { id: 'nyt', label: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', region: 'us' },
  // World
  { id: 'bbc', label: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'world' },
  { id: 'guardian', label: 'The Guardian World', url: 'https://www.theguardian.com/world/rss', region: 'world' },
  { id: 'aljazeera', label: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: 'world' },
  { id: 'dw', label: 'DW News (English)', url: 'https://rss.dw.com/rdf/rss-en-all', region: 'world' }
]

export function presetById(id: string): PresetFeed | undefined {
  return PRESET_FEEDS.find((f) => f.id === id)
}

export interface NewsItemDto {
  title: string
  link: string | null
  /** ISO instant, null when the feed omits dates */
  publishedAt: string | null
}

export interface NewsFeedDto {
  feedId: string
  label: string
  items: NewsItemDto[]
  fetchedAt: string
}
