$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $projectRoot 'tmp/yara-x-v1.20.0.zip'
$destination = Join-Path $projectRoot 'vendor/yara-x'
New-Item -ItemType Directory -Force -Path (Split-Path $archive),$destination | Out-Null
Invoke-WebRequest 'https://github.com/VirusTotal/yara-x/releases/download/v1.20.0/yara-x-v1.20.0-x86_64-pc-windows-msvc.zip' -OutFile $archive
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'b1e2840bac593aea353d2b2b341f5a862c9d61c0c406d9abbbad9e1fa35163a1') { throw 'YARA-X archive SHA-256 mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
Invoke-WebRequest 'https://raw.githubusercontent.com/VirusTotal/yara-x/v1.20.0/LICENSE' -OutFile (Join-Path $destination 'LICENSE')
if (-not (Test-Path -LiteralPath (Join-Path $destination 'yr.exe'))) { throw 'YARA-X executable missing' }
