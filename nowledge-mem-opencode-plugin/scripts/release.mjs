import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)))
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url)))
const registry = JSON.parse(readFileSync(new URL("../../integrations.json", import.meta.url)))
assert.equal(pkg.name, "opencode-nowledge-mem")
assert.equal(lock.version, pkg.version)
assert.equal(lock.packages[""].version, pkg.version)
assert.equal(registry.integrations.find((entry) => entry.id === "opencode").version, pkg.version)
assert.match(readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8"), new RegExp(`^## \\[${pkg.version.replaceAll(".", "\\.")}\\]`, "m"))
if (process.env.RELEASE_VERSION) assert.equal(pkg.version, process.env.RELEASE_VERSION)

if (process.argv[2] === "verify") {
  const artifact = JSON.parse(readFileSync(process.argv[3], "utf8"))[0]
  assert.equal(artifact.name, pkg.name)
  assert.equal(artifact.version, pkg.version)
  const version = await fetch(`https://registry.npmjs.org/${pkg.name}/${pkg.version}`)
  assert.equal(version.status, 200, "Published version is absent from npm")
  const remote = await version.json()
  assert.equal(remote.dist.integrity, artifact.integrity, "npm artifact differs from the validated tarball")
  const latest = await fetch(`https://registry.npmjs.org/${pkg.name}/latest`)
  assert.equal(latest.status, 200)
  assert.equal((await latest.json()).version, pkg.version, "npm latest did not advance")
  console.log(`Verified npm ${pkg.name}@${pkg.version}: matching integrity and latest tag`)
} else {
  assert.equal(process.argv[2], "check", "Use check or verify <npm-pack-json>")
  console.log(`Release metadata aligned: ${pkg.name}@${pkg.version}`)
}
