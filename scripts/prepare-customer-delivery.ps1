param([string]$Version = '3.0.2')
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid release version' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$releaseRoot = Join-Path $projectRoot $(if ($Version -eq $package.version) { $package.build.directories.output } else { "release/$Version" })
$targetRoot = Join-Path $projectRoot "output/customer/LSIP_$Version"
if (Test-Path -LiteralPath $targetRoot) { throw 'Customer package already exists; do not overwrite delivered files' }
$files = @("LSIP v3.0 $Version.exe", "LSIP_Windows_x64_$Version.zip")
foreach ($name in $files) { if (!(Test-Path -LiteralPath (Join-Path $releaseRoot $name))) { throw "Missing release artifact: $name" } }
New-Item -ItemType Directory -Path $targetRoot | Out-Null
foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $releaseRoot $name) -Destination $targetRoot }
Copy-Item -LiteralPath (Join-Path $projectRoot 'output/pdf/LSIP_3_Kurumsal_Kullanim_Kilavuzu_TR.pdf') -Destination $targetRoot
@"
LSIP $Version — Windows x64

Başlamak için LSIP v3.0 $Version.exe dosyasını çalıştırın.
ZIP aynı sürümün alternatif dağıtımıdır; kullanmak için tamamını bir klasöre çıkarın.
Türkçe PDF kullanım kılavuzu bu klasördedir.

Uygulama yerel bir masaüstü analiz aracıdır. Merkezi kullanıcı yönetimi ve SSO içermez.
İlk açılış çevrimdışıdır. Dış istihbarat için ilgili sağlayıcı hesapları ve anahtarları gerekir.
Yedek geri yükleme aynı Windows hesabı/bilgisayarıyla sınırlıdır.
EXE dijital olarak imzalanmamıştır.
Üçüncü taraf araçların lisans bildirimleri ZIP içindeki resources/tools dizinindedir.

Bu paket geliştirme raporlarını, test betiklerini veya kaynak deposunu içermez.
Electron uygulamasının çalışabilmesi için derlenmiş kodu EXE içinde bulunur;
bu dağıtım biçimi kodun incelenemeyeceği anlamına gelmez.

SHA256SUMS.txt gizli anahtar içermez; dosya bütünlüğünü kontrol etmek içindir.
PowerShell: Get-FileHash -Algorithm SHA256 -LiteralPath '.\LSIP v3.0 $Version.exe'
"@ | Set-Content -LiteralPath (Join-Path $targetRoot 'BASLAMADAN_ONCE.txt') -Encoding utf8
$hashLines = Get-ChildItem -LiteralPath $targetRoot -File | ForEach-Object {
    "$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant())  $($_.Name)"
}
$hashLines | Set-Content -LiteralPath (Join-Path $targetRoot 'SHA256SUMS.txt') -Encoding utf8
Write-Output $targetRoot
