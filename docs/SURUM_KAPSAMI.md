# LSIP 3.0.2 — Kullanım kapsamı

LSIP, Windows x64 üzerinde çalışan yerel bir güvenlik inceleme uygulamasıdır. Türkçe ve İngilizce arayüz; sistem/ağ gözlemi, olay inceleme, vaka yönetimi, kural değerlendirme, adli analiz yardımcıları ve raporlama sunar.

## Çalıştırma

GitHub Releases bölümündeki EXE taşınabilir uygulamadır. ZIP alternatif dağıtımdır; tamamını aynı klasöre çıkardıktan sonra uygulamayı çalıştırın. İndirilen dosyaların SHA-256 değerlerini sürümdeki SHA256SUMS.txt ile karşılaştırabilirsiniz. SHA-256 değerleri gizli anahtar değildir.

EXE dijital olarak imzalı değildir. İlk açılış çevrimdışıdır. Dış sorgular için sağlayıcıların kendi hesapları, API anahtarları ve kullanım hakları gerekir. URLhaus dahil anahtar gerektiren sağlayıcıları Ayarlar ekranından yapılandırın. Hiçbir gerçek anahtarı kaynak kod, sorun kaydı veya herkese açık rapora koymayın.

## Özellik sınırları

- Bu sürüm merkezi sunucu, çok kullanıcılı yönetim, SSO veya rol bazlı kurumsal yönetim içermez.
- AI ekranı yerel sezgisel analiz yapar; LLM veya otonom araştırmacı değildir.
- MITRE/Purple ekranları vaka eşlemelerini gösterir; tüm tekniklerde doğrulanmış tespit kapsamı sunmaz.
- Sağlayıcıda sonuç bulunmaması, hedefin güvenli olduğunun kanıtı değildir. Kota, yetki ve bağlantı sorunları sonucu etkiler.
- Sigma/Hunt değerlendirmesi desteklenen sözdizimi alt kümesiyle ve sınırlı olay kümesiyle çalışır. Kural kaydetmek kuralın doğrulandığı anlamına gelmez.
- Bellek analizi uygun Windows dökümü ve semboller gerektirir. Disk analizinde desteklenen veri kaynağı ve gerekli dosyalar sağlanmalıdır.
- Bazı Windows verilerine standart kullanıcı hesabından erişilemez. Erişim ve kısmi veri uyarılarını dikkate alın.
- Şifreli yedekleme aynı Windows hesabı/bilgisayarı için tasarlanmıştır. Parola kurtarma veya başka makineye anahtar taşıma bu sürümde yoktur.
- Uygulamanın çevrimdışı düğmesi sistem güvenlik duvarı değildir. Kullanıcının başlattığı ağ incelemeleri ayrıca trafik oluşturabilir.

Bu açıklama tüm Windows ortamlarında hatasızlık veya bir güvenlik sertifikasyonu beyanı değildir. Kullanmadan önce kendi kurumunuzun kabul testlerini gerçekleştirin.

## Belgeler ve dağıtım

Kullanım kılavuzu `output/pdf/` altındadır. Yeni sürüm davranışlarını bu belge ve CHANGELOG tamamlar. Bileşen envanteri `docs/BILESEN_ENVANTERI.json`; araç lisans bildirimleri dağıtımın `resources/tools/` dizinindedir. İç geliştirme raporları son kullanıcı paketinin parçası değildir.
