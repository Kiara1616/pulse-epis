$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $repo 'artifacts/presentacion'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$pptxPath = Join-Path $outputDir 'Pulse_EPIS_Segunda_Unidad_2026-11-07_LISTA.pptx'
$pdfPath = Join-Path $outputDir 'Pulse_EPIS_Segunda_Unidad_2026-11-07_LISTA.pdf'
$previewDir = Join-Path $outputDir 'preview-lista'
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = $true
$presentation = $ppt.Presentations.Add()
$presentation.PageSetup.SlideSize = 16

$W = 960
$H = 540
$navy = 0x341F0A
$blue = 0xF45B1F
$lightBlue = 0xFFF4E8
$ink = 0x2B1C0B
$muted = 0x7B6A55
$white = 0xFFFFFF
$green = 0x5AA142
$amber = 0x2C96E8
$red = 0x4B3FE3

function Add-Box {
    param($slide, [double]$x, [double]$y, [double]$w, [double]$h, [int]$fill, [double]$radius = 8)
    $shape = $slide.Shapes.AddShape(5, $x, $y, $w, $h)
    $shape.Fill.ForeColor.RGB = $fill
    $shape.Line.Visible = 0
    return $shape
}

function Add-Text {
    param($slide, [string]$text, [double]$x, [double]$y, [double]$w, [double]$h,
        [double]$size = 20, [int]$color = 0x2B1C0B, [bool]$bold = $false,
        [int]$align = 1, [string]$font = 'Aptos')
    $box = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
    $box.TextFrame.TextRange.Text = $text
    $box.TextFrame.MarginLeft = 0
    $box.TextFrame.MarginRight = 0
    $box.TextFrame.MarginTop = 0
    $box.TextFrame.MarginBottom = 0
    $box.TextFrame.WordWrap = -1
    $box.TextFrame.AutoSize = 0
    $box.TextFrame.TextRange.Font.Name = $font
    $box.TextFrame.TextRange.Font.Size = $size
    $box.TextFrame.TextRange.Font.Bold = [int]$bold
    $box.TextFrame.TextRange.Font.Color.RGB = $color
    $box.TextFrame.TextRange.ParagraphFormat.Alignment = $align
    return $box
}

function Add-Title {
    param($slide, [string]$title, [string]$subtitle = '')
    Add-Text $slide $title 54 38 850 50 28 $navy $true | Out-Null
    if ($subtitle) { Add-Text $slide $subtitle 54 88 850 34 14 $muted $false | Out-Null }
    $line = $slide.Shapes.AddShape(1, 54, 124, 92, 4)
    $line.Fill.ForeColor.RGB = $blue
    $line.Line.Visible = 0
}

function Add-Footer {
    param($slide, [int]$number)
    Add-Text $slide 'Pulse EPIS | Inteligencia de Negocios | 07 nov. 2026' 54 510 720 18 9 $muted $false | Out-Null
    Add-Text $slide "$number" 870 510 36 18 9 $muted $true 3 | Out-Null
}

function Add-ImageFit {
    param($slide, [string]$path, [double]$x, [double]$y, [double]$w, [double]$h)
    if (-not (Test-Path $path)) { throw "No existe la imagen: $path" }
    $pic = $slide.Shapes.AddPicture($path, 0, -1, $x, $y)
    $pic.LockAspectRatio = -1
    if (($pic.Width / $pic.Height) -gt ($w / $h)) {
        $pic.Width = $w
    } else {
        $pic.Height = $h
    }
    $pic.Left = $x + (($w - $pic.Width) / 2)
    $pic.Top = $y + (($h - $pic.Height) / 2)
    return $pic
}

function Add-BulletList {
    param($slide, [string[]]$items, [double]$x, [double]$y, [double]$w, [double]$h, [double]$size = 18)
    $text = ($items | ForEach-Object { "• $_" }) -join "`r`n"
    $box = Add-Text $slide $text $x $y $w $h $size $ink $false
    $box.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 9
    return $box
}

$logo = Join-Path $repo 'docs/recursos/imagenes/upt-logo.png'
$dwDiagram = Join-Path $repo 'artifacts/presentacion/data-warehouse.png'
$etlDiagram = Join-Path $repo 'artifacts/presentacion/etl-periodico.png'
$infraDiagram = Join-Path $repo 'artifacts/presentacion/infraestructura-gcp.png'
$images = Join-Path $repo 'docs/recursos/imagenes'

# 1. Portada
$s = $presentation.Slides.Add(1, 12)
$bg = $s.Shapes.AddShape(1, 0, 0, $W, $H); $bg.Fill.ForeColor.RGB = $navy; $bg.Line.Visible = 0
Add-ImageFit $s $logo 64 58 110 110 | Out-Null
Add-Text $s 'Pulse EPIS' 64 200 560 58 42 $white $true | Out-Null
Add-Text $s 'Arquitectura analítica y BI en GCP' 64 270 720 46 28 0xA9D6FF $true | Out-Null
Add-Text $s 'Entrega de la segunda unidad' 64 330 520 34 18 $white $false | Out-Null
Add-Text $s 'Data Lake · ETL automatizado · Terraform · Costos · 6 dashboards' 64 390 790 30 16 0xD7E7F7 $false | Out-Null
Add-Text $s 'Demostración con datos sintéticos' 64 470 400 22 11 0xA9BFD5 $false | Out-Null

# 2. Cumplimiento
$s = $presentation.Slides.Add(2, 12); Add-Title $s 'Cobertura de los requisitos de la unidad' 'La entrega local ya es reproducible; el despliegue real requiere un proyecto GCP activo.'
$rows = @(
    @('Arquitectura DW / Data Lake', 'Modelo, Data Lake particionado y tres diagramas', 'Completo local'),
    @('ETL automatizado', 'Cloud Run Job, Scheduler, idempotencia y calidad', 'Completo local'),
    @('IaC y costos', 'Terraform válido, presupuesto y estimación mensual', 'Completo local'),
    @('Procesos e infraestructura', 'Mermaid + SVG alineados con Terraform', 'Completo'),
    @('6 dashboards temporales', 'Día, mes, año, periodo, corte y exportación', 'Completo local')
)
$y = 154
foreach ($r in $rows) {
    Add-Text $s $r[0] 62 $y 235 38 16 $navy $true | Out-Null
    Add-Text $s $r[1] 310 $y 420 38 14 $ink $false | Out-Null
    $color = if ($r[2] -eq 'Completo') { $green } else { $amber }
    Add-Text $s $r[2] 760 $y 150 32 13 $color $true 3 | Out-Null
    $line = $s.Shapes.AddLine(62, $y + 46, 900, $y + 46); $line.Line.ForeColor.RGB = 0xE7DED3
    $y += 66
}
Add-Footer $s 2

# 3. Arquitectura DW / Data Lake
$s = $presentation.Slides.Add(3, 12); Add-Title $s 'Arquitectura Data Warehouse y Data Lake' 'GCP como plataforma objetivo, PostgreSQL para el piloto y Cloud Storage para trazabilidad.'
Add-ImageFit $s $dwDiagram 90 160 760 300 | Out-Null
Add-Text $s 'La identidad permanece en la zona operacional restringida. El DW usa claves seudonimizadas.' 72 478 820 25 12 $muted $false 2 | Out-Null
Add-Footer $s 3

# 4. Modelo y grano
$s = $presentation.Slides.Add(4, 12); Add-Title $s 'Modelo dimensional y reglas de conteo' 'Los snapshots conservan el estado de cada periodo y fecha de corte.'
Add-Box $s 64 154 390 278 $lightBlue | Out-Null
Add-Text $s 'Hechos principales' 88 178 320 34 20 $navy $true | Out-Null
Add-BulletList $s @('fact_student_period: un estudiante por periodo y corte','fact_certification: una certificación por habilidad y corte','etl_runs: corrida, hash, estado, aceptados y rechazados') 88 224 330 170 16 | Out-Null
Add-Box $s 500 154 390 278 0xF4FAF4 | Out-Null
Add-Text $s 'Dimensiones lógicas' 524 178 320 34 20 $navy $true | Out-Null
Add-BulletList $s @('Tiempo y periodo académico','Estudiante seudonimizado','Cohorte y ciclo','Emisor, credencial y habilidad','Último corte mensual o anual') 524 224 300 190 14 | Out-Null
Add-Text $s 'Los porcentajes no se suman entre cortes. Una aprobación nueva usa la fecha real de decisión.' 92 452 780 34 14 $blue $true 2 | Out-Null
Add-Footer $s 4

# 5. ETL
$s = $presentation.Slides.Add(5, 12); Add-Title $s 'Proceso ETL periódico automatizado' 'Cloud Scheduler inicia el job y la publicación solo ocurre cuando la calidad cumple los umbrales.'
Add-BulletList $s @('Scheduler ejecuta el job','Se valida periodo y fecha','Hash evita duplicados','Calidad bloquea publicaciones inválidas','La publicación actualiza hechos y manifiesto') 72 170 390 250 16 | Out-Null
Add-ImageFit $s $etlDiagram 520 145 330 340 | Out-Null
Add-Text $s 'La repetición del mismo periodo, corte y hash no duplica datos.' 130 482 700 24 13 $blue $true 2 | Out-Null
Add-Footer $s 5

# 6. Infraestructura
$s = $presentation.Slides.Add(6, 12); Add-Title $s 'Infraestructura objetivo en Google Cloud' 'Servicios independientes para frontend, API, ETL, base de datos, almacenamiento y observabilidad.'
Add-ImageFit $s $infraDiagram 100 172 760 292 | Out-Null
Add-Footer $s 6

# 7. Terraform
$s = $presentation.Slides.Add(7, 12); Add-Title $s 'Infraestructura como código' 'Terraform validado con Google Provider 7.46.2.'
Add-Text $s 'Recursos declarados' 68 154 340 34 20 $navy $true | Out-Null
Add-BulletList $s @('Cloud Run: frontend, API y job ETL','Cloud SQL PostgreSQL 16','Buckets separados para Data Lake y evidencias','Secret Manager, IAM, Logging y Monitoring','Scheduler, Artifact Registry y presupuesto') 68 205 400 235 16 | Out-Null
Add-Box $s 530 166 350 224 $navy | Out-Null
Add-Text $s 'terraform init' 566 202 270 26 18 0xA9D6FF $true | Out-Null
Add-Text $s '✓ proveedores instalados' 566 238 270 24 15 $white $false | Out-Null
Add-Text $s 'terraform validate' 566 286 270 26 18 0xA9D6FF $true | Out-Null
Add-Text $s '✓ configuración válida' 566 322 270 24 15 $white $false | Out-Null
Add-Text $s 'El workflow usa Workload Identity Federation y evita llaves permanentes.' 536 414 340 44 13 $muted $false 2 | Out-Null
Add-Footer $s 7

# 8. Costos
$s = $presentation.Slides.Add(8, 12); Add-Title $s 'Estimación mensual de costos' 'Región southamerica-west1, USD antes de impuestos, créditos y descuentos.'
$table = $s.Shapes.AddTable(7, 3, 92, 156, 776, 264).Table
$headers = @('Componente','Demo','Piloto')
for ($c=1; $c -le 3; $c++) { $table.Cell(1,$c).Shape.TextFrame.TextRange.Text=$headers[$c-1]; $table.Cell(1,$c).Shape.Fill.ForeColor.RGB=$navy; $table.Cell(1,$c).Shape.TextFrame.TextRange.Font.Color.RGB=$white; $table.Cell(1,$c).Shape.TextFrame.TextRange.Font.Bold=-1 }
$costs = @(
    @('Cloud SQL compute','$7.67','$83.27'),@('Cloud SQL SSD','$3.40','$8.50'),@('Cloud Storage','$0.14','$1.20'),
    @('Cloud Run ETL','$0.11','$0.32'),@('Cloud Run reservado','$0.00','$62.34'),@('Total mensual','$11.36','$155.69')
)
for ($r=2; $r -le 7; $r++) { for($c=1;$c -le 3;$c++){ $table.Cell($r,$c).Shape.TextFrame.TextRange.Text=$costs[$r-2][$c-1]; $table.Cell($r,$c).Shape.TextFrame.TextRange.Font.Name='Aptos'; $table.Cell($r,$c).Shape.TextFrame.TextRange.Font.Size=14; if($r -eq 7){$table.Cell($r,$c).Shape.Fill.ForeColor.RGB=$lightBlue; $table.Cell($r,$c).Shape.TextFrame.TextRange.Font.Bold=-1} } }
Add-Text $s 'Cloud SQL concentra el costo base. El escenario demo permite escala a cero en frontend y API.' 106 432 750 38 13 $muted $false 2 | Out-Null
Add-Footer $s 8

# 9. Panorama
$s = $presentation.Slides.Add(9, 12); Add-Title $s 'Reporte 1 · Panorama ejecutivo' 'KPIs, cobertura y tendencia con filtros de año, mes, día, periodo y corte.'
Add-ImageFit $s (Join-Path $images 'bi-panorama.png') 110 150 740 320 | Out-Null
Add-Footer $s 9

# 10. Reportes 2 y 3
$s = $presentation.Slides.Add(10, 12); Add-Title $s 'Evolución y certificaciones' 'Reportes 2 y 3: tendencias, proveedores, credenciales y niveles desde la misma API temporal.'
Add-ImageFit $s (Join-Path $images 'bi-evolucion.png') 70 160 360 275 | Out-Null
Add-ImageFit $s (Join-Path $images 'bi-certificaciones.png') 520 160 360 275 | Out-Null
Add-Text $s 'Evolución diaria, mensual y anual' 68 458 370 24 13 $navy $true 2 | Out-Null
Add-Text $s 'Ranking y participación por proveedor' 518 458 370 24 13 $navy $true 2 | Out-Null
Add-Footer $s 10

# 11. Reportes 4 y 5
$s = $presentation.Slides.Add(11, 12); Add-Title $s 'Reportes 4 y 5: habilidades y cohortes' 'Filtros por habilidad, ciclo, cohorte, periodo y rango temporal.'
Add-ImageFit $s (Join-Path $images 'bi-habilidades.png') 70 158 360 275 | Out-Null
Add-ImageFit $s (Join-Path $images 'bi-cohortes.png') 520 158 360 275 | Out-Null
Add-Text $s 'Cobertura y brechas por habilidad' 68 458 370 24 13 $navy $true 2 | Out-Null
Add-Text $s 'Comparación de cohortes y ciclos' 518 458 370 24 13 $navy $true 2 | Out-Null
Add-Footer $s 11

# 12. Calidad
$s = $presentation.Slides.Add(12, 12); Add-Title $s 'Calidad y trazabilidad ETL' 'Reporte 6 con estado, fuente, periodo, aceptados y rechazados.'
Add-ImageFit $s (Join-Path $images 'bi-calidad.png') 110 150 740 320 | Out-Null
Add-Footer $s 12

# 13. Demostración
$s = $presentation.Slides.Add(13, 12); Add-Title $s 'Demostración del proyecto' 'La defensa conecta el requisito con código, ejecución y evidencia.'
$steps = @(
    @('1','Abrir','http://127.0.0.1:3000/reportes/panorama'),
    @('2','Cambiar','granularidad day, month y year'),
    @('3','Recorrer','los seis reportes y sus exportaciones'),
    @('4','Mostrar','terraform validate y el reporte de costos'),
    @('5','Explicar','que el despliegue GCP requiere proyecto y facturación')
)
$y=150
foreach($step in $steps){
    $circle=$s.Shapes.AddShape(9,70,$y,40,40);$circle.Fill.ForeColor.RGB=$blue;$circle.Line.Visible=0
    Add-Text $s $step[0] 70 ($y+8) 40 22 14 $white $true 2 | Out-Null
    Add-Text $s $step[1] 132 ($y+2) 130 28 16 $navy $true | Out-Null
    Add-Text $s $step[2] 260 ($y+2) 620 44 15 $ink $false | Out-Null
    $y+=66
}
Add-Text $s 'Conclusión: la segunda unidad está completa en local y lista para desplegar cuando GCP esté configurado.' 86 474 790 28 14 $blue $true 2 | Out-Null
Add-Footer $s 13

$presentation.SaveAs($pptxPath, 24)
$presentation.SaveAs($pdfPath, 32)
$presentation.Export($previewDir, 'PNG', 1280, 720)
$presentation.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null

Write-Output "PPTX=$pptxPath"
Write-Output "PDF=$pdfPath"
Write-Output "PREVIEW=$previewDir"
