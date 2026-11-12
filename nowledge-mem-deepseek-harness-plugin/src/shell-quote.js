/**
 * Quote one nmem argument for the shell ctx.shell runs on this platform.
 * Pulled out of index.js because it has no dependency on the DSH SDK, so it can
 * be unit tested without the DSH peer packages.
 *
 * ctx.shell is PowerShell on Windows and a POSIX shell elsewhere, and their
 * quoting rules differ. The POSIX form '\'' does not work in PowerShell.
 *
 * In PowerShell a single-quoted string is closed by any of five characters, not
 * only the ASCII apostrophe, and doubling is the only escape:
 * https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_quoting_rules
 *
 * @ is left out of the bare-word set on Windows because @name is splatting there.
 */
const POSIX_BARE = /^[A-Za-z0-9_./:=@%+-]+$/u
const POWERSHELL_BARE = /^[A-Za-z0-9_./:=%+-]+$/u
const POWERSHELL_SINGLE_QUOTES = /['‘’‚‛]/gu

export function shellQuote(value, platform = process.platform) {
  if (platform === 'win32') {
    if (POWERSHELL_BARE.test(value)) return value
    return `'${value.replace(POWERSHELL_SINGLE_QUOTES, '$&$&')}'`
  }
  if (POSIX_BARE.test(value)) return value
  return `'${value.replaceAll("'", "'\\''")}'`
}

/**
 * Build the command line. PowerShell reads a quoted first word as a string, not a
 * command, so a quoted executable path needs the call operator there.
 */
export function shellCommand(executable, args, platform = process.platform) {
  const quoted = [executable, ...args].map(value => shellQuote(value, platform))
  const prefix = platform === 'win32' && quoted[0] !== executable ? '& ' : ''
  return prefix + quoted.join(' ')
}
