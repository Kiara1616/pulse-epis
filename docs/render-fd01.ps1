[CmdletBinding()]
param(
    [string]$OutputPath = "docs/FD01-Informe-Factibilidad.pdf"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$inputPath = Join-Path $repoRoot "docs/FD01-Informe-Factibilidad.md"
$outputFullPath = Join-Path $repoRoot $OutputPath

if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) {
    throw "No se encontró el documento fuente: $inputPath"
}

if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) {
    throw "No se encontro Pandoc. Instala Pandoc 3.x y vuelve a ejecutar este script."
}

$pdfEngine = $null
if (Get-Command xelatex -ErrorAction SilentlyContinue) {
    $pdfEngine = "xelatex"
} elseif (Get-Command tectonic -ErrorAction SilentlyContinue) {
    $pdfEngine = "tectonic"
} else {
    throw "No se encontro XeLaTeX ni Tectonic. Instala uno de los dos motores PDF y vuelve a ejecutar este script."
}

$outputDirectory = Split-Path -Parent $outputFullPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$pandocArgs = @(
    $inputPath,
    "--from=gfm",
    "--standalone",
    "--toc",
    "--number-sections",
    "--pdf-engine=$pdfEngine",
    "--metadata", "title=Informe de Factibilidad - Pulse EPIS",
    "--metadata", "author=Kiara Holly Zapana Murillo; Vincenzo Rafael Lllanos Niño",
    "--metadata", "date=2026-09-11",
    "--variable", "geometry:margin=2.2cm",
    "--resource-path=$repoRoot",
    "--output=$outputFullPath"
)

& pandoc @pandocArgs
if ($LASTEXITCODE -ne 0) {
    throw "Pandoc termino con codigo de salida $LASTEXITCODE. No se genero un PDF valido."
}

Write-Output "PDF generado: $outputFullPath"
