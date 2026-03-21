// ==UserScript==
// @name         Yoklama Sayfası İzin Belirteci
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  İzin/Görev sekmesindeki izinleri okur, Ders Yoklama sekmesine İZİNLİ yazar.
// @author       YZ yardımıyla mahmutelmas@yaani.com
// @updateURL    https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Kurumsal/main/yoklama-sayfasi-izin-belirteci.user.js
// @downloadURL  https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Kurumsal/main/yoklama-sayfasi-izin-belirteci.user.js
// @match        *://spor.gsb.gov.tr/Modules/Antrenman/AntrenorPersonelDetay.aspx?antrenorpersonelid=*
// @grant        none
// ==/UserScript==
(function() {
    'use strict';

    // --- DURUM DEĞİŞKENLERİ ---
    let izinSenkronTamamlandi = false; // Senkronizasyon bir kez yapıldı mı?
    let senkronDevamEdiyor    = false; // Şu an senkronizasyon işlemi sürüyor mu?
    let tabloObserver         = null;  // MutationObserver referansı (temizlik için)

    // --- TARİH PARSE FONKSİYONLARI ---

    // İzin tablosundaki tarih formatı: "16-03-2026 00:00:00"
    function parseIzinDate(dateStr) {
        if (!dateStr) return null;
        let parts  = dateStr.trim().split(" ");
        let dParts = parts[0].split("-");
        if (dParts.length < 3) return null;
        let tParts = parts[1] ? parts[1].split(":") : [0, 0, 0];
        return new Date(
            Number(dParts[2]),      // yıl
            Number(dParts[1]) - 1, // ay (0-tabanlı)
            Number(dParts[0]),      // gün
            Number(tParts[0]),
            Number(tParts[1]),
            Number(tParts[2])
        );
    }

    // Ders tablosundaki tarih+saat: "16.03.2026 Pazartesi" ve "09:00"
    // Not: dateStr içinde "16.03.2026 Pazartesi" gibi ekstra metin olabilir,
    // bu yüzden önce boşlukla bölüp ilk parçayı alıyoruz, sonra "." ile bölüyoruz.
    function parseDersDate(dateStr, timeStr) {
        if (!dateStr || !timeStr) return null;
        let dParts = dateStr.trim().split(" ")[0].split(".");
        if (dParts.length < 3) return null;
        let tParts = timeStr.trim().split(":");
        return new Date(
            Number(dParts[2]),
            Number(dParts[1]) - 1,
            Number(dParts[0]),
            Number(tParts[0]),
            Number(tParts[1]),
            0
        );
    }

    // --- UYARI MESAJI (Banner) ---

    // Ders yoklama sekmesinin üst kısmına sarı bir bilgi bandı ekler.
    function uyariGoster() {
        if (document.getElementById('izin-sync-uyari')) return;
        const uyari = document.createElement('div');
        uyari.id = 'izin-sync-uyari';
        uyari.style.cssText = `
            position: sticky; top: 0; z-index: 9999;
            background: #fff3cd; border: 1px solid #ffc107;
            color: #856404; padding: 8px 14px; border-radius: 4px;
            font-size: 13px; font-weight: bold; margin-bottom: 8px;
            display: flex; align-items: center; gap: 8px;
        `;
        uyari.innerHTML = `
            <span style="font-size:16px; animation: spin 1s linear infinite; display:inline-block;">⏳</span>
            İzin verileri senkronize ediliyor, lütfen bekleyiniz...
        `;
        const hedef = document.querySelector('#tabProgramDers');
        if (hedef) hedef.prepend(uyari);
    }

    function uyariKaldir() {
        const uyari = document.getElementById('izin-sync-uyari');
        if (uyari) uyari.remove();
    }

    // --- ANA SENKRONIZASYON: İzin sekmesine git, bekle, geri dön ---

    function izinSekmesiniBekleVeGeriDon() {
        if (senkronDevamEdiyor || izinSenkronTamamlandi) return;
        senkronDevamEdiyor = true;

        uyariGoster();

        const izinTabLink = document.querySelector('a[href="#tabIzin"]');
        const dersTabLink = document.querySelector('a[href="#tabProgramDers"]');

        if (!izinTabLink || !dersTabLink) {
            uyariKaldir();
            senkronDevamEdiyor = false;
            return;
        }

        // İzin sekmesine programatik olarak geç
        izinTabLink.click();

        // İzin tablosunun AJAX ile yüklenmesini bekle
        let deneme = 0;
        const bekle = setInterval(() => {
            deneme++;

            const loadDiv    = document.querySelector('#tabIzin .fixed-table-loading');
            const yukleniyor = loadDiv && getComputedStyle(loadDiv).display !== 'none';
            const satirlar   = document.querySelectorAll('#gridIzinListesi tbody tr');

            // Yükleme bitti mi? (yükleniyor=false VE en az bir satır var VEYA 20 denemeyi geçtik)
            if (!yukleniyor && (satirlar.length > 0 || deneme > 20)) {
                clearInterval(bekle);

                // Yoklama sekmesine geri dön
                dersTabLink.click();

                // Yoklama tablosunun da yüklenmesini bekle
                let deneme2 = 0;
                const bekle2 = setInterval(() => {
                    deneme2++;
                    const loadDiv2    = document.querySelector('#tabProgramDers .fixed-table-loading');
                    const yukleniyor2 = loadDiv2 && getComputedStyle(loadDiv2).display !== 'none';
                    const satirlar2   = document.querySelectorAll('#CetGridProgramDers tbody tr');

                    if (!yukleniyor2 && (satirlar2.length > 0 || deneme2 > 20)) {
                        clearInterval(bekle2);
                        izinSenkronTamamlandi = true;
                        senkronDevamEdiyor   = false;

                        // İzin etiketlerini tabloya uygula
                        checkIzinDurumu();

                        // Bundan sonra tablo her değiştiğinde (sayfa, sıralama)
                        // otomatik yeniden uygula
                        izlemeBaslat();

                        uyariKaldir();
                    }
                }, 400);
            }

            if (deneme > 30) {
                clearInterval(bekle);
                senkronDevamEdiyor = false;
                uyariKaldir();
            }
        }, 400);
    }

    // --- MUTATIONOBSERVER: Tablo yeniden render edilince tekrar uygula ---
    // Bootstrap-table sayfalama veya sıralama yapıldığında tüm tbody'yi
    // yeniden yazar; bu da bizim eklediğimiz İZİNLİ etiketlerini siler.
    // MutationObserver bunu algılar ve checkIzinDurumu()'yu yeniden çalıştırır.

    function izlemeBaslat() {
        // Zaten bir observer çalışıyorsa önce temizle
        if (tabloObserver) tabloObserver.disconnect();

        const tbody = document.querySelector('#CetGridProgramDers tbody');
        if (!tbody) return;

        tabloObserver = new MutationObserver(() => {
            // Bootstrap-table satırları yazarken DOM çok hızlı değişir;
            // kısa bir gecikme veriyoruz ki render tamamlansın.
            setTimeout(checkIzinDurumu, 300);
        });

        // Sadece doğrudan çocuk değişikliklerini (satır ekleme/silme) izle
        tabloObserver.observe(tbody, { childList: true });
    }

    // --- İZİN DURUMU KONTROL VE YAZMA FONKSİYONU ---

    function checkIzinDurumu() {
        // 1) İzin tablosundaki onaylanmış tüm izin aralıklarını topla
        let izinler = [];
        document.querySelectorAll('#gridIzinListesi tbody tr').forEach(row => {
            let cells = row.querySelectorAll('td');
            // cells[4] = Onay Durumu sütunu (HTML'deki sırayla: İzinTuru, Başlangıç, Bitiş, Açıklama, OnayDurumu...)
            if (cells.length > 5 && cells[4].textContent.trim().includes("Onaylandı")) {
                let startDate = parseIzinDate(cells[1].textContent.trim());
                let endDate   = parseIzinDate(cells[2].textContent.trim());
                if (startDate && endDate) {
                    izinler.push({ start: startDate, end: endDate });
                }
            }
        });

        // 2) Ders tablosundaki her satırı kontrol et
        let eslesenDersSayisi = 0;
        document.querySelectorAll('#CetGridProgramDers tbody tr').forEach(row => {
            let cells = row.querySelectorAll('td');
            // Ders tablosu sütunları: checkbox, ProgramDersId, DersAd, TesisAd,
            //                         Gun(4), DersSaat(5), CalismaGrubu, Konum, YoklamaDurum(8)
            if (cells.length > 8) {
                let dersTarihi = parseDersDate(
                    cells[4].textContent.trim(), // "16.03.2026 Pazartesi"
                    cells[5].textContent.trim()  // "09:00"
                );

                if (dersTarihi) {
                    let isIzinli = izinler.some(
                        izin => dersTarihi >= izin.start && dersTarihi <= izin.end
                    );

                    if (isIzinli) {
                        eslesenDersSayisi++;
                        let durumCell = cells[8];
                        // Zaten İZİNLİ yazıyorsa tekrar yazma (gereksiz DOM işlemi)
                        if (!durumCell.innerHTML.includes("İZİNLİ")) {
                            durumCell.innerHTML = `
                                <span style="color:white; background-color:#d9534f;
                                      padding:3px 6px; border-radius:4px;
                                      font-weight:bold; display:inline-block;">İZİNLİ</span>
                            `;
                        }
                    }
                }
            }
        });

        if (izinler.length > 0 || eslesenDersSayisi > 0) {
            console.log(`✅ İzin senkron — Toplam izin: ${izinler.length}, İzinli ders: ${eslesenDersSayisi}`);
        }
    }

    // --- YOKLAMA SEKMESİNE TIKLAMA ALGILAMAs ---

    document.addEventListener('click', function(e) {
        const tiklanan = e.target.closest('a[href="#tabProgramDers"]');
        if (tiklanan && !izinSenkronTamamlandi && !senkronDevamEdiyor) {
            // Sekme geçiş animasyonunun başlaması için kısa bir bekleme
            setTimeout(izinSekmesiniBekleVeGeriDon, 300);
        }
    });

    // --- SAYFA AÇILIŞINDA OTOMATİK BAŞLATMA ---
    // Eğer sayfa doğrudan yoklama sekmesi aktif olarak açılıyorsa
    // (Document 3'teki gibi HaftalikProgram li class="active")
    // kullanıcı tıklamadan senkronu tetiklememiz gerekir.

    window.addEventListener('load', () => {
        setTimeout(() => {
            const dersTabAktif = document.querySelector('li.active a[href="#tabProgramDers"]');
            if (dersTabAktif && !izinSenkronTamamlandi) {
                izinSekmesiniBekleVeGeriDon();
            }
        }, 1000); // Sayfanın AJAX tablolarını yüklemesi için 1 saniye bekle
    });

    // --- DÖNDÜRME ANİMASYONU (banner'daki ⏳ için) ---
    const style = document.createElement('style');
    style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

})();
