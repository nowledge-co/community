const SANDBOX_UNAVAILABLE_CODE = 'SANDBOX_UNAVAILABLE'

export function errorMessage(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

export function warn(ctx, message) {
  if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(message)
}

export function isSandboxUnavailableError(error) {
  if (typeof error !== 'object' || error === null) return false
  return error.code === SANDBOX_UNAVAILABLE_CODE || error.name === 'SandboxUnavailableError'
}

export function resolveDangerFullAccessPolicy(ctx, session) {
  let service
  try {
    service = typeof ctx.get === 'function' ? ctx.get('sandboxPolicy') : undefined
  } catch (error) {
    warn(ctx, `nowledge-mem: failed to access sandbox policy service: ${errorMessage(error)}`)
    return undefined
  }
  if (typeof service?.resolve !== 'function') return undefined

  try {
    return service.resolve(session === undefined
      ? { mode: 'danger-full-access' }
      : { session, mode: 'danger-full-access' }) ?? undefined
  } catch (error) {
    warn(ctx, `nowledge-mem: failed to resolve danger-full-access sandbox policy: ${errorMessage(error)}`)
    return undefined
  }
}

async function runShell(ctx, request) {
  return await ctx.shell.run(ctx.shell.resolve(request))
}

export async function runShellWithHostSandboxRetry(
  ctx,
  request,
  session,
  allowDangerFullAccessRetry = false,
) {
  let sandboxError
  try {
    return await runShell(ctx, request)
  } catch (error) {
    if (!isSandboxUnavailableError(error)) {
      warn(ctx, `nowledge-mem: nmem shell call failed: ${errorMessage(error)}`)
      return undefined
    }
    sandboxError = error
  }

  if (!allowDangerFullAccessRetry) {
    warn(ctx, `nowledge-mem: nmem shell sandbox unavailable and danger-full-access retry is not enabled; skipping retry: ${errorMessage(sandboxError)}`)
    return undefined
  }

  const sandboxPolicy = resolveDangerFullAccessPolicy(ctx, session)
  if (sandboxPolicy === undefined) {
    warn(ctx, `nowledge-mem: nmem shell sandbox unavailable and host did not grant danger-full-access; skipping retry: ${errorMessage(sandboxError)}`)
    return undefined
  }

  warn(ctx, `nowledge-mem: nmem shell sandbox unavailable; retrying with host-resolved danger-full-access policy: ${errorMessage(sandboxError)}`)
  try {
    return await runShell(ctx, { ...request, sandboxPolicy })
  } catch (error) {
    warn(ctx, `nowledge-mem: nmem shell retry failed: ${errorMessage(error)}`)
    return undefined
  }
}
