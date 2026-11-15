# Sürüm notları

## 3.0.3 — Bellek kullanımı ve kararlılık / 15 Kasım 2026

- Olay Gezgini'nde mesajı boş olan Windows olayları arayüzün tamamını "UI Crashed" ekranına düşürüyordu; düzeltildi. Her sekme artık kendi hata sınırına sahiptir: bir sayfa hata verirse yalnız o sayfa "Yenile" seçeneğiyle hata gösterir, uygulamanın geri kalanı çalışmaya devam eder.
- Ziyaret edilen her sekme gizlendikten sonra da bellekte kalıyordu. Artık yalnız son kullanılan 4 sekme bellekte tutulur; diğerleri kapatılır ve yeniden açıldığında yüklenir. Tüm sekmelerin gezildiği ölçümde arayüz süreci yaklaşık 175 MB'tan 67 MB'a, DOM düğümü sayısı 57.000'den 2.000'e indi.
- Gösterge paneli gizliyken de 3 saniyede bir sorgu yapıyor ve her seferinde kullanılmayan bir yönetici denetimi için yeni `net session` süreci başlatıyordu. Panel artık yalnız görünürken yenilenir; yönetici denetimi süreç başına bir kez yapılır.
- SQLite sayfa önbelleği veritabanı başına 64 MB'tan 8 MB'a indirildi (9 veritabanı için en kötü durum ~576 MB yerine ~72 MB). Geçici sıralama verileri bellek yerine diske yazılır.
- Uyku moduna geçen Süreç Gezgini ve Bağlantı Haritası modülleri önbelleklerini bırakır. Boşta kalan işçi iş parçacıkları 30 saniye sonra tamamen kapanır.
- Yeni kurulumlarda olay tablosu sınırı 1.000.000'dan 250.000 kayda indirildi. Mevcut ayar dosyaları korunur.
- Paketlenmiş uygulamada konsol günlüğü kapatıldı; gösterge panelinin 3 saniyelik ayrıntılı izleme kayıtları hata ayıklama düzeyine alındı. Cam efekti bulanıklığı GPU yükünü azaltmak için 20px'ten 8px'e indirildi.
- Eksik veya reddedilen API anahtarı ayrı gösterilir ve Ayarlar bağlantısı sunulur. Tehdit Avcılığı, port tarayıcısı ve istihbarat sorgusunda geçen süre, tekrar başlatma koruması ve açıklayıcı boş sonuç mesajları eklendi. Küçük Türkçe arayüz düzeltmeleri yapıldı.
- ESLint yapılandırması UTF-16 kaydedildiği için okunamıyordu; UTF-8'e çevrildi ve `npm run lint` komutu eklendi. Kullanılmayan `src/preload/index.js` kaldırıldı.


## 3.0.2 — Kalıcı toplama, yedekleme ve kural geçmişi / 22 Eylül 2026

- Aynı 3.0.2 sürümüne sağlayıcı düzeltmeleri dahil edildi: iptal/zaman aşımı ayrımı, yeniden deneme iptali, yetki/kota hataları, güncel URLhaus/GreyNoise uç noktaları, VirusTotal URL kimliği, Shodan alan adı ve OTX IPv6 sorguları.
- Boş veya geçersiz sağlayıcı yanıtlarının doğrulanmış temiz sonuç gibi gösterilmesi düzeltildi. Ham sağlayıcı yanıtları tanılama günlüklerine yazılmaz.
- Dağıtım dosyaları yenilendi; önceki 3.0.2 indirmeleriyle SHA-256 değerleri farklıdır. Yeni dosyalarda sürüm sayfasındaki güncel SHA256SUMS.txt değerlerini kullanın.

- Windows olayları kanal bazında kalıcı kayıt imleciyle sayfalanır. Olaylar ve imleç aynı işlemde yazılır; günlük sıfırlanması/saklama kaybı uyarılır.
- Toplayıcılarda boş sonuç, kısmi veri ve hata ayrı izlenir; ilgili sekmede kaynak uyarısı gösterilir. Başarısız yerel süreç okuması artık tüm süreçlerin kapandığı anlamına gelmez.
- Ayarlara parola korumalı AES-256-GCM yedekleme ve yeniden başlatmada geri yükleme eklendi. WAL, çalışma alanı ve kanıt kasası birlikte alınır; manifest HMAC ile doğrulanır. Hatalı parola, bozuk içerik ve yol geçişi reddedilir. Kesilen geri yükleme önceki veriye döner. Yalnız aynı Windows hesabı/bilgisayarı desteklenir.
- Sigma, YARA, IOC kuralları ve tehdit avları SQLite üzerinde değiştirilemez sürümlerle saklanır. Eski sürümün üzerine yazma ve tür değişimi reddedilir. Kaydetme, doğrulama yerine geçmez.
- Yeni açıklamalar Türkçe/İngilizce eklendi. Mevcut PDF kılavuzunun içeriği değiştirilmedi.


## 3.0.1 — Veri bütünlüğü ve modül dayanıklılığı / 17 Eylül 2026

- Vaka, IOC ve kanıt koleksiyonları şema denetimiyle açılır. Bozuk özgün kayıtlar korunur; üzerine yazma engellenir. Vaka ve bağlı kanıtlar tek sürümlü kayıtla atomik saklanır; kota hatasında başarılı kayıt gösterilmez.
- Yeniden kullanılan PID için işlem bilgileri güncellenir ve önceki/yeni süreç ayrımı geçmişe yazılır.
- DNS, USB, olay ve itibar zamanlayıcıları modül uykusunda durur, uyanınca tek kez kurulur, kapanışta temizlenir. Sekmeye dönüşte modül kullanılabilirliği yeniden denetlenir.
- Eklentiler kullanıcı veri dizinindeki güven listesine ve SHA-256 eşleşmesine göre çalıştırılır. Örnek eklenti otomatik üretilmez. Güvenilen kod ayrı iş parçacığında çalışır; başlangıç hatası, zaman aşımı, yeniden yükleme ve kapatma yönetilir. Bu mekanizma işletim sistemi izin yalıtımı değildir.
- DNS sorgularına doğrulama, zaman sınırı ve kayıt türü bazında hata bilgisi eklendi. Tam başarısızlık boş başarı olarak dönmez. Alan adı kayıt bilgisi için IANA hizmet listesinden RDAP sorgusu eklendi.
- Uzak IP puanları yerel bilgisayarın tüm olay/süreç bulgularından etkilenmez. Telemetri bulunmayan sisteme sıfır risk atanmaz; hesaplama ve yazma hataları yutulmaz.
- Olay kimliği kanal, kayıt numarası, bilgisayar ve zamanla oluşturulur; aynı kaydın tekrar eklenmesi engellenir. Kanallar arası zaman sırası kayıt atlanmasına yol açmaz. Canlı akış UTF-8 parçalanması ve yazma baskısı için düzenlendi.
- FIM kayıtlı dizinleri 60 saniyede bir, modül aktifken tarar. Silinme gerçek dosya sistemi kontrolüyle doğrulanır; yeniden oluşturma kaydedilir. Dizin başına 1000 dosya sınırı görünürdür.
- Adli analiz tekrarları önceki sonucu korur. Eski geçmiş yeni tabloya kayıp olmadan aktarılır. Disk analizindeki 1000 kayıt sınırı gösterilir.
- Rapor üretiminde hata nesnesinin arayüzü çökertmesi düzeltildi. Yeni açıklamalar Türkçe/İngilizce sözlüklere eklendi.

Ayrıntılı doğrulama kapsamı ve açık kabul başlıkları: `docs/SURUM_KAPSAMI.md`.


## 3.0.0 - Modül işlevleri ve gerçek veri akışları / 16 Eylül 2026

- Sekme-modül eşleştirmeleri, ilk açılış sırası ve tekrar etkinleştirme düzeltildi.
- Süreç, DLL, sertifika, olay ve diğer Windows toplayıcılarında PowerShell çağrıları düzeltildi. Süreç yolu ve kullanıcı bilgisi gerçek kaynaktan okunur; PID yeniden kullanımında eski önbellek atılır.
- Gizli sekmelerin sürekli sorguları durduruldu. Eşzamanlı süreç sorguları ortak toplama işlemini kullanır.
- Örnek V3 sonuçları kaldırıldı; süreç ağacı, zaman çizelgesi ve IOC grafiği gerçek kayıtlara bağlandı. Vakalara IOC, gözlem ve MITRE eşleştirmesi eklenebilir.
- Sigma/Hunt/IOC değerlendirmesi sınırlı işçi sürecinde, YARA-X dosya taraması gerçek yerel motorla çalışır. Desteklenmeyen girdiler açık hata verir.
- Dissect ve Volatility 3 yardımcı araçları eklendi. Kısmi Windows koleksiyonlarında eksik kullanıcı bağlamı uyarı olarak korunur.
- Şifreli delil kopyası, SHA-256 doğrulaması ve bozulmuş kopyanın reddedilmesi eklendi. Başarılı/başarısız doğrulama kayıt zincirine yazılır.
- Ağ keşfi seçilen alt ağla sınırlandı; zaman aşımı, kapalı port ve açık port ayrımı düzeltildi. Raporun sistem bilgisi seçeneği işler hale getirildi.
- Bağımlılıklar uyumlu güvenlik güncellemeleriyle yenilendi. Ayrıntılı sınırlar ve tekrar üretim adımları README içinde açıklanır.
- Kullanıcı kılavuzunun mevcut PDF içeriği değiştirilmedi.

## 3.0.0 - Dil ve çeviri düzeltmeleri / 15 Eylül 2026

- Red Team sonuç açıklamaları, ayar pencereleri ve diğer arayüzlerdeki sabit metinler seçili dile bağlandı.
- Eksik 49 çeviri anahtarı tamamlandı; tek ve çift süslü parantezli değişkenlerin gösterimi düzeltildi.
- Açık ekranlardaki açıklamaların dil değişiminde yenilenmesi ve İngilizce/Türkçe sözlük tutarlılığı için kontroller eklendi.
- İşlem akışları ve kullanıcı kılavuzunun içeriği korunmuştur.

## 3.0.0 - Güvenlik düzeltmeli dağıtım / 10 Eylül 2026

- Önceki denetimdeki 25 başarısız güvenlik kontrolü düzeltildi; 27 beklentinin tamamı geçti.
- 15 regresyon ve 5 gerçek Electron sınır kontrolü eklendi/doğrulandı.
- Komut girdileri, IPC, API anahtarı depolaması, HTTP sınırları ve güvenli rapor çıktıları düzeltildi.
- FIM kabuk bağımlılığı kaldırıldı; dosya ve delil SHA-256 hesaplama akışları düzeltildi.
- Sabit saldırı yüzeyi/CVE iddiaları ve otomatik DFIR örnek sonuçları kaldırıldı.
- AI özetindeki sabit sayılar kaldırıldı; yetersiz ölçümde risk bilinmiyor gösterilir.
- Olay ve davranış sorgularındaki şema uyumsuzlukları düzeltildi.
- Türkçe, 30 sayfalık kurumsal kullanıcı kılavuzu hazırlandı. Son biçimlendirmede içerik korunarak paragraflar iki yana yaslandı.

Bu tarihsel dağıtımda ürün sürüm numarası 3.0.0 olarak korunmuştu; sonraki değişiklikler yukarıda listelenir.
