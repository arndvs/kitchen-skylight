import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DbHandle } from '../../src/main/db/client'
import { createChoresService, type ChoresService } from '../../src/main/services/choresService'
import { createRewardsService, type RewardsService } from '../../src/main/services/rewardsService'

const CHI = 'America/Chicago'

describe('chores + rewards', () => {
  let handle: DbHandle
  let chores: ChoresService
  let rewards: RewardsService

  beforeEach(() => {
    handle = openDatabase(':memory:')
    chores = createChoresService(handle.db, () => CHI)
    rewards = createRewardsService(handle.db, chores)
    handle.sqlite
      .prepare(
        "INSERT INTO people (id, name, color, role, sort_order, created_at) VALUES ('kid1','Emma','#46A758','child',0,'2026-01-01T00:00:00Z')"
      )
      .run()
  })

  it('daily chores are due every day from their anchor', () => {
    chores.create({ title: 'Make bed', personId: 'kid1', starsValue: 2, recurrence: { freq: 'daily' }, anchorDate: '2026-06-08' })
    expect(chores.getDay('2026-06-07')).toHaveLength(0) // before anchor
    expect(chores.getDay('2026-06-08')).toHaveLength(1)
    expect(chores.getDay('2026-06-20')).toHaveLength(1)
  })

  it('weekly chores are due only on their weekdays', () => {
    // 2026-06-08 is a Monday; byWeekdays 0=Mon, 4=Fri
    chores.create({
      title: 'Trash out',
      personId: 'kid1',
      starsValue: 5,
      recurrence: { freq: 'weekly', byWeekdays: [0, 4] },
      anchorDate: '2026-06-08'
    })
    expect(chores.getDay('2026-06-08')).toHaveLength(1) // Mon
    expect(chores.getDay('2026-06-09')).toHaveLength(0) // Tue
    expect(chores.getDay('2026-06-12')).toHaveLength(1) // Fri
    expect(chores.getDay('2026-06-15')).toHaveLength(1) // next Mon
  })

  it('bi-weekly chores are due every other week on their weekdays', () => {
    // 2026-06-08 is a Monday; interval 2 means every other week
    chores.create({
      title: 'Deep clean',
      personId: 'kid1',
      starsValue: 8,
      recurrence: { freq: 'weekly', interval: 2, byWeekdays: [0] },
      anchorDate: '2026-06-08'
    })
    expect(chores.getDay('2026-06-08')).toHaveLength(1) // anchor week Mon
    expect(chores.getDay('2026-06-15')).toHaveLength(0) // next week skipped
    expect(chores.getDay('2026-06-22')).toHaveLength(1) // two weeks later
    expect(chores.getDay('2026-06-29')).toHaveLength(0) // skipped again
    expect(chores.getDay('2026-07-06')).toHaveLength(1) // back on
  })

  it('one-time chores appear only on the anchor date', () => {
    chores.create({ title: 'Clean garage', personId: 'kid1', starsValue: 10, recurrence: null, anchorDate: '2026-06-10' })
    expect(chores.getDay('2026-06-10')).toHaveLength(1)
    expect(chores.getDay('2026-06-11')).toHaveLength(0)
  })

  it('completing awards stars exactly once and uncompleting reverses', () => {
    const chore = chores.create({
      title: 'Dishes',
      personId: 'kid1',
      starsValue: 3,
      recurrence: { freq: 'daily' },
      anchorDate: '2026-06-01' // fixed: getDay below uses fixed dates, so the anchor must not be "today"
    })
    expect(chores.complete(chore.id, '2026-06-10').balance).toBe(3)
    expect(chores.complete(chore.id, '2026-06-10').balance).toBe(3) // idempotent
    expect(chores.complete(chore.id, '2026-06-11').balance).toBe(6) // different day counts
    expect(chores.getDay('2026-06-10')[0].completed).toBe(true)
    expect(chores.uncomplete(chore.id, '2026-06-10').balance).toBe(3)
    expect(chores.getDay('2026-06-10')[0].completed).toBe(false)
  })

  it('balance equals the ledger sum across chores and redemptions', () => {
    const chore = chores.create({ title: 'Dishes', personId: 'kid1', starsValue: 10, recurrence: { freq: 'daily' } })
    chores.complete(chore.id, '2026-06-10')
    chores.complete(chore.id, '2026-06-11')
    const reward = rewards.create({ title: 'Ice cream', costStars: 15 })
    rewards.redeem(reward.id, 'kid1')
    expect(chores.balanceOf('kid1')).toBe(5)
  })

  it('refuses redemptions the balance cannot cover', () => {
    const reward = rewards.create({ title: 'Bike', costStars: 100 })
    expect(() => rewards.redeem(reward.id, 'kid1')).toThrow(/Not enough stars/)
    expect(chores.balanceOf('kid1')).toBe(0)
  })

  it('tracks pending redemptions until granted', () => {
    const chore = chores.create({ title: 'Dishes', personId: 'kid1', starsValue: 20, recurrence: { freq: 'daily' } })
    chores.complete(chore.id, '2026-06-10')
    const reward = rewards.create({ title: 'Ice cream', costStars: 15 })
    const redemption = rewards.redeem(reward.id, 'kid1')
    expect(rewards.pendingRedemptions()).toHaveLength(1)
    expect(rewards.pendingRedemptions()[0].rewardTitle).toBe('Ice cream')
    rewards.grant(redemption.id)
    expect(rewards.pendingRedemptions()).toHaveLength(0)
  })
})
