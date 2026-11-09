export async function isPersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false
  } catch {
    return false
  }
}

/** Asks the browser not to clear our data when space is low. It may say no; that is fine. */
export async function requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!navigator.storage?.persist) return 'unsupported'
  try {
    return (await navigator.storage.persist()) ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}
