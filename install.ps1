# install.ps1 — IE Mode native messaging host installer
# Run with: Right-click → "Run with PowerShell"
# No administrator privileges required (writes to HKCU).
#
# Optional: pass -ExtensionId to skip the interactive prompt, e.g.
#   .\install.ps1 -ExtensionId abcdefghijklmnopabcdefghijklmnop

param(
    [string]$ExtensionId = ""
)

$ErrorActionPreference = 'Stop'

# ── Locate IEModeHost.exe ─────────────────────────────────────────────────────

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exeRelative = Join-Path $scriptDir "native\IEModeHost\bin\Release\IEModeHost.exe"
$_resolved = Resolve-Path $exeRelative -ErrorAction SilentlyContinue
$exePath = if ($_resolved) { $_resolved.Path } else { $null }

if (-not $exePath) {
    Write-Host ""
    Write-Host "ERROR: IEModeHost.exe not found at:" -ForegroundColor Red
    Write-Host "  $exeRelative" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure you cloned or downloaded the full repository" -ForegroundColor Yellow
    Write-Host "  (IEModeHost.exe should be included in the release package)"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Found IEModeHost.exe:" -ForegroundColor Green
Write-Host "  $exePath"

# ── Ask for the extension ID (skipped if passed as parameter) ────────────────

if ($ExtensionId) {
    $extId = $ExtensionId.Trim()
    Write-Host ""
    Write-Host "Using extension ID: $extId" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "You need your Chrome/Edge extension ID." -ForegroundColor Cyan
    Write-Host "  Tip: click the IE Mode toolbar button — it shows the ID automatically."
    Write-Host "  Or: chrome://extensions  →  enable Developer mode  →  copy the ID"
    Write-Host "     (looks like: abcdefghijklmnopabcdefghijklmnop)"
    Write-Host ""
    $extId = (Read-Host "Extension ID").Trim()
}

if ($extId -notmatch '^[a-p]{32}$') {
    Write-Host ""
    Write-Host "WARNING: '$extId' doesn't look like a valid extension ID." -ForegroundColor Yellow
    Write-Host "  Expected 32 lowercase letters a-p."
    Write-Host "  You can update com.iemode.host.json manually later."
    Write-Host ""
}

$origin = "chrome-extension://$extId/"

# ── Write the native messaging manifest ──────────────────────────────────────

$manifestPath = Join-Path $scriptDir "native\com.iemode.host.json"

$manifest = @{
    name            = "com.iemode.host"
    description     = "IE Mode native messaging host"
    path            = $exePath
    type            = "stdio"
    allowed_origins = @($origin)
} | ConvertTo-Json -Depth 4

Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8
Write-Host ""
Write-Host "Written: $manifestPath" -ForegroundColor Green

# ── Register in the Windows registry (HKCU, no admin needed) ─────────────────

$chromePath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.iemode.host"
$edgePath   = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.iemode.host"

foreach ($regPath in @($chromePath, $edgePath)) {
    $null = New-Item -Path $regPath -Force
    Set-ItemProperty -Path $regPath -Name "(default)" -Value $manifestPath
    Write-Host "Registered: $regPath" -ForegroundColor Green
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Go to chrome://extensions (or edge://extensions)"
Write-Host "  2. Find 'IE Mode' and click the reload icon (the circular arrow)"
Write-Host "  3. Navigate to any http/https page and click the IE Mode toolbar button"
Write-Host ""
Read-Host "Press Enter to exit"
