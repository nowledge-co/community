/** Serialize capture per Session and retain only acknowledged checkpoints. */
export function createSyncQueue(operation, onError, now = Date.now) {
  const cursors = new WeakMap(), tails = new WeakMap(), failures = new WeakMap()
  return session => {
    const task = (tails.get(session) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      const failure = failures.get(session)
      if (failure !== undefined && now() < failure.retryAt) return
      let failed
      try {
        const cursor = await operation(session, cursors.get(session))
        failed = cursor?.failed === true
        if (!failed && cursor !== undefined) {
          cursors.set(session, cursor)
          failures.delete(session)
        }
      } catch {
        failed = true
        onError()
      }
      if (failed) {
        const attempts = Math.min((failure?.attempts ?? 0) + 1, 7)
        failures.set(session, { attempts, retryAt: now() + Math.min(1000 * 2 ** (attempts - 1), 60_000) })
      }
    })
    tails.set(session, task)
    return task
  }
}
