param(
    [switch]$Full,
    [switch]$SkipBrowser
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$results = [System.Collections.Generic.List[object]]::new()

function Add-Check {
    param([string]$Name, [scriptblock]$Action)
    $started = Get-Date
    try {
        & $Action
        $results.Add([pscustomobject]@{
            Check = $Name
            Status = 'OK'
            Seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
            Detail = ''
        })
    } catch {
        $results.Add([pscustomobject]@{
            Check = $Name
            Status = 'ERROR'
            Seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
            Detail = $_.Exception.Message
        })
    }
}

Push-Location $repo
try {
    Add-Check 'API /health' {
        $response = Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 5
        if ($response.status -ne 'ok') { throw 'La API no informó estado ok.' }
    }

    Add-Check 'Dashboard panorama' {
        $response = Invoke-WebRequest 'http://127.0.0.1:3000/reportes/panorama' -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -ne 200) { throw "HTTP $($response.StatusCode)" }
    }

    Add-Check 'Terraform fmt' {
        terraform -chdir=infra/environments/demo fmt -check | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'terraform fmt -check falló.' }
    }

    Add-Check 'Terraform validate' {
        terraform -chdir=infra/environments/demo init -backend=false -input=false | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'terraform init falló.' }
        terraform -chdir=infra/environments/demo validate | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'terraform validate falló.' }
    }

    Add-Check 'Reporte de costos' {
        python infra/costs/estimate.py | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo regenerar el costo.' }
        $estimate = Get-Content -Raw infra/costs/estimate.json | ConvertFrom-Json
        if (-not $estimate) { throw 'El JSON de costos quedó vacío.' }
    }

    if ($Full) {
        Add-Check 'Backend pytest' {
            python -m pytest -q backend/tests | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'Las pruebas backend fallaron.' }
        }

        Add-Check 'Frontend lint' {
            Push-Location dashboard-app
            try { npm run lint | Out-Host; if ($LASTEXITCODE -ne 0) { throw 'Lint falló.' } }
            finally { Pop-Location }
        }

        Add-Check 'Frontend build' {
            Push-Location dashboard-app
            try { npm run build | Out-Host; if ($LASTEXITCODE -ne 0) { throw 'Build falló.' } }
            finally { Pop-Location }
        }

        if (-not $SkipBrowser) {
            Add-Check 'E2E seis reportes BI' {
                Push-Location dashboard-app
                try {
                    npx playwright test -c playwright.local.config.ts e2e-real/reports.spec.ts | Out-Host
                    if ($LASTEXITCODE -ne 0) { throw 'E2E BI falló.' }
                } finally { Pop-Location }
            }
        }
    }
} finally {
    Pop-Location
}

$results | Format-Table -AutoSize
$failed = @($results | Where-Object Status -eq 'ERROR')
if ($failed.Count -gt 0) {
    Write-Error "Preflight incompleto: $($failed.Count) verificación(es) fallaron."
    exit 1
}

Write-Host 'Preflight U2 correcto.' -ForegroundColor Green

