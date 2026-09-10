param(
  [Parameter(Mandatory = $true)]
  [string]$AsarPath,
  [switch]$KeepRunning,
  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$installedRoot = Join-Path $env:LOCALAPPDATA 'Programs\RetainPDF'
$testRoot = 'D:\RetainPDF-win-test\app-current'
$testExe = Join-Path $testRoot 'RetainPDF.exe'
$testResources = Join-Path $testRoot 'resources'
$installedBackend = Join-Path $installedRoot 'resources\backend'
$backendLink = Join-Path $testResources 'backend'
$stdoutPath = Join-Path $testRoot 'startup.stdout.log'
$stderrPath = Join-Path $testRoot 'startup.stderr.log'
$apiBodyPath = Join-Path $testRoot 'api-smoke.json'
$aiBodyPath = Join-Path $testRoot 'ai-runtime-smoke.json'

if ($testRoot -ne 'D:\RetainPDF-win-test\app-current') {
  throw 'Unexpected Windows smoke-test root'
}
if (-not (Test-Path (Join-Path $installedRoot 'RetainPDF.exe'))) {
  throw "Installed RetainPDF is missing at $installedRoot"
}
if (-not (Test-Path $installedBackend)) {
  throw "Installed Windows backend is missing at $installedBackend"
}
if (-not (Test-Path $AsarPath)) {
  throw "Incoming app.asar is missing at $AsarPath"
}

New-Item -ItemType Directory -Path $testResources -Force | Out-Null
Get-ChildItem $installedRoot -File |
  Where-Object { $_.Name -notlike 'Uninstall*' -and $_.Name -ne 'uninstallerIcon.ico' } |
  Copy-Item -Destination $testRoot -Force
Copy-Item (Join-Path $installedRoot 'locales') (Join-Path $testRoot 'locales') -Recurse -Force
Copy-Item (Join-Path $installedRoot 'resources\elevate.exe') $testResources -Force

if (Test-Path $backendLink) {
  $existingBackend = Get-Item $backendLink -Force
  $isExpectedLink = ($existingBackend.Attributes -band [IO.FileAttributes]::ReparsePoint) -and
    ($existingBackend.Target -contains $installedBackend)
  if (-not $isExpectedLink) {
    throw "$backendLink exists but is not the expected installed-runtime junction"
  }
} else {
  New-Item -ItemType Junction -Path $backendLink -Target $installedBackend | Out-Null
}

$incomingHash = (Get-FileHash -Algorithm SHA256 $AsarPath).Hash.ToLowerInvariant()
$deployedAsar = Join-Path $testResources 'app.asar'
Copy-Item $AsarPath $deployedAsar -Force
$deployedHash = (Get-FileHash -Algorithm SHA256 $deployedAsar).Hash.ToLowerInvariant()
if ($incomingHash -ne $deployedHash) {
  throw 'Deployed app.asar checksum mismatch'
}
Write-Output "[live-smoke] asar-sha256=$deployedHash"

$existingProcesses = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'RetainPDF.exe' }
if ($existingProcesses) {
  throw 'A RetainPDF instance is already running; close it before the Windows smoke test'
}

$env:ELECTRON_ENABLE_LOGGING = '1'
$process = Start-Process -FilePath $testExe -PassThru `
  -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
$passed = $false
Write-Output "[live-smoke] pid=$($process.Id)"

try {
  $gatewayPort = $null
  for ($attempt = 1; $attempt -le $TimeoutSeconds; $attempt++) {
    Start-Sleep -Seconds 1
    $process.Refresh()
    if ($process.HasExited) {
      throw "RetainPDF exited during startup with code $($process.ExitCode)"
    }
    $testPids = @(Get-CimInstance Win32_Process | Where-Object {
      $_.Name -eq 'RetainPDF.exe' -and $_.ExecutablePath -eq $testExe
    } | ForEach-Object { $_.ProcessId })
    if ($testPids.Count -eq 0) {
      continue
    }
    $connection = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {
      $_.OwningProcess -in $testPids -and $_.LocalPort -ge 40000 -and $_.LocalPort -le 40020
    } | Select-Object -First 1
    if ($connection) {
      $gatewayPort = $connection.LocalPort
      break
    }
  }
  if ($null -eq $gatewayPort) {
    throw "Desktop gateway did not become ready within $TimeoutSeconds seconds"
  }
  Write-Output "[live-smoke] gateway-port=$gatewayPort"

  $baseUrl = "http://127.0.0.1:$gatewayPort"
  $html = & curl.exe --fail --silent "$baseUrl/"
  if ($LASTEXITCODE -ne 0) {
    throw 'Gateway root request failed'
  }
  $joinedHtml = $html -join [Environment]::NewLine
  $hasApiKeyField = $joinedHtml -match 'xApiKey'
  $hasDesktopKey = $joinedHtml -match 'retain-pdf-desktop'
  Write-Output "[live-smoke] runtime-config xApiKey=$hasApiKeyField desktop-key=$hasDesktopKey"
  if (-not $hasApiKeyField -or -not $hasDesktopKey) {
    throw 'Injected desktop runtime config is incomplete'
  }

  $apiKeyMatch = [regex]::Match($joinedHtml, '"xApiKey":"([^"]+)"')
  if (-not $apiKeyMatch.Success) {
    throw 'Could not read xApiKey from the injected desktop runtime config'
  }
  $runtimeApiKey = $apiKeyMatch.Groups[1].Value

  $status = & curl.exe --silent --show-error --output $apiBodyPath `
    --write-out '%{http_code}' --header "X-API-Key: $runtimeApiKey" `
    "$baseUrl/api/v1/documents?limit=1"
  if ($LASTEXITCODE -ne 0) {
    throw 'Gateway document API request failed'
  }
  Write-Output "[live-smoke] documents-status=$status"
  if ($status -eq '401') {
    throw 'Gateway proxy did not supply desktop authentication'
  }
  if ([int]$status -lt 200 -or [int]$status -ge 300) {
    throw "Unexpected document API status $status"
  }

  $aiStatus = '000'
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    $aiStatus = & curl.exe --silent --show-error --output $aiBodyPath `
      --write-out '%{http_code}' --header "X-API-Key: $runtimeApiKey" `
      "$baseUrl/api/v1/ai/runtime-config"
    if ($LASTEXITCODE -eq 0 -and [int]$aiStatus -ge 200 -and [int]$aiStatus -lt 300) {
      break
    }
    Start-Sleep -Seconds 1
  }
  Write-Output "[live-smoke] ai-runtime-status=$aiStatus"
  if ([int]$aiStatus -lt 200 -or [int]$aiStatus -ge 300) {
    throw "Unexpected AI runtime API status $aiStatus"
  }

  # If this profile already owns both vault records, the renderer must recover
  # their opaque references on startup and mark first-run complete. Never read
  # or print the stored secret fields.
  $vaultPath = Join-Path $env:APPDATA 'retain-pdf-desktop\data\secrets\credentials.json'
  $desktopConfigPath = Join-Path $env:APPDATA 'retain-pdf-desktop\desktop-config.json'
  if (Test-Path $vaultPath) {
    $vault = Get-Content -Raw $vaultPath | ConvertFrom-Json
    $vaultEntries = @($vault.credentials.PSObject.Properties | ForEach-Object { $_.Value })
    $hasStoredOcr = @($vaultEntries | Where-Object {
      $_.kind -eq 'ocr_provider_token' -and $_.provider -eq 'paddle'
    }).Count -gt 0
    $hasStoredTranslation = @($vaultEntries | Where-Object {
      $_.kind -eq 'translation_api_key'
    }).Count -gt 0
    if ($hasStoredOcr -and $hasStoredTranslation) {
      $restoredConfig = $null
      for ($attempt = 1; $attempt -le 15; $attempt++) {
        if (Test-Path $desktopConfigPath) {
          $candidate = Get-Content -Raw $desktopConfigPath | ConvertFrom-Json
          if ($candidate.firstRunCompleted -and
              -not [string]::IsNullOrWhiteSpace($candidate.ocrCredentialRef) -and
              -not [string]::IsNullOrWhiteSpace($candidate.translationCredentialRef)) {
            $restoredConfig = $candidate
            break
          }
        }
        Start-Sleep -Seconds 1
      }
      if ($null -eq $restoredConfig) {
        throw 'Desktop did not restore stored OCR and translation credential references'
      }
      if ([string]::IsNullOrWhiteSpace($restoredConfig.paddleToken) -or
          [string]::IsNullOrWhiteSpace($restoredConfig.modelApiKey)) {
        throw 'Desktop did not persist visible credential values after vault restoration'
      }
      Write-Output '[live-smoke] stored credential refs and visible values restored; first-run complete'
    }
  }

  $combinedLogs = ''
  if (Test-Path $stdoutPath) {
    $combinedLogs += Get-Content $stdoutPath -Tail 160 | Out-String
  }
  if (Test-Path $stderrPath) {
    $combinedLogs += Get-Content $stderrPath -Tail 160 | Out-String
  }
  if ($combinedLogs -match 'buildDesktopRuntimeConfig is not defined') {
    throw 'Regression reproduced: buildDesktopRuntimeConfig is not defined'
  }
  if ($combinedLogs -match 'Uncaught Exception') {
    throw 'Uncaught Electron exception detected'
  }

  $passed = $true
  Write-Output '[live-smoke] PASS: current ASAR, runtime config, and authenticated proxy work on Windows'
} finally {
  if ($process -and -not $process.HasExited) {
    & taskkill.exe /PID $process.Id /T /F | Out-Null
    Write-Output '[live-smoke] test process tree stopped'
  }
}

if ($passed -and $KeepRunning) {
  $taskName = 'RetainPDF-Desktop-Local-Test'
  $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $action = New-ScheduledTaskAction -Execute $testExe
  $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal `
    -Settings $settings -Force | Out-Null
  try {
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 5
  } finally {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  }
  $interactiveProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'RetainPDF.exe' -and $_.ExecutablePath -eq $testExe -and $_.SessionId -ne 0
  })
  if ($interactiveProcesses.Count -eq 0) {
    throw 'The verified test app could not be launched in the interactive Windows session'
  }
  Write-Output (
    '[live-smoke] interactive app running: ' +
    (($interactiveProcesses | ForEach-Object { "PID=$($_.ProcessId) session=$($_.SessionId)" }) -join ', ')
  )
}
