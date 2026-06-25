import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uuidv7 } from '@shared/uuid'

export interface KitchenTimer {
  id: string
  label?: string
  /** epoch ms when it fires */
  endsAt: number
  /** original length, for the progress ring */
  durationSec: number
}

/** Keep a just-fired timer around this long so it still rings after a quick reload. */
const RING_GRACE_MS = 5 * 60 * 1000

interface TimerState {
  timers: KitchenTimer[]
  add(seconds: number, label?: string): void
  cancel(id: string): void
}

export const useTimers = create<TimerState>()(
  persist(
    (set) => ({
      timers: [],
      add: (seconds, label) =>
        set((s) => ({
          timers: [
            ...s.timers,
            { id: uuidv7(), label, endsAt: Date.now() + seconds * 1000, durationSec: seconds }
          ].sort((a, b) => a.endsAt - b.endsAt)
        })),
      cancel: (id) => set((s) => ({ timers: s.timers.filter((t) => t.id !== id) }))
    }),
    {
      name: 'osl-timers',
      // drop timers that fired long ago so stale ones don't ring on next boot
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.timers = state.timers.filter((t) => t.endsAt > Date.now() - RING_GRACE_MS)
      }
    }
  )
)
