param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $targetRoot) { throw 'Destination already exists; choose a new delivery directory' }
$repo = Join-Path $targetRoot 'GitHub-Repo'
$releases = Join-Path $targetRoot 'GitHub-Releases'
New-Item -ItemType Directory -Path $repo,$releases | Out-Null
foreach ($directory in @('src')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $directory) -Destination $repo -Recurse
}
$publicDocs = Join-Path $repo 'docs'
New-Item -ItemType Directory -Path $publicDocs | Out-Null
foreach ($name in @('LSIP_Kurumsal_Kullanim_Kilavuzu.md','BILESEN_ENVANTERI.json','SURUM_KAPSAMI.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot "docs/$name") -Destination $publicDocs
}
$scriptDirectory=Join-Path $repo 'scripts'
New-Item -ItemType Directory -Path $scriptDirectory | Out-Null
foreach($name in @('provider-acceptance.cjs','forensic-negative-acceptance.cjs','upgrade-acceptance.cjs','prepare-customer-delivery.ps1','maintenance-regression.cjs','backup-integration.cjs','event-pages-integration.cjs','workspace-integration.cjs','dev.js','enterprise-regression.cjs','enterprise-integration.cjs','build-user-guide.py','build-forensic-tools.ps1','forensic-helper.py','forensic-licenses.py','forensic-requirements.txt','setup-yara.ps1','prepare-delivery.ps1','dfir-integration.cjs','electron-security-smoke.cjs','localization-test.cjs','module-integration.cjs','network-scope-test.cjs','rule-engine-test.cjs','security-audit.cjs','security-regression.cjs','ui-integration.cjs','validate-packaged.cjs')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot "scripts/$name") -Destination $scriptDirectory
}
foreach ($name in @('.gitignore','README.md','CHANGELOG.md','SECURITY.md','package.json','package-lock.json','eslint.config.mjs','tsconfig.json','tsconfig.main.json','tsconfig.renderer.json','vite.config.ts')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $repo
}
$pdfDirectory=Join-Path $repo 'output/pdf'
New-Item -ItemType Directory -Path $pdfDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'output/pdf/LSIP_3_Kurumsal_Kullanim_Kilavuzu_TR.pdf') -Destination $pdfDirectory
$releasePackage=Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$releaseVersion=$releasePackage.version
$releaseDirectory=Join-Path $projectRoot $releasePackage.build.directories.output
$executableName="LSIP v3.0 $releaseVersion.exe"
$executable = Join-Path $releaseDirectory $executableName
Copy-Item -LiteralPath $executable -Destination $releases
$hash=(Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $executableName" | Set-Content -LiteralPath (Join-Path $releases 'SHA256SUMS.txt') -Encoding utf8
$zip=Join-Path $releaseDirectory "LSIP_Windows_x64_$releaseVersion.zip"
if(Test-Path -LiteralPath $zip) {
    Copy-Item -LiteralPath $zip -Destination $releases
    $zipHash=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    "$zipHash  LSIP_Windows_x64_$releaseVersion.zip" | Add-Content -LiteralPath (Join-Path $releases 'SHA256SUMS.txt') -Encoding utf8
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'CHANGELOG.md') -Destination (Join-Path $releases 'SURUM_NOTLARI.md')
@'
# GitHub'a hangi dosyaları yüklemelisiniz?

1. GitHub-Repo klasörünün içindekileri deponun ana dizinine yükleyin. README.md dosyası ana dizinde görünmelidir.
2. GitHub-Releases içindeki EXE ve SHA256SUMS.txt dosyalarını GitHub'ın Releases bölümünde sürüm eki olarak yükleyin. EXE'yi kaynak deposuna eklemeyin.
3. SURUM_NOTLARI.md içeriğini sürüm açıklamasında kullanabilirsiniz.
4. Bu teslim klasörünün tamamını tek seferde deponun içine yüklemeyin. ONCE_BUNU_OKU.md ve DOSYA_MANIFESTI.json sizin teslim kontrol dosyalarınızdır.

Paket kişisel API anahtarı, veritabanı, delil, tarama günlüğü veya node_modules içermez. Kaynak koddan tekrar EXE oluşturma adımları README.md içindedir. Adli analiz motorlarının kaynak derlemesi ek kurulum gerektirir; hazır EXE araçları içerir.

PDF kılavuzunun mevcut içeriği korunmuştur. Bu sürümde eklenen işlevler ve sınırlamalar README.md ve CHANGELOG.md dosyalarında açıklanır.

Dosyalar GitHub'a otomatik yüklenmemiştir.
'@ | Set-Content -LiteralPath (Join-Path $targetRoot 'ONCE_BUNU_OKU.md') -Encoding utf8
$manifest = Get-ChildItem -LiteralPath $targetRoot -File -Recurse | ForEach-Object {
    [pscustomobject]@{path=[IO.Path]::GetRelativePath($targetRoot,$_.FullName);bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $targetRoot 'DOSYA_MANIFESTI.json') -Encoding utf8
Write-Output ([pscustomobject]@{destination=$targetRoot;files=$manifest.Count;exeSHA256=$hash}|ConvertTo-Json -Compress)
