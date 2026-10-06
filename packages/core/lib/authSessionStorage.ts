type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function authStorageKey(url: string): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
}

/** A single Supabase client can keep refreshing either a durable or temporary session.
 * Unchecked sessions live only in this WebView/page's memory, including refreshed tokens.
 * Keep the SDK's existing key so upgrades preserve previously saved sign-ins. */
export function createAuthSessionStorage(storageKey: string, getPersistentStorage: () => StorageBackend | undefined = () => {
  try { return typeof window === 'undefined' ? undefined : window.localStorage }
  catch { return undefined }
}) {
  const preferenceKey = `slur.remember-me:${storageKey}`
  const keys = [storageKey, `${storageKey}-user`, `${storageKey}-code-verifier`]
  const memory = new Map<string, string>()
  let rememberMe: boolean | undefined

  const getRememberMe = () => {
    if (rememberMe === undefined) {
      // Existing Slur builds always persisted sessions. Preserve that default.
      try { rememberMe = getPersistentStorage()?.getItem(preferenceKey) !== 'false' }
      catch { rememberMe = true }
    }
    return rememberMe
  }

  const storage = {
    getItem(key: string): string | null {
      if (getRememberMe()) {
        try {
          const persistent = getPersistentStorage()
          if (persistent) return persistent.getItem(key) ?? memory.get(key) ?? null
        } catch { /* Storage is unavailable; retain the current in-memory session. */ }
      }
      return memory.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      if (getRememberMe()) {
        try {
          const persistent = getPersistentStorage()
          if (persistent) {
            persistent.setItem(key, value)
            memory.delete(key)
            return
          }
        } catch { /* Private/restricted WebViews may disallow durable storage. */ }
      }
      memory.set(key, value)
    },
    removeItem(key: string): void {
      // Sign-out must remove every copy, regardless of the last checkbox choice.
      memory.delete(key)
      getPersistentStorage()?.removeItem(key)
    },
  }

  const setRememberMe = (value: boolean) => {
    const saved = keys.map(key => [key, storage.getItem(key)] as const)
    const persistent = getPersistentStorage()
    // Erase durable copies before switching to a temporary login. If erasure
    // fails, abort login instead of silently keeping the session on disk.
    for (const key of keys) {
      persistent?.removeItem(key)
      memory.delete(key)
    }
    rememberMe = value
    // A denied preference write must not prevent a memory-only sign-in.
    try { persistent?.setItem(preferenceKey, String(value)) } catch { /* best effort */ }
    for (const [key, stored] of saved) if (stored !== null) storage.setItem(key, stored)
  }

  // Supabase broadcasts auth events across tabs. A temporary sign-in belongs
  // only to its own page; other tabs must not display an unusable signed-in UI.
  return { storage, getRememberMe, setRememberMe, hasSession: () => storage.getItem(storageKey) !== null }
}
