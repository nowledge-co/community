# Starts a Nowledge Mem hook for Dim with an isolated Python interpreter.
#
# Python is selected from absolute PATH entries only, so a relative PATH entry
# or the working directory can never supply the interpreter. The hook is
# fail-open: when no trusted interpreter exists this exits 0 and Dim continues.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$event = if ($args.Count -gt 0) { [string]$args[0] } else { '' }
if ($event -eq 'prompt') {
  # Static text; printing it here avoids starting Python on every prompt.
  $null = [Console]::In.ReadToEnd()
  [Console]::Out.Write('{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[Nowledge Mem] Before concluding work that depends on prior context, run one targeted memory or thread search. The startup briefing can be stale; read Working Memory again for the current view. Keep the configured identity and Space. Report retrieval failures briefly, never as no matches."}}' + "`n")
  exit 0
}
switch ($event) {
  'context' { $script = 'nmem_hook.py' }
  'capture' { $script = 'nmem_capture.py' }
  default { exit 0 }
}
$python = $null
foreach ($name in @('python3.exe', 'python.exe')) {
  foreach ($entry in ($env:PATH -split ';')) {
    if ([string]::IsNullOrWhiteSpace($entry)) { continue }
    if (-not [System.IO.Path]::IsPathRooted($entry)) { continue }
    $candidate = Join-Path $entry $name
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $python = $candidate; break }
  }
  if ($python) { break }
}
if (-not $python) { exit 0 }
& $python -I (Join-Path $here $script) $event
exit $LASTEXITCODE
