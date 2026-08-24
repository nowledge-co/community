export async function flushBeforeImport(ctx, session, report) {
  try {
    await ctx.sessions.flush(session)
    return true
  } catch (error) {
    report(error)
    return false
  }
}
