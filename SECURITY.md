# Güvenlik

LSIP yalnız yetkili sistemlerde ve kurumun belirlediği kapsamda kullanılmalıdır. Uygulamanın sahip olduğu Windows izinleri, dosya ve süreç işlemlerini etkiler.

## Bu sürümdeki düzeltmeler

PID ve tarama girdileri doğrulanır; FIM dosyaları kabuk komutu üretmeden okur. IPC güvenilir ana pencere ve belgeyle sınırlandırılır. HTML/PDF rapor metni kaçırılır, CSV formülleri metne dönüştürülür. Sağlayıcı anahtarları güvenli depoda saklanır ve renderer'a geri gönderilmez. HTTP işlemleri süre/boyut sınırı ve çevrimdışı iptal kullanır. Ölçüm bulunmaması doğrulanmış temiz sonuç olarak sunulmaz.

## Sınırlar

Bu kontroller tam ürün güvenlik sertifikasyonu değildir. Yerel Windows hesabının veya güvenilir eklentinin ele geçirilmesi farklı bir güven sınırıdır. MITRE/Purple eşlemeleri doğrulanmış tespit kapsamı değildir. Yerel sezgisel analiz, LLM veya otonom analist değildir. Kılavuz mevcut işlevleri ve sınırlarını açıklar.

## Sorun bildirme

Gerçek API anahtarlarını, parola içeren komutları, kişisel veriyi veya kurumsal delilleri herkese açık sorun kaydına eklemeyin. Güvenlik sorunu için depo sahibiyle özel iletişim kurun; depo sahibi özel güvenlik bildirimini etkinleştirdiyse ilgili kanalı kullanın. Sürüm, etkilenen alan, zararsız tekrar üretme adımları ve beklenen/gerçekleşen davranışı paylaşın.

Depoda örnek dışındaki anahtar veya kişisel veri bulunmamalıdır. Bir anahtar yanlışlıkla yayımlandıysa yalnız dosyayı silmek yeterli değildir; anahtarı ilgili sağlayıcıdan yenileyin ve depo geçmişini ayrıca değerlendirin.

## Yedek güvenliği

Yedek içeriği parola türetilmiş anahtarla AES-256-GCM kullanılarak şifrelenir; manifest bütünlüğü HMAC-SHA-256 ile doğrulanır. Kanıt kasası ve kayıtlı sağlayıcı kimlik bilgileri Windows DPAPI korumasını korur. Bu nedenle geri yükleme aynı Windows hesabı/bilgisayarıyla sınırlıdır. Parola kurtarma ve farklı makineye taşıma bu sürümde yoktur. Yedek parolasını veriyle aynı yerde saklamayın. Geri yüklemeden önceki veri uygulama kullanıcı dizinindeki `.restore-rollback` içinde korunur; kurumun saklama politikası bu yerel kopyaları da kapsamalıdır.
