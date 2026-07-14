# Keep this web installer ASCII-only and BOM-free. It must run through both
# Windows PowerShell 5.1's `irm | iex` path and direct local file execution.
param(
    [switch]$Mcp,
    [string]$HermesHome = $env:HERMES_HOME
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($HermesHome)) {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        throw "LOCALAPPDATA is unavailable. Set HERMES_HOME and retry."
    }
    $HermesHome = Join-Path $env:LOCALAPPDATA "hermes"
}
$HermesHome = [IO.Path]::GetFullPath($HermesHome)
$ConfigPath = Join-Path $HermesHome "config.yaml"
$BaseUrl = "https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes"
$PluginFiles = @("plugin.yaml", "__init__.py", "provider.py", "client.py", "skill_outcome.py")
$Utf8NoBom = [Text.UTF8Encoding]::new($false)

function Write-Utf8File([string]$Path, [string]$Content) {
    [IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Get-InstallerFile([string]$Name, [string]$Destination) {
    $LocalPath = if ($PSScriptRoot) { Join-Path $PSScriptRoot $Name } else { $null }
    if ($LocalPath -and (Test-Path -LiteralPath $LocalPath -PathType Leaf)) {
        Copy-Item -LiteralPath $LocalPath -Destination $Destination -Force
        return
    }
    Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/$Name" -OutFile $Destination
}

function Resolve-PythonLauncher {
    foreach ($Name in @("python", "python3")) {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue
        if ($Command) {
            & $Command.Source -c "import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)"
            if ($LASTEXITCODE -eq 0) {
                return @{ Command = $Command.Source; Prefix = @() }
            }
        }
    }
    $Py = Get-Command "py" -ErrorAction SilentlyContinue
    if ($Py) {
        & $Py.Source -3 -c "import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)"
        if ($LASTEXITCODE -eq 0) {
            return @{ Command = $Py.Source; Prefix = @("-3") }
        }
    }
    return $null
}

function Test-PluginStage([string]$Stage, [hashtable]$Python) {
    $Validation = @'
import ast
from pathlib import Path
import sys

target = Path(sys.argv[1])
expected = {"plugin.yaml", "__init__.py", "provider.py", "client.py", "skill_outcome.py"}
missing_files = sorted(name for name in expected if not (target / name).is_file())
if missing_files:
    raise SystemExit("missing plugin files: " + ", ".join(missing_files))

missing_modules = []
for path in sorted(target.glob("*.py")):
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(path))
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or node.level < 1 or not node.module:
            continue
        module = node.module.split(".", 1)[0]
        if not (target / f"{module}.py").is_file() and not (target / module / "__init__.py").is_file():
            missing_modules.append(f"{path.name}: .{node.module}")
    compile(source, str(path), "exec")
if missing_modules:
    raise SystemExit("missing installed plugin modules: " + ", ".join(sorted(set(missing_modules))))
'@
    # Windows PowerShell 5 applies native command-line quoting to `python -c`;
    # a multiline script can be truncated or re-tokenized before Python sees it.
    # Execute a staging-only file instead, then remove it before publication.
    $ValidationPath = Join-Path $Stage "_validate_install.py"
    Write-Utf8File $ValidationPath $Validation
    try {
        & $Python.Command @($Python.Prefix) $ValidationPath $Stage
        if ($LASTEXITCODE -ne 0) {
            throw "Downloaded plugin files are incomplete or invalid. The existing plugin was not changed."
        }
    } finally {
        Remove-Item -LiteralPath $ValidationPath -Force -ErrorAction SilentlyContinue
    }
}

function Publish-PluginFiles([string]$Source, [string]$Target, [string]$Label = "") {
    New-Item -ItemType Directory -Path $Target -Force | Out-Null
    foreach ($Name in $PluginFiles) {
        Copy-Item -LiteralPath (Join-Path $Source $Name) -Destination (Join-Path $Target $Name) -Force
        Write-Host "  [ok] $Label$Name"
    }
}

function Set-MemoryProvider([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Utf8File $Path "memory:`n  provider: `"nowledge-mem`"`n"
        return "created"
    }

    $Text = [IO.File]::ReadAllText($Path)
    $HadTrailingNewline = $Text.EndsWith("`n")
    $Lines = [Collections.Generic.List[string]]::new()
    foreach ($Line in ($Text -split "`r?`n")) { $Lines.Add($Line) }
    if ($HadTrailingNewline -and $Lines.Count -gt 0 -and $Lines[$Lines.Count - 1] -eq "") {
        $Lines.RemoveAt($Lines.Count - 1)
    }

    $MemoryIndex = -1
    for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
        if ($Lines[$Index] -match '^memory:\s*(#.*)?$') { $MemoryIndex = $Index; break }
    }
    if ($MemoryIndex -lt 0) {
        if ($Lines.Count -gt 0 -and $Lines[$Lines.Count - 1] -ne "") { $Lines.Add("") }
        $Lines.Add("memory:")
        $Lines.Add('  provider: "nowledge-mem"')
        Write-Utf8File $Path (($Lines -join "`n") + "`n")
        return "added-memory"
    }

    $BlockEnd = $Lines.Count
    for ($Index = $MemoryIndex + 1; $Index -lt $Lines.Count; $Index++) {
        $Line = $Lines[$Index]
        if ([string]::IsNullOrWhiteSpace($Line) -or $Line.TrimStart().StartsWith("#")) { continue }
        if ($Line -notmatch '^\s') { $BlockEnd = $Index; break }
    }
    $ChildIndent = "  "
    for ($Index = $MemoryIndex + 1; $Index -lt $BlockEnd; $Index++) {
        if ($Lines[$Index] -match '^(\s+)\S') { $ChildIndent = $Matches[1]; break }
    }
    for ($Index = $MemoryIndex + 1; $Index -lt $BlockEnd; $Index++) {
        if ($Lines[$Index] -notmatch '^(\s*)provider:\s*(.*?)\s*(#.*)?$') { continue }
        $Indent = if ($Matches[1]) { $Matches[1] } else { $ChildIndent }
        $Value = $Matches[2].Trim()
        if ($Value -in @("nowledge-mem", '"nowledge-mem"', "'nowledge-mem'")) { return "already" }
        if ($Value -in @("", '""', "''")) {
            $Lines[$Index] = $Indent + 'provider: "nowledge-mem"'
            Write-Utf8File $Path (($Lines -join "`n") + $(if ($HadTrailingNewline) { "`n" } else { "" }))
            return "updated-empty"
        }
        return "conflict:$Value"
    }

    $Lines.Insert($MemoryIndex + 1, $ChildIndent + 'provider: "nowledge-mem"')
    Write-Utf8File $Path (($Lines -join "`n") + $(if ($HadTrailingNewline) { "`n" } else { "" }))
    return "inserted"
}

function Test-LegacyProviderDiscovery([string]$MemoryDir) {
    $Discovery = Join-Path $MemoryDir "__init__.py"
    if (-not (Test-Path -LiteralPath $Discovery -PathType Leaf)) { return $false }
    $Text = [IO.File]::ReadAllText($Discovery)
    return -not ($Text.Contains("_get_user_plugins_dir") -or $Text.Contains("HERMES_HOME/plugins"))
}

function Install-McpMode {
    $SoulPath = Join-Path $HermesHome "SOUL.md"
    $Marker = "# Nowledge Mem for Hermes"
    $McpReady = $false

    if ((Test-Path -LiteralPath $ConfigPath) -and ([IO.File]::ReadAllText($ConfigPath).Contains("nowledge-mem"))) {
        Write-Host "[ok] MCP server already in $ConfigPath"
        $McpReady = $true
    } elseif (-not (Test-Path -LiteralPath $ConfigPath)) {
        Write-Utf8File $ConfigPath "mcp_servers:`n  nowledge-mem:`n    url: `"http://127.0.0.1:14242/mcp/`"`n    timeout: 120`n"
        Write-Host "[ok] Created $ConfigPath with Nowledge Mem MCP server"
        $McpReady = $true
    } else {
        Write-Host "`n[action needed] $ConfigPath exists but does not contain nowledge-mem."
        Write-Host "Add this under the existing mcp_servers block:"
        Write-Host "  nowledge-mem:"
        Write-Host '    url: "http://127.0.0.1:14242/mcp/"'
        Write-Host "    timeout: 120"
    }

    if ((Test-Path -LiteralPath $SoulPath) -and ([IO.File]::ReadAllText($SoulPath).Contains($Marker))) {
        Write-Host "[ok] Behavioral guidance already in $SoulPath"
    } else {
        $GuidanceStage = Join-Path ([IO.Path]::GetTempPath()) ("nowledge-mem-hermes-guidance-" + [guid]::NewGuid())
        try {
            Get-InstallerFile "AGENTS.md" $GuidanceStage
            $Guidance = [IO.File]::ReadAllText($GuidanceStage)
            if (-not $Guidance.Contains($Marker)) { throw "Downloaded guidance is invalid." }
            if (Test-Path -LiteralPath $SoulPath) {
                [IO.File]::AppendAllText($SoulPath, "`n`n---`n`n$Guidance`n", $Utf8NoBom)
                Write-Host "[ok] Appended Nowledge Mem guidance to $SoulPath"
            } else {
                Write-Utf8File $SoulPath ($Guidance + "`n")
                Write-Host "[ok] Created $SoulPath with Nowledge Mem guidance"
            }
        } finally {
            Remove-Item -LiteralPath $GuidanceStage -Force -ErrorAction SilentlyContinue
        }
    }

    if ($McpReady) {
        Write-Host "`nSetup complete. Restart Hermes, then test:"
        Write-Host '  "Search my memories for recent decisions"'
    } else {
        Write-Host "`nBehavioral guidance is ready, but MCP config needs the manual addition above."
    }
}

Write-Host "[*] Hermes home: $HermesHome"
New-Item -ItemType Directory -Path $HermesHome -Force | Out-Null

if (-not (Get-Command nmem -ErrorAction SilentlyContinue)) {
    $ManagedNmem = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Nowledge Mem\cli\nmem.cmd" } else { $null }
    if (-not ($ManagedNmem -and (Test-Path -LiteralPath $ManagedNmem))) {
        Write-Warning "nmem is not available. Open Nowledge Mem once or install nmem-cli before using Hermes."
    }
}

if ($Mcp) {
    Install-McpMode
    exit 0
}

$Python = Resolve-PythonLauncher
if (-not $Python) { throw "Python 3 was not found. Install Hermes/Python 3, then retry." }

$StageDir = Join-Path ([IO.Path]::GetTempPath()) ("nowledge-mem-hermes-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $StageDir | Out-Null
try {
    Write-Host "[*] Downloading and validating the Nowledge Mem provider..."
    foreach ($Name in $PluginFiles) {
        Get-InstallerFile $Name (Join-Path $StageDir $Name)
        if ((Get-Item -LiteralPath (Join-Path $StageDir $Name)).Length -eq 0) { throw "$Name is empty." }
    }
    Test-PluginStage $StageDir $Python
    Write-Host "  [ok] Downloaded plugin module closure validated"

    $PluginDir = Join-Path $HermesHome "plugins\nowledge-mem"
    Publish-PluginFiles $StageDir $PluginDir
    Write-Host "  [ok] Plugin module closure validated"

    $LegacyMemoryDir = Join-Path $HermesHome "hermes-agent\plugins\memory"
    if (Test-LegacyProviderDiscovery $LegacyMemoryDir) {
        $LegacyPluginDir = Join-Path $LegacyMemoryDir "nowledge-mem"
        Write-Host "[*] Detected older Hermes provider discovery; installing compatibility copy..."
        Publish-PluginFiles $StageDir $LegacyPluginDir "legacy:"
    }

    $OldPluginDir = Join-Path $HermesHome "plugins\memory\nowledge-mem"
    if ((Test-Path -LiteralPath (Join-Path $OldPluginDir "plugin.yaml")) -and
        ([IO.Path]::GetFullPath($OldPluginDir) -ne [IO.Path]::GetFullPath($PluginDir))) {
        Remove-Item -LiteralPath $OldPluginDir -Recurse -Force
        Write-Host "  [ok] Removed the obsolete plugin path $OldPluginDir"
    }

    $ProviderStatus = Set-MemoryProvider $ConfigPath
    switch -Wildcard ($ProviderStatus) {
        "created" { Write-Host "[ok] Created $ConfigPath with memory.provider: nowledge-mem" }
        "already" { Write-Host "[ok] memory.provider already set in $ConfigPath" }
        "updated-empty" { Write-Host "[ok] Filled empty memory.provider in $ConfigPath" }
        "inserted" { Write-Host "[ok] Added memory.provider under the existing memory block" }
        "added-memory" { Write-Host "[ok] Added memory.provider to $ConfigPath" }
        "conflict:*" {
            $Existing = $ProviderStatus.Substring("conflict:".Length)
            throw "$ConfigPath already sets memory.provider to $Existing. The plugin was updated, but the active provider was not changed."
        }
        default { throw "Could not update memory.provider in $ConfigPath" }
    }

    $PluginYaml = [IO.File]::ReadAllText((Join-Path $PluginDir "plugin.yaml"))
    $Version = if ($PluginYaml -match '(?m)^version:\s*["'']?([^\s"'']+)') { $Matches[1] } else { "unknown" }
    Write-Host "`nPlugin installed to $PluginDir"
    Write-Host "Installed version: $Version"
    Write-Host "Thread import endpoint: /threads/import"
    Write-Host "Restart Hermes, then test:"
    Write-Host '  "Search my memories for recent decisions"'
} finally {
    Remove-Item -LiteralPath $StageDir -Recurse -Force -ErrorAction SilentlyContinue
}
