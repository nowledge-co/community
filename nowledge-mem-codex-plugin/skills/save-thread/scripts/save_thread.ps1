$ErrorActionPreference = "Stop"

function Add-NmemCandidate {
    param(
        [System.Collections.Generic.List[string]]$Candidates,
        [string]$Root,
        [string]$RelativePath
    )
    if (-not [string]::IsNullOrWhiteSpace($Root)) {
        $Candidates.Add((Join-Path $Root $RelativePath))
    }
}

$nmem = $null
if (-not [string]::IsNullOrWhiteSpace($env:NMEM_CLI_PATH) -and
    (Test-Path -LiteralPath $env:NMEM_CLI_PATH -PathType Leaf)) {
    $nmem = $env:NMEM_CLI_PATH
}

if ($null -eq $nmem) {
    foreach ($name in @("nmem", "nmem.cmd", "nmem.exe")) {
        $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $command) {
            $nmem = $command.Source
            break
        }
    }
}

if ($null -eq $nmem) {
    $candidates = [System.Collections.Generic.List[string]]::new()
    Add-NmemCandidate $candidates $env:LOCALAPPDATA "Nowledge Mem CLI\bin\nmem.cmd"
    Add-NmemCandidate $candidates $env:LOCALAPPDATA "Programs\Nowledge Mem\cli\nmem.cmd"
    Add-NmemCandidate $candidates $env:LOCALAPPDATA "Nowledge Mem\cli\nmem.cmd"
    Add-NmemCandidate $candidates $env:PROGRAMFILES "Nowledge Mem\cli\nmem.cmd"
    Add-NmemCandidate $candidates ${env:PROGRAMFILES(X86)} "Nowledge Mem\cli\nmem.cmd"
    Add-NmemCandidate $candidates $env:PROGRAMW6432 "Nowledge Mem\cli\nmem.cmd"
    Add-NmemCandidate $candidates $env:APPDATA "npm\nmem.cmd"

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $nmem = $candidate
            break
        }
    }
}

if ($null -eq $nmem) {
    [Console]::Error.WriteLine(
        "nmem is not installed. In Nowledge Mem, open Settings > Preferences > Developer Tools and install or repair the CLI."
    )
    exit 127
}

try {
    & $nmem @args
    exit $LASTEXITCODE
} catch {
    [Console]::Error.WriteLine("failed to launch nmem at ${nmem}: $($_.Exception.Message)")
    exit 126
}
