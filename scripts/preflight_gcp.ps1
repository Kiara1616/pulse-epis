$ErrorActionPreference = 'Stop'

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Falta la herramienta '$Name'."
    }
}

Require-Command terraform

$gcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudCommand) {
    $localGcloud = Join-Path $env:LOCALAPPDATA 'Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
    if (-not (Test-Path $localGcloud)) { throw "Falta la herramienta 'gcloud'." }
    Set-Alias -Name gcloud -Value $localGcloud -Scope Script
}

$account = gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>$null
if (-not $account) {
    throw 'No existe una cuenta activa. Ejecute: gcloud auth login'
}

$project = gcloud config get-value project 2>$null
if (-not $project -or $project -eq '(unset)') {
    throw 'No existe proyecto activo. Ejecute: gcloud config set project PROJECT_ID'
}

$billing = gcloud billing projects describe $project --format='value(billingEnabled)' 2>$null
if ($billing -ne 'True') {
    throw "El proyecto '$project' no tiene facturación habilitada."
}

$requiredApis = @(
    'artifactregistry.googleapis.com',
    'run.googleapis.com',
    'sqladmin.googleapis.com',
    'storage.googleapis.com',
    'secretmanager.googleapis.com',
    'cloudscheduler.googleapis.com',
    'monitoring.googleapis.com'
)
$enabled = @(gcloud services list --enabled --format='value(config.name)' --project $project)
$missing = @($requiredApis | Where-Object { $_ -notin $enabled })

Write-Host "Cuenta: $account"
Write-Host "Proyecto: $project"
Write-Host "Facturación: habilitada"
if ($missing.Count -gt 0) {
    Write-Warning "APIs pendientes: $($missing -join ', ')"
    Write-Host "Para habilitarlas: gcloud services enable $($missing -join ' ') --project $project"
    exit 2
}

terraform -chdir=infra/environments/demo validate
if ($LASTEXITCODE -ne 0) { throw 'Terraform no es válido.' }

Write-Host 'Preflight GCP correcto.' -ForegroundColor Green
