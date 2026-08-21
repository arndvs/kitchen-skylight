// One-off: verify every preset feed is reachable and contains items.
const FEEDS = [
  ['npr', 'https://feeds.npr.org/1001/rss.xml'],
  ['cnn', 'http://rss.cnn.com/rss/cnn_topstories.rss'],
  ['fox', 'https://moxie.foxnews.com/google-publisher/latest.xml'],
  ['nbc', 'https://feeds.nbcnews.com/nbcnews/public/news'],
  ['abc', 'https://abcnews.go.com/abcnews/topstories'],
  ['nyt', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'],
  ['bbc', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
  ['guardian', 'https://www.theguardian.com/world/rss'],
  ['aljazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
  ['dw', 'https://rss.dw.com/rdf/rss-en-all']
]

for (const [id, url] of FEEDS) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'KitchenSkylight/1.0 (family calendar display)' }
    })
    const body = res.ok ? await res.text() : ''
    const itemCount = (body.match(/<item[\s>]/g) ?? []).length + (body.match(/<entry[\s>]/g) ?? []).length
    const firstTitle = /<item[\s>][\s\S]*?<title>(?:<!\[CDATA\[)?(.{5,80}?)(?:\]\]>)?<\/title>/.exec(body)?.[1]
    console.log(`${res.ok && itemCount > 0 ? 'OK  ' : 'FAIL'} ${id.padEnd(10)} HTTP ${res.status} items=${itemCount} ${firstTitle ? '| ' + firstTitle.slice(0, 60) : ''}`)
  } catch (err) {
    console.log(`FAIL ${id.padEnd(10)} ${err.message}`)
  }
}
