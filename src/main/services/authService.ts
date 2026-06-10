import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { SettingsService } from './settingsService'
import { AppError, invalid } from './errors'

const KEY_PIN = 'auth.pinHash' // format: <saltHex>:<hashHex>
const UNLOCK_WINDOW_MS = 5 * 60 * 1000

function hashPin(pin: string, salt: Buffer): Buffer {
  return scryptSync(pin, salt, 32)
}

/**
 * Parental lock. The PIN hash lives in the settings table (internal key, never
 * sent to the renderer); the unlock state lives here in the main process so a
 * compromised renderer cannot skip the gate.
 */
export function createAuthService(settings: SettingsService) {
  let unlockedUntilMs = 0

  function pinSet(): boolean {
    return settings.getRaw(KEY_PIN) !== null
  }

  function isUnlocked(): boolean {
    return !pinSet() || Date.now() < unlockedUntilMs
  }

  function verifyPin(pin: string): boolean {
    const stored = settings.getRaw(KEY_PIN)
    if (!stored) return true
    const [saltHex, hashHex] = stored.split(':')
    if (!saltHex || !hashHex) return false
    const expected = Buffer.from(hashHex, 'hex')
    const actual = hashPin(pin, Buffer.from(saltHex, 'hex'))
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual)
    if (ok) unlockedUntilMs = Date.now() + UNLOCK_WINDOW_MS
    return ok
  }

  function setPin(pin: string | null): void {
    if (pinSet() && !isUnlocked()) throw new AppError('LOCKED', 'Unlock with the current PIN first')
    if (pin === null) {
      removePin()
      return
    }
    if (!/^\d{4,8}$/.test(pin)) throw invalid('PIN must be 4–8 digits')
    const salt = randomBytes(16)
    settings.setRaw(KEY_PIN, `${salt.toString('hex')}:${hashPin(pin, salt).toString('hex')}`)
    unlockedUntilMs = Date.now() + UNLOCK_WINDOW_MS
  }

  function removePin(): void {
    settings.deleteRaw(KEY_PIN)
    unlockedUntilMs = 0
  }

  function lock(): void {
    unlockedUntilMs = 0
  }

  /** Throw unless the parental gate is open. Successful use slides the window. */
  function assertUnlocked(): void {
    if (!isUnlocked()) throw new AppError('LOCKED', 'Parental lock is on — enter the PIN first')
    if (pinSet()) unlockedUntilMs = Date.now() + UNLOCK_WINDOW_MS
  }

  return { pinSet, isUnlocked, verifyPin, setPin, lock, assertUnlocked }
}

export type AuthService = ReturnType<typeof createAuthService>
