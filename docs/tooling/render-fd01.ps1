[CmdletBinding()]
param([string]$PythonCommand = "python")
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location -LiteralPath $repoRoot
try {
    & $PythonCommand "scripts/build_academic_pdfs.py"
    if ($LASTEXITCODE -ne 0) { throw "La generación académica falló con código $LASTEXITCODE." }
    Write-Output "FD01 y los otros cuatro formatos están en artifacts/docs/academico."
} finally { Pop-Location }
