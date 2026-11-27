// Shared owner of the established Pi Windows CLI shim quoting contract.
import { existsSync } from 'node:fs'
import { win32 as pathWin32 } from 'node:path'
const WINDOWS_CMD_ENV_EXPANSION_RE = /%[A-Za-z_][A-Za-z0-9_]*%/

function quoteWindowsBatchArg(arg) {
	if (arg === '') return '""'
	const out = ['"']
	let i = 0
	const n = arg.length
	while (i < n) {
		let backslashes = 0
		while (i < n && arg[i] === '\\') {
			i += 1
			backslashes += 1
		}
		if (i === n) {
			out.push('\\'.repeat(backslashes * 2))
			break
		}
		if (arg[i] === '"') {
			out.push('\\'.repeat(backslashes * 2))
			out.push('""')
			i += 1
		} else {
			out.push('\\'.repeat(backslashes))
			out.push(arg[i])
			i += 1
		}
	}
	out.push('"')
	return out.join('')
}

function rejectWindowsCmdEnvExpansion(args) {
	for (let index = 1; index < args.length; index += 1) {
		if (WINDOWS_CMD_ENV_EXPANSION_RE.test(args[index])) {
			throw new Error(
				'nmem Windows .cmd shim cannot safely receive %VAR%-style arguments; remove or escape the environment-variable token before retrying.',
			)
		}
	}
}

export function windowsComspec(env = process.env) {
	const systemRoot = env.SystemRoot || 'C:\\Windows'
	const root = pathWin32.isAbsolute(systemRoot) ? systemRoot : 'C:\\Windows'
	const expected = pathWin32.join(root, 'System32', 'cmd.exe')
	const comspec = env.ComSpec || ''
	const samePath = (left, right) =>
		pathWin32.normalize(left).toLowerCase() === pathWin32.normalize(right).toLowerCase()
	if (
		comspec &&
		pathWin32.isAbsolute(comspec) &&
		pathWin32.basename(comspec).toLowerCase() === 'cmd.exe' &&
		samePath(comspec, expected) &&
		existsSync(comspec)
	) {
		return comspec
	}
	return existsSync(expected) ? expected : 'C:\\Windows\\System32\\cmd.exe'
}

export function windowsCommandLine(args) {
	rejectWindowsCmdEnvExpansion(args)
	return args.map(quoteWindowsBatchArg).join(' ')
}
