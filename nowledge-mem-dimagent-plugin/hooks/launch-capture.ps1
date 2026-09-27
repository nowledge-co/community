$PSModuleAutoLoadingPreference = 'None'
$captureScript = [System.IO.Path]::Combine($PSScriptRoot, 'nmem-capture.py')

# Avoid cmd.exe's implicit cwd lookup, including for Python itself.
foreach ($interpreter in @('py.exe', 'python.exe', 'python3.exe')) {
    foreach ($entry in ($env:PATH -split ';')) {
        $directory = $entry.Trim().Trim('"')
        if ($directory -notmatch '^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)') {
            continue
        }
        $candidate = [System.IO.Path]::Combine($directory, $interpreter)
        if (-not [System.IO.File]::Exists($candidate)) {
            continue
        }
        $pythonArguments = @('-I', $captureScript)
        if ($interpreter -eq 'py.exe') {
            $pythonArguments = @('-3') + $pythonArguments
        }
        & $candidate @pythonArguments
        if ($LASTEXITCODE -eq 0) {
            exit 0
        }
    }
}
try {
    $bootstrapRoot = $env:DIMCODE_HOME
    if ([string]::IsNullOrWhiteSpace($bootstrapRoot)) {
        $bootstrapRoot = [System.IO.Path]::Combine(
            [Environment]::GetFolderPath('UserProfile'), '.dim')
    }
    $logDirectory = [System.IO.Path]::Combine($bootstrapRoot, 'logs')
    [void][System.IO.Directory]::CreateDirectory($logDirectory)
    # A fixed overwrite stays bounded even when Python never starts.
    [System.IO.File]::WriteAllText(
        [System.IO.Path]::Combine($logDirectory, 'nowledge-mem-capture-bootstrap.log'),
        "capture skipped: trusted Python launcher unavailable or failed`n")
} catch {
    # Diagnostic failures must not block the host.
}
exit 0
