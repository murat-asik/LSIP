import { en } from './en';

export const tr: typeof en = {
  // Navigation & Workspaces
  workspaces: {
    blue: 'MAVİ TAKIM',
    dfir: 'ADLİ BİLİŞİM',
    red: 'KIRMIZI TAKIM',
    socDashboard: 'SOC Kontrol Paneli',
    assetDiscovery: 'Varlık Keşfi',
    reputationEngine: 'Repütasyon Motoru',
    threatIntel: 'Tehdit İstihbaratı',
    netTopology: 'Ağ Topolojisi',
    connMonitor: 'Bağlantı İzleyici',
    processExplorer: 'Süreç Gezgini',
    threadExplorer: 'İz (Thread) Gezgini',
    dllDependency: 'DLL Bağımlılıkları',
    eventExplorer: 'Olay Gezgini',
    timelineView: 'Zaman Çizelgesi',
    dnsIntel: 'DNS İstihbaratı',
    smbIntel: 'SMB İstihbaratı',
    rdpMonitor: 'RDP İzleyici',
    certScanner: 'Sertifika Tarayıcı',
    usbMonitor: 'USB İzleyici',
    fim: 'Dosya Bütünlüğü (FIM)',
    persistenceScanner: 'Kalıcılık Tarayıcı',
    iocScanner: 'IOC Tarayıcı',
    behaviorAnalytics: 'Davranış Analizi',
    aiAnalyst: 'Yapay Zeka Güvenlik Analisti',
    reportGenerator: 'Rapor Oluşturucu',
    pluginSystem: 'Eklenti Sistemi',
    settings: 'Ayarlar',

    // DFIR
    evidenceCustody: 'Kanıt & Gözetim Chain',
    memoryAnalysis: 'Bellek Analizi',
    registryExplorer: 'Registry Gezgini',
    prefetchParser: 'Prefetch Ayrıştırıcı',
    amcacheParser: 'Amcache Ayrıştırıcı',
    shimcacheParser: 'ShimCache Ayrıştırıcı',
    jumplistsParser: 'JumpLists Ayrıştırıcı',
    srumMetrics: 'SRUM Metrikleri',
    usnJournal: 'USN Günlüğü',
    recycleBin: 'Geri Dönüşüm Kutusu',

    // RED TEAM
    portScanner: 'Port Tarayıcı & Banner',
    httpSslInspector: 'HTTP & SSL Denetleyici',
    dnsWhois: 'DNS & WHOIS İstihbaratı',
    attackSurface: 'Saldırı Yüzeyi & CVEler',
  },

  // Common UI
  common: {
    searchPlaceholder: 'Genel arama (Ctrl+K)...',
    online: 'ÇEVRİMİÇİ',
    offline: 'ÇEVRİMDIŞI',
    limited: 'SINIRLI',
    noInternet: 'İNTERNET YOK',
    connect: 'Bağlan',
    disconnect: 'Kopart',
    cpu: 'İÇB (CPU)',
    ram: 'BELLEK (RAM)',
    disk: 'DİSK',
    themeLight: 'Açık Mod',
    themeDark: 'Karanlık Mod',
    langEnglish: 'English',
    langTurkish: 'Türkçe',
    status: 'Durum',
    riskScore: 'Risk Puanı',
    actions: 'Eylemler',
    export: 'Dışa Aktar',
    refresh: 'Yenile',
    loading: 'Yükleniyor...',
    noData: 'Veri bulunamadı',
    details: 'Detaylar',
    save: 'Kaydet',
    cancel: 'İptal',
  },

  // AI Security Analyst
  aiAnalyst: {
    title: 'Yapay Zeka Siber Güvenlik Analisti',
    subtitle: 'SOC, Adli Bilişim ve Keşif telemetrilerini sentezleyerek uygulanabilir savunma önerileri sunan otonom analist.',
    reAnalyze: 'Durumu Yeniden Analiz Et',
    execRisk: 'Yönetici Risk Durumu',
    attackSurface: 'Saldırı Yüzeyi Değerlendirmesi',
    exposedServices: 'Dışa Açık Servisler Telemetrisi',
    certHealth: 'Taşıma Katmanı & Sertifika Sağlığı',
    webHeaders: 'Web Güvenlik Başlıkları Denetimi',
    mitigations: 'Uygulanabilir Güvenlik Sıkılaştırma & İyileştirme Önerileri',
  },

  // DFIR
  dfirView: {
    title: 'Dijital Adli Bilişim & Gözetim Zinciri',
    subtitle: 'Çevrimdışı SQLite kanıt kaydı ve müdahale gözetim zinciri takibi.',
    acquireTitle: 'Adli Bilişim Kanıtı Edin / Kaydet',
    registerItem: 'Öğeyi Kaydet',
    forensicItems: 'Adli Öğe Listesi',
    chainOfCustody: 'Gözetim Zinciri Defteri',
  },

  // RED TEAM
  redTeamView: {
    portScannerTitle: 'Yerel Port Tarayıcı & Servis Banner Numaralandırıcı',
    portScannerSubtitle: 'Saldırgan olmayan ağ port taraması, gecikme ölçümü ve servis banner edinimi.',
    httpTitle: 'HTTP Güvenlik & SSL Sertifika Denetleyicisi',
    httpSubtitle: 'HTTP güvenlik başlıklarını (HSTS, CSP, CORS, XFO) ve TLS x509 sertifika zincirlerini inceleyin.',
    dnsTitle: 'DNS İstihbaratı & WHOIS Çözümleyici',
    dnsSubtitle: 'DNS kayıtlarını (A, AAAA, MX, TXT, NS, CAA, SOA, SPF, DMARC) ve WHOIS ağ bloklarını sorgulayın.',
    surfaceTitle: 'Saldırı Yüzeyi Haritası & CVE Korelasyonu',
    surfaceSubtitle: 'IP → Port → Servis → Yazılım Sürümü → Kamu NVD/CVE bilinen zafiyet eşleme haritası.',
    startScan: 'Port Taramasını Başlat',
    inspectWeb: 'Web Hedefini Denetle',
    resolveDns: 'DNS Kayıtlarını Çözümle',
    evaluateSurface: 'Saldırı Yüzeyini Değerlendir',
  }
};
