# LSIP 3.0
## Kurumsal Kullanım Kılavuzu

Yerel güvenlik incelemesi, olay araştırması ve yetkili ağ keşfi

Bu kılavuz; uygulamayı teslim alan kurumun kurulum sorumlusuna, güvenlik analistine ve inceleme sonuçlarını değerlendiren ekip yöneticisine yöneliktir. İlk açılıştan rapor teslimine kadar izlenecek adımları, ekranların ne gösterdiğini ve bulguların nasıl yorumlanacağını açıklar.

Kapsam: 10 Eylül 2026 tarihli güvenlik düzeltmeleri uygulanmış LSIP 3.0 kaynak sürümü.

Belge sürümü: 1.0 | Dil: Türkçe | Hazırlanma tarihi: 10 Eylül 2026

> Kullanıma başlamadan önce 3. sayfadaki yetenek sınırlarını okuyun. Bazı V3 ekranları örnek veri gösterir. Bu ekranlardaki kayıtlar kuruma ait gerçek güvenlik bulguları olarak kullanılamaz.

Bu belgedeki kurum adları, dosya yolları ve senaryolar kullanım örneğidir. Bir hedefe yönelik tarama başlatmak için kurumunuzun belirlediği kapsam ve iş emri esas alınır.

---PAGE---
# İçindekiler ve okuma rotası

| Sayfa | Konu | Kim okumalı? |
| 3 | Uygulamanın amacı ve yetenek sınırları | Tüm kullanıcılar |
| 4 | Kurumsal sorumluluklar ve veri düzeni | Yönetici, analist |
| 5 | Teslim alma ve ilk çalıştırma | Kurulum sorumlusu |
| 6 | Arayüz ve günlük çalışma düzeni | Tüm kullanıcılar |
| 7 | Çevrimdışı ve çevrimiçi çalışma | Analist, ağ ekibi |
| 8 | Sağlayıcı ve API anahtarı ayarları | Yetkili yönetici |
| 9 | Gösterge paneli ve ilk değerlendirme | Analist |
| 10 | Varlık keşfi, topoloji ve bağlantılar | Analist, ağ ekibi |
| 11 | Süreçler, iş parçacıkları ve DLL'ler | Analist |
| 12 | Olaylar ve zaman çizelgesi | Analist |
| 13 | DNS, SMB, RDP ve sertifikalar | Analist |
| 14 | USB, dosya bütünlüğü ve kalıcılık | Analist |
| 15 | IOC taraması ve davranış analizi | Analist |
| 16 | İnternet araştırması ve itibar | Analist |
| 17 | AI Security Analyst ekranı | Analist, yönetici |
| 18 | DFIR delil kaydı ve dosya özeti | DFIR ekibi |
| 19 | Bellek, kayıt defteri ve kalıntılar | DFIR ekibi |
| 20 | Port taraması | Yetkili test ekibi |
| 21 | HTTP, TLS, DNS ve saldırı yüzeyi | Yetkili test ekibi |
| 22 | V3 vaka yönetimi ve delil görünümü | Analist |
| 23 | V3 örnek ekranlarının kullanımı | Eğitim ve ürün ekibi |
| 24 | Rapor üretimi ve teslim | Analist, yönetici |
| 25 | Ayarlar, performans ve eklentiler | Kurulum sorumlusu |
| 26 | Yedekleme, taşıma ve güncelleme | Kurulum sorumlusu |
| 27 | Uçtan uca araştırma örnekleri | Analist |
| 28 | Sorun giderme | Tüm kullanıcılar |
| 29 | Teslim ve günlük kontrol listesi | Yönetici, analist |
| 30 | Terimler ve belge kapsamı | Tüm kullanıcılar |

İlk kullanım için 3-8. sayfaları, ardından görevinize uygun ekran bölümünü okuyun. Bir araştırmayı baştan sona yürütmek için 27. sayfadaki senaryoları izleyin. Raporu göndermeden önce 24 ve 29. sayfalardaki kontrolleri uygulayın.

---PAGE---
# 01 / Uygulamanın amacı

LSIP, Windows bilgisayarında çalışan bir güvenlik inceleme uygulamasıdır. Yerel süreçleri, ağ bağlantılarını, olay kayıtlarını ve belirli sistem yapılandırmalarını incelemeyi; kayıtlı verileri ilişkilendirmeyi; isteğe bağlı dış istihbarat sorguları yapmayı sağlar. Birden fazla bilgisayardan merkezi olarak veri toplayan kurulu bir ajan filosu veya otomatik müdahale sistemi bu sürümün parçası değildir.

## Üç çalışma alanı

| Alan | Temel kullanım | Beklenen çıktı |
| Blue Team | Yerel sistem ve ağ görünürlüğü, IOC araştırması | Süreç, bağlantı, olay ve inceleme kayıtları |
| DFIR | Dosya delili kaydı, SHA-256 hesaplama, mevcut kalıntı kayıtlarını görüntüleme | Kaynak yolu, özet, boyut ve kayıt geçmişi |
| Red Team | Belirlenen hedefe TCP, HTTP/TLS ve DNS ölçümleri | Ölçüm zamanına bağlı keşif sonuçları |

## Bir sonucun anlamı

Gerçek ölçüm, çalıştırıldığı anda belirli bir kaynaktan alınan veridir. Önbellek sonucu daha önce alınmıştır; güncelliği ayrıca değerlendirilir. Kural tabanlı yorum, ölçümün analitik değerlendirmesidir. Örnek kayıt ise arayüzü göstermek için yazılmıştır ve araştırma kanıtı değildir.

> Boş tablo, düşük risk puanı veya eşleşme bulunmaması tek başına sistemin temiz olduğunu göstermez. Kaynağın toplanmış olması, erişim izinleri, zaman aralığı ve tarama kapsamı birlikte kontrol edilmelidir.

## Bu sürümde sınırlar

AI Security Analyst bir LLM hizmetine bağlanmaz; yerel verilerden kurallarla özet çıkarır. DFIR dosya kaydı disk imajı oluşturmaz, dosyayı kasaya kopyalamaz ve bellek dökümünü ayrıştırmaz. Kalıntı ekranlarında genel bir dosya içe aktarma/ayrıştırma akışı bulunmaz. V3 grafik, avcılık, tespit laboratuvarı ve bazı zaman çizelgesi ekranları örnek içerik kullanır. Uygulama USB erişimini otomatik engellemez; gösterilen riskler otomatik bir saldırı doğrulaması değildir.

---PAGE---
# 02 / Kurumsal çalışma düzeni

Kurulumdan önce uygulamanın hangi bilgisayarda, hangi Windows hesabıyla ve hangi amaçla kullanılacağını belirleyin. Veri toplama ve araştırma kapsamını bir iş emrine bağlamak, aynı bulguyu farklı ekiplerin tutarlı değerlendirmesine yardımcı olur.

| Sorumlu | Görev |
| Kurulum sorumlusu | Teslim paketini doğrular, çalıştırma ve yedekleme düzenini oluşturur, güncellemeyi test eder. |
| Güvenlik analisti | Veri toplar, zaman ve kaynak bilgilerini korur, bulguları doğrular ve raporlar. |
| DFIR sorumlusu | Kaynak dosyayı korur, dosya özetini bağımsız olarak doğrular, teslim geçmişini kurum sisteminde tutar. |
| Ağ/test sorumlusu | Hedef, port, zaman aralığı ve trafik beklentisini belirler. |
| İnceleyen yönetici | Sonucun kapsamını ve sınırlamalarını değerlendirir; operasyonel değişiklik kararını verir. |

Bu görevler kurumsal iş bölümüdür. Uygulamada bunları zorunlu kılan çok kullanıcılı oturum, rol tabanlı yetki veya kurumsal onay akışı bulunmaz. Erişim Windows hesabı, klasör izinleri ve kurumun çalışma prosedürüyle yönetilir.

## Araştırma için kayıt düzeni

Her çalışmaya kurumunuzun vaka numarasını verin. Örneğin IR-2026-017 altında kapsam notu, gözlem listesi, raporlar ve delil referansları için ayrı alt klasörler kullanabilirsiniz. Dosya adında tarih, bilgisayar adı ve belge türünü belirtin; eski raporun üzerine yazmak yerine yeni bir sürüm oluşturun.

Araştırma notuna en az bilgisayar adını, Windows kullanıcısını, LSIP sürümünü, başlangıç/bitiş zamanını, saat dilimini, kullanılan kaynakları ve varsa erişim hatalarını yazın. Bir ekran görüntüsünü aktarırken seçili filtreyi ve ölçüm zamanını da kaydedin.

> API anahtarlarını, erişim belirteçlerini veya parola içerebilen komut satırlarını genel araştırma notuna kopyalamayın. Raporların içindeki kullanıcı adları, iç IP adresleri ve dosya yolları kurum verisi olarak ele alınmalıdır.

---PAGE---
# 03 / Teslim alma ve ilk çalıştırma

Bu projenin paketleme hedefi Windows taşınabilir uygulamasıdır. Teslim paketinin biçimini dağıtımı yapan ekiple eşleştirin. Bu kılavuz bir kurulum sihirbazı, otomatik lisans aktivasyonu veya belirli bir kurulum dizini varsaymaz.

## Hazır paketle başlama

1. Paketi kurumun onayladığı kaynaktan alın. Sağlanan sürüm ve dosya özeti bilgilerini teslim kaydıyla karşılaştırın.
2. Paketi yerel, yazma izinleri denetlenen bir klasöre yerleştirin. Sıkıştırılmış paket geldiyse tüm içeriği çıkarın; yalnızca yürütülebilir dosyayı ayırmayın.
3. Uygulamayı kendi Windows hesabınızla başlatın. İnceleme için ek yetki gerektiğinde kurumunuzun ayrıcalıklı çalıştırma prosedürünü kullanın.
4. Gösterge panelinin açıldığını, bilgisayar bilgilerinin beklenen sisteme ait olduğunu ve uygulamanın çevrimdışı başladığını kontrol edin.
5. Dil kontrolünden Türkçeyi seçin. Açık veya koyu temayı okunabilirliğe göre belirleyin.
6. Önce Süreçler ve Bağlantılar ekranlarında küçük bir kontrol yapın. Boş sonuçlarda yetki, filtre ve kaynak durumunu inceleyin.

## Çalışma ortamı

Toplayıcıların önemli bir bölümü Windows araçlarını ve PowerShell'i kullanır. Kurum politikaları bu araçların çalışmasına ve gerekli kayıtların okunmasına izin vermelidir. İşletim sistemi, mimari ve donanım uygunluğu teslim edilen paketle pilot ortamda doğrulanmalıdır; bu belge ölçülmemiş bir minimum RAM veya performans garantisi vermez.

## Kaynak koddan çalışma - teknik ekip için

Bağımlılıkları hazırlanmış proje kökünde `npm run typecheck` tür kontrolünü, `npm run build` üretim dosyalarının derlenmesini çalıştırır. Başarılı derlemeden sonra `npm start` uygulamayı açar. `npm run package` dağıtım paketi oluşturmak içindir. Müşteri kullanıcılarının kaynak kod komutlarını çalıştırması gerekmez.

Mevcut bir eski EXE, kaynak klasöründeki düzeltmelerle kendiliğinden güncellenmez. Dağıtım ekibi yeni kaynak sürümünden paket üretip teslim ettiği paketi ayrıca doğrulamalıdır.

---PAGE---
# 04 / Arayüzde gezinme

Sol menü çalışma alanlarını ve ekranları içerir. Üst çubukta arama, bağlantı durumu, bağlantı açma/kapatma, dil ve tema kontrolleri yer alır. Ana bölüm seçtiğiniz ekranın tablosunu, kartlarını veya giriş formunu gösterir. Alt durum alanı uygulamanın çalışma bilgilerine yardımcı olur.

## Günlük başlangıç sırası

1. Doğru bilgisayarda ve doğru kullanıcı hesabında olduğunuzu doğrulayın.
2. Gösterge panelindeki metrikleri ve varsa yetki uyarısını inceleyin.
3. İhtiyacınız olan çalışma alanına geçin; ilgili ekranın ilk yüklemesini bekleyin.
4. Filtre veya arama alanlarını kontrol edin. Önceki oturumdan kalan bir filtre kayıtları gizleyebilir.
5. Veri yenileme veya tarama gerekiyorsa o ekranın işlemini başlatın. Yenilemeyi sürekli tekrarlamak sonuçların daha güvenilir olmasını sağlamaz.
6. Görünen sonuçların zamanı ile araştırmanızın zaman aralığını karşılaştırın.

## Sekme geçişleri ve kalıcılık

Modüller ihtiyaç oldukça yüklenir. Açılmış ekranlar sekme değişiminde bellekte tutulabilir; bazı araştırma tercihleri ve vaka verileri yerel oturum alanına kaydedilir. Bu nedenle sekmeden çıkmak, çalışan bir işlemi iptal etmek veya içeriği silmek anlamına gelmez. Yeniden başlatmanın her canlı ölçümü koruyacağını da varsaymayın.

Üst aramanın bütün veritabanlarını sorgulayan merkezi bir arama olduğunu düşünmeyin. Etkisi ekrana göre değişebilir. Belirli bir kaydı bulmak için ilgili ekranın kendi filtrelerini kullanın ve sonuç sayısının nasıl değiştiğini gözlemleyin.

## Ekran etiketleri

Türkçe seçili olsa da bazı düğmeler veya alanlar İngilizce kalabilir. Bu kılavuz eşleştirmeyi kolaylaştırmak için önemli ekranların İngilizce adlarını parantez içinde verir. “Refresh” yenileme, “Scan” tarama, “Generate” üretme, “Save” kaydetme, “Clear History” geçmişi temizleme anlamına gelir.

---PAGE---
# 05 / Bağlantı ve veri çıkışı

Uygulama her başlangıçta çevrimdışı modla açılır. Dış istihbarat sorguları için kullanıcının bağlantıyı açması gerekir. Bunun yanında internet istihbaratının genel ayarı, çevrimdışı tercihi ve ilgili sağlayıcının etkinliği de sorguya izin vermelidir.

| Durum | Kullanıcının yorumu |
| OFFLINE | Dış istihbarat sorgusu için çevrimiçi mod açılmamıştır. Yerel inceleme yapılabilir. |
| ONLINE | Uygulama bağlantı kontrolünü geçmiştir. Her sağlayıcının çalışacağı veya kotasının uygun olduğu garanti edilmez. |
| LIMITED / NO INTERNET | Ağ arayüzü veya DNS erişimi yeterli değildir. Ağ ekibiyle kontrol edin. |
| PROVIDER ERROR | Sağlayıcıya özgü hata olabilir; anahtar, kota ve hizmet yanıtını inceleyin. |

## Çevrimiçi araştırma adımları

1. Dışarı gönderilecek göstergenin kurum politikasına uygun olduğunu doğrulayın.
2. Ayarlardan internet istihbaratını ve kullanacağınız sağlayıcıyı etkinleştirin.
3. Üst çubuktan bağlantıyı açın ve durum sonucunu bekleyin.
4. Araştırma ekranına bir IP, alan adı, URL veya desteklenen dosya özeti girin.
5. Sonuçta sağlayıcı, hata, zaman ve önbellek bilgilerini kontrol edin.
6. İşiniz bittiğinde bağlantıyı kapatın. Politika değişikliği devam eden ortak HTTP istemcisi isteklerinin iptal edilmesini de sağlar.

> Çevrimdışı düğmesi işletim sistemi güvenlik duvarı değildir. Varlık keşfi, Red Team TCP/HTTP/DNS ölçümleri ve diğer yerel ağ işlemleri ayrıca trafik oluşturabilir. Tam ağ yalıtımı gerekiyorsa bunu işletim sistemi veya ağ altyapısında sağlayın.

Sağlayıcıya gönderilen gösterge o dış hizmet tarafından görülebilir. Bir URL'nin sorgu bölümü kurum içi bilgi veya belirteç içerebilir. Gönderim öncesinde göstergeyi gözden geçirin. Dosya özetiyle araştırma, dosyanın tamamının yüklendiği anlamına gelmez; bu sürümde genel dosya yükleme hizmeti varsayılmamalıdır.

---PAGE---
# 06 / Sağlayıcı ayarları

Ayarlar içindeki internet istihbaratı paneli dış sağlayıcıları yönetir. Kaynak sürümünde AbuseIPDB, VirusTotal, URLhaus, Hybrid Analysis, OTX, IPQualityScore, Shodan ve GreyNoise bağdaştırıcıları bulunur. Her sağlayıcının desteklediği gösterge türü ve gerektirdiği hesap farklı olabilir. Güncel ticari haklar ve kota koşulları kurumunuzun sağlayıcı hesabında doğrulanmalıdır.

## İlk anahtar kaydı

1. Kuruma ait, araştırma için ayrılmış sağlayıcı hesabını kullanın.
2. İlgili sağlayıcı kartını açın; gerekiyorsa API anahtarını girin.
3. Etkinlik, zaman aşımı ve kota alanlarını kurum hesabıyla uyumlu ayarlayın.
4. Sağlayıcı ayarını kaydedin. Başarı durumunu kontrol edin.
5. Çevrimiçi modda test işlevini çalıştırın. Testin başarısı gelecekteki tüm sorgular için garanti değildir.
6. Araştırma ekranında küçük bir doğrulama sorgusu yapın ve doğru sağlayıcının kullanıldığını kontrol edin.

## Kayıtlı anahtarın davranışı

Anahtar arayüze geri gönderilmez; panel anahtarın yapılandırılmış olup olmadığını gösterir. Anahtar alanını boş bırakarak diğer ayarları kaydetmek mevcut anahtarı korur. Sağlayıcıyı kapatmak da anahtarı silmez. Silmek için ayrı anahtar kaldırma işlemini kullanın.

Anahtarlar Windows güvenli depolama mekanizması üzerinden şifrelenir. Güvenli depolama kullanılamıyorsa yeni anahtar açık metne düşürülerek kaydedilmez. Bu durumda Windows hesabını ve ortamı kontrol edin. Başka bilgisayara veya Windows hesabına taşındığında anahtarları yeniden girmeniz gerekebilir.

Teknik ekip anahtarı ortam değişkeniyle tanımladıysa bu değer dosyada kayıtlı anahtara göre önceliklidir. Arayüzden dosyadaki anahtarı kaldırmak ortam değişkenini kaldırmaz; yönetici çalışma ortamını da güncellemelidir.

## Zaman aşımı ve hata

Ortak istemci yalnız HTTPS kullanır, otomatik yönlendirmeleri kabul etmez ve yanıt boyutunu sınırlar. Zaman aşımı, yönlendirme veya aşırı büyük yanıt hatasını “temiz sonuç” olarak yorumlamayın. Önce sağlayıcı kartındaki durum ve kurumsal ağ erişimi incelenmelidir.

---PAGE---
# 07 / Gösterge paneli

Gösterge Paneli (Dashboard), bilgisayarın anlık görünümünü ve uygulamanın topladığı özetleri bir araya getirir. Ayrıntılı araştırmaya başlamak için yön gösterir; tek başına olayın nedenini açıklamaz.

## İlk değerlendirme

1. Bilgisayar adı ve sistem bilgilerinin inceleme kapsamıyla eşleştiğini kontrol edin.
2. İşlemci ve bellek kullanımını gözlemleyin. Tarama başlatıldığında kısa süreli artış olabilir.
3. Süreç, bağlantı ve olay özetlerini ilgili ayrıntı ekranlarıyla karşılaştırın.
4. Risk veya anomali kartından hareketle süreç adı, hedef adres, dosya yolu ve zaman bilgisini not alın.
5. Aynı gözlemi mümkünse ikinci bir kaynaktan doğrulayın; örneğin süreç ile bağlantı veya olay kaydı arasında ilişki kurun.

## Bulguyu not etme örneği

“10 Eylül 2026, 09:40, UTC+03:00: FIN-WS-07 üzerinde olağandışı bellek artışı görüldü. Süreçler ekranında ilgili PID ve komut satırı kaydedildi. Bağlantı ekranındaki uzak adres araştırılacak.”

Bu not, “bilgisayara virüs bulaştı” gibi doğrulanmamış bir yargıdan daha kullanılabilirdir. Henüz açıklanamayan bir gözlemle doğrulanmış olay arasında ayrım yapın.

## Risk puanlarını okuma

Puan ve önem seviyeleri inceleme sırasını belirlemeye yardımcı olur. Kullanılan kural, veri kapsamı ve önbellek yaşı puanı etkileyebilir. Düşük puan olay olmadığını, yüksek puan ise tek başına saldırgan etkinliği olduğunu kanıtlamaz. Kurumunuzun olay sınıflandırması için ek bağlam gerekir.

Yerel yöneticilik gerektiren kaynaklar okunamadığında görünüm eksik olabilir. İlk açılıştaki yüklenme sürecini, filtreli boş tabloyu ve toplama hatasını birbirinden ayırın. Ekranda veri bulunmuyorsa örnek bir değeri gerçek bulgu olarak kaydetmeyin.

---PAGE---
# 08 / Varlıklar ve ağ görünümü

## Varlık Keşfi (Asset Discovery)

Bu modül yerel ARP önbelleğindeki aday cihazlardan hareket eder; adaylar için gecikme ve port ölçümleri yapabilir. Dolayısıyla tarama yalnız pasif listeleme değildir. Görülen cihazlar tüm ağın eksiksiz envanteri sayılmaz.

1. Kullanılacak ağ arayüzünü ve araştırma kapsamını kontrol edin.
2. Tarama başlatmadan önce ağ/test sorumlusunun belirlediği hedef kapsamıyla karşılaştırın.
3. Taramayı çalıştırın; tamamlandıktan sonra IP, MAC, açık port ve son görülme alanlarını inceleyin.
4. İşletim sistemi ve cihaz türü alanlarını tahmin olarak değerlendirin. Üretici bilgisi de varlık sahipliğini tek başına doğrulamaz.
5. Önceki kayıtla karşılaştırırken IP adresinin değişmiş olabileceğini, aynı IP'nin farklı cihaza atanabileceğini hesaba katın.

Alt ağ veya tarama hızı ayarının her toplayıcıda aynı biçimde uygulandığını varsaymayın. Mevcut keşif akışı ARP adaylarına dayanır; yazılmış bir CIDR kapsamı tüm adreslerin tek tek tarandığını göstermez.

## Ağ Topolojisi (Network Topology)

Topoloji görünümü eldeki ağ verisini görselleştirir. Düğüm ve bağlantıları inceleyerek olası ilişkileri belirleyin; kaynak tabloya dönerek adres ve zamanı doğrulayın. Harita fiziksel kablolamanın, güvenlik duvarı kurallarının veya bütün segmentlerin otomatik keşfi olarak kullanılmamalıdır.

## Bağlantı Haritası (Connection Map)

Yerel ve uzak adres, port, bağlantı durumu ve ilişkili süreç alanlarını birlikte okuyun. PID ile Süreçler ekranına dönün. PID'ler süreç kapandıktan sonra tekrar kullanılabilir; farklı zamanlardaki aynı PID'yi doğrudan aynı süreç saymayın.

Bir port numarası yalnızca olası hizmete işaret eder. Örneğin 443 kullanılması trafiğin güvenli olduğunu veya belirli bir uygulamaya ait olduğunu kanıtlamaz. Bağlantı kaydı da aktarılmış içeriğin paket kaydı değildir.

---PAGE---
# 09 / Süreç, iş parçacığı ve DLL

## Süreç Gezgini (Process Explorer)

Süreç listesinde PID, ad, kaynak kullanımı ve erişilebilen ayrıntıları inceleyin. Şüpheli görünen sürecin dosya yolunu, komut satırını, üst süreç ilişkisini ve ağ bağlantılarını beraber değerlendirin. Meşru yönetim araçları da saldırılarda kullanılabildiğinden yalnız dosya adına göre karar vermeyin.

1. Süreci ad veya PID ile bulun; gözlem zamanını not edin.
2. Ayrıntılarını açarak yol ve komut satırını kontrol edin.
3. Bağlantı Haritasında aynı PID'ye ait güncel bağlantıları inceleyin.
4. Olay Gezgini üzerinden oluşum zamanına yakın kayıtları karşılaştırın.
5. İşlem yapmadan önce kurumsal uygulama sahibinden sürecin işlevini doğrulayın.

## Süreci sonlandırma

Sonlandırma gerçek bir işletim sistemi işlemidir; ilgili programın kapanmasına ve kaydedilmemiş işin kaybolmasına yol açabilir. Kullanacağınız PID'nin hâlâ doğru sürece ait olduğunu kontrol edin. Kurumun müdahale kararı doğrultusunda düğmeyi kullanın, ardından listeyi yenileyip sonucu doğrulayın. Yetki hatasını başarı olarak kabul etmeyin. Bu işlem dosyayı silmez, karantinaya almaz veya yeniden başlamasını önlemez.

## İş Parçacıkları (Thread Explorer)

Geçerli bir sayısal PID için iş parçacığı bilgilerini inceleyin. Sonuç, sorgulanan sürecin o andaki durumuna bağlıdır. Süreç kapanırsa veya erişim engellenirse veri alınamayabilir. Sayılar uygulamanın işleviyle birlikte değerlendirilmelidir.

## DLL Tarayıcı (DLL Scanner)

PID üzerinden yüklenmiş modülleri inceleyin. Yol, modül adı ve imza durumunu karşılaştırın. İmza bilgisi dosyanın Authenticode durumuna dayanır; şirket adı metni imza kabul edilmez. İmzasız dosya otomatik olarak zararlı değildir; geçerli imza da dosyanın zararsızlığının garantisi değildir. Bu liste tek başına tüm kod enjeksiyonlarını veya bellekteki gizli modülleri tespit etmez.

---PAGE---
# 10 / Olaylar ve zaman çizelgesi

## Olay Gezgini (Event Explorer)

Olay kayıtları, bir işlemin veya sistem değişikliğinin zamanını anlamak için kullanılır. Ekranda kaynak, olay kimliği, seviye, zaman ve mesaj gibi alanları okuyun. Kullanıcı alanı kaynağın sunduğu ölçüde doldurulur; boş olması anonim bir saldırgan bulunduğunu göstermez.

1. Araştırma zaman aralığını belirleyin ve bilgisayarın saat dilimini not edin.
2. Ekranın mevcut kaynak/seviye/arama filtrelerini uygulayın.
3. Bulduğunuz kaydın yalnız özetine bakmayın; tam mesajını ve kaynak adını okuyun.
4. Süreç adı, PID, hesap ve adres bilgilerini diğer ekranlarla ilişkilendirin.
5. Olay kimliğini kaynakla birlikte rapora aktarın. Aynı sayı farklı kaynakta farklı anlama gelebilir.

Günlük ilkesi etkin değilse veya kullanıcının izni yoksa beklediğiniz olay kaydı bulunmayabilir. Silinmiş veya saklama süresi dolmuş kayıtlar da görünmez. LSIP geçmişte hiç toplanmamış veriyi kendiliğinden oluşturamaz.

## Zaman Çizelgesi (Timeline)

Blue Team içindeki zaman çizelgesi, mevcut olayları sıraya koymak için kullanılır. Önce en erken gözlemi belirleyin, sonra süreç, bağlantı ve dosya değişikliği gibi kaynakları aynı zaman ekseninde karşılaştırın. Yakın zamanlı iki kayıt arasında nedensellik kurmadan önce kullanıcı, PID ve hedef eşleşmesini kontrol edin.

> V3 Forensic Timeline ayrı bir ekrandır ve bu sürümde sabit örnek olaylar içerir. Gerçek araştırma için kaynak kayıtlarına ve Blue Team zaman çizelgesine başvurun; V3 örneklerini raporun olay kronolojisine taşımayın.

## Zamanları raporlama

Ekranda yerel saat, dış sağlayıcıda UTC, raporda ISO tarih gösterimi bulunabilir. Karşılaştırırken hepsini ortak bir saat dilimine çevirin ve bunu raporda yazın. Veri alınma zamanı, olayın gerçekleşme zamanı ve rapor oluşturma zamanı farklı kavramlardır.

---PAGE---
# 11 / Ağ ve erişim incelemesi

## DNS Intelligence

Yerel DNS kayıtlarını alan adı, kayıt türü ve yanıt bağlamında inceleyin. Bir alan adının önbellekte olması kullanıcının o siteyi bilinçli açtığını kanıtlamaz; arka plan uygulamaları da çözümleme yapabilir. Alan adını IOC taraması ve bağlantı kayıtlarıyla karşılaştırın. Önbelleğin eksiksiz bir DNS trafik geçmişi olmadığını dikkate alın.

## SMB Intelligence

Paylaşım ve oturum görünümündeki sunucu, paylaşım adı, yol ve bağlantı ayrıntılarını kontrol edin. Kurum envanterinde beklenmeyen paylaşım veya oturumları işaretleyin; ilgili cihazın sahibiyle doğrulayın. Yönetim paylaşımlarının görünmesi tek başına ihlal değildir. Bu ekranın paylaşım izinlerini otomatik düzelttiğini veya uzaktaki bütün dosyaları denetlediğini varsaymayın.

## RDP Monitor

RDP oturumlarını ve mevcut bağlantı olaylarını hesap, uzak adres ve zaman üzerinden inceleyin. Mesai dışı bir oturum varsa değişiklik kaydı veya uzaktan destek talebiyle karşılaştırın. Başarısız girişler ile başarılı oturumları ayırın. Kaynak günlüklerinin ve okuma yetkisinin yeterli olması gerekir; toplama sınırı nedeniyle bütün geçmişin gösterilmesi beklenmemelidir.

## Certificate Scanner

Yerel sertifika görünümünde konu, düzenleyen, geçerlilik tarihleri ve ilgili özellikleri inceleyin. Süresi geçmiş, beklenmeyen veya kurum envanterinde bulunmayan sertifikaları sertifika sorumlusuna aktarın. Yerel depoda bulunmak sertifikanın bir web sunucusunda kullanıldığını göstermez. Red Team TLS incelemesi ise belirli bir uzak hizmetten alınan ayrı bir ölçümdür.

## Önerilen inceleme sırası

1. Bağlantı veya oturumdaki adresi ve hesabı belirleyin.
2. DNS/varlık kayıtlarından bağlam toplayın.
3. Olay kayıtlarıyla zaman eşleştirmesi yapın.
4. Beklenen iş faaliyetiyle karşılaştırın.
5. Doğrulanmış gözlemi ve eksik veriyi ayrı ayrı raporlayın.

---PAGE---
# 12 / USB, dosyalar ve kalıcılık

## USB Monitor

Cihaz kimliği, üretici/seri bilgisi ve erişilebilir zaman alanlarını inceleyin. Bilinen kurumsal cihaz listesiyle karşılaştırın. Bir USB kaydı dosya kopyalandığını göstermez; bunu doğrulamak için ayrı dosya erişim kayıtları gerekir. LSIP bu ekrandan USB aygıtlarını otomatik engellemez.

## Dosya Bütünlüğü (File Integrity / FIM)

Referans tarama, seçilmiş dosyaların SHA-256 özetini kaydeder; sonraki taramalarda değişen özetler karşılaştırılır. İlk taramayı mümkün olduğunca bilinen bir sistem durumunda yapın. Tarama düğmesini çalıştırıp tamamlanmasını bekleyin, dosya sayısını ve değişiklik listesini inceleyin.

| Varsayılan dizin | Desen | Referans tarama sınırı |
| C:\Windows\System32\drivers | *.sys | En fazla 80 dosya |
| C:\Windows\System32 | *.exe, *.dll | En fazla 80 dosya |
| C:\Windows | *.exe, *.ini | En fazla 80 dosya |

Bu tarama alt dizinleri kapsamaz. İlk uygun dosyalar işlenir; listeleme sırası garanti değildir. Sınır nedeniyle tüm sistem dosyaları taranmış sayılmaz. Tarama sırasında değişen dosya veya erişim hatası başarısızlığa yol açabilir; önce nedeni çözün ve yeniden tarayın. Özet hesaplaması dosya içeriğini okuduğu için disk etkinliği oluşturur.

İlk görülen dosya “yeni”, farklı özete sahip dosya “değişmiş” olarak görünebilir. Windows güncellemesi de meşru değişiklik üretir. Görülmeyen dosyalar üzerinden eksiksiz bir silinme tespiti beklemeyin. Her çalıştırma güncel referansı yeniler; önceki değişiklik kaydını rapora zamanında alın.

## Persistence Scanner

Başlangıç ve kalıcılık noktalarında gösterilen yol, komut ve kaynakları inceleyin. Kurumun izin verdiği uygulamalarla karşılaştırın. Şüpheli girdiyi doğrudan silmek yerine ilişkili dosyayı, imzayı, süreci ve değişiklik kaydını doğrulayın. Bu ekran bütün kalıcılık tekniklerini kapsayan bir garanti sunmaz.

---PAGE---
# 13 / IOC ve davranış incelemesi

## IOC Scanner

Gösterge taraması, girilen değerleri mevcut yerel bağlantı, DNS ve FIM kayıtlarında arar. Bir antivirüsün tüm diski taraması veya bir YARA motorunun dosya içeriğini değerlendirmesiyle aynı işlem değildir.

1. Kurumun doğrulanmış gösterge listesinden küçük, ilgili bir küme seçin.
2. Giriş alanına göstergeleri ekleyin; boş satırları ve açıklama metinlerini ayıklayın.
3. Taramayı çalıştırın. Aranan gösterge ve eşleşme sayılarını kontrol edin.
4. Her eşleşmede kaynak, zaman ve bağlam bilgisini okuyun.
5. Kaynak ekrana dönerek ilgili bağlantı, DNS kaydı veya dosyayı doğrulayın.

| Gösterge | Aranan veri | Yorum |
| IPv4 adresi | Yerel/uzak bağlantı adresi ve DNS yanıtı | Aynı adres farklı zamanlarda farklı sisteme ait olabilir. |
| Alan adı | DNS sorgu adı içinde eşleşme | Kısmi eşleşmeleri tam alan adıyla doğrulayın. |
| Dosya özeti | FIM SHA-256 referansları | Yalnız daha önce FIM kapsamına girmiş dosyalar bulunabilir. |

Giriş bir özet olarak tanınsa bile FIM deposu SHA-256 ile karşılaştırılır; farklı özet türünde sonuç beklemeyin. Eşleşme yoksa önce ilgili kaynakların toplanmış olduğunu kontrol edin. Kaynak veya sorgu hatası araştırma kapsamını daraltabilir.

## Behavior Analytics

Davranış analizi, mevcut süreç ve olay verilerinden kural tabanlı şüpheli ilişkiler üretir. Üst/alt süreç ilişkisini gerçek yol ve komut satırıyla karşılaştırın. Yönetim, yazılım dağıtımı ve yedekleme araçları olağandışı görünen fakat beklenen davranışlar üretebilir.

Bir anomaliyi raporlamak için hangi kuralın veya ilişkinin dikkat çektiğini yazın. “Şüpheli üst süreç ilişkisi görüldü; değişiklik kaydıyla doğrulanamadı” gibi bir ifade, doğrulanmamış saldırı kesinliğinden daha doğrudur. Otomatik karantina veya hesap kapatma bu ekranın normal sonucu değildir.

---PAGE---
# 14 / İnternet araştırması ve itibar

## Internet Investigation

Bu ekran bir göstergeyi dış sağlayıcılar ve yerel bağlamla araştırmak içindir. Araştırma geçmişi, daha önceki sorgulara dönmenize yardımcı olur. Önce bağlantı politikasını ve sağlayıcı yapılandırmasını tamamlayın.

1. Araştırma amacını yazın: örneğin “bağlantı kaydındaki uzak adresin itibarını kontrol etme”.
2. Gösterge türünü ve değerini kontrol edin. URL ile alan adını birbirine karıştırmayın.
3. Sorguyu başlatın ve sağlayıcı yanıtlarının tamamlanmasını bekleyin.
4. Kaynak sayısını, uyarıları, risk değerlendirmesini ve ham ayrıntıları birlikte okuyun.
5. Önbellekten gelen sonuçlarda tarih ve veri yaşını not edin.
6. Sonucu yerel süreç, bağlantı veya DNS kaydıyla eşleştirin; araştırma notunu vaka numaranızla saklayın.

## Çelişkili sonuçlar

Bir sağlayıcı yüksek risk bildirirken diğeri kayıt bulamayabilir. “Kayıt yok”, “sorgu başarısız” ve “düşük risk” farklı durumlardır. Sağlayıcıların kapsadığı zaman aralığı, veri türü ve gösterge kullanım amacı değişir. Yönetim raporunda tek bir puanı bağlamından ayırmak yerine kaynakları ve belirsizliği belirtin.

## Reputation Engine

İtibar görünümü, eldeki konak ve araştırma bilgilerinden önceliklendirme sağlar. Yüksek puanlı varlığı seçerek açık port, bağlantı veya anomali gibi dayanaklarına dönün. Ağdaki iş rolü bilinmeden bir sunucunun çok sayıda hizmet sunması ihlal olarak sınıflandırılmamalıdır.

## Geçmiş ve temizlik

Geçmiş araması veya tür filtresiyle önceki araştırmayı bulun. Geçmişi temizleme düğmesi araştırma kaydını kaldırabilir; gerekli bulguları önce kurum arşivine aktarın. Geçmişin temizlenmesi ayrı raporları, sağlayıcı önbelleğini veya diğer veri depolarını topluca sildiğiniz anlamına gelmez.

---PAGE---
# 15 / AI Security Analyst

Ekran adı AI Security Analyst olsa da mevcut sürümde analiz yerel kurallarla üretilir. Bir dış büyük dil modeline veri gönderilmez. Sonuç, eldeki tarama ve yerel kayıtların yapılandırılmış özetidir; bağımsız bir saldırı doğrulaması değildir.

## Kullanım sırası

1. İlgili hedef veya konu için önce gerçek veriyi toplayın. Gerekliyse bağlantı, olay ve Red Team ölçümlerini tamamlayın.
2. Analist ekranını açın. Özet kayıtlı verileri birlikte kullanır; bu ekranda hedef giriş filtresi bulunmaz.
3. Gerekirse Yeniden Analiz düğmesini kullanın; özet, risk, bulgu ve öneri bölümlerini okuyun.
4. Her önemli yargıyı kaynak ölçümle karşılaştırın. Ölçülmeyen alanlarda bilinmiyor veya veri yok durumunu koruyun.
5. Kurumsal aksiyon kararını analist değerlendirmesi ve ek doğrulama sonrasında verin.

## Sonuçları doğru aktarma

Yeterli güvenlik ölçümü yoksa puan verilmez ve risk bilinmiyor olarak gösterilir. Ölçüm bulunan bir özet düşük risk gösterse bile eksik TLS, başlık veya hizmet alanları doğrulanmış değildir. Saldırgan altyapısı, komuta kontrol faaliyeti veya belirli bir zafiyet iddiası için bağımsız dayanak gerekir. Ekranın kural tabanlı önerileri ortamınıza uygulanabilirlik açısından incelenmelidir.

| İfade | Raporda kullanım |
| Ölçümde açık TCP portu bulundu | Hedef, port ve ölçüm zamanıyla birlikte somut gözlem olarak yazılır. |
| Bir güvenlik başlığı yok | İncelenen HTTP yanıtıyla sınırlı yapılandırma gözlemi olarak yazılır. |
| Veri bulunamadı / bilinmiyor | İncelemenin sınırlaması olarak açıkça belirtilir. |
| Kural tabanlı risk veya öneri | Analitik yorum olduğu ve doğrulama gerektiği belirtilir. |

## Kurumsal inceleme notu

Kullanılan hedefi, veri kaynaklarını, analiz zamanını ve analistin ek yorumunu ayrı alanlarda saklayın. Kurumunuzda otomatik karar süreçleri varsa bu ekranın çıktısını doğrudan engelleme veya üretim değişikliği tetikleyicisi olarak kabul etmeyin; ilgili sürecin insan incelemesini uygulayın.

---PAGE---
# 16 / DFIR delil kaydı

Delil Kaydı (Evidence Custody), araştırma dosyasının başlığını, türünü, kaynak yolunu ve hesaplanan özetini kaydeder. Kaynak dosya verildiğinde tamamını okuyarak SHA-256 hesaplar. Kaynak dosya uygulama tarafından başka yere kopyalanmaz veya şifreli kasaya taşınmaz.

## Dosya kaydetme adımları

1. Kaynak dosyayı kurumun delil toplama yöntemiyle önceden hazırlayın. Dosyanın sabit ve erişilebilir olduğundan emin olun.
2. DFIR çalışma alanında delil kayıt ekranını açın.
3. Açıklayıcı bir başlık yazın; örneğin “IR-2026-017 - FIN-WS-07 olay dışa aktarımı”.
4. Türü seçin ve tam kaynak dosya yolunu girin. Tür seçimi kendiliğinden disk imajı veya bellek dökümü oluşturmaz.
5. Ekleme işlemini başlatın. Büyük dosyalarda okuma tamamlanana kadar bekleyin.
6. Listede yeni kaydın, boyutun ve özetin oluştuğunu kontrol edin. Kayıt geçmişinde ilgili ekleme satırını doğrulayın.
7. Özeti bağımsız olarak hesaplanan değerle karşılaştırın; kaynak dosyanın korunmasını kurum prosedüründe sürdürün.

## Durumların anlamı

`hashed`, verilen dosyanın özetinin hesaplandığını gösterir. `manual`, dosya içeriği olmadan girilen bir kaydı ifade eder; özet alanı N/A olabilir. Bu durum dosya doğrulaması yapılmış demek değildir. Kaynak yolunun bulunamaması veya dosyanın okuma sırasında değişmesi başarısızlık üretir.

> Ekrandaki gözetim zinciri kaydı, kurumsal imzalı teslim tutanağının veya değiştirilemez delil deposunun yerine geçmez. İşlemi yapan alanı uygulamanın sabit etiketi olabilir; gerçek kişinin kimliğini ayrıca kayıt altına alın.

Delilin orijinalini salt okunur veya kurumun kontrollü delil alanında tutun. Rapor tesliminde dosya adı, boyut, SHA-256, kaynak, toplama zamanı ve sorumlu kişiyi birlikte belirtin. Yalnız bir hash satırı dosyanın kaynağını ve bütün geçmişini kanıtlamaz.

---PAGE---
# 17 / DFIR inceleme ekranları

## Bellek Analizi (Memory Analysis)

Mevcut ekran canlı Windows süreçlerinden sınırlı bir liste alır; ilk 30 süreç için bellek kullanımı ve bazı süreç ölçümlerini gösterir. Bu işlem bir .dmp veya .raw dosyasını açıp ayrıştırmaz. Süreç adına dayalı şüpheli işareti, bellekte zararlı kod bulunduğunu göstermez.

Süreç listesini inceleyin, ilgili PID'yi Süreçler ekranıyla karşılaştırın ve gözlem zamanını not edin. Toplama başarısızsa sonuç bilinmiyordur; önce PowerShell erişimini ve Windows izinlerini kontrol edin. Uygulama başarısız toplama yerine otomatik örnek süreç üretmez.

## Kayıt Defteri ve kalıntılar

Bu sürümün aşağıdaki DFIR ekranları ilgili yerel veritabanı tablolarındaki mevcut kayıtları gösterir. Genel bir imaj bağlama, dosya seçip ayrıştırma veya kurtarma akışı uygulanmış değildir. Yeni ve boş profilde sonuç bulunmaması normaldir.

| Ekran | Verinin araştırma bağlamı | Kullanım sınırı |
| Registry Explorer | Kayıt defteri girdileri | Genel canlı kayıt defteri gezgini varsaymayın. |
| Prefetch | Program çalıştırma kalıntıları | Dosya ayrıştırıcısı bu akışta yoktur. |
| Amcache / Shimcache | Uygulama ve uyumluluk izleri | Tek kayıt doğrudan çalıştırma kanıtı değildir. |
| Jump Lists | Uygulama ile ilişkili son öğeler | Kullanıcı işlemi kaynakla doğrulanmalıdır. |
| SRUM | Kaynak kullanımı kayıtları | Otomatik tam geçmiş toplandığı varsayılmaz. |
| USN Journal | Dosya sistemi değişiklik izleri | Tüm disk günlüğünün alındığı varsayılmaz. |
| Recycle Bin | Geri dönüşüm kutusu kayıtları | Dosya kurtarma işlevi olarak kullanılamaz. |

Eski uygulama sürümleri bazı tablolara örnek kayıt eklemiş olabilir. Güncelleme mevcut veritabanını otomatik temizlemez. Kaynağı doğrulanmayan eski kayıtları gerçek delil olarak kullanmayın; arşivleme ve temiz profil kararı öncesinde yedek alın. Yeni sürüm bu DFIR tablolara boş oldukları için örnek kayıt eklemez.

---PAGE---
# 18 / Yetkili port taraması

Red Team Port Scanner, belirtilen tek hedefte TCP bağlantı denemeleri yapar. İşlem hedefe trafik gönderir. Hedef adını veya IP adresini kurumun onaylı kapsamından alın; hedef alanına URL yolu veya kabuk komutu yazmayın.

## Tarama adımları

1. İş emrindeki hedef, zaman aralığı ve iletişim kişisini kontrol edin.
2. Hedef alanındaki varsayılan değeri inceleyerek yetkili hedefle değiştirin.
3. Taramayı başlatın ve tamamlanmasını bekleyin. Modül aynı anda yalnız bir port taraması kabul eder.
4. Açık, kapalı ve filtrelenmiş sonuçları ayırın. Hedef, başlangıç/bitiş zamanı ve portları not edin.
5. Açık bir portun hizmetini ayrı yöntemle doğrulayın. Etiketler çoğunlukla bilinen port eşleştirmesidir.

Arayüzün standart taraması şu portları kullanır: 21, 22, 25, 53, 80, 110, 143, 443, 445, 1433, 3306, 3389, 5432, 6379, 8080 ve 27017. Bu liste tüm 65535 portu kapsamaz. Arka uç, verilen port listelerinde ayrıca boyut ve değer kontrolü uygular; ağ bağlantıları sınırlı sayıda paralel yürütülür.

| Sonuç | Anlamı |
| Open / açık | TCP bağlantısı kurulmuştur. Banner alınamasa da açık port açık kalır. |
| Closed / kapalı | Bağlantı reddedilmiş olabilir. Hedef veya ara cihaz davranışı etkileyebilir. |
| Filtered / filtrelenmiş | Süre içinde bağlantı sonucu alınamamıştır. Tek başına güvenlik duvarı kuralını kanıtlamaz. |

## Nmap göstergesi

Ekranda Nmap kullanılabilirlik kontrolü bulunabilir. Mevcut tarama akışı yerleşik TCP soketleriyle çalışır; bu göstergenin varlığı sürüm tespiti, işletim sistemi parmak izi veya Nmap betik taraması yapıldığı anlamına gelmez.

Taramayı bir üretim uygulamasının işlev testine eşdeğer saymayın. Açık port uygulamanın sağlıklı çalıştığını; kapalı port ise hizmetin hiçbir adresten erişilemediğini kanıtlamaz.

---PAGE---
# 19 / Web, DNS ve saldırı yüzeyi

## HTTP / SSL Inspector

Hedef URL'yi girip analiz başlatın. HTTP bölümünde yanıt durumu ve mevcut güvenlik başlıkları incelenir; TLS bölümünde sertifika ve bağlantı bilgileri alınır. Bu işlem web uygulamasının bütün sayfalarını, oturumlarını veya iş mantığını test etmez.

HTTP ölçümünde GET isteği kullanılır. Yalnız onaylanmış, ölçüm için uygun bir hedef kullanın. Sertifika incelemesi hatalı sertifikayı da raporlayabilmek için bağlantıyı kabul edebilir; sonucu değerlendirirken yetkilendirme/doğrulama alanına bakın. “Bağlanıldı” ile “sertifika doğrulandı” aynı şey değildir.

Mevcut arayüz TLS incelemesinde alan adını kullanarak varsayılan 443 portuna gider. URL'deki özel portun TLS bölümüne aynı şekilde taşındığını varsaymayın. HTTP ve TLS sonuçlarını raporda kendi hedef kapsamlarıyla belirtin. Protokol ve anahtar boyutu gibi alanlar yalnız ölçülebildiğinde değerlendirilmelidir.

## DNS & WHOIS

Alan adını girerek A, AAAA, MX, TXT, NS ve mevcut diğer DNS kayıtlarını inceleyin. Ekran adında WHOIS bulunsa da bu sürümde gerçek alan adı kayıt sahibi sorgusu beklenmemelidir. DNS kaydı sahiplik belgesi değildir. Boş kayıt, ilgili türün yokluğundan veya çözümleme hatasından kaynaklanabilir.

## Attack Surface Mapper

1. Önce aynı hedef için port taramasını tamamlayın.
2. Gerekiyorsa aynı hedefin HTTP ölçümünü yapın.
3. Saldırı yüzeyi ekranında hedefi girip analizi başlatın.
4. Kapsam açıklamasını, kullanılan taramayı ve açık hizmet gözlemlerini okuyun.

Bu görünüm kayıtlı son tamamlanmış port taramasından ve eşleşen HTTP ölçümlerinden derlenir. Veri yoksa açıkça eksik kapsam olarak değerlendirin. Otomatik CVE eşleştirme yapılmaz; CVE listesinin boş olması hedefin zafiyetsiz olduğunu göstermez. Bağımsız bir zafiyet tarama ürününün tüm kontrolleri bu ekrana yüklenmemelidir.

---PAGE---
# 20 / V3 vaka ve delil görünümü

## Vaka Yönetimi (Case Management)

Vaka ekranı başlık, açıklama, önem seviyesi, durum, etiketler ve analist notlarıyla araştırmayı düzenlemeye yardımcı olur. Vaka verileri bu Windows profilinin uygulama içi yerel depolamasında tutulur; merkezi ekip sunucusunda paylaşılmaz.

1. Yeni vaka oluştururken kurum vaka numarasını başlığa ekleyin.
2. Açıklamaya hedef sistemi, zaman aralığını ve araştırma nedenini yazın.
3. Önem seviyesi ve durumunu kurumunuzun sınıflandırmasına göre seçin.
4. Notları gözlem, doğrulama ve karar olarak açık cümlelerle tutun.
5. Bir vakayı silmeden veya arşivlemeden önce gerekli içeriği kurumsal kayıt sistemine aktarın.

İlk kullanımda örnek vaka ve delil içeriği görünebilir. Örnekteki bilgisayar, adres, saldırı grubu ve dosya adları kuruma ait bir tespit değildir. Yeni gerçek vaka oluşturup kendi kaynaklarıyla çalışın. Örnek veriye dayalı risk ve MITRE ilişkilerini kurumsal ölçüm gibi sunmayın.

## Evidence Locker

Bu görünüm vaka deposundaki delil metaverilerini, özet metinlerini ve kayıtlı zincir alanlarını gösterir. Dosya içeriğini AES ile şifreleyen bir kasa değildir. “Doğrulandı” benzeri bir işaret kayıtlı alanın değeridir; ekrana bakılması dosyanın yeniden okunup hash hesaplanmasını sağlamaz.

Gerçek dosyanın özetini hesaplamak için DFIR delil kaydı akışını kullanın; orijinal dosyayı kurumun kontrollü deposunda koruyun. V3 kaydını DFIR veritabanındaki kayıtla kendiliğinden aynı veya senkronize kabul etmeyin.

## Kalıcılık ve paylaşım

Yerel uygulama verilerinin silinmesi, farklı Windows kullanıcısıyla açılması veya profilin değiştirilmesi vaka görünümünü etkileyebilir. Ekipler arası teslim için yalnız bu ekrana güvenmeyin; kurumsal vaka sistemini ve uygulama kapalıyken alınan profil yedeğini kullanın. İlgili yedekleme adımları 26. sayfadadır.

---PAGE---
# 21 / V3 örnek ve eğitim ekranları

Bu sayfa gerçek veriyle karıştırılmaması gereken ekranları açıklar. Mevcut arayüz mantığı korunmuştur; bir düğmenin sonuç üretmesi arka planda gerçek tarama veya sorgu motoru çalıştığını kanıtlamaz.

| Ekran | Mevcut davranış | Uygun kullanım |
| IOC Graph | Sabit düğüm ve ilişki örnekleri | Gösterge ilişkilendirme fikrini öğrenmek |
| Process Tree | Sabit örnek süreç ağacı | Üst/alt süreç ilişkisini görsel olarak anlatmak |
| Forensic Timeline | Sabit olay dizisi | Zaman ve kategori filtrelerini tanımak |
| Detection Lab | Sigma/YARA/IOC sekmeleri; sabit test sonucu | Kural editörü arayüzünü tanımak |
| Threat Hunting | Girilen sorgudan bağımsız örnek sonuçlar | Avcılık sorgusu ekranını tanımak |
| Purple Team Matrix | Önceden tanımlanmış kapsam satırları | Savunma/inceleme/test ilişkisini tartışmak |

## Tespit laboratuvarı ve avcılık

Detection Lab içindeki “Run Test Against SQLite” ifadesine rağmen mevcut işleyiş gerçek bir Sigma veya YARA yürütücüsü değildir. Sonuç sayısını kuralınızın doğruluğu olarak raporlamayın. Threat Hunting sorgu alanında metni değiştirmek de gerçek veritabanında o sorgunun uygulandığını göstermez.

Kurumda tespit kuralı geliştirme için doğrulanmış bir yürütücü, gerçek test verisi ve beklenen olumlu/olumsuz örnekler gerekir. Bu ekranlar o doğrulamanın yerine kullanılamaz.

## MITRE ve çevrimdışı bilgi

MITRE Matrix ile Offline Knowledge Base, mevcut katalog veya kayıtlı vaka bilgilerini yorumlamaya yardımcı olabilir. Bir tekniğin görünmesi kurumda algılama kapsamının test edildiği anlamına gelmez. Kapsam iddiası için gerçek kural, veri kaynağı, test zamanı ve sonuç kaydı gerekir.

> Bu ekranlardan alınan görüntülere kurum içinde “örnek arayüz” açıklaması ekleyin. Eğitim çıktılarıyla gerçek olay raporlarını ayrı tutun. Örnek saldırı adlarını veya adresleri uygulamanın o bilgisayarda bulduğu göstergeler gibi aktarmayın.

---PAGE---
# 22 / Rapor oluşturma

Rapor Üretici (Report Generator), mevcut kayıtlardan seçili özetleri dışa aktarır. PDF, HTML, JSON ve CSV biçimleri bulunur. Rapor üretimi yeni bir sistem taraması başlatmaz; önce ilgili kaynak ekranlarında veri toplama tamamlanmalıdır.

## Adım adım

1. Araştırma kapsamının ve veri toplama zamanının uygun olduğunu doğrulayın.
2. Rapor ekranında dahil edilecek bölümleri seçin.
3. Teslim amacına uygun biçimi seçin: okunabilir paylaşım için PDF/HTML, veri incelemesi için JSON/CSV.
4. Üret ve Kaydet düğmesini kullanın; açılan dosya penceresinde kurumun rapor klasörünü seçin.
5. Dosya adında vaka, sistem ve tarih belirtin. Başarı iletisini, yolu ve dosya boyutunu kontrol edin.
6. Kaydedilen dosyayı açarak kapsamı, karakterleri, sayfaları ve beklenen kayıtları kontrol edin.
7. Kaynak sınırlamalarını ve analist yorumunu teslim notuna ekleyin.

## İçerik sınırları

| Seçenek | Mevcut toplama kapsamı |
| İtibar | En yüksek puanlı en fazla 100 konak kaydı |
| Anomaliler | Yüksek/kritik seviyeli en fazla 50 FIM değişikliği |
| Bağlantılar | Sorguya uyan en fazla 200 bağlantı kaydı |
| Zaman çizelgesi | En son en fazla 300 olay kaydı |
| Sistem bilgisi | Temel bilgisayar/platform/sürüm ve üretim zamanı metaverisi |

Seçilen biçimlerin gösterdiği alanlar aynı olmayabilir. Sistem bilgisi seçeneği ayrıntılı donanım envanteri oluşturmaz; temel metaveri zaten rapora eklenir. Genel rapor bütün DFIR delillerinin, vaka notlarının veya Red Team sonuçlarının eksiksiz dışa aktarımı değildir.

HTML/PDF metinleri kod olarak çalıştırılmaz. CSV'de formül gibi başlayabilen hücrelerin başına koruyucu tek tırnak gelebilir; bu güvenlik amacıyla yapılır. Rapor içeriği yine de kurum verisi taşır. Dosyayı göndermeden önce kullanıcı adları, komut satırları ve iç adresleri gözden geçirin.

---PAGE---
# 23 / Ayarlar ve işletim

## Genel ayarlar

Ayarlar ekranı veritabanı saklama tercihleri, tarama tercihleri ve arayüz yenileme aralığı gibi alanları sunar. Değer değişikliğinden sonra Kaydet düğmesini kullanın. Kaydı doğrulamak için ayarı yeniden açıp aynı değerin geldiğini kontrol edin.

| Alan | Kabul edilen sınır / kullanım |
| Saklama günü | 1-3650 gün |
| Olay satır sınırı | 1-10.000.000 |
| Arayüz yenileme aralığı | 500-3.600.000 ms |
| Tarama hızı | Yavaş, orta veya hızlı |
| Alt ağ kapsamı | Kısa, geçerli kapsam metni; boş değer otomatik davranış için kullanılabilir |

Bir ayarın kaydedilmesi bütün modüllerin bunu hemen uyguladığı anlamına gelmez. Özellikle saklama sürelerinin tüm veritabanlarında ve yerel oturum kayıtlarında aynı temizlik güvencesini verdiğini varsaymayın. Kurumun veri yaşam döngüsü için ayrıca arşiv ve yedek prosedürü uygulayın.

## Performance Monitor

Performans ekranında süreç belleği, çalışma yükü ve mevcut modül ölçümlerini inceleyin. Sorunu tekrar üretirken hangi ekranın açık olduğunu, başlatılan işlemi ve ölçüm zamanını kaydedin. Uzun bir dosya hash işlemi veya ağ taraması sırasında kaynak artışı beklenebilir. Kullanılmayan yoğun taramaları tekrarlamayın.

## Plugin System

Eklenti ekranı çalışma dizinindeki `plugins` klasöründeki JavaScript dosyalarını yükleyebilir. Bu eklentiler ana uygulama yetkisiyle çalışır; imzalı ve yalıtılmış bir eklenti mağazası değildir. Yalnız kurumun kodunu incelediği eklentileri kullanın ve bu klasörün yazma yetkisini sınırlandırın. Yeniden tara işlemi eklentiyi tekrar yükleyebilir.

Çalışma dizininin değişmesi farklı eklenti dosyalarının bulunmasına yol açabilir. Kurumsal kısayolun çalışma klasörünü sabit tutun. Eklenti sistemi, bu kılavuz kapsamındaki 25 güvenlik kontrolünden ayrı bir dağıtım değerlendirmesi gerektirir; bilinmeyen dosyaları buraya eklemeyin.

---PAGE---
# 24 / Yedekleme ve güncelleme

LSIP verileri tek bir rapor dosyasında tutulmaz. Veritabanları, yapılandırma, günlükler ve arayüzün yerel oturum verileri birlikte değerlendirilmelidir. Normal çalışmada Electron kullanıcı veri dizini kullanılır; tam dizin paket ve Windows hesabına göre değişebilir. Veri yolu uygulama günlüklerinde kayıtlıdır.

| Veri | Kullanıcı veri dizinindeki konum |
| SQLite kayıtları | databases alt klasörü |
| Genel ayarlar ve şifreli sağlayıcı bilgileri | config/config.json |
| Uygulama hata ve çalışma günlükleri | logs/error.log ve logs/combined.log |
| Vaka, tercihler ve bazı oturumlar | Electron profilinin yerel depolaması |
| Dışa aktarılmış raporlar | Kullanıcının kaydederken seçtiği klasör |

## Tutarlı yedek alma

1. Devam eden tarama ve rapor üretimlerini tamamlayın; LSIP'ı kapatın.
2. Kurulum sorumlusu gerçek kullanıcı veri dizinini doğrulasın. Farklı kullanıcıların ayrı profilleri olabileceğini dikkate alın.
3. Profilin tamamını kurumun erişimi sınırlı yedek alanına kopyalayın. Yalnız bir .db dosyasını ayırmayın; mevcut SQLite yan dosyalarını da koruyun.
4. Rapor klasörlerini ve ayrı yerdeki orijinal delil dosyalarını kendi yedek planına dahil edin.
5. Tarih, sürüm ve kaynak bilgisayarı yedek kaydına yazın. Yedeğin okunabildiğini pilot geri yükleme ile doğrulayın.

## Taşıma ve geri yükleme

Önce mevcut hedef profili yedekleyin. Uygulama kapalıyken aynı sürümle kontrollü bir geri yükleme yapın; veritabanı, vaka ve ayarları doğrulayın. Farklı hesap veya bilgisayarda şifreli API anahtarları çözülemeyebilir; anahtarları tekrar tanımlayın. Özgün delil dosyaları kopyalanmadıysa kayıtlı kaynak yolları artık geçersiz olabilir.

## Güncelleme

Yeni paketi önce ayrı test profilinde doğrulayın. Sürümü, kaynak verilerin görünmesini ve örnek raporu kontrol ettikten sonra kurumsal dağıtıma geçin. Bu sürüm için otomatik güncelleme veya çevrimiçi eşitleme varsayılmaz. Eski örnek DFIR kayıtlarını temizleme kararı verirken gerçek kayıtlarla karışma ihtimalini ayrıca inceleyin.

---PAGE---
# 25 / Uçtan uca çalışma örnekleri

## A. Şüpheli dış bağlantıyı araştırma

1. Bağlantılar ekranında uzak adresi, portu, PID'yi ve zamanı kaydedin.
2. Süreçler ekranında o andaki PID'nin yolunu ve komut satırını doğrulayın.
3. Olay Gezgini ve DNS verilerinden aynı zaman aralığında destekleyici kayıt arayın.
4. Kurum politikası uygunsa dış gösterge sorgusunu açıp adresi Internet Investigation ile araştırın.
5. Sağlayıcı yargısını yerel kullanım bağlamıyla karşılaştırın; tek puan üzerinden müdahale kararı vermeyin.
6. Kaynakları ve eksik verileri belirterek rapor oluşturun. Sonlandırma gibi işlemleri kurumun olay müdahale kararıyla yürütün.

## B. Dosya değişikliğini inceleme

1. FIM'de değişmiş görünen dosyanın yolunu, eski/yeni özetini ve zamanı alın.
2. Değişiklik zamanını Windows veya uygulama güncelleme kaydıyla karşılaştırın.
3. Gerekiyorsa dosyanın inceleme kopyasını kurumun toplama yöntemiyle hazırlayın.
4. DFIR delil ekranında bu kopyanın kaynak yolunu kaydederek hash hesaplatın.
5. Özeti bağımsız doğrulayın; orijinal ve inceleme kopyasının ilişkisini teslim tutanağına yazın.
6. FIM'in yalnız sınırlı dosya kümesini taradığını raporda belirtin.

## C. Yetkili web hizmeti keşfi

1. Test ekibinden hedef adı, port kapsamı ve çalışma zamanını alın.
2. Port taramasını çalıştırıp açık portları ve ölçüm zamanını not edin.
3. HTTP/TLS ekranında onaylı URL'yi inceleyin; TLS'in varsayılan 443 kapsamını kontrol edin.
4. DNS kayıtlarını alın ve saldırı yüzeyi görünümünde aynı hedef için mevcut ölçümleri birleştirin.
5. “Açık hizmet”, “eksik başlık” ve “doğrulanmamış zafiyet” ayrımını koruyun. CVE testi yapılmadığını yazın.

Her senaryonun kapanışında kullanılan kaynakların zamanını, tamamlanmayan işlemleri, alınan aksiyonu ve sonraki sorumlu kişiyi belirtin. Örnek V3 ekranları bu senaryolarda kanıt kaynağı olarak kullanılmaz.

---PAGE---
# 26 / Sorun giderme

| Belirti | Kontrol ve izlenecek adım |
| Sekme boş veya yükleniyor | Filtreyi temizleyin, ilk yüklemeyi bekleyin, yeniden açın. Kaynak yetkisini ve hata günlüğünü kontrol edin. |
| No handler registered / modül bulunamadı | Uygulamayı yeniden başlatın. Sekme adını ve tam hatayı destek ekibine verin; bu hata veri yok anlamına gelmez. |
| Süreç sonlandırılamadı | PID'nin güncel olduğunu ve Windows yetkisini doğrulayın. Korunan süreçlerde erişim engeli beklenebilir. |
| PowerShell erişim hatası | Kurumsal uygulama kontrol politikasını ve gerekli araçların kullanılabilirliğini yöneticiyle inceleyin. |
| Sağlayıcı sonucu gelmiyor | Çevrimiçi durumu, genel çevrimdışı ayarı, sağlayıcı etkinliği, anahtar ve kotayı kontrol edin. |
| Güvenli depo kullanılamıyor | Windows hesabını ve profilini doğrulayın. Anahtarı açık metinle dosyaya yazmayın; depo düzeldikten sonra yeniden kaydedin. |
| HTTP zaman aşımı / yanıt çok büyük | Hedef/sağlayıcı erişimini kontrol edin. Başarısız ölçümü temiz sonuç kabul etmeyin. |
| FIM veya delil kaydı başarısız | Dosya yolunu, okuma iznini ve dosyanın sabit olduğunu kontrol edin. Büyük dosyanın tamamı okunmalıdır. |
| DFIR kalıntı tablosu boş | Bu sürüm otomatik ayrıştırıcı içermez; mevcut veritabanında kayıt olmayabilir. |
| Tarama sürüyor uyarısı | Önceki port taramasının tamamlanmasını bekleyin. Tekrarlı düğme kullanımından kaçının. |
| PDF/rapor oluşmadı | Kaydetme iptalini, hedef klasör iznini ve disk alanını kontrol edin. Dosyanın gerçekten var olduğunu doğrulayın. |
| Vaka başka hesapta görünmüyor | Yerel Windows/Electron profili farklı olabilir. Doğru profil ve yedek düzenini kontrol edin. |

## Destek kaydında ne gönderilmeli?

LSIP sürümü, Windows sürümü, sekme adı, işlemin zamanı, tekrar üretme adımları ve tam hata metnini paylaşın. İlgili günlük bölümünü gönderirken anahtar, kullanıcı adı, iç adres veya parola içeren komut satırını kurum politikasına göre ayıklayın. Sağlayıcı API anahtarının kendisini destek kaydına koymayın.

Sorun çözüldüğünde aynı küçük işlemi tekrar çalıştırıp beklenen sonucu doğrulayın. Bütün veri dizinini silmek ilk sorun giderme adımı değildir; araştırma ve vaka kayıtlarını kaybedebilirsiniz.

---PAGE---
# 27 / Kullanım ve teslim kontrolleri

## Kurumsal kabul sırasında

1. Teslim paketinin sürümü ve kaynağı kayıt altına alındı.
2. Doğru Windows hesabında uygulama açıldı ve çevrimdışı başlangıç doğrulandı.
3. Süreç, bağlantı ve olay ekranlarından pilot sistemde gerçek veri okunabildi.
4. Türkçe dil, tema ve temel ayarlar kaydedilip yeniden açılışta kontrol edildi.
5. Dış sağlayıcı kullanılıyorsa küçük sorgu ve bağlantı kapatma akışı doğrulandı.
6. Küçük bir test dosyası için DFIR SHA-256 değeri bağımsız değerle eşleşti.
7. Örnek bir PDF raporu oluşturuldu, açıldı ve kapsamı kontrol edildi.
8. V3 örnek ekranlarının sınırları kullanıcı eğitiminde açıklandı.
9. Profil yolu, yedekleme sorumlusu ve destek iletişim süreci belirlendi.
10. Üretim paketindeki eklenti klasörü ve yazma yetkileri dağıtım ekibince incelendi.

## Günlük başlangıç

Doğru bilgisayar ve hesabı kontrol edin. Araştırma kapsamını açın. Önceki filtreleri ve verinin zamanını inceleyin. Yalnız ihtiyaç duyduğunuz taramaları başlatın. Dış bağlantıyı görev gerektiriyorsa açın.

## Rapor tesliminden önce

Hedef, saat dilimi, kaynak ve ölçüm zamanı yazılı olmalıdır. Gerçek ölçüm ile örnek veri ayrılmalıdır. Önbellek yaşı ve eksik kaynaklar belirtilmelidir. Rapor dosyası açılarak gözle kontrol edilmelidir. Delil referanslarıyla hash değerleri eşleştirilmelidir. Kurum verisi içeren alanlar uygun alıcıya gönderilmelidir.

## Çalışma sonunda

Devam eden işlemleri tamamlayın. Gerekli rapor ve notları arşivleyin. Dış istihbarat bağlantısını kapatın. Uygulamayı kapattıktan sonra planlı yedeği alın. Gerçek delil dosyalarını, uygulama kayıtlarını ve raporları farklı saklama ihtiyaçlarıyla yönetin.

Bu kontrol listesi ürünün kurumsal kabulünü kolaylaştırır; uygulama içinde otomatik tamamlanan bir onay süreci değildir. Sorumlu kişi tarih ve sonucu kurumun kendi teslim kaydına işler.

---PAGE---
# 28 / Terimler ve belge kapsamı

| Terim | Bu kılavuzdaki anlamı |
| IOC | Araştırmada kullanılan IP, alan adı veya dosya özeti gibi gösterge. |
| PID / PPID | Süreç ve üst süreç kimliği; zaman içinde yeniden kullanılabilir. |
| SHA-256 | Dosya içeriğinden hesaplanan özet; kaynak ve sahiplik bilgisi değildir. |
| FIM | Belirli dosyaların özetlerini karşılaştırarak değişiklik izleme. |
| DFIR | Dijital adli inceleme ve olay müdahalesi çalışma alanı. |
| Önbellek | Daha önce alınmış yanıtın yeniden kullanılması. |
| TLS | Uzak hizmetle kurulan şifreli bağlantının protokolü. |
| Authenticode | Windows dosya imzası doğrulama mekanizması. |
| Gözetim zinciri | Delilin kim tarafından, ne zaman ve nasıl işlendiğinin kaydı. |
| Kural tabanlı analiz | Önceden yazılmış koşullardan sonuç üretme. |
| CVE | Belirli bir yayımlanmış güvenlik açığının kimliği; açık porttan otomatik çıkarılamaz. |
| Örnek veri | Arayüzü göstermek için hazırlanmış, gerçek ölçüme dayanmayan kayıt. |

## Belgenin dayanağı

Bu kılavuz 10 Eylül 2026 tarihinde incelenen uygulama ekranları ve kaynak uygulamalarına göre hazırlanmıştır. Başlıca dayanaklar; ana uygulama ve ayar akışı, Blue Team modülleri, internet sağlayıcı yönetimi, DFIR ve Red Team işlemleri, rapor üreticisi, V3 görünümleri ve yerel vaka deposudur. Eski kılavuzlardaki uygulanmamış özellik iddiaları bu belgeye taşınmamıştır.

Güvenlik düzeltmelerinin kaynak testleri, gerçek dosya doğrulamaları ve yalıtılmış Electron sınır testleri ayrı teknik doğrulama kaydında tutulur. Bu testler her müşteri ortamının, dış sağlayıcının veya bütün sekmelerin uçtan uca kabul testinin yerine geçmez. Kurumsal teslim edilen yürütülebilir paket ayrıca pilot ortamda doğrulanmalıdır.

## Sürüm değişiklikleri

Yeni bir sürümde gerçek kalıntı ayrıştırıcı, tespit motoru, merkezi ekip deposu veya farklı paketleme eklendiğinde ilgili kullanım bölümleri güncellenmelidir. Ürün arayüzü ile bu belge arasında fark gördüğünüzde sürüm ve ekran adını destek kaydına ekleyin; belgede bulunmayan bir yeteneği var kabul etmeyin.

Belge sahibi: LSIP ürün ve dağıtım ekibi. Bu sürümün amacı, kullanıcıların mevcut uygulamayı doğru kapsamla çalıştırmasını ve bulgularını anlaşılır biçimde teslim etmesini sağlamaktır.
