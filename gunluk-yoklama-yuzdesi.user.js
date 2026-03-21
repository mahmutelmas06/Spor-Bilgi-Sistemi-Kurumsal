// ==UserScript==
// @name         SBS Günlük Yoklama Yüzdesi Gösterici
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Kurum personelleri için yazılmış iş takip betiğidir. (Akıllı Sütun Tespiti & Saat Duyarlılığı)
// @author       YZ yardımıyla mahmut.elmas@yaani.com
// @updateURL    https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Kurumsal/main/gunluk-yoklama-yuzdesi.user.js
// @downloadURL  https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Kurumsal/main/gunluk-yoklama-yuzdesi.user.js
// @match        *://spor.gsb.gov.tr/Modules/Antrenman/AntrenmanProgramiListeleme.aspx*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    const AUTO_START_KEY = 'gsb_auto_start';
    let isAutoStart = localStorage.getItem(AUTO_START_KEY) !== 'false';

    let tasksQueue = [];
    let isScriptPaused = !isAutoStart;
    let isProcessorRunning = false;
    let isAllExpanded = false;
    let globalProcessorRunId = 0;

    function toYMD(date) {
        return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    }

    const MONTH_MAP = {
        'OCAK': 1, 'ŞUBAT': 2, 'MART': 3, 'NİSAN': 4,
        'MAYIS': 5, 'HAZİRAN': 6, 'TEMMUZ': 7, 'AĞUSTOS': 8,
        'EYLÜL': 9, 'EKİM': 10, 'KASIM': 11, 'ARALIK': 12
    };

    GM_registerMenuCommand(`⚙️ Başlangıç Modu: ${isAutoStart ? 'OTOMATİK' : 'BEKLEME'}`, () => {
        const newState = !isAutoStart;
        localStorage.setItem(AUTO_START_KEY, newState);
        alert(`Sistem artık "${newState ? 'OTOMATİK' : 'BEKLEME'}" modunda başlayacak. Sayfa yenileniyor...`);
        location.reload();
    });

    function resetAndRestartSystem() {
        globalProcessorRunId++;
        tasksQueue = [];
        isProcessorRunning = false;
        clearTimeout(window.gsbCalcTimer);
        window.gsbCalcTimer = setTimeout(calculateYoklamaUI, 500);
    }

    function getDocViaIframe(coachId) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'width:10px; height:10px; position:absolute; top:-9999px; left:-9999px; border:none; opacity:0; pointer-events:none;';
            iframe.src = `/Modules/Antrenman/AntrenorPersonelDetay.aspx?antrenorpersonelid=${coachId}`;
            document.body.appendChild(iframe);

            let checkDersInterval, checkIzinInterval;
            let timeout = setTimeout(() => {
                clearInterval(checkDersInterval);
                clearInterval(checkIzinInterval);
                iframe.remove();
                reject(new Error("Zaman Aşımı"));
            }, 30000);

            iframe.onload = () => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    setTimeout(() => {
                        const dersTabLink = doc.querySelector('a[href="#tabProgramDers"]');
                        if (dersTabLink && !dersTabLink.parentElement.classList.contains('active')) dersTabLink.click();

                        let attemptDers = 0;
                        checkDersInterval = setInterval(() => {
                            attemptDers++;
                            const loadDivDers = doc.querySelector('#tabProgramDers .fixed-table-loading');
                            const isLoadingDers = loadDivDers && getComputedStyle(loadDivDers).display !== 'none';
                            const rowsDers = doc.querySelectorAll('#CetGridProgramDers tbody tr');
                            let isNoRecordsDers = rowsDers.length > 0 && rowsDers[0].textContent.toLowerCase().includes('bulunamadı');

                            if (!isLoadingDers && (rowsDers.length > 1 || isNoRecordsDers || (rowsDers.length === 1 && !isNoRecordsDers))) {
                                clearInterval(checkDersInterval);

                                const izinTabLink = doc.querySelector('a[href="#tabIzin"]');
                                if (izinTabLink) izinTabLink.click();

                                let attemptIzin = 0;
                                checkIzinInterval = setInterval(() => {
                                    attemptIzin++;
                                    const loadDivIzin = doc.querySelector('#tabIzin .fixed-table-loading');
                                    const isLoadingIzin = loadDivIzin && getComputedStyle(loadDivIzin).display !== 'none';
                                    const rowsIzin = doc.querySelectorAll('#gridIzinListesi tbody tr');
                                    let isNoRecordsIzin = rowsIzin.length > 0 && rowsIzin[0].textContent.toLowerCase().includes('bulunamadı');

                                    if (!isLoadingIzin && (rowsIzin.length > 1 || isNoRecordsIzin || (rowsIzin.length === 1 && !isNoRecordsIzin))) {
                                        clearInterval(checkIzinInterval);
                                        clearTimeout(timeout);
                                        resolve({ doc, iframe });
                                    } else if (attemptIzin > 30) {
                                        clearInterval(checkIzinInterval);
                                        clearTimeout(timeout);
                                        iframe.remove();
                                        reject(new Error("İzin Tablosu Yüklenemedi"));
                                    }
                                }, 500);

                            } else if (attemptDers > 30) {
                                clearInterval(checkDersInterval);
                                clearTimeout(timeout);
                                iframe.remove();
                                reject(new Error("Ders Tablosu Yüklenemedi"));
                            }
                        }, 500);

                    }, 400);
                } catch (e) {
                    clearInterval(checkDersInterval);
                    clearInterval(checkIzinInterval);
                    clearTimeout(timeout);
                    iframe.remove();
                    reject(e);
                }
            };
        });
    }

    async function extractAllDersRows(doc, targetY, targetM) {
        let allRowsData = [];

        const dersTabLink = doc.querySelector('a[href="#tabProgramDers"]');
        if (dersTabLink && !dersTabLink.parentElement.classList.contains('active')) {
            dersTabLink.click();
            await new Promise(r => setTimeout(r, 600));
        }

        const waitForTable = () => new Promise(resolve => {
            setTimeout(() => {
                let attempt = 0;
                let check = setInterval(() => {
                    attempt++;
                    const loadDiv = doc.querySelector('#tabProgramDers .fixed-table-loading');
                    const isLoading = loadDiv && getComputedStyle(loadDiv).display !== 'none';
                    if (!isLoading || attempt > 50) {
                        clearInterval(check);
                        setTimeout(resolve, 400);
                    }
                }, 200);
            }, 500);
        });

        try {
            const pageSizeBtn = doc.querySelector('#tabProgramDers .page-list button');
            if (pageSizeBtn && !pageSizeBtn.textContent.includes('100')) {
                const size100Opt = Array.from(doc.querySelectorAll('#tabProgramDers .page-list .dropdown-menu li a')).find(a => a.textContent.trim() === '100');
                if (size100Opt) {
                    size100Opt.click();
                    await waitForTable();
                }
            }
        } catch(e) { }

        let hasNextPage = true;
        let lastFirstRowHtml = "";
        let safetyCounter = 0;

        while(hasNextPage && safetyCounter < 20) {
            safetyCounter++;
            const rows = doc.querySelectorAll('#CetGridProgramDers tbody tr');
            if (!rows || rows.length === 0 || rows[0].classList.contains('no-records-found')) break;

            const currentFirstRowHtml = rows[0].innerHTML;
            if (currentFirstRowHtml === lastFirstRowHtml) {
                break;
            }
            lastFirstRowHtml = currentFirstRowHtml;

            let pageHasOlderMonth = false;

            rows.forEach(tr => {
                const hasClassVar = tr.classList.contains('YoklamaVar');
                const hasClassYok = tr.classList.contains('YoklamaYok');
                const hasClassIptal = tr.classList.contains('CalismaGrubuYok');

                const isOgrenciYok = tr.innerHTML.includes('Öğrencilerin hiçbiri derse katılmadı');
                const isIslemYapilmadi = tr.innerHTML.includes('İşlem yapılmadı');

                let rowYMD = null;
                let rowMonthNum = null;
                let rowYearNum = null;
                let rowTimestamp = null;

                const tds = tr.querySelectorAll('td');
                for (let td of tds) {
                    const txt = td.textContent.trim();
                    const dateMatch = txt.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
                    if (dateMatch) {
                        const d = parseInt(dateMatch[1], 10);
                        const m = parseInt(dateMatch[2], 10);
                        const y = parseInt(dateMatch[3], 10);
                        const hr = dateMatch[4] ? parseInt(dateMatch[4], 10) : 12;
                        const mn = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;

                        rowYMD = y * 10000 + m * 100 + d;
                        rowMonthNum = m;
                        rowYearNum = y;
                        rowTimestamp = new Date(y, m - 1, d, hr, mn, 0).getTime();
                        break;
                    }
                }

                if (rowYearNum && rowMonthNum) {
                    if (rowYearNum < targetY || (rowYearNum === targetY && rowMonthNum < targetM)) {
                        pageHasOlderMonth = true;
                    } else if (rowYearNum === targetY && rowMonthNum === targetM) {
                        allRowsData.push({ hasClassVar, hasClassYok, hasClassIptal, isOgrenciYok, isIslemYapilmadi, rowYMD, rowTimestamp });
                    }
                }
            });

            const nextBtnLi = doc.querySelector('#tabProgramDers .pagination .page-next');
            const nextLink = nextBtnLi ? nextBtnLi.querySelector('a') : null;

            if (!pageHasOlderMonth && nextBtnLi && !nextBtnLi.classList.contains('disabled') && nextLink) {
                nextLink.click();
                await waitForTable();
            } else {
                hasNextPage = false;
            }
        }

        return allRowsData;
    }

    async function processQueue() {
        if (isProcessorRunning) return;
        isProcessorRunning = true;

        const currentRunId = globalProcessorRunId;

        while (tasksQueue.some(t => t.status === 'pending')) {
            if (currentRunId !== globalProcessorRunId) {
                break;
            }

            if (isScriptPaused) {
                await new Promise(r => setTimeout(r, 500));
                continue;
            }

            tasksQueue = tasksQueue.filter(t => t.status === 'processing' || document.body.contains(t.newTd));

            const batch = [];
            for (let i = 0; i < tasksQueue.length && batch.length < 2; i++) {
                if (tasksQueue[i].status === 'pending') {
                    tasksQueue[i].status = 'processing';
                    batch.push(tasksQueue[i]);
                }
            }

            if (batch.length === 0) break;

            const promises = batch.map(t => fetchCoachDataAndCalculate(t, currentRunId));
            await Promise.all(promises);
        }

        if (currentRunId === globalProcessorRunId) {
            isProcessorRunning = false;
        }
    }

    function calculateYoklamaUI() {
        const table = document.getElementById('cetgridAntrenman');
        if (!table) return;

        const tbodyRows = Array.from(table.querySelectorAll('tbody tr'));
        const firstValidRow = tbodyRows.find(tr => !tr.classList.contains('no-records-found') && tr.querySelectorAll('td').length > 3);

        if (firstValidRow) {
            const tds = firstValidRow.querySelectorAll('td');
            if (tds[1] && tds[2]) {
                const rowYear = parseInt(tds[1].textContent.trim(), 10);
                const rowMonthStr = tds[2].textContent.trim().toUpperCase();
                const rowMonthNum = MONTH_MAP[rowMonthStr];

                const today = new Date();
                const currentY = today.getFullYear();
                const currentM = today.getMonth() + 1;

                if (rowYear !== currentY || rowMonthNum !== currentM) {
                    const existingTh = table.querySelector('.guncel-yuzde-th');
                    if (existingTh) existingTh.remove();

                    table.querySelectorAll('.guncel-yuzde-td').forEach(td => td.remove());
                    tbodyRows.forEach(row => row.removeAttribute('data-fetching'));
                    table.dataset.yoklamaAdded = 'false';
                    tasksQueue = [];
                    return;
                }
            }
        }

        const theadRow = table.querySelector('thead tr');
        if (!theadRow) return;

        const thElements = Array.from(theadRow.querySelectorAll('th'));
        const yuzdeThIndex = thElements.findIndex(th => th.getAttribute('data-field') === 'YoklamaYuzdesi');

        if (yuzdeThIndex === -1) return;

        let uygulamaThIndex = -1;
        for (let i = 0; i < thElements.length; i++) {
            const field = (thElements[i].getAttribute('data-field') || '').toLowerCase();
            const text = thElements[i].textContent.toLowerCase();
            if (field.includes('uygulama') || text.includes('uygulama') || field.includes('planlanan')) {
                uygulamaThIndex = i;
                break;
            }
        }

        if (table.dataset.yoklamaAdded !== 'true' || !table.querySelector('.guncel-yuzde-th')) {
            const newTh = document.createElement('th');
            newTh.className = 'guncel-yuzde-th';
            newTh.style.textAlign = 'center';
            newTh.style.verticalAlign = 'middle';
            newTh.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; gap:5px; height:100%;">
                    <span>Günlük Yoklama</span>
                    <button id="btn-pause-script" style="background:none; border:none; cursor:pointer; font-size:16px; padding:0; line-height:1; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));" title="İşlemi durdur veya başlat">
                        ${isScriptPaused ? '▶️' : '⏸️'}
                    </button>
                    <button id="btn-toggle-all-info" style="background:none; border:none; cursor:pointer; font-size:16px; padding:0; line-height:1; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));" title="Tüm detayları Aç/Kapat">
                        ${isAllExpanded ? '🔼' : '🔽'}
                    </button>
                </div>
            `;
            theadRow.insertBefore(newTh, thElements[yuzdeThIndex].nextSibling);
            table.dataset.yoklamaAdded = 'true';
        }

        tbodyRows.forEach(row => {
            if (row.hasAttribute('data-fetching') || row.classList.contains('no-records-found')) return;

            const tds = row.querySelectorAll('td');
            if (tds.length <= yuzdeThIndex) return;

            row.setAttribute('data-fetching', 'true');

            let isZeroUygulama = false;
            if (uygulamaThIndex !== -1 && tds.length > uygulamaThIndex) {
                const val = parseInt(tds[uygulamaThIndex].textContent.trim(), 10);
                if (val === 0) {
                    isZeroUygulama = true;
                }
            }

            let coachId = null;
            const aTag = row.querySelector('a[onclick*="programOnizleme"]');
            if (aTag) {
                const match = aTag.getAttribute('onclick').match(/programOnizleme\(\d+,\s*(\d+)\)/);
                if (match && match[1]) coachId = match[1];
            }

            const newTd = document.createElement('td');
            newTd.className = 'guncel-yuzde-td';
            newTd.style.verticalAlign = 'middle';
            row.insertBefore(newTd, tds[yuzdeThIndex].nextSibling);

            if (isZeroUygulama) {
                newTd.innerHTML = `
                    <div style="display:flex; justify-content:flex-start; align-items:center; width:100%; padding: 0 5px;">
                        <span style="display:inline-block; padding:3px 8px; background-color:#17a2b8; color:white; border-radius:3px; font-size:11px; font-weight:bold;">Tüm ay izinli</span>
                    </div>
                `;
                return;
            }

            if (!coachId) {
                newTd.innerHTML = `<span style="color:gray; font-size:10px;">ID Bulunamadı</span>`;
                return;
            }

            newTd.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding: 0 5px;">
                    <span style="color:#f0ad4e; font-size:11px; font-weight:bold;">⏳ Bekliyor...</span>
                    <button class="btn-hemen-hesapla" data-coach-id="${coachId}" title="Sırayı beklemeden HEMEN hesapla" style="background:none; border:none; cursor:pointer; font-size:14px; padding:0;">▶️</button>
                </div>
            `;

            tasksQueue.push({ status: 'pending', coachId, newTd });
        });

        if (tasksQueue.some(t => t.status === 'pending') && !isProcessorRunning && !isScriptPaused) {
            processQueue();
        }
    }

    async function fetchCoachDataAndCalculate(task, runId) {
        if (runId !== globalProcessorRunId) return;

        const { coachId, newTd } = task;
        let doc, iframe;

        try {
            newTd.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:flex-start; width:100%; padding: 0 5px;">
                    <span style="color:#5bc0de; font-size:11px; font-weight:bold;"><span class="glyphicon glyphicon-refresh" style="animation: spin 1s infinite linear; margin-right:4px;"></span>Sistemden Çekiliyor...</span>
                </div>
            `;

            ({ doc, iframe } = await getDocViaIframe(coachId));

            if (runId !== globalProcessorRunId) {
                if (iframe) iframe.remove();
                return;
            }

            if (!doc) throw new Error("Sayfa İçeriği Boş");

            const izinRows = doc.querySelectorAll('#gridIzinListesi tbody tr');
            let allLeaves = [];

            // METİN İÇİNDEKİ TARİHLERİ BULMA (Eğik çizgi ve nokta destekli)
            function extractDatesFromText(txt) {
                if (!txt) return [];
                const regex = /(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/g;
                let matches = [];
                let match;

                while ((match = regex.exec(txt)) !== null) {
                    const hasTime = match[4] !== undefined;
                    const ts = new Date(
                        parseInt(match[3], 10),
                        parseInt(match[2], 10) - 1,
                        parseInt(match[1], 10),
                        match[4] ? parseInt(match[4], 10) : 0,
                        match[5] ? parseInt(match[5], 10) : 0,
                        match[6] ? parseInt(match[6], 10) : 0
                    ).getTime();
                    matches.push({ ts, hasTime });
                }
                return matches;
            }

            // SÜTUN BAŞLIKLARINI DİNAMİK OLARAK TESPİT ET
            const izinThElements = Array.from(doc.querySelectorAll('#gridIzinListesi thead th'));
            let baslangicIndex = 1; // Başlık bulunamazsa varsayılan
            let bitisIndex = 2;     // Başlık bulunamazsa varsayılan

            izinThElements.forEach((th, index) => {
                const text = th.textContent.toLowerCase();
                const field = (th.getAttribute('data-field') || '').toLowerCase();
                if (text.includes('başla') || field.includes('basla')) baslangicIndex = index;
                if (text.includes('biti') || field.includes('bitis')) bitisIndex = index;
            });

            // SADECE HEDEF SÜTUNLARI TARA
            izinRows.forEach((tr) => {
                const tds = tr.querySelectorAll('td');
                // Tabloda başlık sütünları kadar hücre yoksa atla
                if (tds.length <= Math.max(baslangicIndex, bitisIndex)) return;

                let dates = [];

                // Tespit edilen sütunlardaki metinlerden tarih çıkar
                if (tds[baslangicIndex]) dates.push(...extractDatesFromText(tds[baslangicIndex].textContent));
                if (tds[bitisIndex]) dates.push(...extractDatesFromText(tds[bitisIndex].textContent));

                if (dates.length > 0) {
                    let startObj = dates.reduce((min, p) => p.ts < min.ts ? p : min, dates[0]);
                    let endObj = dates.reduce((max, p) => p.ts > max.ts ? p : max, dates[0]);

                    let start = startObj.ts;
                    let end = endObj.ts;

                    if (!endObj.hasTime) {
                        let d = new Date(end);
                        d.setHours(23, 59, 59, 999);
                        end = d.getTime();
                    }

                    allLeaves.push({ start: start, end: end });
                }
            });

            function isLeaveDay(ts) {
                if (!ts) return false;
                for (let l of allLeaves) {
                    if (ts >= l.start && ts <= l.end) return true;
                }
                return false;
            }

            const today = new Date();
            const currentM = today.getMonth() + 1;
            const currentY = today.getFullYear();

            const tumDersVerileri = await extractAllDersRows(doc, currentY, currentM);
            const todayYMD = toYMD(today);
            const d3 = new Date(today);
            d3.setDate(today.getDate() - 3);
            const threeDaysAgoYMD = toYMD(d3);

            let brutGereken = 0;
            let izinliGereken = 0;
            let gecmisGereken = 0;

            let gecmisVar = 0;
            let gecmisOgrenciYok = 0;
            let gecmisIptal = 0;
            let gecmisEksik = 0;

            let izinliVar = 0, izinliOgrenciYok = 0, izinliIptal = 0, izinliEksik = 0;
            let son3GunEksik = 0;

            tumDersVerileri.forEach(ders => {
                const isOnLeave = ders.rowTimestamp ? isLeaveDay(ders.rowTimestamp) : false;
                const isPast = ders.rowYMD ? (ders.rowYMD < todayYMD) : false;

                const isHedefClass = ders.hasClassVar || ders.hasClassYok || ders.hasClassIptal;

                if (isPast) {
                    if (isHedefClass) {
                        brutGereken++;
                        if (isOnLeave) {
                            izinliGereken++;
                        } else {
                            gecmisGereken++;
                        }
                    }

                    if (isOnLeave) {
                        if (ders.hasClassIptal) izinliIptal++;
                        else if (ders.isOgrenciYok) izinliOgrenciYok++;
                        else if (ders.isIslemYapilmadi) izinliEksik++;
                        else if (ders.hasClassVar) izinliVar++;
                    } else {
                        if (ders.hasClassIptal) {
                            gecmisIptal++;
                        } else if (ders.isOgrenciYok) {
                            gecmisOgrenciYok++;
                        } else if (ders.isIslemYapilmadi) {
                            gecmisEksik++;
                            if (ders.rowYMD >= threeDaysAgoYMD) son3GunEksik++;
                        } else if (ders.hasClassVar) {
                            gecmisVar++;
                        }
                    }
                }
            });

            let anlikYuzde = (gecmisGereken > 0) ? ((gecmisVar + gecmisOgrenciYok) / gecmisGereken) * 100 : 100;
            if (anlikYuzde > 100) anlikYuzde = 100;
            const color = anlikYuzde < 90 ? 'rgb(255, 0, 0)' : 'rgb(0, 120, 200)';

            let islemYazisiHtml = '';
            if (son3GunEksik > 0) {
                let projectedYuzdeSon3 = (gecmisGereken > 0) ? ((gecmisVar + gecmisOgrenciYok + son3GunEksik) / gecmisGereken) * 100 : 100;
                if (projectedYuzdeSon3 > 100) projectedYuzdeSon3 = 100;
                const projectedColor = projectedYuzdeSon3 < 90 ? '#c0392b' : '#1a7abf';

                islemYazisiHtml = `
                    <div style="font-size:10px; color:green; margin-top:4px; line-height:1.5; background:#fff5f5; border:1px solid #f5c6cb; border-radius:3px; padding:4px 6px;">
                        <div style="font-weight:bold;">Alınabilir: ${son3GunEksik}</div>
                        <div style="color:${projectedColor}; margin-top:2px;">
                            Alınırsa: <b>%${Math.round(projectedYuzdeSon3)}</b>
                        </div>
                    </div>
                `;
            }

            const toplamEksikSayı = gecmisEksik + gecmisIptal;
            const displayState = isAllExpanded ? 'block' : 'none';

            if (runId !== globalProcessorRunId) {
                if (iframe) iframe.remove();
                return;
            }

            if (gecmisGereken === 0 && gecmisVar === 0 && gecmisOgrenciYok === 0 && toplamEksikSayı === 0) {
                newTd.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding: 0 5px;">
                        <span style="display:inline-block; padding:3px 8px; background-color:#5cb85c; color:white; border-radius:3px; font-size:11px; font-weight:bold;">Sunucu gecikti</span>
                        <button class="btn-yeniden-dene" data-coach-id="${coachId}" title="Tekrar Dene" style="background:none; border:none; cursor:pointer; font-size:14px; padding:0;">🔄</button>
                    </div>
                `;
            } else {
                newTd.innerHTML = `
                    <div style="display:flex; align-items:center; width:100%;">
                        <div class="bar-container" style="flex-grow:1; text-align:left; padding-right:5px;">
                            <span class="value-text" style="color:${color}; font-weight:bold;">%${Math.round(anlikYuzde)}</span>
                            <div class="progress-bar" style="margin-bottom:0; width:100%; background-color:#e0e0e0; height:10px; border-radius:5px;">
                                <div class="progress" style="width:${anlikYuzde}%; background-color:${color}; height:100%;"></div>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <button class="btn btn-xs btn-default btn-bilgi-ac" style="padding:0 3px; font-size:13px; background:transparent; border:none; cursor:pointer;" title="Hesaplama Detayları">ℹ️</button>
                        </div>
                    </div>
                    ${islemYazisiHtml}
                    <div class="bilgi-paneli" style="display:${displayState}; margin-top:5px; padding:8px; background:#e9f5ff; border:1px solid #b8daff; border-radius:4px; font-size:12px; white-space:normal; min-width:190px; color:#004085; text-align:left; box-shadow: 0 2px 5px rgba(0,0,0,0.1); z-index:100; position:relative;">
                        <div style="margin-bottom:8px; font-weight:bold; border-bottom:1px solid #b8daff; padding-bottom:4px; font-size:12px;">
                            Geçmiş Özeti
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <div style="display:flex; flex-direction:column;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><b>Gereken:</b></span>
                                    <span style="font-weight:bold; color:#0056b3; font-size:13px;">${gecmisGereken}</span>
                                </div>
                                <div style="color:#6c757d; font-size:10px; text-align:right; margin-top:2px;">
                                    ↳ Brüt: ${brutGereken} &nbsp;|&nbsp; İzinli: ${izinliGereken}
                                </div>
                            </div>
                            <hr style="margin:0; border-top:1px dashed #b8daff;">
                            <div style="display:flex; flex-direction:column;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><b>Alınan:</b></span>
                                    <span style="color:green; font-weight:bold; font-size:13px;">${gecmisVar + gecmisOgrenciYok}</span>
                                </div>
                                <div style="color:#6c757d; font-size:10px; text-align:right; margin-top:2px;">
                                    ↳ Öğrenci gelmedi: ${gecmisOgrenciYok}
                                </div>
                            </div>
                            <hr style="margin:0; border-top:1px dashed #b8daff;">
                            <div style="display:flex; flex-direction:column;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><b>Alınmayan:</b></span>
                                    <span style="color:red; font-weight:bold; font-size:13px;">${toplamEksikSayı}</span>
                                </div>
                                <div style="color:#6c757d; font-size:10px; text-align:right; margin-top:2px;">
                                    ↳ Eşleştirme Yapılmamış: ${gecmisIptal}
                                </div>
                            </div>
                        </div>
                        <div style="margin-top:10px; border-top:1px solid #b8daff; padding-top:6px; font-size:10px; color:#6c757d; line-height:1.3;">
                            * Bugün hesaplamaya dahil edilmemiştir.<br>
                            * Öğrencilerin katılmadığı dersler yoklama alınmış sayılır.
                        </div>
                    </div>
                `;
            }

            task.status = 'done';
            setTimeout(() => { iframe.remove(); }, 1000);

        } catch (error) {
            task.status = 'error';
            if (iframe) iframe.remove();

            if (runId === globalProcessorRunId) {
                newTd.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding: 0 5px;">
                        <span style="color:red; font-size:11px; font-weight:bold;">❌ Hata</span>
                        <button class="btn-yeniden-dene" data-coach-id="${coachId}" title="Tekrar Dene" style="background:none; border:none; cursor:pointer; font-size:14px; padding:0;">🔄</button>
                    </div>
                `;
            }
        }
    }

    document.addEventListener('click', function(e) {

        if (e.target.closest('#btn-toggle-all-info')) {
            e.preventDefault();
            isAllExpanded = !isAllExpanded;
            const btn = document.getElementById('btn-toggle-all-info');
            if (btn) btn.innerHTML = isAllExpanded ? '🔼' : '🔽';
            document.querySelectorAll('.bilgi-paneli').forEach(panel => {
                panel.style.display = isAllExpanded ? 'block' : 'none';
            });
        }

        if (e.target.closest('#btn-pause-script')) {
            e.preventDefault();
            isScriptPaused = !isScriptPaused;
            const btn = document.getElementById('btn-pause-script');
            if (btn) btn.innerHTML = isScriptPaused ? '▶️' : '⏸️';
            if (!isScriptPaused && !isProcessorRunning) processQueue();
        }

        if (e.target.closest('.btn-hemen-hesapla')) {
            e.preventDefault();
            const btn = e.target.closest('.btn-hemen-hesapla');
            const cId = btn.getAttribute('data-coach-id');
            const task = tasksQueue.find(t => t.coachId === cId && t.status === 'pending');
            if (task) {
                task.status = 'processing';
                fetchCoachDataAndCalculate(task, globalProcessorRunId);
            }
        }

        if (e.target.closest('.btn-yeniden-dene')) {
            e.preventDefault();
            const btn = e.target.closest('.btn-yeniden-dene');
            const cId = btn.getAttribute('data-coach-id');
            const task = tasksQueue.find(t => t.coachId === cId && (t.status === 'error' || t.status === 'done'));
            if (task) {
                task.status = 'processing';
                fetchCoachDataAndCalculate(task, globalProcessorRunId);
            }
        }

        if (e.target.closest('.btn-bilgi-ac')) {
            e.preventDefault();
            const td = e.target.closest('td');
            const bilgiPanel = td.querySelector('.bilgi-paneli');
            bilgiPanel.style.display = bilgiPanel.style.display === 'none' ? 'block' : 'none';
        }
    });

    const style = document.createElement('style');
    style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

    const observer = new MutationObserver((mutations) => {
        let shouldCalculate = false;
        mutations.forEach((m) => {
            if (m.addedNodes.length) {
                Array.from(m.addedNodes).forEach(node => {
                    if (node.nodeType === 1) {
                        const isOurs = node.classList.contains('guncel-yuzde-td') ||
                                       node.classList.contains('guncel-yuzde-th') ||
                                       node.closest('.guncel-yuzde-td') ||
                                       node.closest('.guncel-yuzde-th');

                        if (!isOurs) {
                            shouldCalculate = true;
                        }
                    }
                });
            }
        });
        if (shouldCalculate) {
            clearTimeout(window.gsbCalcTimer);
            window.gsbCalcTimer = setTimeout(calculateYoklamaUI, 400);
        }
    });

    window.addEventListener('load', () => {
        setTimeout(calculateYoklamaUI, 800);

        if (typeof $ !== 'undefined') {
            $('#cetgridAntrenman').on('reset-view.bs.table search.bs.table sort.bs.table page-change.bs.table load-success.bs.table column-switch.bs.table', function () {
                resetAndRestartSystem();
            });
        }

        const tableContainer = document.querySelector('.bootstrap-table');
        if (tableContainer) observer.observe(tableContainer, { childList: true, subtree: true });
    });

})();
