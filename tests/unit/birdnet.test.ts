import { describe, expect, it } from 'vitest'
import { normalizeBirdnetUrl, parseDetections } from '../../src/main/services/birdnetService'

const ORIGIN = 'http://192.168.0.208:8080'

const SAMPLE = {
  data: [
    {
      id: 12345,
      commonName: 'Eurasian Blackbird',
      scientificName: 'Turdus merula',
      confidence: 0.89,
      timestamp: '2026-06-25T14:30:00Z'
    },
    {
      id: 12346,
      commonName: 'European Robin',
      scientificName: 'Erithacus rubecula',
      confidence: 0.71,
      timestamp: '2026-06-25T14:28:00Z'
    },
    // missing commonName → skipped
    { id: 12347, scientificName: 'Parus major', confidence: 0.5, timestamp: '2026-06-25T14:20:00Z' },
    // missing timestamp → skipped
    { id: 12348, commonName: 'Great Tit', scientificName: 'Parus major', confidence: 0.5 }
  ],
  total: 4
}

describe('parseDetections', () => {
  it('maps valid rows and skips ones missing required fields', () => {
    const out = parseDetections(SAMPLE, ORIGIN)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({
      id: 12345,
      commonName: 'Eurasian Blackbird',
      scientificName: 'Turdus merula',
      confidence: 0.89,
      timestamp: '2026-06-25T14:30:00Z'
    })
  })

  it('builds an osl-bird proxy image URL with encoded params', () => {
    const [first] = parseDetections(SAMPLE, ORIGIN)
    expect(first.image).toBe(
      `osl-bird://image?base=${encodeURIComponent(ORIGIN)}&sci=${encodeURIComponent('Turdus merula')}`
    )
  })

  it('tolerates junk and honors the limit', () => {
    expect(parseDetections(null, ORIGIN)).toEqual([])
    expect(parseDetections({}, ORIGIN)).toEqual([])
    expect(parseDetections({ data: 'nope' }, ORIGIN)).toEqual([])
    expect(parseDetections(SAMPLE, ORIGIN, 1)).toHaveLength(1)
  })

  it('defaults missing id/confidence rather than dropping the row', () => {
    const out = parseDetections(
      { data: [{ commonName: 'Wren', scientificName: 'Troglodytes troglodytes', timestamp: '2026-06-25T10:00:00Z' }] },
      ORIGIN
    )
    expect(out[0]).toMatchObject({ id: 0, confidence: 0 })
  })
})

describe('normalizeBirdnetUrl', () => {
  it('reduces any pasted URL to its origin', () => {
    expect(normalizeBirdnetUrl('http://192.168.0.208:8080/ui/dashboard')).toBe(ORIGIN)
    expect(normalizeBirdnetUrl('http://192.168.0.208:8080/')).toBe(ORIGIN)
    expect(normalizeBirdnetUrl('  http://192.168.0.208:8080/api/v2/detections?x=1  ')).toBe(ORIGIN)
    expect(normalizeBirdnetUrl('https://birds.example.com')).toBe('https://birds.example.com')
  })

  it('rejects non-http(s) and garbage', () => {
    expect(() => normalizeBirdnetUrl('file:///etc/passwd')).toThrow()
    expect(() => normalizeBirdnetUrl('ftp://192.168.0.208')).toThrow()
    expect(() => normalizeBirdnetUrl('not a url')).toThrow()
  })
})
