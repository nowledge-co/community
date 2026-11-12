import { mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Keep shell-double payloads out of the developer's actual DSH profile.
const root = mkdtempSync(fileURLToPath(new URL('../node_modules/.dsh-test-', import.meta.url)))
process.env.DSH_HOME = root
process.on('exit', () => rmSync(root, { recursive: true, force: true }))
