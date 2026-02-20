$ErrorActionPreference = "Stop"

# Load .env file
if (Test-Path ".env") {
    Write-Host "Loading .env file..." -ForegroundColor Cyan
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*([^#=]+)\s*=\s*(.*)$") {
            $name = $matches[1]
            $value = $matches[2]
            if (-not [string]::IsNullOrWhiteSpace($name)) {
                [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
            }
        }
    }
} else {
    Write-Warning ".env file not found!"
}

# Set config path explicitly
$env:OPENCLAW_CONFIG_PATH = "$PSScriptRoot\openclaw.json"

# Launch Gateway
Write-Host "Starting OpenClaw Gateway..." -ForegroundColor Green
# Using --dev for now to keep the current verified behavior, but with channels enabled
# Removing OPENCLAW_SKIP_CHANNELS to test integrations
node openclaw.mjs gateway --dev
