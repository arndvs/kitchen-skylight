import { useState } from 'react'
import { Dialog } from './ui'
import { LockIcon } from './icons'

const MAX_LEN = 8
const MIN_LEN = 4

export function PinDialog({
  open,
  title,
  error,
  onClose,
  onSubmit
}: {
  open: boolean
  title: string
  /** external error (e.g. wrong PIN); shown until the next keypress */
  error?: string | null
  onClose: () => void
  onSubmit: (pin: string) => void
}) {
  const [pin, setPin] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const shownError = localError ?? error

  const press = (d: string): void => {
    setLocalError(null)
    if (pin.length < MAX_LEN) setPin(pin + d)
  }
  const submit = (): void => {
    if (pin.length < MIN_LEN) return
    onSubmit(pin)
    setPin('')
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setPin('')
        setLocalError(null)
        onClose()
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <LockIcon size={30} className="text-ink-faint" />
        <h3 className="font-display text-2xl font-semibold">{title}</h3>
        <div className="flex h-6 items-center gap-2.5">
          {Array.from({ length: Math.max(pin.length, MIN_LEN) }, (_, i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-ink' : 'border-2 border-line'}`}
            />
          ))}
        </div>
        {shownError && <p className="text-base font-bold text-ember-deep">{shownError}</p>}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === '⌫') setPin(pin.slice(0, -1))
                else if (key === 'OK') submit()
                else press(key)
              }}
              disabled={key === 'OK' && pin.length < MIN_LEN}
              className={`pressable flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold disabled:opacity-30 ${
                key === 'OK' ? 'bg-ember text-lg text-white' : 'bg-paper-deep text-ink'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
