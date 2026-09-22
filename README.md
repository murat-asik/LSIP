# LSIP 3.0.2

**Local Security Intelligence Platform**, Windows üzerinde yerel sistem ve ağ verilerini incelemek için geliştirilen bir masaüstü uygulamasıdır. Electron, React, TypeScript ve SQLite kullanır. Türkçe ve İngilizce arayüz içerir.

## Çalışma alanları

| Alan | Kapsam |
| --- | --- |
| Blue Team | Süreçler, ağ bağlantıları, olay kayıtları, DNS, SMB, RDP, USB, dosya bütünlüğü, kalıcılık, IOC ve itibar incelemesi |
| DFIR | SHA-256 doğrulaması, AES-256-GCM ile şifreli delil kopyası, işlem zinciri; Dissect ile disk kalıntıları ve Volatility 3 ile bellek dökümleri |
| Red Team | Yetkili hedefe TCP port taraması, HTTP/TLS, DNS ve RDAP kayıt sorgusu, kayıtlı ölçümlerden saldırı yüzeyi özeti |
| Raporlama | PDF, HTML, JSON ve CSV çıktıları |

Uygulama çevrimdışı başlar. Dış istihbarat sağlayıcılarını kullanmak için bağlantı ve sağlayıcı ayarları etkinleştirilir. Çevrimdışı düğmesi işletim sistemi güvenlik duvarı değildir; kullanıcı tarafından başlatılan ağ keşifleri ayrıca trafik üretebilir.

## Kullanıcı kılavuzu

[30 sayfalık Türkçe PDF kılavuz](output/pdf/LSIP_3_Kurumsal_Kullanim_Kilavuzu_TR.pdf) kurulum, ekranlar, araştırma senaryoları, yedekleme ve sorun giderme adımlarını içerir.

Kılavuzun [kaynak metni](docs/LSIP_Kurumsal_Kullanim_Kilavuzu.md) de depoda bulunur. PDF'nin son düzenlemesinde yalnız paragraf hizalaması iki yana yaslı yapılmış, içeriği değiştirilmemiştir.

## Hazır EXE ile çalıştırma

Sık kullanım için **LSIP_Windows_x64_3.0.2.zip** paketini bir klasöre çıkarıp içindeki **LSIP v3.0.exe** dosyasını çalıştırın. EXE ile birlikte gelen `resources` ve diğer dosyaları aynı klasörde tutun. Bu yöntem her açılışta yeniden arşiv çıkarılmasını önler.

Yayımlanmış sürümün Windows x64 taşınabilir EXE dosyasını bu deponun **Releases** bölümünden indirin. EXE dosyası kaynak deposunda tutulmaz. Dosyayı yerel bir klasöre alın ve çalıştırın. Dış sağlayıcı API anahtarları kullanıcı tarafından Ayarlar ekranında girilir; dağıtım paketi kişisel anahtar veya çalışma veritabanı içermez.

Tek dosyalık taşınabilir EXE, adli analiz araçlarını her açılışta geçici klasöre çıkarır; bu aşama disk ve antivirüs denetimine bağlı olarak zaman alabilir.

Windows erişim izinleri bazı toplayıcıları sınırlayabilir. Yetkili ağ hedefleri ve kurumunuzun inceleme prosedürüyle çalışın. Bu dağıtım için kod imzalama sertifikası tanımlanmamıştır.

## Kaynak koddan kurulum

Bu sürümün hazırlığı Windows üzerinde Node.js 24 ve npm ile yapılmıştır. Windows PowerShell ve ilgili sistem araçlarının kullanılabilir olması gerekir. Adli analiz yardımcı aracını kaynak koddan üretmek için Python 3.12 gerekir. Hazır EXE kullanılırken Python kurulumu gerekmez.

Depoyu indirdikten sonra `package.json` dosyasının bulunduğu klasörde:

```powershell
npm ci
npm run typecheck
npm run build
npm start
```

`npm ci`, kilit dosyasındaki bağımlılık sürümlerini kurar. İlk kurulum için internet erişimi gerekir. `sqlite3` ve `koffi` yerel ikili bileşenler içerir; uygun hazır ikili bulunmazsa derleme araçları gerekebilir.

## Windows EXE oluşturma

Kaynak deposu büyük üçüncü taraf çalıştırılabilir dosyalarını içermez. Paketlemeden önce araçları hazırlayın:

```powershell
./scripts/build-forensic-tools.ps1 -Python python
./scripts/setup-yara.ps1
npm run package
```

Bu komut üretim derlemesini yapar ve Electron Builder ile taşınabilir Windows paketi oluşturur. Sonuç `release/3.0.2-updated/` klasöründedir. `win-unpacked/` ara paketleme çıktısıdır; son kullanıcıya taşınabilir EXE dağıtılır. Paketlemede Electron ve paketleme araçlarının ilk indirmesi için internet erişimi gerekebilir.

## Güvenlik doğrulaması

```powershell
node scripts/security-audit.cjs
node scripts/security-regression.cjs
npm run build
npx --no-install electron scripts/electron-security-smoke.cjs
```

3.0.2 düzeltme doğrulamasında 27 güvenlik beklentisi, mevcut 15 regresyon testi, 13 yeni regresyon ve 7 yeni gerçek Electron senaryosu geçti. Önceki sürümde ayrıca 5 yalıtılmış Electron güvenlik kontrolü uygulanmıştı. Kaynak testleri dış sınırların çoğunda test nesneleri kullanır; dosya ve Electron testleri ayrıca gerçek yerel kaynaklarla çalışır. Sonuçlar `security-audit/` altında üretilir. Test sonuçları tüm müşteri ortamlarının uçtan uca kabul testinin yerine geçmez.

Dil ve çeviri kontrolleri `node scripts/localization-test.cjs` komutuyla çalıştırılır. Paketlenmiş EXE üzerinde dil geçişini de doğrulamak için paketleme tamamlandıktan sonra `node scripts/validate-packaged.cjs` kullanılabilir.

## Mevcut özellik sınırları

- AI Security Analyst yerel kurallarla özet üretir; LLM hizmeti değildir. Yeterli ölçüm yoksa risk bilinmiyor gösterilir.
- IOC Graph, süreç ağacı ve zaman çizelgesi kayıtlı gerçek verileri kullanır. Yeni kurulumda örnek vaka oluşturulmaz. MITRE/Purple Team tabloları analistin vaka eşleştirmelerini gösterir; otomatik doğrulanmış saldırı tespit kapsamı iddiası taşımaz.
- Detection Lab, son 10.000 Windows olayında desteklenen Sigma seçim/koşullarını ve IOC değerlerini çalıştırır. Hunt alan karşılaştırmaları ve AND/OR/NOT koşullarını destekler. Desteklenmeyen kurallar hata verir; başarılı sonuç taklit edilmez. YARA-X, seçilen tek dosyayı en fazla 512 MiB sınırıyla tarar.
- DFIR, Dissect'in desteklediği disk imajı veya Windows dosya koleksiyonunu okur. Canlı Run/RunOnce kayıtları salt okunur alınır. Diğer canlı kalıntılar Windows erişim izinlerine bağlıdır. Bellek analizi mevcut döküm dosyası ve uygun yerel semboller gerektirir; uygulama RAM imajı almaz. Analiz başına en fazla 1.000 kayıt gösterilir.
- Evidence Locker kaynak dosyayı değiştirmeden şifreli kopya alır. Anahtar Windows kullanıcı hesabına bağlı korunur. Kasa ve anahtar dosyasının yedeği birlikte tutulmalıdır; başka kullanıcıya yalnız dosyaları kopyalamak yeterli değildir. Eski delil kayıt ekranı yalnız dosya özetini kaydeder; kasaya kopyalama ayrı işlemdir.
- Ağ keşfi seçilen alt ağdaki ARP önbelleği adaylarını inceler; bütün adreslere gönderim yapan bir alt ağ taraması değildir. Yanıt alınamayan cihaz çevrimiçi kabul edilmez.
- Eklentiler çalışma dizinindeki JavaScript dosyalarını ana uygulama yetkisiyle yükleyebilir. Yalnız güvenilir eklenti kullanın.
- Dış sağlayıcılar için geçerli API anahtarları, kota ve ağ erişimi gerekir. Anahtarsız veya erişilemeyen sağlayıcıların verisi garanti edilemez.

Üçüncü taraf araçların sürüm ve lisans bildirimleri paket içindeki `tools/forensics/licenses/` ve `tools/yara-x/LICENSE` altında bulunur. Dissect bileşenleri AGPL-3.0-or-later, Volatility 3 VSL lisans bilgisini taşır; bunlar LSIP'nin lisansı olarak yorumlanmamalıdır. Yardımcı aracın kaynak giriş noktası ve yeniden üretim betikleri `scripts/` altındadır.

## Depo düzeni

```text
src/                 Uygulama kaynak kodu
scripts/             Geliştirme, güvenlik testleri ve PDF üreticisi
docs/                Kılavuzun kaynak metni
output/pdf/          Kullanıma hazır Türkçe PDF
package.json         Komutlar ve paketleme ayarları
package-lock.json    Kilitlenmiş bağımlılıklar
tsconfig*.json       TypeScript yapılandırması
vite.config.ts       Arayüz derleme ayarları
SECURITY.md          Güvenlik kapsamı ve bildirim bilgisi
CHANGELOG.md         Sürüm notları
```

`node_modules`, `dist`, `release`, çalışma veritabanları, günlükler, geçici dosyalar ve API anahtarları depoya eklenmez. `.gitignore` bunları dışarıda bırakır. Gerçek araştırma verilerini veya kişisel profil klasörlerini GitHub'a yüklemeyin.

## Kılavuzu yeniden üretme

Windows Arial yazı tipleri ve Python ortamında `reportlab` ile `pypdf` gereklidir:

```powershell
python -m pip install reportlab pypdf
python scripts/build-user-guide.py
```

Çıktı `output/pdf/` altında oluşur. PDF'de sayfa düzeni değiştirildiğinde sayfaları görsel olarak kontrol edin.

## Lisans

Bu depoda henüz bir açık kaynak lisansı belirtilmemiştir. Kaynakların yayımlanması, kendiliğinden ticari kullanım veya yeniden dağıtım izni verildiği anlamına gelmez. Lisans koşullarını proje sahibi belirler.


## 3.0.2 doğrulama ve eklenti kullanımı

Desteklenen özellikler ve kullanım sınırları [kapsam belgesinde](docs/SURUM_KAPSAMI.md) bulunur. Yeni hata senaryoları `node scripts/enterprise-regression.cjs` ile; gerçek Electron, dosya ve SQLite kontrolleri `npx --no-install electron scripts/enterprise-integration.cjs` ile çalıştırılır.

Eklenti dizini uygulamanın Windows kullanıcı verisi dizini altındaki `plugins` klasörüdür; çalışma dizinindeki rastgele `plugins` klasörü yüklenmez. Önce uygulamadan Eklentiler ekranını açın. Yalnızca incelediğiniz, güvendiğiniz JavaScript eklentilerini bu dizine koyun. Aynı dizinde `trusted-plugins.json` dosyası dosya adını küçük harfli SHA-256 değerine eşler:

```json
{ "kurum-eklentisi.js": "dosyanin-64-karakterlik-kucuk-harfli-sha256-degeri" }
```

Dosyanın özetini PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath <dosya>` ile hesaplayabilirsiniz. Dosya değiştiğinde inceleme ve güven listesi güncellemesi gerekir. Eklenti `module.exports` üzerinden kimlik bilgilerini, isteğe bağlı asenkron `init()` ve `shutdown()` işlevlerini sunar. Başlangıç süresi 5 saniye, kapatma süresi 2 saniyeyle sınırlıdır. Ayrı iş parçacığı ana pencerenin takılmasını azaltır; dosya sistemi veya ağ izinlerini kısıtlayan bir güvenlik sınırı değildir. Eklentiler mevcut Windows hesabının yetkilerine sahiptir.

Eski kullanıcı kılavuzu değiştirilmemiştir. Bu bölüm yeni davranışlara ek açıklamadır.

## 3.0.2: yedekleme, kaynak durumu ve kayıtlı kurallar

Ayarlar ekranından en az 12 karakterli parolayla şifreli yedek oluşturabilirsiniz. Seçtiğiniz dizinde oluşan `LSIP-backup-...` klasörünün tamamını saklayın; yalnızca manifest dosyası yeterli değildir. Yedek; SQLite veritabanlarını, WAL içindeki tamamlanmış yazmaları, vaka/IOC çalışma alanını, ayarları ve şifreli kanıt kasasını kapsar. Harici orijinal delil dosyaları, eklenti kodları ve Windows kimlik bilgileri kapsam dışındadır.

Geri yükleme aynı Windows hesabı ve bilgisayar içindir; farklı makineye taşıma desteklenmez. Parola kaybolursa yedek açılamaz. Geri yükleme doğrulandıktan sonra uygulamayı ekrandaki düğmeyle yeniden başlatın; yedekten sonraki çalışmalar aktif veri alanında yer değiştirir. Önceki veriler kullanıcı veri dizinindeki `.restore-rollback` altında korunur. Bu işlem Windows yedeği değildir.

Olay kayıtları kanal bazında kalıcı imleçle sayfalanır. Kuyruk, erişim sorunu ve günlük sıfırlanması görünür uyarı üretir. Kaynak erişim hataları artık boş sonuçla aynı kabul edilmez.

Tespit Laboratuvarı ve Tehdit Avcılığı ekranında bir ad verip yeni sürüm kaydedebilirsiniz. Kayıtlı sürümü seçmek içeriği düzenleyiciye yükler; değerlendirme mevcut çalıştır düğmesiyle başlatılır. Sürümler önceki içeriği değiştirmez. Son 200 sürüm listelenir. Kaydetmek kuralın doğrulanmış veya MITRE kapsamının test edilmiş olduğu anlamına gelmez.

Yeni testler: `maintenance-regression.cjs`, `event-pages-integration.cjs`, `backup-integration.cjs`, `workspace-integration.cjs` (`scripts/` altında). Electron tabanlı yedek testini Electron ile; diğerlerini Node ile çalıştırın.
