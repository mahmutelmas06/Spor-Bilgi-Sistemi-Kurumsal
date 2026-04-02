// ==UserScript==
// @name         SBS Günlük Yoklama Yüzdesi Gösterici
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Kurum personelleri için yazılmış iş takip betiğidir.
// @author       YZ yardımıyla mahmut.elmas@yaani.com
// @updateURL    https://raw.githubusercontent.com/mahmutelmas06/sbs-gunluk-yoklama/main/sbs-gunluk-yoklama.user.js
// @downloadURL  https://raw.githubusercontent.com/mahmutelmas06/sbs-gunluk-yoklama/main/sbs-gunluk-yoklama.user.js
// @match        *://spor.gsb.gov.tr/Modules/Antrenman/AntrenmanProgramiListeleme.aspx*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    // ── Renkli Performans Logu (console.log kapatılmadan ÖNCE native ref alınır) ──
    const _nativeInfo = window.console.info.bind(console);

    const TAB_COLORS = {
        iframe:    '#e74c3c',
        antrenor:  '#9b59b6',
        dersler:   '#e67e22',
        izin:      '#1abc9c',
        sporcular: '#2ecc71'
    };

    function perfLog(tabName, coachId, ms) {
        const tabColor  = TAB_COLORS[tabName] || '#95a5a6';
        const timeColor = ms > 5000 ? '#e74c3c' : ms > 2000 ? '#f39c12' : '#2ecc71';
        _nativeInfo(
            '%c[GSB] %c%s %c#%s %c%ss',
            'color:#0056b3;font-weight:bold;background:#eef4ff;padding:1px 4px;border-radius:3px;',
            `color:${tabColor};font-weight:bold;min-width:80px;display:inline-block;`,
            tabName.toUpperCase().padEnd(10),
            'color:#7f8c8d;',
            coachId,
            `color:${timeColor};font-weight:bold;`,
            (ms / 1000).toFixed(2)
        );
    }

    // ── Konsol ve Hata Yönetimi ───────────────────────────────────────────────
    console.log = function() {};

    window.onerror = function(message) {
        if (typeof message === 'string' && message.includes('clickToSelect')) {
            return true;
        }
        return false;
    };

    // ── Özel Hata Tipleri ────────────────────────────────────────────────────
    const ERR_VERI_OKUNAMADI = 'VERI_OKUNAMADI';

    // ── Ayarlar ──────────────────────────────────────────────────────────────
    const SETTINGS_KEY = 'gsb_script_settings_v3_3';
    const DEFAULT_SETTINGS = {
        autoStart:   true,
        concurrency: 1,
        periods:     ['past', 'current', 'future'],
        tabs:        ['antrenor', 'yoklama', 'tesis']
    };

    let GSB_SETTINGS = (() => {
        try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || DEFAULT_SETTINGS; }
        catch (e) { return DEFAULT_SETTINGS; }
    })();

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(GSB_SETTINGS));
        location.reload();
    }

    function openSettingsModal() {
        if (document.getElementById('gsb-settings-modal')) return;
        const s = GSB_SETTINGS;
        document.body.insertAdjacentHTML('beforeend', `
            <div id="gsb-settings-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;
                background:rgba(0,0,0,0.6);z-index:9998;backdrop-filter:blur(3px);"></div>
            <div id="gsb-settings-modal" style="position:fixed;top:50%;left:50%;
                transform:translate(-50%,-50%);background:#fff;width:370px;border-radius:12px;
                box-shadow:0 10px 25px rgba(0,0,0,0.2);z-index:9999;font-family:Arial,sans-serif;
                overflow:hidden;">
                <div style="background:#0056b3;color:#fff;padding:15px;font-size:16px;
                    font-weight:bold;text-align:center;">⚙️ Script Ayarları</div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:15px;
                    font-size:13px;color:#333;">
                    <label style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                        <b>Otomatik Başlat (Beklemeden):</b>
                        <input type="checkbox" id="set-autoStart" ${s.autoStart ? 'checked' : ''}
                            style="transform:scale(1.3);">
                    </label>
                    <label style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                        <b>Eşzamanlı Sekme (İframe):</b>
                        <select id="set-concurrency" style="padding:5px;border-radius:4px;border:1px solid #ccc;">
                            <option value="1" ${s.concurrency===1?'selected':''}>1 Sekme (Tam Stabil)</option>
                            <option value="2" ${s.concurrency===2?'selected':''}>2 Sekme (Dengeli)</option>
                            <option value="3" ${s.concurrency===3?'selected':''}>3 Sekme (Hızlı)</option>
                        </select>
                    </label>
                    <div style="border-top:1px solid #eee;padding-top:10px;">
                        <b style="display:block;margin-bottom:8px;color:#0056b3;">Çalışacak Dönemler:</b>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-period-past"
                                ${s.periods.includes('past')?'checked':''}> Geçmiş Aylarda Çalış
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-period-current"
                                ${s.periods.includes('current')?'checked':''}> Şimdiki Ayda Çalış
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" id="set-period-future"
                                ${s.periods.includes('future')?'checked':''}> Gelecek Aylarda Çalış
                        </label>
                    </div>
                    <div style="border-top:1px solid #eee;padding-top:10px;">
                        <b style="display:block;margin-bottom:8px;color:#0056b3;">Okunacak Sütunlar / Sekmeler:</b>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-tab-antrenor"
                                ${s.tabs.includes('antrenor')?'checked':''}> Kadro Türü (Antrenör Bilgileri)
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-tab-yoklama"
                                ${s.tabs.includes('yoklama')?'checked':''}> Genel Durum Yüzdesi (Yoklama ve İzin)
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-tab-tesis"
                                ${s.tabs.includes('tesis')?'checked':''}> Kullanılan Tesisler (Dersler Sekmesi)
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" id="set-tab-sporcular"
                                ${s.tabs.includes('sporcular')?'checked':''}> Sporcu Detayları (Sporcular Sekmesi)
                        </label>
                    </div>
                </div>
                <div style="display:flex;border-top:1px solid #eee;">
                    <button id="btn-settings-cancel" style="flex:1;padding:12px;border:none;
                        background:#f8f9fa;color:#333;cursor:pointer;font-weight:bold;">İptal</button>
                    <button id="btn-settings-save" style="flex:1;padding:12px;border:none;
                        background:#28a745;color:#fff;cursor:pointer;font-weight:bold;">
                        Kaydet ve Yenile</button>
                </div>
            </div>`);

        document.getElementById('btn-settings-cancel').onclick = () => {
            document.getElementById('gsb-settings-modal').remove();
            document.getElementById('gsb-settings-overlay').remove();
        };
        document.getElementById('btn-settings-save').onclick = () => {
            GSB_SETTINGS.autoStart   = document.getElementById('set-autoStart').checked;
            GSB_SETTINGS.concurrency = parseInt(document.getElementById('set-concurrency').value);
            const newPeriods = [];
            if (document.getElementById('set-period-past').checked)    newPeriods.push('past');
            if (document.getElementById('set-period-current').checked)  newPeriods.push('current');
            if (document.getElementById('set-period-future').checked)   newPeriods.push('future');
            GSB_SETTINGS.periods = newPeriods;
            const newTabs = [];
            if (document.getElementById('set-tab-antrenor').checked)   newTabs.push('antrenor');
            if (document.getElementById('set-tab-yoklama').checked)     newTabs.push('yoklama');
            if (document.getElementById('set-tab-tesis').checked)       newTabs.push('tesis');
            if (document.getElementById('set-tab-sporcular').checked)   newTabs.push('sporcular');
            GSB_SETTINGS.tabs = newTabs;
            saveSettings();
        };
    }

    GM_registerMenuCommand('⚙️ Ayarları Aç', openSettingsModal);

    // ── Global Değişkenler ───────────────────────────────────────────────────
    let tasksQueue         = [];
    let isScriptPaused     = !GSB_SETTINGS.autoStart;
    let isProcessorRunning = false;
    let isAllExpanded      = false;
    let globalProcessorRunId = 0;

    function toYMD(date) {
        return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    }

    const MONTH_MAP = {
        'OCAK':1,'ŞUBAT':2,'MART':3,'NİSAN':4,'MAYIS':5,'HAZİRAN':6,
        'TEMMUZ':7,'AĞUSTOS':8,'EYLÜL':9,'EKİM':10,'KASIM':11,'ARALIK':12
    };

    // ── Ders Olmayan Günler Hesaplayıcı ──────────────────────────────────────
    const TR_DAYS = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

    function getMissingDays(rows, targetY, targetM) {
        // Dersi olan günlerin YMD kümesi (aynı günde birden fazla ders olabilir)
        const lessonDays = new Set(rows.map(r => r.rowYMD));
        const daysInMonth = new Date(targetY, targetM, 0).getDate(); // targetM 1-indexed, 0. gün = son gün
        const missing = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const ymd = targetY * 10000 + targetM * 100 + d;
            if (!lessonDays.has(ymd)) {
                const dd   = String(d).padStart(2, '0');
                const mm   = String(targetM).padStart(2, '0');
                const gün  = TR_DAYS[new Date(targetY, targetM - 1, d).getDay()];
                missing.push(`${dd}.${mm}.${targetY} ${gün}`);
            }
        }
        return missing;
    }

    // ── Kadro Türü ───────────────────────────────────────────────────────────
    function getSicilType(sicilNo) {
        const s = (sicilNo || '').trim();
        if (!s)                return 'EYS';
        if (s.startsWith('1')) return 'Memur';
        if (s.startsWith('2')) return 'Sözleşmeli';
        if (s.startsWith('3')) return 'Sürekli İşçi';
        return 'EYS';
    }
    const KADRO_BG = {
        'Memur':'#3498db', 'Sözleşmeli':'#27ae60',
        'Sürekli İşçi':'#e67e22', 'EYS':'#95a5a6'
    };
    function kadroTuruBadge(type) {
        return `<span style="display:inline-block;padding:3px 8px;border-radius:3px;font-size:11px;
            font-weight:bold;background:${KADRO_BG[type]||'#95a5a6'};color:#fff;">${type}</span>`;
    }

    // ── Dönem Sınıflandırma ──────────────────────────────────────────────────
    function getTablePeriod(table) {
        const first = Array.from(table.querySelectorAll('tbody tr')).find(
            r => !r.classList.contains('no-records-found') && r.querySelectorAll('td').length > 3);
        if (!first) return null;
        const tds = first.querySelectorAll('td');
        const y = parseInt(tds[1]?.textContent.trim(), 10);
        const m = MONTH_MAP[tds[2]?.textContent.trim().toUpperCase()];
        return (y && m) ? { year: y, month: m } : null;
    }

    function classifyPeriod({ year, month }) {
        const t    = new Date();
        const diff = (year - t.getFullYear()) * 12 + (month - (t.getMonth() + 1));
        if (diff < 0)   return 'past';
        if (diff === 0) return 'current';
        return 'future';
    }

    // ── Veri Odaklı Bekleme / İşlem Yürütücü (Sıfır Gecikme) ─────────────────
    const actionAndWaitForTable = (doc, tabSelector, tableSelector, actionCallback) => new Promise(resolve => {
        const firstRow = doc.querySelector(`${tableSelector} tbody tr`);
        if (firstRow) firstRow.setAttribute('data-stale', 'true');

        actionCallback();

        let attempt = 0;
        const check = setInterval(() => {
            attempt++;
            const currentFirstRow = doc.querySelector(`${tableSelector} tbody tr`);
            const loadDiv = doc.querySelector(`${tabSelector} .fixed-table-loading`);
            const isLoading = loadDiv && getComputedStyle(loadDiv).display !== 'none';

            if ((!currentFirstRow || !currentFirstRow.hasAttribute('data-stale')) && !isLoading) {
                clearInterval(check);
                resolve();
            } else if (attempt > 300) {
                clearInterval(check);
                resolve();
            }
        }, 50);
    });

    const waitForContent = (doc, tabSelector, tableSelector, maxWaitMs = 15000) => new Promise((resolve, reject) => {
        const start = Date.now();
        let wasLoading = false;

        const check = setInterval(() => {
            try {
                if (Date.now() - start > maxWaitMs) {
                    clearInterval(check);
                    reject(new Error(ERR_VERI_OKUNAMADI));
                    return;
                }

                const tab = doc.querySelector(tabSelector);
                if (!tab) return;

                const loadDiv = tab.querySelector('.fixed-table-loading');
                const isLoading = loadDiv && getComputedStyle(loadDiv).display !== 'none';

                if (isLoading) {
                    wasLoading = true;
                }

                if (!isLoading && (wasLoading || (Date.now() - start > 1200))) {
                    const table = doc.querySelector(tableSelector);
                    if (table) {
                        const rows = table.querySelectorAll('tbody tr');
                        if (rows.length > 0) {
                            clearInterval(check);
                            setTimeout(resolve, 300);
                        }
                    }
                }
            } catch (e) {
                clearInterval(check);
                reject(e);
            }
        }, 200);
    });

    // ── 1. Ana Yükleme ve Antrenör Sekmesi (V4.4 - Sicil Odaklı Akıllı Bekleme) ─
    function getDocViaIframe(coachId, needsAntrenorClick) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'width:10px;height:10px;position:absolute;top:-9999px;left:-9999px;border:none;opacity:0;pointer-events:none;';
            iframe.src = `/Modules/Antrenman/AntrenorPersonelDetay.aspx?antrenorpersonelid=${coachId}`;
            document.body.appendChild(iframe);

            const timeout = setTimeout(() => { iframe.remove(); reject(new Error('Ana Sayfa Zaman Aşımı')); }, 30000);
            const iframeStartTime = Date.now();

            iframe.onload = () => {
                perfLog('iframe', coachId, Date.now() - iframeStartTime);

                setTimeout(() => { // Iframe DOM'un ilk kendine gelme süresi
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        if (needsAntrenorClick) {
                            const antTab = doc.querySelector('a[href="#tabAntrenorBilgileri"]');
                            if (antTab && !antTab.parentElement.classList.contains('active')) antTab.click();

                            const MAX_SICIL_WAIT_MS = 1500;
                            let attempt = 0;
                            let tabReadyAt = -1;

                            const checkData = setInterval(() => {
                                attempt++;
                                const tabPane  = doc.querySelector('#tabAntrenorBilgileri');
                                const tabText  = tabPane ? tabPane.textContent.toUpperCase() : '';
                                const sicilEl  = doc.querySelector('#lblSicilNo');
                                const sicilText = sicilEl ? sicilEl.textContent.trim() : '';

                                const hasKadrolu = tabText.includes('KADROLU') || tabText.includes('GÖREV');
                                const hasAnswer  = tabText.includes('EVET')    || tabText.includes('HAYIR');
                                const tabReady   = hasKadrolu && hasAnswer;

                                if (tabReady && tabReadyAt === -1) {
                                    tabReadyAt = attempt;
                                }

                                const sicilLoaded      = sicilText.length > 0;
                                const msSinceTabReady  = tabReadyAt >= 0
                                    ? (attempt - tabReadyAt) * 200
                                    : 0;
                                const sicilWaitExpired = tabReadyAt >= 0 && msSinceTabReady >= MAX_SICIL_WAIT_MS;
                                const hardTimeout      = attempt > 60;

                                if (sicilLoaded || sicilWaitExpired || hardTimeout) {
                                    clearInterval(checkData);
                                    clearTimeout(timeout);
                                    const antrenorTime = tabReadyAt >= 0
                                        ? (attempt - 0) * 200
                                        : attempt * 200;
                                    perfLog('antrenor', coachId, antrenorTime);
                                    resolve({ doc, iframe, sicilNo: sicilText });
                                }
                            }, 200);

                        } else {
                            clearTimeout(timeout);
                            resolve({ doc, iframe, sicilNo: null });
                        }
                    } catch (e) {
                        clearTimeout(timeout); iframe.remove(); reject(e);
                    }
                }, 300);
            };
        });
    }

    // ── 2. İzin Sekmesi ──────────────────────────────────────────────────────
    async function extractIzinRows(doc) {
        const tabLink = doc.querySelector('a[href="#tabIzin"]');
        if (!tabLink) return null;
        if (!tabLink.parentElement.classList.contains('active')) tabLink.click();

        try {
            await waitForContent(doc, '#tabIzin', '#gridIzinListesi', 12000);
        } catch (e) {
            return null;
        }

        try {
            const pageSizeBtn = doc.querySelector('#tabIzin .page-list button');
            if (pageSizeBtn && !pageSizeBtn.textContent.includes('50')) {
                const opt50 = Array.from(doc.querySelectorAll('#tabIzin .page-list .dropdown-menu li a')).find(a => a.textContent.trim() === '50');
                if (opt50) {
                    await actionAndWaitForTable(doc, '#tabIzin', '#gridIzinListesi', () => opt50.click());
                }
            }
        } catch (e) { }

        const allLeaves = [];
        const parseDate = txt => {
            if (!txt) return null;
            const r = /(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/.exec(txt.trim());
            return r ? { ts: new Date(r[3], r[2]-1, r[1], r[4]||0, r[5]||0).getTime(), hasTime: !!r[4] } : null;
        };

        let hasNextPage = true, lastHtml = '', safety = 0;
        while (hasNextPage && safety < 20) {
            safety++;
            const rows = doc.querySelectorAll('#gridIzinListesi tbody tr');
            if (!rows || rows.length === 0 || rows[0].classList.contains('no-records-found')) break;
            if (rows[0].innerHTML === lastHtml) break;
            lastHtml = rows[0].innerHTML;

            rows.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length >= 3) {
                    const bas = parseDate(tds[1].textContent);
                    const bit = parseDate(tds[2].textContent);
                    if (bas && bit) allLeaves.push({ start: bas.ts, end: bit.hasTime ? bit.ts : bit.ts + 86399999 });
                }
            });

            const nextLink = doc.querySelector('#tabIzin .pagination .page-next')?.querySelector('a');
            if (nextLink && !nextLink.parentElement.classList.contains('disabled')) {
                await actionAndWaitForTable(doc, '#tabIzin', '#gridIzinListesi', () => nextLink.click());
            } else hasNextPage = false;
        }
        return allLeaves;
    }

    // ── 3. Dersler Sekmesi ───────────────────────────────────────────────────
    async function extractAllDersRows(doc, targetY, targetM) {
        // classifiedRowCount: hedef ayda YoklamaVar/YoklamaYok/CalismaGrubuYok
        //   sınıfından en az birini taşıyan satır sayısı.
        // Tüm matched satırlar var ama classifiedRowCount=0 ise DOM okuma şüphelidir.
        const result = { rows: [], tableLoaded: false, totalRowsOnPage: 0, classifiedRowCount: 0 };

        const tabLink = doc.querySelector('a[href="#tabProgramDers"]');
        if (!tabLink) return result;
        if (!tabLink.parentElement.classList.contains('active')) tabLink.click();

        try {
            await waitForContent(doc, '#tabProgramDers', '#CetGridProgramDers', 14000);
        } catch (e) {
            return result;
        }

        try {
            const pageSizeBtn = doc.querySelector('#tabProgramDers .page-list button');
            if (pageSizeBtn && !pageSizeBtn.textContent.includes('100')) {
                const opt100 = Array.from(doc.querySelectorAll('#tabProgramDers .page-list .dropdown-menu li a')).find(a => a.textContent.trim() === '100');
                if (opt100) {
                    await actionAndWaitForTable(doc, '#tabProgramDers', '#CetGridProgramDers', () => opt100.click());
                }
            }
        } catch (e) { }

        let tesisIdx = -1;
        doc.querySelectorAll('#CetGridProgramDers thead th').forEach((th, idx) => {
            const f = (th.getAttribute('data-field') || '').toLowerCase();
            if (f.includes('tesis') || th.textContent.trim().toLowerCase().includes('tesis')) tesisIdx = idx;
        });

        let hasNextPage = true, lastHtml = '', safety = 0;

        while (hasNextPage && safety < 20) {
            safety++;
            const rows = doc.querySelectorAll('#CetGridProgramDers tbody tr');
            if (!rows || rows.length === 0) break;

            if (rows[0].classList.contains('no-records-found')) {
                result.tableLoaded = true;
                break;
            }
            if (rows[0].innerHTML === lastHtml) break;
            lastHtml = rows[0].innerHTML;

            result.tableLoaded = true;
            result.totalRowsOnPage += rows.length;

            let pageHasOlderMonth = false;
            rows.forEach(tr => {
                const innerHTML         = tr.innerHTML;
                const hasClassVar       = tr.classList.contains('YoklamaVar');
                const hasClassYok       = tr.classList.contains('YoklamaYok');
                const hasClassIptal     = tr.classList.contains('CalismaGrubuYok');
                const isOgrenciYok      = innerHTML.includes('Öğrencilerin hiçbiri derse katılmadı');
                const isIslemYapilmadi  = innerHTML.includes('İşlem yapılmadı');
                const isTesisUygunDegil = innerHTML.includes('Tesis uygun değildi');

                const tds = tr.querySelectorAll('td');
                const rowTesisAdi = (tesisIdx !== -1 && tds.length > tesisIdx) ? tds[tesisIdx].textContent.trim() : null;

                let rowYMD = null, rowMonthNum = null, rowYearNum = null, rowTimestamp = null;
                for (const td of tds) {
                    const dm = td.textContent.trim().match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
                    if (dm) {
                        const d = +dm[1], m = +dm[2], y = +dm[3];
                        const hr = dm[4] ? +dm[4] : 12, mn = dm[5] ? +dm[5] : 0;
                        rowYMD       = y * 10000 + m * 100 + d;
                        rowMonthNum  = m; rowYearNum = y;
                        rowTimestamp = new Date(y, m-1, d, hr, mn, 0).getTime();
                        break;
                    }
                }

                if (rowYearNum && rowMonthNum) {
                    if (rowYearNum < targetY || (rowYearNum === targetY && rowMonthNum < targetM)) {
                        pageHasOlderMonth = true;
                    } else if (rowYearNum === targetY && rowMonthNum === targetM) {
                        result.rows.push({ hasClassVar, hasClassYok, hasClassIptal, isOgrenciYok, isIslemYapilmadi, isTesisUygunDegil, rowYMD, rowTimestamp, rowTesisAdi });
                        // ── Doğrulama sayacı: en az bir CSS sınıfı olan satırları say ──
                        if (hasClassVar || hasClassYok || hasClassIptal) {
                            result.classifiedRowCount++;
                        }
                    }
                }
            });

            const nextLink = doc.querySelector('#tabProgramDers .pagination .page-next')?.querySelector('a');
            if (!pageHasOlderMonth && nextLink && !nextLink.parentElement.classList.contains('disabled')) {
                await actionAndWaitForTable(doc, '#tabProgramDers', '#CetGridProgramDers', () => nextLink.click());
            } else hasNextPage = false;
        }

        return result;
    }

    // ── 4. Sporcular Sekmesi ─────────────────────────────────────────────────
    async function extractSporcular(doc, targetY, targetM) {
        const stats = {
            toplam: 0, lisansli: 0, okulSporlari: 0, sporKart: 0, yetenek: 0,
            gruplar: new Set(),
            rowsFound: 0,
            tableLoaded: false
        };

        const tabLink = doc.querySelector('a[href="#tabSporcular"]');
        if (!tabLink) return stats;
        if (!tabLink.parentElement.classList.contains('active')) tabLink.click();

        try {
            await waitForContent(doc, '#tabSporcular', '#gridOgrencilerimListesi', 15000);
        } catch (e) {
            return stats;
        }

        let waitAttempt = 0;
        while (waitAttempt < 15) {
            const rows = doc.querySelectorAll('#gridOgrencilerimListesi tbody tr[data-index]');
            if (rows.length > 0) break;
            if (doc.querySelector('#gridOgrencilerimListesi tbody tr.no-records-found')) break;
            await new Promise(r => setTimeout(r, 300));
            waitAttempt++;
        }

        const table = doc.querySelector('#gridOgrencilerimListesi');
        if (!table) return stats;

        if (table.querySelector('tbody tr.no-records-found')) {
            stats.tableLoaded = true;
            return stats;
        }

        try {
            const pageSizeBtn = doc.querySelector('#tabSporcular .page-list button');
            if (pageSizeBtn && !pageSizeBtn.textContent.includes('100')) {
                const opt100 = Array.from(doc.querySelectorAll('#tabSporcular .page-list .dropdown-menu li a')).find(
                    a => a.textContent.trim() === '100'
                );
                if (opt100) {
                    await actionAndWaitForTable(doc, '#tabSporcular', '#gridOgrencilerimListesi', () => opt100.click());
                }
            }
        } catch (e) { }

        const ths = Array.from(table.querySelectorAll('thead th'));

        function normalizeTR(str) {
            return str.toUpperCase()
                .replace(/Ğ/g, 'G').replace(/İ/g, 'I').replace(/Ş/g, 'S')
                .replace(/Ç/g, 'C').replace(/Ö/g, 'O').replace(/Ü/g, 'U')
                .replace(/\s+/g, ' ').trim();
        }

        const findIdx = (keywords) => ths.findIndex(th => {
            const text = normalizeTR(th.textContent || '');
            return keywords.some(kw => text.includes(normalizeTR(kw)));
        });

        const idx = {
            lisans:  findIdx(['Faal Lisans', 'Lisans']),
            okul:    findIdx(['Okul Sporlari', 'Okul Sp']),
            kart:    findIdx(['Sporkart', 'Spor Kart']),
            yetenek: findIdx(['Yetenek']),
            grup:    findIdx(['Calisma Grubu', 'Grup']),
            sonDers: findIdx(['Son Ders', 'Katildigi Son Ders'])
        };

        const checkEvet = (td) => {
            if (!td) return false;
            const text = (td.textContent || '').toUpperCase().trim();
            return text.includes('EVET') || text === 'E';
        };

        let hasNextPage = true, lastHtml = '', safety = 0;
        let stopPagination = false;

        while (hasNextPage && !stopPagination && safety < 100) {
            safety++;
            const rows = table.querySelectorAll('tbody tr[data-index]');

            if (rows.length === 0) break;
            if (rows[0].innerHTML === lastHtml) break;
            lastHtml = rows[0].innerHTML;

            stats.tableLoaded = true;

            rows.forEach(tr => {
                if (stopPagination) return;

                stats.rowsFound++;
                const tds = tr.querySelectorAll('td');
                let isTargetMonth = true;

                if (idx.sonDers >= 0) {
                    const dateText = (tds[idx.sonDers]?.textContent || '').trim();
                    const dm = dateText.match(/(\d{2})[-./](\d{2})[-./](\d{4})/);
                    if (dm) {
                        const m = +dm[2], y = +dm[3];
                        if (y < targetY || (y === targetY && m < targetM)) {
                            stopPagination = true;
                            isTargetMonth = false;
                        } else if (y > targetY || (y === targetY && m > targetM)) {
                            isTargetMonth = false;
                        }
                    }
                }

                if (isTargetMonth && !stopPagination) {
                    stats.toplam++;
                    if (idx.lisans  >= 0 && checkEvet(tds[idx.lisans]))   stats.lisansli++;
                    if (idx.okul    >= 0 && checkEvet(tds[idx.okul]))     stats.okulSporlari++;
                    if (idx.kart    >= 0 && checkEvet(tds[idx.kart]))     stats.sporKart++;
                    if (idx.yetenek >= 0 && checkEvet(tds[idx.yetenek]))  stats.yetenek++;

                    if (idx.grup >= 0) {
                        const grupMetni = (tds[idx.grup]?.textContent || '').replace(/\s+/g, ' ').trim();
                        if (grupMetni) stats.gruplar.add(grupMetni);
                    }
                }
            });

            if (stopPagination) break;

            const nextLink = doc.querySelector('#tabSporcular .pagination .page-next')?.querySelector('a');
            if (nextLink && !nextLink.parentElement.classList.contains('disabled')) {
                await actionAndWaitForTable(doc, '#tabSporcular', '#gridOgrencilerimListesi', () => nextLink.click());
            } else {
                hasNextPage = false;
            }
        }

        return stats;
    }

    // ── Kuyruk İşleyici ──────────────────────────────────────────────────────
    async function processQueue() {
        if (isProcessorRunning) return;
        isProcessorRunning = true;
        const currentRunId = globalProcessorRunId;

        while (tasksQueue.some(t => t.status === 'pending')) {
            if (currentRunId !== globalProcessorRunId) break;
            if (isScriptPaused) { await new Promise(r => setTimeout(r, 500)); continue; }

            tasksQueue = tasksQueue.filter(t => t.status === 'processing' || document.body.contains(t.row));

            const batch = [];
            for (let i = 0; i < tasksQueue.length && batch.length < GSB_SETTINGS.concurrency; i++) {
                if (tasksQueue[i].status === 'pending') {
                    tasksQueue[i].status = 'processing';
                    batch.push(tasksQueue[i]);
                }
            }
            if (batch.length === 0) break;
            await Promise.all(batch.map(t => fetchCoachDataAndCalculate(t, currentRunId)));
        }
        if (currentRunId === globalProcessorRunId) isProcessorRunning = false;
    }

    // ── Ana UI Oluşturucu ────────────────────────────────────────────────────
    function calculateYoklamaUI() {
        const table = document.getElementById('cetgridAntrenman');
        if (!table) return;
        const theadRow = table.querySelector('thead tr');
        if (!theadRow) return;

        const period = getTablePeriod(table);
        if (!period) return;

        const classification  = classifyPeriod(period);
        const isPeriodEnabled = GSB_SETTINGS.periods.includes(classification);
        const isPastOrCurrent = (classification === 'past' || classification === 'current');

        const needsAntrenor  = GSB_SETTINGS.tabs.includes('antrenor')  && isPeriodEnabled;
        const needsYoklama   = GSB_SETTINGS.tabs.includes('yoklama')   && isPeriodEnabled && isPastOrCurrent;
        const needsTesis     = GSB_SETTINGS.tabs.includes('tesis')     && isPeriodEnabled && isPastOrCurrent;
        const needsSporcular = GSB_SETTINGS.tabs.includes('sporcular') && isPeriodEnabled && isPastOrCurrent;

        const nativeThs = Array.from(theadRow.querySelectorAll('th')).filter(
            th => !th.classList.contains('kadro-turu-th') && !th.classList.contains('guncel-yuzde-th'));

        const yuzdeThIndex = nativeThs.findIndex(th => th.getAttribute('data-field') === 'YoklamaYuzdesi');
        if (yuzdeThIndex === -1) return;

        const uygulamaThIndex = nativeThs.findIndex(th => {
            const f = (th.getAttribute('data-field') || '').toLowerCase();
            return f.includes('uygulama') || th.textContent.toLowerCase().includes('uygulama');
        });

        const ogrenciThIndex = nativeThs.findIndex(th => {
            const f   = (th.getAttribute('data-field') || '').toLowerCase();
            const txt = th.textContent.toLowerCase();
            return txt.includes('katılan sporcu') || txt.includes('katılan öğrenci') || txt.includes('öğrenci') || f.includes('ogrenci');
        });

        const firstRow   = table.querySelector('tbody tr:not(.no-records-found)');
        const isNewTable = firstRow && !firstRow.hasAttribute('data-fetching');
        if (isNewTable) {
            globalProcessorRunId++;
            tasksQueue = [];
            isProcessorRunning = false;
        }

        if (needsAntrenor && !theadRow.querySelector('.kadro-turu-th')) {
            const th = document.createElement('th');
            th.className = 'kadro-turu-th';
            th.style.cssText = 'text-align:center;vertical-align:middle;';
            th.textContent = 'Kadro Türü';
            theadRow.insertBefore(th, nativeThs[yuzdeThIndex].nextSibling);
        } else if (!needsAntrenor) {
            theadRow.querySelectorAll('.kadro-turu-th').forEach(el => el.remove());
            table.querySelectorAll('.kadro-turu-td').forEach(el => el.remove());
        }

        if (needsYoklama && !theadRow.querySelector('.guncel-yuzde-th')) {
            const th = document.createElement('th');
            th.className = 'guncel-yuzde-th';
            th.style.cssText = 'text-align:center;vertical-align:middle;';
            th.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;gap:8px;height:100%;">
                    <span>Genel Durum</span>
                    <button id="btn-pause-script" style="background:none;border:none;cursor:pointer;font-size:16px;">${isScriptPaused ? '▶️' : '⏸️'}</button>
                    <button id="btn-toggle-all-info" style="background:none;border:none;cursor:pointer;font-size:16px;">${isAllExpanded ? '🔼' : '🔽'}</button>
                </div>`;
            const refTh = theadRow.querySelector('.kadro-turu-th') || nativeThs[yuzdeThIndex];
            theadRow.insertBefore(th, refTh.nextSibling);
        } else if (!needsYoklama) {
            theadRow.querySelectorAll('.guncel-yuzde-th').forEach(el => el.remove());
            table.querySelectorAll('.guncel-yuzde-td').forEach(el => el.remove());
        }

        Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
            if (row.hasAttribute('data-fetching') || row.classList.contains('no-records-found')) return;

            const nativeTds = Array.from(row.querySelectorAll('td')).filter(
                td => !td.classList.contains('kadro-turu-td') && !td.classList.contains('guncel-yuzde-td'));
            if (nativeTds.length <= yuzdeThIndex) return;

            row.setAttribute('data-fetching', 'true');
            if (!isPeriodEnabled || (!needsAntrenor && !needsYoklama && !needsTesis && !needsSporcular)) return;

            const isZeroUygulama = uygulamaThIndex !== -1 && parseInt((nativeTds[uygulamaThIndex]?.textContent || '').trim(), 10) === 0;

            let coachId = null;
            const aTag = row.querySelector('a[onclick*="programOnizleme"]');
            if (aTag) {
                const m = aTag.getAttribute('onclick').match(/programOnizleme\(\d+,\s*(\d+)\)/);
                if (m) coachId = m[1];
            }

            // ── Programı Göster td'sine "Ders Olmayan Günler" butonu ekle ────
            const programTd = aTag ? aTag.closest('td') : null;
            const needsGunOzet = (needsYoklama || needsTesis) && !isZeroUygulama;
            if (programTd && coachId && needsGunOzet && !programTd.querySelector('.btn-gun-ozet-ac')) {
                programTd.insertAdjacentHTML('beforeend', `
                    <div style="margin-top:4px;text-align:center;">
                        <button class="btn-gun-ozet-ac" data-coach-id="${coachId}"
                            style="font-size:11px;padding:1px 6px;border:1px solid #ccc;border-radius:3px;
                                   background:#f8f9fa;cursor:pointer;color:#555;white-space:nowrap;"
                            title="Ders olmayan günleri listele">📅 Boş Günler</button>
                    </div>
                    <div class="gun-ozet-paneli" style="display:none;margin-top:5px;padding:7px 9px;
                        background:#fffbf0;border:1px solid #ffe58f;border-radius:5px;
                        font-size:11px;color:#333;max-height:220px;overflow-y:auto;
                        white-space:nowrap;line-height:1.8;">
                        <span style="color:#aaa;">⏳ Yükleniyor...</span>
                    </div>`);
            }

            let kadroTuruTd = null;
            if (needsAntrenor) {
                kadroTuruTd = document.createElement('td');
                kadroTuruTd.className = 'kadro-turu-td';
                kadroTuruTd.style.cssText = 'vertical-align:middle;text-align:center;';
                kadroTuruTd.innerHTML = coachId ? `<span style="color:#ccc;font-size:11px;">⏳</span>` : `<span style="color:#aaa;font-size:11px;">—</span>`;
                row.insertBefore(kadroTuruTd, nativeTds[yuzdeThIndex].nextSibling);
            }

            let yoklamaTd = null;
            if (needsYoklama) {
                yoklamaTd = document.createElement('td');
                yoklamaTd.className = 'guncel-yuzde-td';
                yoklamaTd.style.verticalAlign = 'middle';
                const insertAfter = kadroTuruTd || nativeTds[yuzdeThIndex];
                row.insertBefore(yoklamaTd, insertAfter.nextSibling);

                if (isZeroUygulama) {
                    yoklamaTd.innerHTML = `<div style="padding:0 5px;"><span style="display:inline-block;padding:3px 8px;background:#17a2b8;color:white;border-radius:3px;font-size:11px;font-weight:bold;">Tüm ay izinli</span></div>`;
                } else if (!coachId) {
                    yoklamaTd.innerHTML = `<span style="color:gray;font-size:10px;">ID Bulunamadı</span>`;
                } else {
                    yoklamaTd.innerHTML = `
                        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:0 5px;">
                            <span style="color:#f0ad4e;font-size:11px;font-weight:bold;">⏳ Bekliyor...</span>
                            <button class="btn-hemen-hesapla" data-coach-id="${coachId}" style="background:none;border:none;cursor:pointer;font-size:14px;">▶️</button>
                        </div>`;
                }
            }

            let ogrenciTd = null;
            if ((needsSporcular || needsTesis) && ogrenciThIndex !== -1 && coachId && !isZeroUygulama) {
                ogrenciTd = nativeTds[ogrenciThIndex];
                if (ogrenciTd && !ogrenciTd.querySelector('.btn-sporcu-bilgi-ac')) {
                    const origHtml = ogrenciTd.innerHTML;
                    ogrenciTd.innerHTML = `
                        <div style="display:flex;justify-content:center;align-items:center;gap:5px;">
                            <span>${origHtml}</span>
                            <button class="btn btn-xs btn-default btn-sporcu-bilgi-ac" style="padding:0 3px;font-size:14px;background:transparent;border:none;cursor:pointer;" title="Sporcu / Tesis Detayları">ℹ️</button>
                        </div>
                        <div class="sporcu-bilgi-paneli" style="display:${isAllExpanded ? 'block' : 'none'};position:relative;margin-top:8px;padding:10px;background:#e9f5ff;border:1px solid #b8daff;border-radius:6px;font-size:12px;white-space:normal;min-width:210px;color:#004085;text-align:left;box-shadow:0 3px 6px rgba(0,0,0,0.1);z-index:100;">
                            <span style="color:#5bc0de;font-size:11px;font-weight:bold;"><span class="glyphicon glyphicon-refresh" style="animation:spin 1s infinite linear;margin-right:4px;"></span>Veri Bekleniyor...</span>
                        </div>`;
                }
            }

            if (!coachId) return;

            tasksQueue.push({
                status: 'pending',
                row,
                coachId,
                kadroTuruTd,
                yoklamaTd,
                ogrenciTd,
                programTd: (programTd && needsGunOzet) ? programTd : null,
                needsAntrenor,
                needsYoklama:   needsYoklama && !isZeroUygulama,
                needsTesis:     needsTesis && !isZeroUygulama,
                needsSporcular: needsSporcular && !isZeroUygulama,
                periodYear:     period.year,
                periodMonth:    period.month,
                cachedData: {
                    sicilNo: null,
                    dersResult: null,
                    allLeaves: null,
                    sporcularStats: null
                }
            });
        });

        if (tasksQueue.some(t => t.status === 'pending') && !isProcessorRunning && !isScriptPaused) {
            processQueue();
        }
    }

    // ── Yardımcı: Veri Okunamadı HTML ─────────────────────────────────────────
    function veriYokHtml(coachId, mesaj) {
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                <span style="color:#856404;font-size:11px;font-weight:bold;">${mesaj || '⚠️ Veri okunamadı'}</span>
                <button class="btn-yeniden-dene" data-coach-id="${coachId}"
                    style="background:none;border:none;cursor:pointer;font-size:14px;flex-shrink:0;" title="Sadece bu veriyi yeniden çek">🔄</button>
            </div>`;
    }

    // ── Sporcu Paneli HTML ────────────────────────────────────────────────────
    function buildSporcuPanelHtml(coachId, sporcularStats, needsTesis, uniqueTesisler, needsSporcular) {
        let html = '';

        if (needsTesis) {
            const tesisArray = Array.from(uniqueTesisler).sort();
            const tesisHtml  = tesisArray.length > 0
                ? tesisArray.map(t => `<div style="color:#6c757d;font-size:10px;margin-top:1px;">↳ ${t}</div>`).join('')
                : `<div style="color:#6c757d;font-size:10px;">↳ Kayıtlı tesis yok</div>`;
            html += `
                <div style="margin-bottom:8px;font-weight:bold;color:#004085;border-bottom:1px solid #b8daff;padding-bottom:5px;">
                    Kullanılan Tesisler (${tesisArray.length})
                </div>
                <div style="margin-bottom:${needsSporcular ? '10px' : '0'};">${tesisHtml}</div>`;
        }

        if (needsSporcular) {
            if (!sporcularStats || !sporcularStats.tableLoaded) {
                html += veriYokHtml(coachId, '⚠️ Sporcu verisi okunamadı');
            } else {
                html += `
                    <div style="margin-bottom:8px;font-weight:bold;color:#004085;border-bottom:1px solid #b8daff;padding-bottom:5px;">Öğrenci Özeti (Bu Ay)</div>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <div style="display:flex;flex-direction:column;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span><b>Toplam Sporcu:</b></span>
                                <span style="font-weight:bold;color:#0056b3;font-size:13px;">${sporcularStats.toplam}</span>
                            </div>
                        </div>
                        <hr style="margin:0;border-top:1px dashed #b8daff;">
                        <div style="display:flex;flex-direction:column;gap:4px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span><b>Lisanslı:</b></span>
                                <span style="color:green;font-weight:bold;font-size:13px;">${sporcularStats.lisansli}</span>
                            </div>
                            <div style="color:#6c757d;font-size:10px;text-align:right;">↳ Okul Sporları: ${sporcularStats.okulSporlari}</div>
                            <div style="color:#6c757d;font-size:10px;text-align:right;">↳ Spor Kart: ${sporcularStats.sporKart}</div>
                            <div style="color:#6c757d;font-size:10px;text-align:right;">↳ Yetenek Seçilen: ${sporcularStats.yetenek}</div>
                        </div>
                        <hr style="margin:0;border-top:1px dashed #b8daff;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span><b>Çalışma Grubu:</b></span>
                            <span style="font-weight:bold;color:#0056b3;font-size:13px;">${sporcularStats.gruplar.size}</span>
                        </div>
                    </div>
                    <div style="margin-top:10px;border-top:1px solid #b8daff;padding-top:6px;font-size:10px;color:#6c757d;line-height:1.3;">* Sadece incelenen aya ait öğrenci istatistikleridir.</div>`;
            }
        }

        return html || 'Veri yok.';
    }

    // ── Kilitlenme Önleyicili Modüler Veri Çekici ────────────────────────────
    function fetchCoachDataAndCalculate(task, runId) {
        return new Promise(async (resolve) => {
            if (runId !== globalProcessorRunId) {
                return resolve();
            }

            const {
                coachId, row, kadroTuruTd, yoklamaTd, ogrenciTd, programTd,
                needsAntrenor, needsYoklama, needsTesis, needsSporcular,
                periodYear, periodMonth, cachedData: cd
            } = task;

            let doc, iframe, sicilNo;

            let fallbackTimeout = setTimeout(() => {
                if (iframe) iframe.remove();
                task.status = 'error';

                const mesaj = '⚠️ Genel Zaman Aşımı (Bağlantı koptu)';
                if (kadroTuruTd && cd.sicilNo === null) kadroTuruTd.innerHTML = `<span style="color:#856404;font-size:11px;" title="Zaman aşımı">⚠️</span>`;
                if (yoklamaTd && needsYoklama && (!cd.dersResult || !cd.dersResult.tableLoaded || cd.allLeaves === null)) yoklamaTd.innerHTML = veriYokHtml(coachId, mesaj);
                if (ogrenciTd && needsSporcular && (!cd.sporcularStats || !cd.sporcularStats.tableLoaded)) {
                    const sporcuPanel = ogrenciTd.querySelector('.sporcu-bilgi-paneli');
                    if (sporcuPanel) sporcuPanel.innerHTML = veriYokHtml(coachId, mesaj);
                }
                resolve();
            }, 45000);

            try {
                if (kadroTuruTd && cd.sicilNo === null) {
                    kadroTuruTd.innerHTML = `<span style="color:#aaa;font-size:10px;">🔄</span>`;
                }
                if (yoklamaTd && needsYoklama && (!cd.dersResult || !cd.dersResult.tableLoaded || cd.allLeaves === null)) {
                    yoklamaTd.innerHTML = `<div style="padding:0 5px;"><span style="color:#5bc0de;font-size:11px;font-weight:bold;"><span class="glyphicon glyphicon-refresh" style="animation:spin 1s infinite linear;margin-right:4px;"></span>Sistemden Çekiliyor...</span></div>`;
                }
                if (ogrenciTd && needsSporcular && (!cd.sporcularStats || !cd.sporcularStats.tableLoaded)) {
                    const sporcuPanel = ogrenciTd.querySelector('.sporcu-bilgi-paneli');
                    if (sporcuPanel) {
                        sporcuPanel.innerHTML = `<span style="color:#5bc0de;font-size:11px;font-weight:bold;"><span class="glyphicon glyphicon-refresh" style="animation:spin 1s infinite linear;margin-right:4px;"></span>Sistemden Çekiliyor...</span>`;
                    }
                }

                const fetchAntrenor = needsAntrenor && cd.sicilNo === null;

                ({ doc, iframe, sicilNo } = await getDocViaIframe(coachId, fetchAntrenor));
                if (runId !== globalProcessorRunId) {
                    clearTimeout(fallbackTimeout);
                    if (iframe) iframe.remove();
                    return resolve();
                }
                if (!doc) throw new Error('Boş İçerik');

                if (fetchAntrenor) cd.sicilNo = sicilNo;

                if (needsAntrenor && kadroTuruTd) {
                    kadroTuruTd.innerHTML = `<div style="padding:0 5px;">${kadroTuruBadge(getSicilType(cd.sicilNo))}</div>`;
                }

                // ── izin perfLog'un her koşulda yazılması için t0 dışarıda tanımlanıyor ──
                let izinT0 = 0;
                try {
                    if ((needsYoklama || needsTesis) && (!cd.dersResult || !cd.dersResult.tableLoaded)) {
                        const t0 = Date.now();
                        cd.dersResult = await extractAllDersRows(doc, periodYear, periodMonth);
                        perfLog('dersler', coachId, Date.now() - t0);
                    }

                    if (needsYoklama && cd.allLeaves === null) {
                        izinT0 = Date.now();
                        cd.allLeaves = await extractIzinRows(doc);
                        perfLog('izin', coachId, Date.now() - izinT0);
                    }
                } catch (innerErr) {
                    // Bir sekme hata verirse izin logunu yine de yaz, sonra yeniden fırlat
                    if (izinT0 > 0 && cd.allLeaves === null) {
                        perfLog('izin', coachId, Date.now() - izinT0);
                    }
                    throw innerErr;
                }

                if (needsSporcular && (!cd.sporcularStats || !cd.sporcularStats.tableLoaded)) {
                    const t0 = Date.now();
                    cd.sporcularStats = await extractSporcular(doc, periodYear, periodMonth);
                    perfLog('sporcular', coachId, Date.now() - t0);
                }

                // ── Ders Olmayan Günler Panelini Doldur ──────────────────────
                if (programTd && cd.dersResult && cd.dersResult.tableLoaded) {
                    const gunPanel = programTd.querySelector('.gun-ozet-paneli');
                    if (gunPanel) {
                        const missing = getMissingDays(cd.dersResult.rows, periodYear, periodMonth);
                        if (missing.length === 0) {
                            gunPanel.innerHTML = `<span style="color:#27ae60;font-weight:bold;">✅ Her gün en az bir ders var</span>`;
                        } else {
                            gunPanel.innerHTML =
                                `<div style="margin-bottom:4px;font-weight:bold;color:#856404;border-bottom:1px solid #ffe58f;padding-bottom:3px;">` +
                                `Ders Yok (${missing.length} gün)</div>` +
                                missing.map(g => `<div>${g}</div>`).join('');
                        }
                    }
                } else if (programTd && (!cd.dersResult || !cd.dersResult.tableLoaded)) {
                    const gunPanel = programTd.querySelector('.gun-ozet-paneli');
                    if (gunPanel) gunPanel.innerHTML = `<span style="color:#856404;font-size:11px;">⚠️ Ders verisi okunamadı</span>`;
                }

                const tumDersVerileri = cd.dersResult ? cd.dersResult.rows : [];
                const allLeaves       = cd.allLeaves || [];
                let uniqueTesisler    = new Set();

                const today           = new Date();
                const todayYMD        = toYMD(today);
                const threeDaysAgoYMD = toYMD(new Date(today.getTime() - 3 * 86400000));
                const isLeaveDay      = ts => ts && allLeaves.some(l => ts >= l.start && ts <= l.end);

                let brutGereken = 0, izinliGereken = 0, gecmisGereken = 0, son3GunEksik = 0;
                let gecmisVar = 0, gecmisOgrenciYok = 0, gecmisTesisUygunDegil = 0, gecmisIptal = 0, gecmisEksik = 0;

                tumDersVerileri.forEach(ders => {
                    const isOnLeave = isLeaveDay(ders.rowTimestamp);
                    const isPast    = ders.rowYMD < todayYMD;
                    const isHedef   = ders.hasClassVar || ders.hasClassYok || ders.hasClassIptal;
                    if (isHedef && ders.rowTesisAdi && ders.rowTesisAdi !== '-' && ders.rowTesisAdi !== '') {
                        uniqueTesisler.add(ders.rowTesisAdi);
                    }
                    if (isPast && isHedef) {
                        brutGereken++;
                        if (isOnLeave) { izinliGereken++; }
                        else {
                            gecmisGereken++;
                            if (ders.isTesisUygunDegil)  gecmisTesisUygunDegil++;
                            else if (ders.hasClassIptal)   gecmisIptal++;
                            else if (ders.isOgrenciYok)    gecmisOgrenciYok++;
                            else if (ders.isIslemYapilmadi) {
                                gecmisEksik++;
                                if (ders.rowYMD >= threeDaysAgoYMD) son3GunEksik++;
                            } else if (ders.hasClassVar)   gecmisVar++;
                        }
                    }
                });

                let hasAnyError = false;

                if (ogrenciTd && (needsTesis || needsSporcular)) {
                    const sporcuPanel = ogrenciTd.querySelector('.sporcu-bilgi-paneli');
                    if (sporcuPanel) {
                        sporcuPanel.innerHTML = buildSporcuPanelHtml(
                            coachId, cd.sporcularStats, needsTesis, uniqueTesisler, needsSporcular
                        );
                    }
                    if (needsSporcular && (!cd.sporcularStats || !cd.sporcularStats.tableLoaded)) {
                        hasAnyError = true;
                    }
                }

                if (needsYoklama && yoklamaTd) {
                    if (!cd.dersResult || !cd.dersResult.tableLoaded || cd.allLeaves === null) {
                        const msg = (!cd.dersResult || !cd.dersResult.tableLoaded) ? '⚠️ Dersler okunamadı' : '⚠️ İzinler okunamadı';
                        yoklamaTd.innerHTML = veriYokHtml(coachId, msg);
                        hasAnyError = true;
                    } else {

                        // ── Veri Doğrulama ────────────────────────────────────────────────
                        // Durum 1: Sayfada satır var (totalRowsOnPage > 0) ama hedef aya ait
                        //          hiç satır eşleşmedi → tarih parse sorunu şüphesi.
                        // Durum 2: Hedef aya ait satırlar var ama hiçbirinde CSS sınıfı yok
                        //          (classifiedRowCount = 0) ve ayın 5'inden geçildi → DOM
                        //          okuma sorunu şüphesi.
                        const rowsOnPage      = cd.dersResult.totalRowsOnPage;
                        const rowsMatched     = cd.dersResult.rows.length;
                        const classifiedCount = cd.dersResult.classifiedRowCount || 0;
                        const dayOfMonth      = today.getDate();

                        const isDataSuspect =
                            (rowsOnPage > 0 && rowsMatched === 0) ||
                            (rowsMatched > 3 && classifiedCount === 0 && dayOfMonth > 5);

                        if (isDataSuspect) {
                            yoklamaTd.innerHTML = veriYokHtml(coachId, '⚠️ Veri doğrulanamadı');
                            hasAnyError = true;
                        } else {
                        // ─────────────────────────────────────────────────────────────────

                        let anlikYuzde = gecmisGereken > 0
                            ? ((gecmisVar + gecmisOgrenciYok + gecmisTesisUygunDegil) / gecmisGereken) * 100
                            : 100;
                        if (anlikYuzde > 100) anlikYuzde = 100;

                        const color      = anlikYuzde < 90 ? 'rgb(255,0,0)' : 'rgb(0,120,200)';
                        const potansiyel = gecmisGereken > 0
                            ? Math.round(Math.min(100, ((gecmisVar + gecmisOgrenciYok + gecmisTesisUygunDegil + son3GunEksik) / gecmisGereken) * 100))
                            : 100;
                        const poColor    = potansiyel < 90 ? '#c0392b' : '#1a7abf';

                        const islemYazisi = son3GunEksik > 0
                            ? `<div style="font-size:10px;color:green;margin-top:4px;line-height:1.5;background:#fff5f5;border:1px solid #f5c6cb;border-radius:3px;padding:4px 6px;">
                                    <div style="font-weight:bold;">Alınabilir: ${son3GunEksik}</div>
                                    <div style="color:${poColor};">Alınırsa: <b>%${potansiyel}</b></div>
                               </div>`
                            : '';

                        yoklamaTd.innerHTML = `
                            <div style="display:flex;align-items:center;width:100%;">
                                <div style="flex-grow:1;text-align:left;padding-right:5px;">
                                    <span style="color:${color};font-weight:bold;font-size:12px;">%${Math.round(anlikYuzde)}</span>
                                    <div style="width:100%;background-color:#e0e0e0;height:10px;border-radius:5px;margin-top:2px;">
                                        <div style="width:${anlikYuzde}%;background-color:${color};height:100%;border-radius:5px;"></div>
                                    </div>
                                </div>
                                <button class="btn btn-xs btn-default btn-bilgi-ac" style="padding:0 3px;font-size:14px;background:transparent;border:none;cursor:pointer;" title="Hesaplama Detayları">ℹ️</button>
                            </div>
                            ${islemYazisi}
                            <div class="bilgi-paneli" style="display:${isAllExpanded ? 'block' : 'none'};margin-top:8px;padding:10px;background:#e9f5ff;border:1px solid #b8daff;border-radius:6px;font-size:12px;white-space:normal;min-width:210px;color:#004085;text-align:left;box-shadow:0 3px 6px rgba(0,0,0,0.1);z-index:100;position:relative;">
                                <div style="margin-bottom:8px;font-weight:bold;border-bottom:1px solid #b8daff;padding-bottom:5px;">Geçmiş Özeti</div>
                                <div style="display:flex;flex-direction:column;gap:8px;">
                                    <div style="display:flex;flex-direction:column;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;">
                                            <span><b>Gereken:</b></span>
                                            <span style="font-weight:bold;color:#0056b3;font-size:13px;">${gecmisGereken}</span>
                                        </div>
                                        <div style="color:#6c757d;font-size:10px;text-align:right;margin-top:2px;">↳ Brüt: ${brutGereken} | İzinli: ${izinliGereken}</div>
                                    </div>
                                    <hr style="margin:0;border-top:1px dashed #b8daff;">
                                    <div style="display:flex;flex-direction:column;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;">
                                            <span><b>Alınan:</b></span>
                                            <span style="color:green;font-weight:bold;font-size:13px;">${gecmisVar + gecmisOgrenciYok + gecmisTesisUygunDegil}</span>
                                        </div>
                                        <div style="color:#6c757d;font-size:10px;text-align:right;margin-top:2px;">↳ Öğrencilerin hiçbiri katılmadı: ${gecmisOgrenciYok}</div>
                                        <div style="color:#6c757d;font-size:10px;text-align:right;margin-top:1px;">↳ Tesis uygun değildi: ${gecmisTesisUygunDegil}</div>
                                    </div>
                                    <hr style="margin:0;border-top:1px dashed #b8daff;">
                                    <div style="display:flex;flex-direction:column;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;">
                                            <span><b>Alınmayan:</b></span>
                                            <span style="color:red;font-weight:bold;font-size:13px;">${gecmisEksik + gecmisIptal}</span>
                                        </div>
                                        <div style="color:#6c757d;font-size:10px;text-align:right;margin-top:2px;">↳ İşlem yapılmadı: ${gecmisEksik}</div>
                                        <div style="color:#6c757d;font-size:10px;text-align:right;margin-top:1px;">↳ Eşleştirme yapılmamış: ${gecmisIptal}</div>
                                    </div>
                                </div>
                                <div style="margin-top:10px;border-top:1px solid #b8daff;padding-top:6px;font-size:10px;color:#6c757d;line-height:1.3;">* Bugün hesaplamaya dahil edilmemiştir.<br>* Öğrencilerin katılmadığı veya tesisin uygun olmadığı dersler yoklama alınmış sayılır.</div>
                            </div>`;

                        } // end isDataSuspect else
                    }
                }

                task.status = hasAnyError ? 'error' : 'done';
                clearTimeout(fallbackTimeout);
                setTimeout(() => iframe.remove(), 400);
                resolve();

            } catch (e) {
                clearTimeout(fallbackTimeout);
                task.status = 'error';
                if (iframe) iframe.remove();

                const isVeriYok = e.message === ERR_VERI_OKUNAMADI;
                const mesaj     = isVeriYok ? '⚠️ Veri okunamadı' : '❌ Hata';

                if (kadroTuruTd && cd.sicilNo === null) {
                    kadroTuruTd.innerHTML = `<span style="color:#856404;font-size:11px;" title="${e.message}">⚠️</span>`;
                }
                if (yoklamaTd && needsYoklama && (!cd.dersResult || !cd.dersResult.tableLoaded || cd.allLeaves === null)) {
                    yoklamaTd.innerHTML = veriYokHtml(coachId, mesaj);
                }
                if (ogrenciTd && needsSporcular && (!cd.sporcularStats || !cd.sporcularStats.tableLoaded)) {
                    const sporcuPanel = ogrenciTd.querySelector('.sporcu-bilgi-paneli');
                    if (sporcuPanel) {
                        sporcuPanel.innerHTML = veriYokHtml(coachId, mesaj);
                    }
                }
                resolve();
            }
        });
    }

    // ── Olay Dinleyiciler ────────────────────────────────────────────────────

    document.addEventListener('click', e => {
        const btnInfo = e.target.closest('.btn-bilgi-ac');
        if (btnInfo) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            const p = btnInfo.closest('td')?.querySelector('.bilgi-paneli');
            if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
            return;
        }

        const btnSporcuInfo = e.target.closest('.btn-sporcu-bilgi-ac');
        if (btnSporcuInfo) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            const p = btnSporcuInfo.closest('td')?.querySelector('.sporcu-bilgi-paneli');
            if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
            return;
        }

        const btnGunOzet = e.target.closest('.btn-gun-ozet-ac');
        if (btnGunOzet) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            const p = btnGunOzet.closest('td')?.querySelector('.gun-ozet-paneli');
            if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
            return;
        }
    }, true);

    document.addEventListener('click', e => {
        const btnAll = e.target.closest('#btn-toggle-all-info');
        if (btnAll) {
            isAllExpanded = !isAllExpanded;
            btnAll.innerHTML = isAllExpanded ? '🔼' : '🔽';
            document.querySelectorAll('.bilgi-paneli, .sporcu-bilgi-paneli').forEach(p => {
                p.style.display = isAllExpanded ? 'block' : 'none';
            });
        }

        const btnPause = e.target.closest('#btn-pause-script');
        if (btnPause) {
            isScriptPaused = !isScriptPaused;
            btnPause.innerHTML = isScriptPaused ? '▶️' : '⏸️';
            if (!isScriptPaused && !isProcessorRunning) processQueue();
        }

        const btnHemen = e.target.closest('.btn-hemen-hesapla');
        if (btnHemen) {
            e.stopPropagation();
            const t = tasksQueue.find(x => x.coachId === btnHemen.dataset.coachId && x.status === 'pending');
            if (t) { t.status = 'processing'; fetchCoachDataAndCalculate(t, globalProcessorRunId); }
        }

        const btnRetry = e.target.closest('.btn-yeniden-dene');
        if (btnRetry) {
            e.stopPropagation();
            const t = tasksQueue.find(x => x.coachId === btnRetry.dataset.coachId);
            if (t) {
                t.status = 'processing';
                fetchCoachDataAndCalculate(t, globalProcessorRunId);
            }
        }
    });

    // ── Tablo Değişim Gözlemcisi ─────────────────────────────────────────────
    const observer = new MutationObserver(mutations => {
        const hasNew = mutations.some(x =>
            Array.from(x.addedNodes).some(n =>
                n.nodeType === 1 &&
                !n.classList.contains('guncel-yuzde-td') &&
                !n.classList.contains('guncel-yuzde-th') &&
                !n.classList.contains('kadro-turu-td') &&
                !n.classList.contains('kadro-turu-th')
            )
        );
        if (hasNew) {
            clearTimeout(window.gsbCalcTimer);
            window.gsbCalcTimer = setTimeout(calculateYoklamaUI, 400);
        }
    });

    window.addEventListener('load', () => {
        setTimeout(calculateYoklamaUI, 800);
        const container = document.querySelector('.bootstrap-table');
        if (container) observer.observe(container, { childList: true, subtree: true });
    });

    const style = document.createElement('style');
    style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

})();
