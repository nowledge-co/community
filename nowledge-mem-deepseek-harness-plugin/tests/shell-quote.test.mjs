import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { shellCommand, shellQuote } from '../src/shell-quote.js'

// Every value must reach the program as exactly one unchanged argument.
const VALUES = [
  'plain',
  'two words',
  "it's fine",
  'curly \u2018left\u2019 right',
  'low \u201A and high \u201B',
  "ending with a quote'",
  "'starting with a quote",
  "two''quotes",
  "semi'; next",
  'semi\u2019; next',
  "line one'\nline two",
  'dollar $HOME and $(sub) and `tick`',
  'hash # and pipe | and amp &',
  '@name',
  '--flag-like',
  '中文 引号’还有 空格',
]

test('POSIX keeps bare words and the classic escape', () => {
  assert.equal(shellQuote('--json', 'linux'), '--json')
  assert.equal(shellQuote('@name', 'linux'), '@name')
  assert.equal(shellQuote("it's", 'linux'), "'it'\\''s'")
  assert.equal(shellQuote('it\u2019s', 'linux'), "'it\u2019s'")
})

test('Windows doubles every character PowerShell reads as a single quote', () => {
  assert.equal(shellQuote('--json', 'win32'), '--json')
  assert.equal(shellQuote('C:/tools/nmem.exe', 'win32'), 'C:/tools/nmem.exe')
  assert.equal(shellQuote('@name', 'win32'), "'@name'")
  assert.equal(shellQuote("it's", 'win32'), "'it''s'")
  for (const quote of ['\u2018', '\u2019', '\u201A', '\u201B']) {
    assert.equal(shellQuote(`a${quote}b`, 'win32'), `'a${quote}${quote}b'`)
  }
})

test('only a quoted executable gets the PowerShell call operator', () => {
  assert.equal(shellCommand('nmem', ['--json', 'it\'s'], 'win32'), "nmem --json 'it''s'")
  assert.equal(shellCommand('C:/tools/nmem.exe', ['--json'], 'win32'), 'C:/tools/nmem.exe --json')
  assert.equal(shellCommand('C:\\Program Files\\nmem.exe', ['--json'], 'win32'), "& 'C:\\Program Files\\nmem.exe' --json")
  assert.equal(shellCommand('/opt/my tools/nmem', ['--json'], 'linux'), "'/opt/my tools/nmem' --json")
})

function findPowerShell() {
  for (const exe of ['pwsh', 'powershell']) {
    const probe = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', '1'], { encoding: 'utf8' })
    if (probe.status === 0) return exe
  }
  return undefined
}

const powerShell = findPowerShell()

test('PowerShell parses each quoted value as one command with one argument', { skip: powerShell === undefined }, () => {
  const exe = powerShell
  const dir = mkdtempSync(join(tmpdir(), 'nmem-quote-'))
  try {
    const script = join(dir, 'parse.ps1')
    const cases = join(dir, 'cases.json')
    writeFileSync(cases, JSON.stringify(VALUES.map(value => `tool ${shellQuote(value, 'win32')}`)))
    writeFileSync(script, [
      '$OutputEncoding = [Text.Encoding]::UTF8',
      '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
      `$lines = [IO.File]::ReadAllText('${cases.replaceAll("'", "''")}', [Text.Encoding]::UTF8) | ConvertFrom-Json`,
      '$out = foreach ($line in $lines) {',
      '  $tokens = $null; $errors = $null',
      '  $ast = [System.Management.Automation.Language.Parser]::ParseInput($line, [ref]$tokens, [ref]$errors)',
      '  $commands = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true)',
      '  $args = @($commands | ForEach-Object { $_.CommandElements } | Select-Object -Skip 1)',
      '  [pscustomobject]@{ errors = $errors.Count; commands = @($commands).Count; args = $args.Count; value = if ($args.Count -eq 1) { $args[0].SafeGetValue() } else { $null } }',
      '}',
      'ConvertTo-Json -InputObject @($out) -Compress',
    ].join('\n'))
    const run = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    const results = JSON.parse(run.stdout)
    assert.equal(results.length, VALUES.length)
    VALUES.forEach((value, index) => {
      const r = results[index]
      assert.deepEqual({ errors: r.errors, commands: r.commands, args: r.args }, { errors: 0, commands: 1, args: 1 }, value)
      assert.equal(r.value, value)
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
