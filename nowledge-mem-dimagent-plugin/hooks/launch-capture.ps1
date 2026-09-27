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
exit 0
