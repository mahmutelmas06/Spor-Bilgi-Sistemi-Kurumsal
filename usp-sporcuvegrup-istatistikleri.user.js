// ==UserScript==
// @name         Ulusal Spor Projeleri Sporcu ve Grup İstatistikleri
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Sporcu Ara: Antrenör, E-Devlet, Yaş, Grup Adı, Toplam Ders Saati
// @author       YZ yardımıyla mahmutelmas@yaani.com
// @updateURL    https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Kurumsal/main/usp-sporcuvegrup-istatistikleri.user.js
// @downloadURL  https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Kurumsal/main/usp-sporcuvegrup-istatistikleri.user.js
// @match        https://spor.gsb.gov.tr/Modules/UlusalSporProjeleri/KursGrupAra.aspx*
// @match        https://spor.gsb.gov.tr/Modules/UlusalSporProjeleri/KursSporcuAra.aspx*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Tablo sarmalayıcılarının overflow kısıtlamasını kaldır
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        let parent = table.parentElement;
        while (parent && parent !== document.body) {
            parent.style.setProperty('overflow',   'visible', 'important');
            parent.style.setProperty('overflow-x', 'visible', 'important');
            parent.style.setProperty('overflow-y', 'visible', 'important');
            parent.style.setProperty('max-width',  'none',    'important');
            parent.style.setProperty('max-height', 'none',    'important');
            parent = parent.parentElement;
        }
    });

    /* ================================================================
       ORTAK: Yardımcılar
    ================================================================ */
    function temizle(metin) {
        return (metin || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR');
    }

    window._gsbRetry = window._gsbRetry || {};
    var _retrySeq = 0;

    function yenidenDeneTD(td, tetikFn) {
        var rid = 'r' + (++_retrySeq);
        window._gsbRetry[rid] = function () {
            delete window._gsbRetry[rid];
            tetikFn();
        };
        td.innerHTML =
            '<span style="color:red;font-size:0.85em;">Zaman Aşımı</span> ' +
            '<button style="font-size:0.8em;padding:1px 6px;cursor:pointer;" ' +
            'onclick="window._gsbRetry[\'' + rid + '\'] && window._gsbRetry[\'' + rid + '\']()">' +
            '&#x21BA; Tekrar</button>';
    }

    /* ================================================================
       ORTAK: iframe ile detay sayfasını yükle + stabillik kontrolü
       Her iki tablo da (GorevliListesi + GrupListesi) yüklenip
       3 ardışık kontrolde satır sayısı sabit kalınca tamam() çağrılır.
    ================================================================ */
    function detaySayfasiniYukle(url, tamam, zaman) {
        var iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left     = '-9999px';
        iframe.style.width    = '1200px';
        iframe.style.height   = '800px';
        iframe.src = url;
        document.body.appendChild(iframe);

        iframe.onload = function () {
            var deneme     = 0;
            var MAX        = 80;   // 80 × 500 ms = 40 s
            var stabilSayac = 0;
            var oncekiHash = '';

            var tid = setInterval(function () {
                if (deneme++ >= MAX) {
                    clearInterval(tid);
                    iframe.remove();
                    zaman();
                    return;
                }
                try {
                    var idoc = iframe.contentDocument || iframe.contentWindow.document;
                    var iwin = idoc.defaultView || iframe.contentWindow;

                    var grupTablo    = idoc.querySelector('#CetGridGrupListesi');
                    var gorevliTablo = idoc.querySelector('#CetGridGorevliListesi');
                    if (!grupTablo || !gorevliTablo) { stabilSayac = 0; return; }

                    var spinnerGrup    = grupTablo.closest('.bootstrap-table')    ? grupTablo.closest('.bootstrap-table').querySelector('.fixed-table-loading')    : null;
                    var spinnerGorevli = gorevliTablo.closest('.bootstrap-table') ? gorevliTablo.closest('.bootstrap-table').querySelector('.fixed-table-loading') : null;

                    var yukleniyor = false;
                    if (spinnerGrup    && iwin.getComputedStyle(spinnerGrup).display    !== 'none') yukleniyor = true;
                    if (spinnerGorevli && iwin.getComputedStyle(spinnerGorevli).display !== 'none') yukleniyor = true;
                    if (yukleniyor) { stabilSayac = 0; return; }

                    var satirlarGrup    = grupTablo.querySelectorAll('tbody tr');
                    var satirlarGorevli = gorevliTablo.querySelectorAll('tbody tr');
                    if (!satirlarGrup.length || !satirlarGorevli.length) { stabilSayac = 0; return; }

                    var sayiGrup    = satirlarGrup[0].classList.contains('no-records-found')    ? 0 : satirlarGrup.length;
                    var sayiGorevli = satirlarGorevli[0].classList.contains('no-records-found') ? 0 : satirlarGorevli.length;

                    var guncelHash = sayiGrup + '-' + sayiGorevli;
                    if (guncelHash !== oncekiHash) { oncekiHash = guncelHash; stabilSayac = 0; return; }

                    stabilSayac++;
                    if (stabilSayac >= 3) {
                        clearInterval(tid);
                        iframe.remove();
                        tamam(idoc);
                    }
                } catch (e) { console.error('[GSB v27]', e); }
            }, 500);
        };
    }

    /* ================================================================
       BÖLÜM 1 — KursGrupAra  (değiştirilmedi)
    ================================================================ */
    function grupAraModuBaslat() {
        var isKuyrugu       = [];
        var guncelCalismaId = 0;
        var gozlemciTimer;
        var MAX_AKTIF_IS    = 2;
        var aktifIsSayisi   = 0;

        new MutationObserver(function () {
            clearTimeout(gozlemciTimer);
            gozlemciTimer = setTimeout(tabloyuKontrolEt, 1000);
        }).observe(document.body, { childList: true, subtree: true });

        window.addEventListener('pageshow', tabloyuKontrolEt);
        setTimeout(tabloyuKontrolEt, 1500);

        function tabloyuKontrolEt() {
            var tablo = document.getElementById('CetGridKursGrupListesi');
            if (!tablo) return;
            var theadTr  = tablo.querySelector('thead tr');
            var ilkSatir = tablo.querySelector('tbody tr');
            if (!theadTr || !ilkSatir) return;
            var baslikYok = !theadTr.querySelector('.antrenor-th');
            var hucreYok  = !ilkSatir.querySelector('.antrenor-td') && !ilkSatir.classList.contains('no-records-found');
            if (baslikYok || hucreYok) sistemiSifirla();
        }

        function sistemiSifirla() {
            guncelCalismaId++;
            isKuyrugu     = [];
            aktifIsSayisi = 0;
            init();
        }

        function init() {
            var tablo = document.getElementById('CetGridKursGrupListesi');
            if (!tablo) return;
            var theadTr = tablo.querySelector('thead tr');

            if (theadTr && !theadTr.querySelector('.antrenor-th')) {
                var th = document.createElement('th');
                th.className = 'antrenor-th';
                th.innerHTML = '<div class="th-inner sortable both">Görevliler</div><div class="fht-cell"></div>';
                theadTr.children.length >= 15
                    ? theadTr.insertBefore(th, theadTr.children[15])
                    : theadTr.appendChild(th);
            }

            tablo.querySelectorAll('tbody tr').forEach(function (tr) {
                if (tr.classList.contains('no-records-found') || tr.querySelector('.antrenor-td')) return;

                var td = document.createElement('td');
                td.className = 'antrenor-td';
                td.innerHTML = '<span style="color:#888;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i> Sırada...</span>';
                tr.children.length >= 15 ? tr.insertBefore(td, tr.children[15]) : tr.appendChild(td);

                var btn = tr.querySelector('input[onclick*="sporcuKartGrupDetayGit"]');
                if (!btn) { td.innerHTML = '-'; return; }

                var m = (btn.getAttribute('onclick') || '').match(/sporcuKartGrupDetayGit\((\d+),\s*(\d+)\)/);
                if (!m) { td.innerHTML = '-'; return; }

                var sporcuTd = tr.children[7];
                if (sporcuTd && !sporcuTd.hasAttribute('data-orijinal'))
                    sporcuTd.setAttribute('data-orijinal', sporcuTd.textContent.trim());

                var url = 'https://spor.gsb.gov.tr/Modules/UlusalSporProjeleri/SporcuKartKursTesisGrupDetay.aspx'
                        + '?sporcukartkurstesisId=' + m[2]
                        + '&sporcukartkurstesisgrupId=' + m[1];

                isKuyrugu.push({ td: td, sporcuTd: sporcuTd, url: url });
            });

            kuyruguIsle(guncelCalismaId);
        }

        function kuyruguIsle(cid) {
            if (cid !== guncelCalismaId) return;
            while (aktifIsSayisi < MAX_AKTIF_IS && isKuyrugu.length > 0) {
                aktifIsSayisi++;
                isle(isKuyrugu.shift(), cid);
            }
        }

        function isle(is, cid) {
            is.td.innerHTML = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i> Taranıyor...</span>';
            detaySayfasiniYukle(
                is.url,
                function (idoc) {
                    if (cid !== guncelCalismaId) { aktifIsSayisi--; kuyruguIsle(cid); return; }
                    grupVerisiniYaz(idoc, is);
                    aktifIsSayisi--;
                    kuyruguIsle(cid);
                },
                function () {
                    if (cid !== guncelCalismaId) { aktifIsSayisi--; kuyruguIsle(cid); return; }
                    var isK = is, cidK = cid;
                    yenidenDeneTD(isK.td, function () {
                        isK.td.innerHTML = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i> Taranıyor...</span>';
                        if (isK.sporcuTd) {
                            var o = isK.sporcuTd.getAttribute('data-orijinal');
                            isK.sporcuTd.innerHTML = '<div style="text-align:center;"><strong>' + o + '</strong><br><span style="color:#888;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span></div>';
                        }
                        aktifIsSayisi++;
                        isle(isK, cidK);
                    });
                    if (isK.sporcuTd) {
                        var orj = isK.sporcuTd.getAttribute('data-orijinal');
                        isK.sporcuTd.innerHTML = '<div style="text-align:center;"><strong>' + orj + '</strong><br><small style="color:#f44336;font-weight:bold;">Zaman Aşımı</small></div>';
                    }
                    aktifIsSayisi--;
                    kuyruguIsle(cid);
                }
            );
        }

        function grupVerisiniYaz(idoc, is) {
            var gorevliler = [], evet = 0, hayir = 0, bekleyen = 0;

            function tara(hedef) {
                if (!hedef) return;
                var rows = hedef.querySelectorAll('tbody tr');
                if (!rows.length || rows[0].classList.contains('no-records-found')) return;

                var eDevInd = 9;
                hedef.querySelectorAll('thead th').forEach(function (th, i) {
                    var attr  = th.getAttribute('data-field') || '';
                    var metin = temizle(th.textContent);
                    if (attr === 'EDevletBasvurusuMu' || metin.includes('DEVLET')) eDevInd = i;
                });

                rows.forEach(function (row) {
                    if (row.cells.length < 5) return;
                    var gorevCell  = row.cells[1];
                    var gorevMetni = temizle(gorevCell.textContent);

                    if ((gorevMetni.includes('ANTRENÖR') || gorevMetni.includes('ÖĞRETMEN') || gorevMetni.includes('LİDER')) &&
                        !gorevMetni.includes('SPORCU')) {
                        var adSoyad = row.cells.length > 4
                            ? temizle(row.cells[3].textContent + ' ' + row.cells[4].textContent)
                            : temizle(row.cells[2].textContent);
                        gorevliler.push(
                            '<strong>' + adSoyad + '</strong><br>' +
                            '<small style="color:#666;">' + gorevCell.textContent.trim() + '</small>');
                    }

                    if (gorevMetni.includes('SPORCU') && eDevInd !== -1 && row.cells.length > eDevInd) {
                        var txt = temizle(row.cells[eDevInd].textContent);
                        if (txt.includes('EVET') || txt.includes('VAR')) evet++;
                        else if (txt.includes('HAYIR') || txt.includes('YOK')) hayir++;
                    }
                });
            }

            tara(idoc.querySelector('#CetGridGorevliListesi'));
            tara(idoc.querySelector('#CetGridGrupListesi'));

            var bekTablo = idoc.querySelector('#gridEdevletBasvuruSporcuListesi');
            if (bekTablo) {
                var bRows = bekTablo.querySelectorAll('tbody tr');
                if (bRows.length && !bRows[0].classList.contains('no-records-found')) bekleyen = bRows.length;
            }

            is.td.innerHTML = gorevliler.length
                ? Array.from(new Set(gorevliler)).join('<div style="margin-top:5px;border-top:1px dashed #ccc;padding-top:5px;"></div>')
                : 'Atanmadı';

            if (is.sporcuTd) {
                var orj = is.sporcuTd.getAttribute('data-orijinal');
                is.sporcuTd.innerHTML =
                    '<div style="text-align:center;"><strong>' + orj + '</strong>' +
                    '<br><small style="color:#4CAF50;font-weight:bold;">E-Devlet: ' + evet + '</small>' +
                    '<br><small style="color:#f44336;font-weight:bold;">Manuel: '   + hayir + '</small>' +
                    (bekleyen > 0 ? '<br><small style="color:#ff9800;font-weight:bold;">Bekleyen: ' + bekleyen + '</small>' : '') +
                    '</div>';
            }
        }
    } /* grupAraModuBaslat */


    /* ================================================================
       BÖLÜM 2 — KursSporcuAra

       Sütunlar (v27): Antrenör | E-Devlet | Yaş | Grup Adı | Ders Saati | Detay Git

       Detay sayfası #CetGridGrupListesi sütunları:
         0:cb  1:Görev  2:TC  3:Ad  4:Soyad  5:Yaş  6:Cinsiyet
         7:Tel  8:GörüntüOnay  9:E-devlet
       Detay sayfası input alanları:
         #txtGrupAdi          → Grup Adı
         #txtToplamDersSaati  → Toplam Ders Saati
    ================================================================ */
    function sporcuAraModuBaslat() {
        var isKuyrugu       = [];
        var guncelCalismaId = 0;
        var gozlemciTimer;
        var MAX_AKTIF_IS    = 2;
        var aktifIsSayisi   = 0;
        var grupCache       = {};
        var grupBekleyen    = {};

        new MutationObserver(function () {
            clearTimeout(gozlemciTimer);
            gozlemciTimer = setTimeout(tabloyuKontrolEt, 1000);
        }).observe(document.body, { childList: true, subtree: true });

        window.addEventListener('pageshow', tabloyuKontrolEt);
        setTimeout(tabloyuKontrolEt, 1500);

        function tabloyuKontrolEt() {
            var tablo = document.getElementById('CetGridKursSporcuListesi');
            if (!tablo) return;
            var theadTr  = tablo.querySelector('thead tr');
            var ilkSatir = tablo.querySelector('tbody tr');
            if (!theadTr || !ilkSatir) return;
            var baslikYok = !theadTr.querySelector('.sp-ekstra-th');
            var hucreYok  = !ilkSatir.querySelector('.sp-antrenor-td') && !ilkSatir.classList.contains('no-records-found');
            if (baslikYok || hucreYok) sistemiSifirla();
        }

        function sistemiSifirla() {
            guncelCalismaId++;
            isKuyrugu     = [];
            aktifIsSayisi = 0;
            grupCache     = {};
            grupBekleyen  = {};
            init();
        }

        function init() {
            var tablo = document.getElementById('CetGridKursSporcuListesi');
            if (!tablo) return;
            var theadTr = tablo.querySelector('thead tr');

            /* Başlık sütunları — Detay Git'ten önce eklenir */
            if (theadTr && !theadTr.querySelector('.sp-ekstra-th')) {
                var son = theadTr.lastElementChild;
                var basliklar = [
                    ['Antrenör',    'sp-ekstra-th'],
                    ['E-Devlet',    'sp-ekstra-th'],
                    ['Yaş',         'sp-ekstra-th'],
                    ['Grup Adı',    'sp-ekstra-th'],
                    ['Ders Saati',  'sp-ekstra-th']
                ];
                for (var b = 0; b < basliklar.length; b++) {
                    var th = document.createElement('th');
                    th.className = basliklar[b][1];
                    th.innerHTML = '<div class="th-inner">' + basliklar[b][0] + '</div><div class="fht-cell"></div>';
                    theadTr.insertBefore(th, son);
                }
            }

            tablo.querySelectorAll('tbody tr').forEach(function (tr) {
                if (tr.classList.contains('no-records-found') || tr.querySelector('.sp-antrenor-td')) return;

                var son = tr.lastElementChild;
                var tdA  = tdEkle(tr, son, 'sp-antrenor-td',  'font-size:0.88em;');
                var tdE  = tdEkle(tr, son, 'sp-edev-td',      'text-align:center;');
                var tdY  = tdEkle(tr, son, 'sp-yas-td',       'text-align:center;');
                var tdGA = tdEkle(tr, son, 'sp-grupadi-td',   'font-size:0.85em;');
                var tdDS = tdEkle(tr, son, 'sp-derssaati-td', 'text-align:center;');

                var btn = tr.querySelector('input[onclick*="sporcuKartGrupDetayGit"]');
                if (!btn) {
                    [tdA, tdE, tdY, tdGA, tdDS].forEach(function (td) { td.innerHTML = '<span style="color:#aaa;">-</span>'; });
                    return;
                }

                var m = (btn.getAttribute('onclick') || '').match(/sporcuKartGrupDetayGit\((\d+),\s*(\d+)\)/);
                if (!m) {
                    [tdA, tdE, tdY, tdGA, tdDS].forEach(function (td) { td.innerHTML = '<span style="color:#aaa;">-</span>'; });
                    return;
                }

                var url = 'https://spor.gsb.gov.tr/Modules/UlusalSporProjeleri/SporcuKartKursTesisGrupDetay.aspx'
                        + '?sporcukartkurstesisId=' + m[2]
                        + '&sporcukartkurstesisgrupId=' + m[1];

                /* Detay Git → yeni sekme */
                btn.removeAttribute('onclick');
                (function (u) {
                    btn.addEventListener('click', function () { window.open(u, '_blank'); });
                })(url);

                var atletTc    = tr.cells[1] ? tr.cells[1].textContent : '';
                var atletAd    = tr.cells[2] ? tr.cells[2].textContent : '';
                var atletSoyad = tr.cells[3] ? tr.cells[3].textContent : '';

                isKuyrugu.push({
                    tdA: tdA, tdE: tdE, tdY: tdY, tdGA: tdGA, tdDS: tdDS,
                    url: url,
                    atletTc: atletTc, atletAd: atletAd, atletSoyad: atletSoyad
                });
            });

            kuyruguIsle(guncelCalismaId);
        }

        function tdEkle(tr, onceki, cls, stl) {
            var td = document.createElement('td');
            td.className = cls;
            td.setAttribute('style', stl);
            td.innerHTML = '<span style="color:#888;"><i class="fa fa-spinner fa-spin"></i> Sırada...</span>';
            tr.insertBefore(td, onceki);
            return td;
        }

        function kuyruguIsle(cid) {
            if (cid !== guncelCalismaId) return;
            while (aktifIsSayisi < MAX_AKTIF_IS && isKuyrugu.length > 0) {
                var is = isKuyrugu.shift();
                if (grupCache[is.url]) { tdleriBesle(is, grupCache[is.url]); continue; }
                if (grupBekleyen[is.url]) { grupBekleyen[is.url].push(is); continue; }
                grupBekleyen[is.url] = [is];
                aktifIsSayisi++;
                isle(is.url, cid);
            }
        }

        function taraniyorGoster(url) {
            var bek = grupBekleyen[url] || [];
            for (var i = 0; i < bek.length; i++) {
                bek[i].tdA.innerHTML  = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i> Taranıyor...</span>';
                bek[i].tdE.innerHTML  = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span>';
                bek[i].tdY.innerHTML  = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span>';
                bek[i].tdGA.innerHTML = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span>';
                bek[i].tdDS.innerHTML = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span>';
            }
        }

        function hataDurumu(url, cid) {
            if (cid !== guncelCalismaId) { aktifIsSayisi--; kuyruguIsle(cid); return; }
            var bek = grupBekleyen[url] || [];
            delete grupBekleyen[url];

            for (var i = 0; i < bek.length; i++) {
                (function (isRef) {
                    var urlK = isRef.url, cidK = cid;
                    yenidenDeneTD(isRef.tdA, function () {
                        isRef.tdA.innerHTML  = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i> Taranıyor...</span>';
                        isRef.tdE.innerHTML  = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span>';
                        isRef.tdY.innerHTML  = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span>';
                        isRef.tdGA.innerHTML = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span>';
                        isRef.tdDS.innerHTML = '<span style="color:#007bff;font-size:0.9em;"><i class="fa fa-spinner fa-spin"></i></span>';
                        if (grupCache[urlK]) { tdleriBesle(isRef, grupCache[urlK]); return; }
                        if (grupBekleyen[urlK]) { grupBekleyen[urlK].push(isRef); return; }
                        grupBekleyen[urlK] = [isRef];
                        aktifIsSayisi++;
                        isle(urlK, cidK);
                        kuyruguIsle(cidK);
                    });
                    isRef.tdE.innerHTML  = '<span style="color:#f44336;font-weight:bold;">Hata</span>';
                    isRef.tdY.innerHTML  = '<span style="color:#f44336;font-weight:bold;">Hata</span>';
                    isRef.tdGA.innerHTML = '<span style="color:#f44336;font-weight:bold;">Hata</span>';
                    isRef.tdDS.innerHTML = '<span style="color:#f44336;font-weight:bold;">Hata</span>';
                })(bek[i]);
            }
            aktifIsSayisi--;
            kuyruguIsle(cid);
        }

        function isle(url, cid) {
            taraniyorGoster(url);

            detaySayfasiniYukle(
                url,
                function (idoc) {
                    if (cid !== guncelCalismaId) { aktifIsSayisi--; kuyruguIsle(cid); return; }
                    var veri = veriyiCikar(idoc);

                    /* Doğrulama: e-devlet verisi boşsa sayfa eksik yüklenmiştir */
                    if (Object.keys(veri.edevletMap).length === 0) {
                        hataDurumu(url, cid);
                        return;
                    }

                    grupCache[url] = veri;
                    var bek = grupBekleyen[url] || [];
                    delete grupBekleyen[url];
                    for (var i = 0; i < bek.length; i++) tdleriBesle(bek[i], veri);
                    aktifIsSayisi--;
                    kuyruguIsle(cid);
                },
                function () { hataDurumu(url, cid); }
            );
        }

        function veriyiCikar(idoc) {
            var gorevliler = [], edevletMap = {}, yasMap = {};

            /* Grup Adı ve Toplam Ders Saati — detay sayfasındaki input'lardan */
            var grupAdiEl    = idoc.querySelector('#txtGrupAdi');
            var dersSaatiEl  = idoc.querySelector('#txtToplamDersSaati');
            var grupAdi      = grupAdiEl   ? grupAdiEl.value.trim()   : '';
            var dersSaati    = dersSaatiEl ? dersSaatiEl.value.trim() : '';

            var tablo = idoc.querySelector('#CetGridGrupListesi');
            if (!tablo) return { gorevliler: gorevliler, edevletMap: edevletMap, yasMap: yasMap, grupAdi: grupAdi, dersSaati: dersSaati };

            /* E-Devlet sütun indeksini başlıktan doğrula */
            var eDevInd = 9;
            tablo.querySelectorAll('thead th').forEach(function (th, i) {
                var attr  = th.getAttribute('data-field') || '';
                var metin = temizle(th.textContent);
                if (attr === 'EDevletBasvurusuMu' || metin.includes('DEVLET')) eDevInd = i;
            });

            tablo.querySelectorAll('tbody tr').forEach(function (row) {
                if (row.classList.contains('no-records-found') || row.cells.length < 5) return;

                var gorev   = temizle(row.cells[1].textContent);
                var tc      = temizle(row.cells[2].textContent);
                var ad      = temizle(row.cells[3].textContent);
                var soyad   = temizle(row.cells[4].textContent);
                var anahtar = temizle(ad + ' ' + soyad);

                /* Antrenör / Öğretmen / Lider */
                if ((gorev.includes('ANTRENÖR') || gorev.includes('ÖĞRETMEN') || gorev.includes('LİDER')) &&
                    !gorev.includes('SPORCU')) {
                    gorevliler.push({ ad: ad + ' ' + soyad, unvan: row.cells[1].textContent.trim() });
                    return;
                }

                /* Sporcu */
                if (gorev.includes('SPORCU')) {
                    if (row.cells.length > eDevInd) {
                        var val = temizle(row.cells[eDevInd].textContent);
                        if (anahtar) edevletMap[anahtar] = val;
                        if (tc && tc.includes('*')) edevletMap[tc] = val;  // yedek TC anahtarı
                    }
                    if (row.cells.length > 5) {
                        var yasVal = row.cells[5].textContent.trim();
                        if (anahtar) yasMap[anahtar] = yasVal;
                        if (tc && tc.includes('*')) yasMap[tc] = yasVal;
                    }
                }
            });

            /* Tekrar eden antrenörleri temizle */
            var gorulmus = {}, temizG = [];
            for (var g = 0; g < gorevliler.length; g++) {
                var k = gorevliler[g].ad + '|' + gorevliler[g].unvan;
                if (!gorulmus[k]) { gorulmus[k] = true; temizG.push(gorevliler[g]); }
            }

            return {
                gorevliler : temizG,
                edevletMap : edevletMap,
                yasMap     : yasMap,
                grupAdi    : grupAdi,
                dersSaati  : dersSaati
            };
        }

        function tdleriBesle(is, veri) {
            /* Antrenör */
            if (veri.gorevliler.length === 0) {
                is.tdA.innerHTML = '<span style="color:#aaa;">Atanmadı</span>';
            } else {
                var sat = [];
                for (var g = 0; g < veri.gorevliler.length; g++) {
                    sat.push('<strong>' + veri.gorevliler[g].ad + '</strong><br>' +
                             '<small style="color:#666;">' + veri.gorevliler[g].unvan + '</small>');
                }
                is.tdA.innerHTML = sat.join('<div style="margin-top:4px;border-top:1px dashed #ccc;padding-top:4px;"></div>');
            }

            /* Sporcu eşleştirme — TC önce, isim yedek */
            var tcAnahtar = temizle(is.atletTc);
            var adAnahtar = temizle(is.atletAd + ' ' + is.atletSoyad);

            var edev = veri.edevletMap[tcAnahtar] || veri.edevletMap[adAnahtar];
            var yas  = veri.yasMap[tcAnahtar]     || veri.yasMap[adAnahtar];

            if (!edev) { var ek = Object.keys(veri.edevletMap); if (ek.length === 1) edev = veri.edevletMap[ek[0]]; }
            if (!yas)  { var yk = Object.keys(veri.yasMap);     if (yk.length === 1) yas  = veri.yasMap[yk[0]]; }

            /* E-Devlet */
            is.tdE.innerHTML = !edev
                ? '<span style="color:#aaa;" title="Eşleşme yok">?</span>'
                : (edev.includes('EVET') || edev.includes('VAR'))
                    ? '<span style="color:#4CAF50;font-weight:bold;">&#10003; E-Devlet</span>'
                    : (edev.includes('HAYIR') || edev.includes('YOK'))
                        ? '<span style="color:#f44336;font-weight:bold;">&#10007; Manuel</span>'
                        : '<span style="color:#888;">' + edev + '</span>';

            /* Yaş */
            is.tdY.innerHTML = yas
                ? '<strong style="color:#333;">' + yas + '</strong>'
                : '<span style="color:#aaa;">?</span>';

            /* Grup Adı */
            is.tdGA.innerHTML = veri.grupAdi
                ? '<span title="' + veri.grupAdi + '">' + veri.grupAdi + '</span>'
                : '<span style="color:#aaa;">-</span>';

            /* Toplam Ders Saati */
            is.tdDS.innerHTML = veri.dersSaati
                ? '<strong style="color:#333;">' + veri.dersSaati + '</strong>'
                : '<span style="color:#aaa;">-</span>';
        }

    } /* sporcuAraModuBaslat */


    var sayfa = window.location.pathname;
    if      (sayfa.includes('KursGrupAra'))   grupAraModuBaslat();
    else if (sayfa.includes('KursSporcuAra')) sporcuAraModuBaslat();

})();
