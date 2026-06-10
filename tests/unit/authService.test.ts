import { describe, expect, it } from 'vitest'
import { createAuthService } from '../../src/main/services/authService'
import type { SettingsService } from '../../src/main/services/settingsService'

function settingsStub(): SettingsService {
  const store = new Map<string, string>()
  return {
    getRaw: (key: string) => store.get(key) ?? null,
    setRaw: (key: string, value: string) => void store.set(key, value),
    deleteRaw: (key: string) => void store.delete(key),
    getAll: () => ({}) as never,
    set: () => ({}) as never
  } as SettingsService
}

describe('authService', () => {
  it('is unlocked when no PIN is set', () => {
    const auth = createAuthService(settingsStub())
    expect(auth.pinSet()).toBe(false)
    expect(auth.isUnlocked()).toBe(true)
    expect(() => auth.assertUnlocked()).not.toThrow()
  })

  it('locks after a PIN is set and lock() is called', () => {
    const auth = createAuthService(settingsStub())
    auth.setPin('1234')
    expect(auth.pinSet()).toBe(true)
    expect(auth.isUnlocked()).toBe(true) // setting unlocks
    auth.lock()
    expect(auth.isUnlocked()).toBe(false)
    expect(() => auth.assertUnlocked()).toThrow(/PIN/)
  })

  it('verifies the correct PIN and rejects wrong ones', () => {
    const auth = createAuthService(settingsStub())
    auth.setPin('4711')
    auth.lock()
    expect(auth.verifyPin('0000')).toBe(false)
    expect(auth.isUnlocked()).toBe(false)
    expect(auth.verifyPin('4711')).toBe(true)
    expect(auth.isUnlocked()).toBe(true)
  })

  it('refuses to change the PIN while locked', () => {
    const auth = createAuthService(settingsStub())
    auth.setPin('1234')
    auth.lock()
    expect(() => auth.setPin('9999')).toThrow(/current PIN/i)
    auth.verifyPin('1234')
    expect(() => auth.setPin('9999')).not.toThrow()
    auth.lock()
    expect(auth.verifyPin('9999')).toBe(true)
  })

  it('removes the PIN', () => {
    const auth = createAuthService(settingsStub())
    auth.setPin('1234')
    auth.setPin(null)
    expect(auth.pinSet()).toBe(false)
    expect(auth.isUnlocked()).toBe(true)
  })

  it('rejects malformed PINs', () => {
    const auth = createAuthService(settingsStub())
    expect(() => auth.setPin('12')).toThrow(/4–8 digits/)
    expect(() => auth.setPin('abcd')).toThrow(/4–8 digits/)
  })
})
