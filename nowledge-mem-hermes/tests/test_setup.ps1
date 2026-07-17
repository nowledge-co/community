$ErrorActionPreference = "Stop"

$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$Setup = Join-Path $Root "setup.ps1"
$ExpectedVersion = if ([IO.File]::ReadAllText((Join-Path $Root "plugin.yaml")) -match '(?m)^version:\s*([^\s]+)') { $Matches[1] } else { throw "version missing" }
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ("nowledge-mem-hermes-test-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $TempRoot | Out-Null

function Assert([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "[fail] $Message" }
}

try {
    $EmptyHome = Join-Path $TempRoot "empty-provider"
    New-Item -ItemType Directory -Path $EmptyHome | Out-Null
    [IO.File]::WriteAllText((Join-Path $EmptyHome "config.yaml"), "memory:`n  provider: `"`"`n")
    $Output = & $Setup -HermesHome $EmptyHome *>&1 | Out-String
    Assert ($LASTEXITCODE -eq 0) "empty provider install failed"
    Assert (([IO.File]::ReadAllText((Join-Path $EmptyHome "config.yaml"))).Contains('provider: "nowledge-mem"')) "empty provider was not filled"
    Assert (Test-Path -LiteralPath (Join-Path $EmptyHome "plugins\nowledge-mem\skill_outcome.py")) "managed plugin file missing"
    Assert ($Output.Contains("Installed version: $ExpectedVersion")) "installed version not reported"
    Assert ($Output.Contains("Thread import endpoint: /threads/import")) "thread endpoint not reported"

    $MissingHome = Join-Path $TempRoot "missing-provider"
    New-Item -ItemType Directory -Path $MissingHome | Out-Null
    [IO.File]::WriteAllText((Join-Path $MissingHome "config.yaml"), "memory:`n  timeout: 30`n")
    & $Setup -HermesHome $MissingHome | Out-Null
    Assert (([IO.File]::ReadAllText((Join-Path $MissingHome "config.yaml"))).Contains('provider: "nowledge-mem"')) "missing provider was not inserted"

    $ConflictHome = Join-Path $TempRoot "provider-conflict"
    New-Item -ItemType Directory -Path $ConflictHome | Out-Null
    $ConflictConfig = Join-Path $ConflictHome "config.yaml"
    [IO.File]::WriteAllText($ConflictConfig, "memory:`n  provider: `"other-provider`"`n")
    $Failed = $false
    try { & $Setup -HermesHome $ConflictHome 2>&1 | Out-Null } catch { $Failed = $true }
    Assert $Failed "another active provider was overwritten"
    Assert (([IO.File]::ReadAllText($ConflictConfig)).Contains('provider: "other-provider"')) "conflicting provider config changed"

    $IncompleteHome = Join-Path $TempRoot "incomplete-provider"
    $IncompletePlugin = Join-Path $IncompleteHome "plugins\nowledge-mem"
    New-Item -ItemType Directory -Path $IncompletePlugin -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $IncompleteHome "config.yaml"), "memory:`n  provider: `"nowledge-mem`"`n")
    foreach ($PluginFile in @("plugin.yaml", "__init__.py", "provider.py", "client.py")) {
        Copy-Item -LiteralPath (Join-Path $Root $PluginFile) -Destination (Join-Path $IncompletePlugin $PluginFile)
    }
    Assert (-not (Test-Path -LiteralPath (Join-Path $IncompletePlugin "skill_outcome.py"))) "incomplete fixture unexpectedly contains skill_outcome.py"
    $IncompleteOutput = & $Setup -HermesHome $IncompleteHome *>&1 | Out-String
    Assert ($LASTEXITCODE -eq 0) "incomplete provider repair failed"
    Assert (Test-Path -LiteralPath (Join-Path $IncompletePlugin "skill_outcome.py")) "incomplete provider repair did not restore skill_outcome.py"
    Assert ($IncompleteOutput.Contains("Plugin module closure validated")) "repaired provider was not validated"

    $McpHome = Join-Path $TempRoot "mcp"
    & $Setup -Mcp -HermesHome $McpHome | Out-Null
    Assert (([IO.File]::ReadAllText((Join-Path $McpHome "config.yaml"))).Contains("http://127.0.0.1:14242/mcp/")) "MCP config missing"
    Assert (([IO.File]::ReadAllText((Join-Path $McpHome "SOUL.md"))).Contains("# Nowledge Mem for Hermes")) "MCP guidance missing"

    Write-Host "[ok] Hermes native PowerShell installer regression checks passed"
} finally {
    Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
