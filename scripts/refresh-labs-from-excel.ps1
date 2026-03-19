$ErrorActionPreference = 'Stop'

$excelPath = Join-Path $PWD 'NIE_Lab_Schedule_Corrected.xlsx'
if (-not (Test-Path $excelPath)) {
  throw "Excel file not found: $excelPath"
}

function Convert-To24([string]$timeText) {
  $t = $timeText.Trim()
  if ($t -notmatch '^(\d{1,2}):(\d{2})$') { return $null }

  $h = [int]$Matches[1]
  $m = [int]$Matches[2]

  # Timetable sheet uses 12-hour style without AM/PM.
  # Treat 01:xx..04:xx as afternoon lab slots.
  if ($h -le 4) { $h += 12 }

  return ('{0:D2}:{1:D2}' -f $h, $m)
}

function Parse-TimeRange([string]$slot) {
  if ([string]::IsNullOrWhiteSpace($slot)) { return $null }

  $normalized = ($slot -replace '\s','')
  $parts = $normalized -split '[–-]'
  if ($parts.Count -lt 2) { return $null }

  $start = Convert-To24 $parts[0]
  $end   = Convert-To24 $parts[1]

  if (-not $start -or -not $end) { return $null }
  return @{ start = $start; end = $end }
}

$excel = $null
$wb = $null
$ws = $null
$range = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $wb = $excel.Workbooks.Open($excelPath)
  $ws = $wb.Worksheets.Item(1)
  $range = $ws.UsedRange

  $rows = $range.Rows.Count
  $data = New-Object System.Collections.Generic.List[object]

  for ($row = 1; $row -le $rows; $row++) {
    $semester = ([string]$range.Cells.Item($row,1).Text).Trim()
    $dept     = ([string]$range.Cells.Item($row,2).Text).Trim()
    $section  = ([string]$range.Cells.Item($row,3).Text).Trim()
    $labName      = ([string]$range.Cells.Item($row,4).Text).Trim()
    $labRoom      = ([string]$range.Cells.Item($row,5).Text).Trim()
    $batchRaw     = ([string]$range.Cells.Item($row,6).Text).Trim()
    $instructors  = ([string]$range.Cells.Item($row,7).Text).Trim()
    $day          = ([string]$range.Cells.Item($row,8).Text).Trim()
    $slot         = ([string]$range.Cells.Item($row,9).Text).Trim()

    $semOk = $semester -in @('II','IV','VI')
    $dayOk = $day -in @('Monday','Tuesday','Wednesday','Thursday','Friday')
    $hasCore = -not [string]::IsNullOrWhiteSpace($labName) -and -not [string]::IsNullOrWhiteSpace($batchRaw)

    if ($row -le 8) {
      Write-Output ("DBG row=" + $row + " sem='" + $semester + "' day='" + $day + "' slot='" + $slot + "' semOk=" + $semOk + " dayOk=" + $dayOk + " hasCore=" + $hasCore)
    }

    if (-not $semOk) { continue }
    if (-not $dayOk) { continue }
    if (-not $hasCore) { continue }

    $timeRange = Parse-TimeRange $slot
    if (-not $timeRange) { continue }

    $batch = $batchRaw
    $faculty = $instructors
    if (-not [string]::IsNullOrWhiteSpace($faculty) -and $faculty -notin @('-', 'NA', 'N/A')) {
      $batch = "$batch ($faculty)"
    }

    $data.Add([ordered]@{
      semester = $semester
      dept     = $dept
      section  = $section
      lab_name = $labName
      lab_room = $labRoom
      batch    = $batch
      day      = $day
      start    = $timeRange.start
      end      = $timeRange.end
    })
  }

  Write-Output ("POST_LOOP_ROWS=" + $data.Count)

  $labJson = $data | ConvertTo-Json -Depth 6

  $labsHtmlPath = Join-Path $PWD 'pages/labs.html'
  $content = Get-Content $labsHtmlPath -Raw

  $pattern = 'const LAB_DATA\s*=\s*[\s\S]*?const DAYS_ORDER\s*=\s*\['
  if ($content -notmatch $pattern) {
    throw 'Could not find LAB_DATA block markers in pages/labs.html'
  }

  $replacement = "const LAB_DATA = $labJson;`r`nconst DAYS_ORDER = ["
  $newContent = [System.Text.RegularExpressions.Regex]::Replace(
    $content,
    $pattern,
    $replacement,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )

  Set-Content -Path $labsHtmlPath -Value $newContent -Encoding UTF8

  Write-Output ("UPDATED_ROWS=" + $data.Count)
}
finally {
  if ($wb) { $wb.Close($false) | Out-Null }
  if ($excel) { $excel.Quit() }

  if ($range) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($range) }
  if ($ws) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) }
  if ($wb) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) }
  if ($excel) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
