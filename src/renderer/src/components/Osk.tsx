import { useEffect, useId, useRef, useState } from 'react'
import { create } from 'zustand'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import { MicIcon } from './icons'

interface OskTarget {
  id: string
  get: () => string
  set: (value: string) => void
}

interface OskState {
  target: OskTarget | null
  /** bumped when the focused input's value changes from physical typing */
  echo: number
  open(target: OskTarget): void
  close(): void
  bump(): void
}

export const useOsk = create<OskState>((set) => ({
  target: null,
  echo: 0,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
  bump: () => set((s) => ({ echo: s.echo + 1 }))
}))

/**
 * Voice input via the Web Speech API. Returns a `listen` function that starts
 * (or stops) dictation and appends the transcript to the current value.
 * `supported` is false when the browser has no speech recognition (e.g. the
 * Windows Speech Platform isn't installed) — the mic button is hidden then.
 */
function useVoiceInput(): {
  supported: boolean
  listening: boolean
  listen: (onResult: (text: string) => void) => void
} {
  const [listening, setListening] = useState(false)
  const recRef = useRef<{ stop: () => void } | null>(null)
  const supported =
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  const listen = (onResult: (text: string) => void): void => {
    if (recRef.current) {
      recRef.current.stop()
      recRef.current = null
      setListening(false)
      return
    }
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => unknown; SpeechRecognition?: new () => unknown })
    const Ctor = SR.webkitSpeechRecognition ?? SR.SpeechRecognition
    if (!Ctor) return
    const rec = new Ctor() as {
      lang: string
      interimResults: boolean
      continuous: boolean
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
      onend: (() => void) | null
      onerror: (() => void) | null
      start: () => void
      stop: () => void
    }
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (text) onResult(text)
    }
    rec.onend = () => {
      recRef.current = null
      setListening(false)
    }
    rec.onerror = () => {
      recRef.current = null
      setListening(false)
    }
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      recRef.current = null
      setListening(false)
    }
  }

  return { supported, listening, listen }
}

export function OskInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  className = ''
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const id = useId()
  const valRef = useRef(value)
  const cbRef = useRef(onChange)
  valRef.current = value
  cbRef.current = onChange
  const { open, bump, target } = useOsk()

  // Open on pointerdown (fires before focus on touch) so a single tap reliably
  // brings up the keyboard. `focus` alone is unreliable on touch — the browser
  // can fire a transient blur right after, which used to close the tray.
  const openFor = (): void => {
    open({ id, get: () => valRef.current, set: (v) => cbRef.current(v) })
  }

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onPointerDown={openFor}
      onFocus={openFor}
      onChange={(e) => {
        onChange(e.target.value)
        if (target?.id === id) bump()
      }}
      className={`min-h-14 w-full rounded-2xl border-2 border-line bg-card px-4 text-xl font-semibold text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none ${className}`}
    />
  )
}

const LAYOUTS = {
  default: [
    'q w e r t y u i o p',
    'a s d f g h j k l',
    "{shift} z x c v b n m ' {bksp}",
    '{numbers} {space} {done}'
  ],
  shift: [
    'Q W E R T Y U I O P',
    'A S D F G H J K L',
    '{shift} Z X C V B N M ! {bksp}',
    '{numbers} {space} {done}'
  ],
  numbers: ['1 2 3 4 5 6 7 8 9 0', '- / : ; ( ) $ & @ "', '{shift} . , ? ! # % + {bksp}', '{abc} {space} {done}']
}

const DISPLAY = {
  '{bksp}': '⌫',
  '{shift}': '⇧',
  '{space}': ' ',
  '{done}': 'Done',
  '{numbers}': '123',
  '{abc}': 'ABC'
}

/** Bottom-anchored on-screen keyboard, shown whenever an OskInput has focus. */
export function OskTray() {
  const { target, close, echo } = useOsk()
  const keyboardRef = useRef<{ setInput: (v: string) => void } | null>(null)
  const [layout, setLayout] = useState<'default' | 'shift' | 'numbers'>('default')
  const { supported, listening, listen } = useVoiceInput()

  useEffect(() => {
    if (target) keyboardRef.current?.setInput(target.get())
    setLayout('default')
  }, [target?.id, echo, target])

  // Any tap that is neither on the keyboard nor on a text input dismisses the
  // tray. Listen to `pointerdown` (fires before click on touch) so the tap that
  // focuses an input never races the close. Closing earlier would reflow the
  // dialog mid-gesture and the tap would land on the moved layout.
  useEffect(() => {
    if (!target) return
    const onPointerDown = (e: PointerEvent): void => {
      const el = e.target as HTMLElement | null
      if (el?.closest('.osl-osk-tray') || el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return
      // ignore the gesture that's still focusing an input (pointerdown precedes focus)
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return
        useOsk.getState().close()
      }, 0)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [target, close])

  if (!target) return null

  return (
    <div className="osl-osk-tray fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-paper/95 px-3 pt-3 pb-4 shadow-float backdrop-blur-md">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-ink-faint">
            {listening ? 'Listening… tap the mic to stop' : 'Tap the mic to speak'}
          </span>
          {supported && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => listen((text) => target.set(target.get() + (target.get() ? ' ' : '') + text))}
              className={`pressable flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                listening ? 'bg-ember text-white' : 'bg-paper-deep text-ink-soft'
              }`}
              aria-label={listening ? 'Stop listening' : 'Speak to type'}
            >
              <MicIcon size={22} />
            </button>
          )}
        </div>
        <Keyboard
          keyboardRef={(r) => (keyboardRef.current = r)}
          theme="hg-theme-default osl-keyboard"
          layout={LAYOUTS}
          layoutName={layout}
          display={DISPLAY}
          preventMouseDownDefault
          stopMouseDownPropagation
          onChange={(input: string) => target.set(input)}
          onKeyPress={(button: string) => {
            if (button === '{shift}') setLayout((l) => (l === 'shift' ? 'default' : 'shift'))
            else if (button === '{numbers}') setLayout('numbers')
            else if (button === '{abc}') setLayout('default')
            else if (button === '{done}') {
              ;(document.activeElement as HTMLElement | null)?.blur()
              close()
            } else if (layout === 'shift') setLayout('default')
          }}
        />
      </div>
    </div>
  )
}
