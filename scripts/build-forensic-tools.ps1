param([Parameter(Mandatory=$true)][string]$Python)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $dependencyPath = Join-Path $projectRoot 'tmp/forensic-packages'
    & $Python -m pip install --upgrade --target $dependencyPath -r scripts/forensic-requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Forensic dependency installation failed' }
    $env:PYTHONPATH = $dependencyPath
    & $Python -m PyInstaller --noconfirm --clean --onedir --name lsip-forensics --distpath vendor/forensics --workpath tmp/forensic-work --specpath tmp --collect-all dissect --collect-all dissect.target --collect-all flow.record --collect-all volatility3 --collect-all colorama --collect-all capstone --collect-all Crypto scripts/forensic-helper.py
    if ($LASTEXITCODE -ne 0) { throw 'Forensic helper build failed' }
    & $Python scripts/forensic-licenses.py
    if ($LASTEXITCODE -ne 0) { throw 'Forensic license inventory failed' }
} finally { Pop-Location }
