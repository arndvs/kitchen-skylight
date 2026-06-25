import { describe, expect, it } from 'vitest'
import { describeDuration, formatDuration, parseTimerCommand } from '../../src/shared/timer'

describe('parseTimerCommand — durations', () => {
  const cases: [string, number][] = [
    ['set a timer for 5 minutes', 300],
    ['5 minute timer', 300],
    ['10 minutes', 600],
    ['90 seconds', 90],
    ['1 hour 30 minutes', 5400],
    ['set a timer for 1 hour and 5 minutes', 3900],
    ['two minutes', 120],
    ['twenty five minutes', 1500],
    ['set a timer for forty five seconds', 45],
    ['a minute', 60],
    ['half an hour', 1800],
    ['half a minute', 30],
    ['an hour and a half', 5400],
    ['a minute and a half', 90],
    ['two and a half minutes', 150],
    ['set a timer for one hour twenty minutes', 4800],
    ['3 min', 180],
    ['45 sec', 45],
    ['2 hours', 7200]
  ]
  for (const [phrase, seconds] of cases) {
    it(`"${phrase}" → ${seconds}s`, () => {
      expect(parseTimerCommand(phrase)?.seconds).toBe(seconds)
    })
  }
})

describe('parseTimerCommand — rejections', () => {
  it('returns null when there is no duration', () => {
    expect(parseTimerCommand('set a timer')).toBeNull()
    expect(parseTimerCommand('what time is it')).toBeNull()
    expect(parseTimerCommand('')).toBeNull()
  })
  it('rejects absurd durations', () => {
    expect(parseTimerCommand('set a timer for 100000 minutes')).toBeNull()
  })
})

describe('parseTimerCommand — labels', () => {
  it('captures a label from common phrasings', () => {
    expect(parseTimerCommand('set a pasta timer for 10 minutes')).toEqual({ seconds: 600, label: 'Pasta' })
    expect(parseTimerCommand('10 minute egg timer')).toEqual({ seconds: 600, label: 'Egg' })
    expect(parseTimerCommand('timer for laundry for 45 minutes')).toEqual({ seconds: 2700, label: 'Laundry' })
  })
  it('omits a label when only a duration is given', () => {
    expect(parseTimerCommand('set a timer for 5 minutes')).toEqual({ seconds: 300 })
  })
})

describe('formatDuration', () => {
  it('formats under and over an hour', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(600)).toBe('10:00')
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('describeDuration', () => {
  it('reads a duration aloud', () => {
    expect(describeDuration(300)).toBe('5 minutes')
    expect(describeDuration(3900)).toBe('1 hour 5 minutes')
    expect(describeDuration(1)).toBe('1 second')
  })
})
