// ==UserScript==
// @name         SBS Excel İndir
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Spor Bilgi Sistemi - Verileri excel olarak indirme userscript
// @author       Mahmut Elmas with the help of AI
// @match        *://spor.gsb.gov.tr/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @updateURL    https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Kurumsal/main/sbs_excel_indir.user.js
// @downloadURL  https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Kurumsal/main/sbs_excel_indir.user.js
// @run-at       document-end
// @exclude      https://spor.gsb.gov.tr/SayfayaYonlendir.aspx
// @exclude      https://spor.gsb.gov.tr/MainSicilLisans.aspx
// @exclude      https://spor.gsb.gov.tr/Login/?AppId=1&ReturnUrl=%2f
// @exclude      https://spor.gsb.gov.tr/edevletbasvuru/*
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // AYAR DEGİSİKLİGİ UYARI MODALI
    // ============================================================
    function showRefreshModal(settingName, newValue) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: '2147483647',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });
        const modal = document.createElement('div');
        Object.assign(modal.style, {
            backgroundColor: '#fff', padding: '20px 25px', borderRadius: '10px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)', textAlign: 'center',
            fontFamily: 'Segoe UI, sans-serif', minWidth: '320px'
        });
        modal.innerHTML = `
            <h4 style="margin:0 0 10px 0; color:#1d6f42;">Ayar Güncellendi</h4>
            <p style="margin:0 0 20px 0; font-size:14px; color:#333;">
                <b>${settingName}</b>: <span style="color:#e74c3c; font-weight:bold;">${newValue}</span><br><br>
                Degisikliklerin etkili olmasi için sayfayi yenileyin.
            </p>
        `;
        const btnContainer = document.createElement('div');
        Object.assign(btnContainer.style, { display: 'flex', gap: '10px', justifyContent: 'center' });
        const btnRefresh = document.createElement('button');
        btnRefresh.innerText = 'Yenile';
        Object.assign(btnRefresh.style, { padding: '8px 15px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', flex: '1' });
        btnRefresh.onclick = () => location.reload();
        const btnLater = document.createElement('button');
        btnLater.innerText = 'Sonra Yenile';
        Object.assign(btnLater.style, { padding: '8px 15px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', flex: '1' });
        btnLater.onclick = () => overlay.remove();
        btnContainer.appendChild(btnRefresh);
        btnContainer.appendChild(btnLater);
        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // ============================================================
    // FIX 7: confirm() YERİNE ASYNC ONAY MODALI
    // ============================================================
    function showConfirmModal(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.65)', zIndex: '2147483647',
                display: 'flex', justifyContent: 'center', alignItems: 'center'
            });
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                backgroundColor: '#fff', padding: '24px 28px', borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.35)', textAlign: 'center',
                fontFamily: 'Segoe UI, sans-serif', minWidth: '320px', maxWidth: '420px'
            });
            modal.innerHTML = `<p style="font-size:14px; color:#333; margin:0 0 20px 0; line-height:1.6;">${message}</p>`;
            const btnContainer = document.createElement('div');
            Object.assign(btnContainer.style, { display: 'flex', gap: '10px', justifyContent: 'center' });
            const btnOk = document.createElement('button');
            btnOk.innerHTML = '✅ Bitir / İndir';
            Object.assign(btnOk.style, { padding: '9px 16px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: '1', fontSize: '13px' });
            const btnCancel = document.createElement('button');
            btnCancel.innerHTML = '⏳ Beklemeye Devam';
            Object.assign(btnCancel.style, { padding: '9px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: '1', fontSize: '13px' });
            btnOk.onclick = () => { overlay.remove(); resolve(true); };
            btnCancel.onclick = () => { overlay.remove(); resolve(false); };
            btnContainer.appendChild(btnOk);
            btnContainer.appendChild(btnCancel);
            modal.appendChild(btnContainer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        });
    }

    // ============================================================
    // AYARLAR
    // ============================================================
    let downloadFormat = GM_getValue('gsb_format', 'xlsx');
    let waitMode = GM_getValue('gsb_wait_mode', 'auto');

    GM_registerMenuCommand("⚙️ İndirme Formati (Su an: " + downloadFormat.toUpperCase() + ")", () => {
        downloadFormat = downloadFormat === 'xlsx' ? 'csv' : 'xlsx';
        GM_setValue('gsb_format', downloadFormat);
        showRefreshModal("İndirme Formati", downloadFormat.toUpperCase());
    });

    GM_registerMenuCommand("⏳ Sayfa Gecisi (Su an: " + (waitMode === 'auto' ? 'OTOMATİK' : 'MANUEL') + ")", () => {
        waitMode = waitMode === 'auto' ? 'manual' : 'auto';
        GM_setValue('gsb_wait_mode', waitMode);
        showRefreshModal("Sayfa Gecis Modu", waitMode === 'auto' ? 'OTOMATİK' : 'MANUEL ONAYLI');
    });

    let isRunning = false;
    let stopRequested = false;
    let globalFilters = [];

    // ============================================================
    // TOAST BİLDİRİM
    // ============================================================
    function showToast(message, type = "info", duration = 4000) {
        let container = document.getElementById('gsb-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'gsb-toast-container';
            Object.assign(container.style, {
                position: 'fixed', top: '25px', right: '25px', zIndex: '2147483647',
                display: 'flex', flexDirection: 'column', gap: '10px',
                pointerEvents: 'none', alignItems: 'flex-end'
            });
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        let bgColor = '#3498db';
        if (type === 'success') bgColor = '#2ecc71';
        else if (type === 'warning') bgColor = '#f39c12';
        else if (type === 'error') bgColor = '#e74c3c';
        Object.assign(toast.style, {
            backgroundColor: bgColor, color: 'white', padding: '15px 25px',
            borderRadius: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
            fontFamily: 'Segoe UI, sans-serif', fontSize: '14px', fontWeight: 'bold',
            opacity: '0', transition: 'all 0.4s ease',
            transform: 'translateX(50px)', pointerEvents: 'auto',
            maxWidth: '350px', wordWrap: 'break-word'
        });
        toast.innerHTML = message;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 10);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }

    // ============================================================
    // GÜNCEL YÜZDE TD - PARSE FONKSİYONLARI
    // ============================================================
 /**
 * 1. Başlık Listesi (Sütun sırasına göre)
 */
function getGuncelYuzdeKeys() {
    return [
        'Güncel Yüzde',      // result[0]
        'Alınabilir',        // result[1]
        'Alınırsa Yüzde',    // result[2]
        'Gereken',           // result[3]
        'Alınan',            // result[4]
        'Alınmayan',         // result[5]
        'Eşleştirme Yapılmamış' // result[6]
    ];
}

/**
 * 2. TD İçeriğini Ayrıştırma
 */
function parseGuncelYuzdeTd(td) {
    // 7 farklı veri alanı için boş dizi (getGuncelYuzdeKeys uzunluğu kadar)
    const result = ["", "", "", "", "", "", ""];

    // A. Güncel Yüzde (%69 gibi)
    const valueText = td.querySelector('.value-text');
    result[0] = valueText ? valueText.innerText.trim() : '';

    // B. Alınabilir ve Alınırsa (Panel dışında, yeşil/kırmızı kutuda)
    // Regex ile "Alınabilir: 11" ve "Alınırsa: %85" değerlerini çekiyoruz
    const alinabilirMatch = td.innerText.match(/Alınabilir\s*:\s*(\d+)/i);
    if (alinabilirMatch) result[1] = alinabilirMatch[1];

    const alinirsaMatch = td.innerText.match(/Alınırsa\s*:\s*(%?\d+)/i);
    if (alinirsaMatch) result[2] = alinirsaMatch[1];

    // C. Bilgi Paneli İçindeki Detaylar (Gereken, Alınan, Alınmayan)
    const panel = td.querySelector('.bilgi-paneli');
    if (panel) {
        const panelText = panel.innerText;

        // Gereken
        const gerekenM = panelText.match(/Gereken\s*:\s*(\d+)/i);
        if (gerekenM) result[3] = gerekenM[1];

        // Alınan
        const alinanM = panelText.match(/Alınan\s*:\s*(\d+)/i);
        if (alinanM) result[4] = alinanM[1];

        // Alınmayan
        const alinmayanM = panelText.match(/Alınmayan\s*:\s*(\d+)/i);
        if (alinmayanM) result[5] = alinmayanM[1];

        // Eşleştirme Yapılmamış
        const eslesmeM = panelText.match(/Eşleştirme Yapılmamış\s*:\s*(\d+)/i);
        if (eslesmeM) result[6] = eslesmeM[1];
    }

    return result;
}

/**
 * 3. Tablodaki Sütun İndeksini Bulma
 */
function findGuncelYuzdeColIndex(tableElement) {
    if (!tableElement) return -1;
    const firstRow = tableElement.querySelector('tbody tr');
    if (!firstRow) return -1;
    return Array.from(firstRow.querySelectorAll('td'))
                .findIndex(td => td.classList.contains('guncel-yuzde-td'));
}

/**
 * 4. Başlıkları Genişletme
 */
function getExpandedHeaders(tableElement) {
    const ths = Array.from(tableElement?.querySelectorAll("thead th") || []);
    const guncelIdx = findGuncelYuzdeColIndex(tableElement);
    let headers = [];

    ths.forEach((th, i) => {
        if (i === guncelIdx) {
            // "Güncel Yüzde" sütunu yerine parçalanmış alt başlıkları ekle
            headers.push(...getGuncelYuzdeKeys());
        } else {
            headers.push(th.innerText.trim() || ("Sütun " + (i + 1)));
        }
    });
    return headers;
}

    // ============================================================
    // TABLO YARDIMCILARI
    // ============================================================
    function getActiveTable() {
        const priorityIds = ['gridOgrencilerimListesi', 'CetGridKursListesi', 'gridSporcular'];
        for (let id of priorityIds) {
            const el = document.getElementById(id);
            if (el && el.offsetWidth > 0) {
                const tab = el.closest('.tab-pane');
                if (!tab || tab.classList.contains('active')) return el;
            }
        }
        const activeTabPane = document.querySelector('.tab-pane.active.in') || document.querySelector('.tab-pane.active');
        if (activeTabPane) {
            const tableInTab = activeTabPane.querySelector('.fixed-table-body table') || activeTabPane.querySelector('table');
            if (tableInTab && tableInTab.offsetWidth > 0) return tableInTab;
        }
        const allTables = Array.from(document.querySelectorAll('.fixed-table-body table, .bootstrap-table table'));
        const visibleTable = allTables.find(t => t.offsetWidth > 0 && t.offsetHeight > 0 && (!t.closest('.tab-pane') || t.closest('.tab-pane').classList.contains('active')));
        return visibleTable || document.querySelector('table[id*="grid" i], table[id*="Grid" i], table[id*="Listesi" i]');
    }

    function getPageRawSignature(tableElement) {
        if (!tableElement) return "";
        const tbodyRows = Array.from(tableElement.querySelectorAll("tbody tr"));
        let sig = "";
        tbodyRows.forEach(row => {
            if (row.classList.contains('no-records-found') || row.innerText.includes("Yükleniyor")) return;
            sig += row.innerText.trim() + "\n";
        });
        return sig;
    }

    function getTableRows(includeHeader, tableElement, selectedIndices = null, appliedFilters = [], antrenorAdi = "") {
        if (!tableElement) return [];
        let rows = [];
        const guncelColIdx = findGuncelYuzdeColIndex(tableElement);

        if (includeHeader) {
            const headRows = Array.from(tableElement.querySelectorAll("thead tr"));
            headRows.forEach(row => {
                let allCols = [];
                Array.from(row.querySelectorAll("th")).forEach((th, i) => {
                    if (i === guncelColIdx) {
                        allCols.push(...getGuncelYuzdeKeys());
                    } else {
                        allCols.push(th.innerText.trim());
                    }
                });
                let filteredCols = selectedIndices ? allCols.filter((_, idx) => selectedIndices.includes(idx)) : allCols;
                if (filteredCols.length > 0) {
                    // FIX 11: Sadece antrenorAdi varsa baslik ekle
                    if (antrenorAdi) filteredCols.push("Antrenör Ad Soyad");
                    rows.push(filteredCols);
                }
            });
        }

        const tbodyRows = Array.from(tableElement.querySelectorAll("tbody tr"));
        tbodyRows.forEach(row => {
            if (row.classList.contains('no-records-found') || row.innerText.includes("kayittan") || row.innerText.includes("Yükleniyor")) return;

            let allCells = [];
            Array.from(row.querySelectorAll("td")).forEach((td, i) => {
                if (i === guncelColIdx) {
                    allCells.push(...parseGuncelYuzdeTd(td));
                } else {
                    allCells.push(td.innerText.trim());
                }
            });

            let passesFilters = true;
            for (let f of appliedFilters) {
                let cellText = (allCells[f.colIdx] || "");
                let searchVal1 = (f.val1 || "").trim();
                let searchVal2 = (f.val2 || "").trim();
                let cleanCellText = cellText.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
                let cleanSearchVal = searchVal1.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
                let cellTextLower = cleanCellText.toLocaleLowerCase('tr-TR');
                let searchVal1Lower = cleanSearchVal.toLocaleLowerCase('tr-TR');

                if (f.type === 'contains') {
                    if (!cellTextLower.includes(searchVal1Lower)) passesFilters = false;
                } else if (f.type === 'not_contains') {
                    if (cellTextLower.includes(searchVal1Lower)) passesFilters = false;
                } else if (['between', 'greater', 'less'].includes(f.type)) {
                    let parseDate = (str) => {
                        if (!str) return null;
                        let m = str.match(/(\d{2})[-./](\d{2})[-./](\d{4})/);
                        return m ? parseInt(m[3] + m[2] + m[1]) : null;
                    };
                    let parseTime = (str) => {
                        if (!str) return null;
                        let m = str.match(/(\d{2})[:.](\d{2})/);
                        return m ? parseInt(m[1] + m[2]) : null;
                    };
                    let v1Date = parseDate(searchVal1), v1Time = parseTime(searchVal1);

                    if (v1Date !== null) {
                        let cDate = parseDate(cellText), v2Date = parseDate(searchVal2);
                        if (cDate === null) passesFilters = false;
                        else if (f.type === 'between' && (cDate < v1Date || cDate > v2Date)) passesFilters = false;
                        else if (f.type === 'greater' && cDate < v1Date) passesFilters = false;
                        else if (f.type === 'less' && cDate > v1Date) passesFilters = false;
                    } else if (v1Time !== null) {
                        let cTime = parseTime(cellText), v2Time = parseTime(searchVal2);
                        if (cTime === null) passesFilters = false;
                        else if (f.type === 'between' && (cTime < v1Time || cTime > v2Time)) passesFilters = false;
                        else if (f.type === 'greater' && cTime < v1Time) passesFilters = false;
                        else if (f.type === 'less' && cTime > v1Time) passesFilters = false;
                    } else {
                        let cleanedStr = cellText.replace(/[^0-9,\.-]/g, '').replace(/\./g, '').replace(',', '.');
                        let cellNum = parseFloat(cleanedStr);
                        let num1 = parseFloat(searchVal1.replace(/\./g, '').replace(',', '.'));
                        let num2 = parseFloat(searchVal2.replace(/\./g, '').replace(',', '.'));
                        if (isNaN(cellNum)) { passesFilters = false; }
                        else {
                            if (f.type === 'between' && (isNaN(num1) || isNaN(num2) || cellNum < num1 || cellNum > num2)) passesFilters = false;
                            else if (f.type === 'greater' && (isNaN(num1) || cellNum < num1)) passesFilters = false;
                            else if (f.type === 'less' && (isNaN(num1) || cellNum > num1)) passesFilters = false;
                        }
                    }
                }
            }

            if (!passesFilters) return;

            let filteredCells = selectedIndices ? allCells.filter((_, idx) => selectedIndices.includes(idx)) : allCells;
            if (filteredCells.length > 0) {
                if (antrenorAdi) filteredCells.push(antrenorAdi);
                rows.push(filteredCells);
            }
        });
        return rows;
    }

    // ============================================================
    // EXCEL / CSV OLUSTURUCU
    // ============================================================
    async function generateExcel(data, fileName, useExcelJS) {
        if (!useExcelJS || typeof ExcelJS === 'undefined') {
            let csvContent = "\uFEFF";
            data.forEach(row => {
                let rowString = row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";");
                csvContent += rowString + "\r\n";
            });
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.setAttribute("href", URL.createObjectURL(blob));
            link.setAttribute("download", fileName + ".csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Veri Listesi');
            worksheet.addRows(data);

            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF31708F' } };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: data[0].length } };

            worksheet.columns.forEach(column => {
                let maxL = 0;
                column.eachCell({ includeEmpty: true }, (c, rowNumber) => {
                    if (rowNumber > 1) c.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
                    if (c.value) {
                        c.value.toString().split('\n').forEach(line => { if (line.length > maxL) maxL = line.length; });
                    }
                });
                column.width = Math.min(Math.max(maxL + 4, 12), 60);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), fileName + ".xlsx");
            showToast("✅ Gelismis Excel (.xlsx) basariyla olusturuldu!", "success");
        } catch (e) {
            console.error("Excel Hatasi:", e);
            showToast("❌ Excel olusturulurken hata olustu. Konsolu kontrol edin.", "error");
            throw e; // FIX 8: hatayı üst catch'e ilet
        }
    }

    // ============================================================
    // FIX 6: GÜVENLİ bootstrapTable ÇAĞIRICI
    // ============================================================
    function callBootstrapTable(tableId, method, arg) {
        // ID'yi güvenli hale getir (XSS önlemi)
        const safeId = tableId.replace(/['"\\`<>]/g, '');

        // unsafeWindow üzerinden dogrudan çagir (tercih edilen yöntem)
        if (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) {
            try {
                if (arg !== undefined) {
                    unsafeWindow.$('#' + safeId).bootstrapTable(method, arg);
                } else {
                    unsafeWindow.$('#' + safeId).bootstrapTable(method);
                }
                return;
            } catch (e) { /* fallback'e geç */ }
        }

        // Fallback: script injection (ID temizlenmis)
        const argStr = arg !== undefined ? `, ${JSON.stringify(arg)}` : '';
        const script = document.createElement('script');
        script.textContent = `try { $('#${safeId}').bootstrapTable('${method}'${argStr}); } catch(e) { console.warn('bootstrapTable:', e); }`;
        document.body.appendChild(script);
        script.remove();
    }

    // ============================================================
    // FIX 9: İLERLEME GÖSTERGESİ
    // ============================================================
    (function injectProgressCSS() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes gsb-slide {
                from { background-position: 0 0; }
                to { background-position: 80px 0; }
            }
        `;
        document.head.appendChild(style);
    })();

    function updateFloatingBtnText(text) {
        const span = document.getElementById('gsb-floating-btn-text');
        if (span) span.innerHTML = text;
    }

    function updateProgress(current, total, rowCount) {
        updateFloatingBtnText(`⏳ Sayfa:${current}${(total && total !== Infinity) ? '/' + total : ''} 🛑 Durdur`);
        const progressBar = document.getElementById('gsb-progress-bar-inner');
        if (!progressBar) return;
        if (total && total !== Infinity) {
            progressBar.style.animation = 'none';
            progressBar.style.backgroundImage = 'none';
            progressBar.style.backgroundColor = '#2ecc71';
            progressBar.style.width = Math.round((current / total) * 100) + '%';
        } else {
            progressBar.style.width = '100%';
            progressBar.style.backgroundImage = 'repeating-linear-gradient(90deg, #2ecc71 0px, #27ae60 20px, #2ecc71 40px)';
            progressBar.style.backgroundSize = '80px 100%';
            progressBar.style.animation = 'gsb-slide 1s linear infinite';
        }
    }

    // ============================================================
    // ANA İNDİRME FONKSİYONU
    // ============================================================
    async function startDownload(startPage, endPage, useExcelJS, isCurrentOnly = false) {
        if (isRunning) return;

        let activeTable = getActiveTable();
        if (!activeTable) { showToast("⚠️ Ekranda indirilecek tablo bulunamadi!", "error"); return; }

        // FIX 3: Genisletilmis başlik indekslerini kullan
        let selectedIndices = null;
        const colCheckboxes = document.querySelectorAll('.gsb-col-checkbox');
        if (document.getElementById('gsb-use-columns')?.checked) {
            selectedIndices = Array.from(colCheckboxes)
                .map((cb, idx) => cb.checked ? idx : null)
                .filter(idx => idx !== null);
            if (selectedIndices.length === 0) { showToast("Lütfen en az bir sütun seçin.", "warning"); return; }
        }

        let currentActiveFilters = [...globalFilters];
        const overlay = document.getElementById('gsb-modal-overlay');
        if (overlay) overlay.remove();

        try {
            isRunning = true;
            stopRequested = false;
            const floatingBtn = document.getElementById('gsb-floating-btn');
            if (floatingBtn) floatingBtn.style.backgroundColor = '#f39c12';

            showToast("⏳ Tarama basliyor... Lütfen bekleyin.", "info", 4000);

            let currentAntrenorAdi = "";
            const lblAntrenor = document.getElementById('lblAntrenorAdSoyad');
            if (lblAntrenor && lblAntrenor.innerText.trim() !== "") {
                currentAntrenorAdi = lblAntrenor.innerText.trim();
            }

            const activeTabPane = document.querySelector('.tab-pane.active.in') || document.querySelector('.tab-pane.active') || document;
            const tableContainer = activeTable.closest('.bootstrap-table') || activeTabPane;

            // FIX 1 + 4 + 7: Düzeltilmis bekleme fonksiyonu
            async function waitForDataChange(oldRawSignature, maxWait = 25) {
                let i = 0;
                let absoluteTimeout = 0;

                while (i < maxWait && absoluteTimeout < 50) {
                    if (stopRequested) return null;

                    await new Promise(r => setTimeout(r, 400));
                    absoluteTimeout++;

                    // FIX 4: null kontrolü eklendi
                    let tbl = getActiveTable();
                    if (!tbl) { i++; continue; }

                    let newSig = getPageRawSignature(tbl);

                    if (waitMode === 'auto') {
                        let isLoading = false;
                        const loaders = tableContainer.querySelectorAll('.fixed-table-loading, .blockOverlay, .loading-message');
                        loaders.forEach(l => { if (l.offsetWidth > 0 && l.offsetHeight > 0) isLoading = true; });
                        if (isLoading) continue;
                    }

                    if (newSig !== oldRawSignature && newSig !== "") {
                        await new Promise(r => setTimeout(r, 400));
                        return newSig;
                    }

                    i++;

                    if (i >= maxWait && waitMode === 'manual' && !stopRequested) {
                        // FIX 7: confirm() yerine async modal
                        const userWantsToFinish = await showConfirmModal(
                            "⏳ <b>ZAMAN ASIMI!</b> Veri degismedi.<br><br>" +
                            "İnternet yavas olabilir veya sayfa hâlâ yükleniyor.<br><br>" +
                            "<b>Bitir / İndir:</b> Simdilik çekilen veriyi kaydet.<br>" +
                            "<b>Beklemeye Devam:</b> Daha fazla bekle."
                        );
                        if (!userWantsToFinish) {
                            // FIX 1: Her iki sayaci da sıfırla
                            i = 0;
                            absoluteTimeout = 0;
                        } else {
                            stopRequested = true;
                        }
                    }
                }
                return null;
            }

            // Tüm sayfalarda 100 kayit/sayfa moduna geç
            if (endPage === Infinity && activeTable && !stopRequested) {
                updateFloatingBtnText(`⏳ 100 Kayıt...`);
                const maxLink = Array.from(tableContainer.querySelectorAll('.page-list .dropdown-menu li a')).find(a => a.innerText.trim() === '100');
                if (maxLink && !maxLink.parentElement.classList.contains('active')) {
                    let pre100Sig = getPageRawSignature(activeTable);
                    maxLink.click();
                    await waitForDataChange(pre100Sig, 25);
                    activeTable = getActiveTable();
                }
            }

            // ✔ 100 kayıt modundan sonra gerçek sayfa sayısını oku
let totalPages = null;

if (endPage === Infinity) {

    const pagination = tableContainer.querySelector('.pagination') || document.querySelector('.pagination');

    if (pagination) {

        let last = pagination.querySelector('.page-last a');

        if (last) {

            const n = parseInt(last.innerText.trim());
            if (!isNaN(n)) totalPages = n;

        }

        if (!totalPages) {

            const nums = Array.from(
                pagination.querySelectorAll('li.page-number a')
            )
            .map(a => parseInt(a.innerText.trim()))
            .filter(n => !isNaN(n));

            if (nums.length) {
                totalPages = Math.max(...nums);
            }

        }

    }

}
            let allData = [];
            let pagesScraped = 0;

            let initialSig = getPageRawSignature(activeTable);
            let emptyCheckCounter = 0;
            while (initialSig === "" && emptyCheckCounter < 10 && !stopRequested) {
                await new Promise(r => setTimeout(r, 500));
                activeTable = getActiveTable();
                initialSig = getPageRawSignature(activeTable);
                emptyCheckCounter++;
            }
            let currentRawSignature = initialSig;

            let activeBtn = tableContainer.querySelector('.pagination li.active a, .pagination li.page-item.active a, .page-number.active a');
            let currentUIPage = activeBtn ? parseInt(activeBtn.innerText.trim()) : 1;
            if (isNaN(currentUIPage)) currentUIPage = 1;

            if (!isCurrentOnly && startPage > 1 && startPage !== currentUIPage && !stopRequested) {
                updateFloatingBtnText(`⏳ ${startPage}. Sayfaya Atlaniyor...`);
                let tbl = getActiveTable();
                if (tbl && tbl.id) {
                    callBootstrapTable(tbl.id, 'selectPage', startPage); // FIX 6
                } else {
                    let targetBtn = Array.from(tableContainer.querySelectorAll('.pagination li a')).find(a => parseInt(a.innerText.trim()) === startPage);
                    if (targetBtn) targetBtn.click();
                }
                let newSig = await waitForDataChange(currentRawSignature, 25);
if (newSig) currentRawSignature = newSig;
            }

            let currentPageNum = isCurrentOnly ? 1 : startPage;
            let targetEndPage = isCurrentOnly ? 1 : (endPage === Infinity && totalPages ? totalPages : endPage);


            while (currentPageNum <= targetEndPage) {
                if (stopRequested) break;

                // FIX 9: İlerleme güncelle
                if (!isCurrentOnly) updateProgress(currentPageNum, totalPages, allData.length);

                let rowsToSave = getTableRows(pagesScraped === 0, getActiveTable(), selectedIndices, currentActiveFilters, currentAntrenorAdi);
                allData = allData.concat(rowsToSave);
                pagesScraped++;

                // FIX 12: Büyük veri uyarisi
                if (allData.length > 0 && allData.length % 5000 === 0) {
                    showToast(`⚠️ ${allData.length} satir bellekte tutuluyor. Tarayici yavaslyabilir.`, "warning", 5000);
                }

                if (currentPageNum >= targetEndPage || stopRequested) break;

                let nextBtn = tableContainer.querySelector('.pagination li.page-next a, .pagination li.next a');
                let nextLi = nextBtn ? nextBtn.closest('li') : null;
                if (!nextBtn || (nextLi && nextLi.classList.contains('disabled'))) break;

                let tbl = getActiveTable();
                if (tbl && tbl.id) {
                    callBootstrapTable(tbl.id, 'nextPage'); // FIX 6
                } else {
                    nextBtn.click();
                }

                let newSig = await waitForDataChange(currentRawSignature, 25);
                if (stopRequested) break;
                currentRawSignature = newSig;
                currentPageNum++;
            }

            if (allData.length > 0) {
                let tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
                let parts = [];

                let breadcrumbItems = document.querySelectorAll('.breadcrumb li');
                if (breadcrumbItems.length > 0) {
                    let lastBreadcrumb = breadcrumbItems[breadcrumbItems.length - 1].innerText.trim();
                    if (lastBreadcrumb) parts.push(lastBreadcrumb);
                }

                if (currentAntrenorAdi) parts.push(currentAntrenorAdi);

                const getInputVal = (id) => { const el = document.getElementById(id); return el && el.value ? el.value.trim() : ''; };
                const getSelectText = (id) => {
                    const el = document.getElementById(id);
                    if (el && el.selectedIndex >= 0) {
                        let text = el.options[el.selectedIndex].text.trim();
                        if (text && text !== 'Seçiniz' && text !== 'Tümü' && text !== '') return text;
                    }
                    return '';
                };

                parts.push(getInputVal('txtSporcuTcKimlikNo'));
                parts.push(getInputVal('txtSporcuAdi'));
                parts.push(getInputVal('txtSporcuSoyadi'));
                parts.push(getSelectText('ctl00_MainContent_UcSelectGorev_ddl1'));
                parts.push(getSelectText('ctl00_MainContent_UcSelectIl_ddl1'));
                parts.push(getSelectText('ctl00_MainContent_UcSelectIlce_ddl1'));
                parts.push(getSelectText('ctl00_MainContent_UcSelectProje_ddl1'));
                parts.push(getSelectText('ctl00_MainContent_UcSelectFederasyon_ddl1'));
                parts.push(tarih);
                parts = parts.filter(Boolean);

                let fileName = parts.join('_').replace(/[^a-zA-Z0-9_ğüşöçıİĞÜŞÖÇI -]/g, '').replace(/\s+/g, '_');
                if (!fileName || fileName === tarih) fileName = 'GSB_Veri_' + tarih;

                if (stopRequested) showToast("✅ İslem durduruldu. Çekilen veriler kaydediliyor...", "success");

                await generateExcel(allData, fileName, downloadFormat === 'xlsx');
            } else {
                showToast("Filtrelere uyan hiçbir veri bulunamadi.", "warning");
            }

        } catch (e) {
            // FIX 8: Beklenmeyen hatalar için kullaniciyi bilgilendir
            console.error("SBS Excel - Beklenmeyen Hata:", e);
            showToast("❌ Beklenmeyen bir hata olustu. Konsolu kontrol edin. (F12)", "error", 7000);
        } finally {
            isRunning = false;
            stopRequested = false;
            const fb = document.getElementById('gsb-floating-btn');
            if (fb) {
                fb.style.backgroundColor = '#1d6f42';
                updateFloatingBtnText('⚙️ Excel');
                const pb = document.getElementById('gsb-progress-bar-inner');
                if (pb) {
                    pb.style.width = '0%';
                    pb.style.animation = 'none';
                    pb.style.backgroundImage = 'none';
                    pb.style.backgroundColor = '#2ecc71';
                }
            }
        }
    }

    // ============================================================
    // MODAL MENÜ
    // ============================================================
    function showModal() {
        if (document.getElementById('gsb-modal-overlay')) return;

        // FIX 5: localStorage yerine GM_getValue kullan
        let savedPresets = {};
        try {
            savedPresets = JSON.parse(GM_getValue('gsb_filter_presets', '{}')) || {};
        } catch (e) { console.warn("Filtre sablonlari okunamadi."); }

        const table = getActiveTable();
        // FIX 3 + 10: Genisletilmis baslikları kullan
        const headers = getExpandedHeaders(table);

        const overlay = document.createElement('div');
        overlay.id = 'gsb-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: '2147483647',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            backgroundColor: '#fff', padding: '20px', borderRadius: '12px',
            width: '420px', maxHeight: '90vh', overflowY: 'auto',
            position: 'relative', fontFamily: 'Segoe UI, sans-serif'
        });

        let columnListHtml = headers.map((h, i) => `
            <div style="display:flex; align-items:center; margin-bottom:5px; font-size:13px;">
                <input type="checkbox" class="gsb-col-checkbox" id="col-${i}" checked style="margin-right:8px;">
                <label for="col-${i}">${h}</label>
            </div>
        `).join('');

        let filterOptionsHtml = headers.map((h, i) => `<option value="${i}">${h}</option>`).join('');

        modal.innerHTML = `
            <h3 style="margin:0 0 15px 0; color:#1d6f42; text-align:center;">📊 Excel</h3>

            <div style="background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:10px; border:1px solid #eee;">
                <label style="display:flex; align-items:center; cursor:pointer; font-weight:bold; color:#333; font-size:13px;">
                    <input type="checkbox" id="gsb-use-columns" style="margin-right:10px;"> Sütunlari Gizle / Seç
                </label>
                <div id="gsb-column-selector" style="display:none; margin-top:10px; border-top:1px solid #ddd; padding-top:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <small style="color:#1d6f42; cursor:pointer; font-weight:bold;" id="gsb-select-all">Tümünü Seç</small>
                        <small style="color:#d9534f; cursor:pointer; font-weight:bold;" id="gsb-select-none">Temizle</small>
                    </div>
                    <div style="max-height:100px; overflow-y:auto; text-align:left; border:1px solid #ddd; padding:5px;">${columnListHtml}</div>
                </div>
            </div>

            <div style="background:#eef7f2; padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid #cce3d6;">
                <label style="display:flex; align-items:center; cursor:pointer; font-weight:bold; color:#1d6f42; font-size:13px;">
                    <input type="checkbox" id="gsb-use-filters" style="margin-right:10px;"> Gelismis Filtre Ekle
                </label>
                <div id="gsb-filter-panel" style="display:none; margin-top:10px; border-top:1px solid #cce3d6; padding-top:10px;">
                    <select id="gsb-filter-col" style="width:100%; padding:6px; margin-bottom:5px; border-radius:4px; border:1px solid #ccc; font-size:12px;">${filterOptionsHtml}</select>
                    <select id="gsb-filter-type" style="width:100%; padding:6px; margin-bottom:5px; border-radius:4px; border:1px solid #ccc; font-size:12px; background:#fff; color:#333;">
                        <option value="" disabled>-- Kural Tipi Seçin --</option>
                        <option value="contains" selected>Sunu İçeriyorsa (Metin)</option>
                        <option value="not_contains">Sunu İçermiyorsa (Metin)</option>
                        <option value="between">Su Aralikta İse (Tarih, Saat, Sayi)</option>
                        <option value="greater">Büyük veya Sonra İse (>=)</option>
                        <option value="less">Küçük veya Önce İse (<=)</option>
                    </select>
                    <input type="text" id="gsb-filter-val1" placeholder="Deger 1" style="width:100%; padding:6px; margin-bottom:5px; border-radius:4px; border:1px solid #ccc; font-size:12px; box-sizing:border-box;">
                    <input type="text" id="gsb-filter-val2" placeholder="Deger 2 (Sadece Aralik için)" style="width:100%; padding:6px; margin-bottom:5px; border-radius:4px; border:1px solid #ccc; font-size:12px; display:none; box-sizing:border-box;">
                    <button id="gsb-add-filter-btn" style="width:100%; padding:6px; background:#1d6f42; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">➕ Kurali Ekle</button>
                    <ul id="gsb-active-filters-list" style="list-style:none; padding-left:0; margin-top:10px; margin-bottom:0; font-size:11px; color:#555;"></ul>

                    <div style="margin-top:10px; border-top:1px dashed #9bc2aa; padding-top:10px;">
                        <div style="font-size:12px; font-weight:bold; color:#1d6f42; margin-bottom:5px;">💾 Kayitli Sablonlar</div>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <input type="text" id="gsb-preset-name" placeholder="Filtre grubuna isim ver" style="flex:1; padding:6px; font-size:11px; border:1px solid #ccc; border-radius:4px;">
                            <button id="gsb-save-preset-btn" style="padding:6px 12px; background:#3498db; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">Kaydet</button>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <select id="gsb-preset-select" style="flex:1; padding:6px; font-size:11px; border:1px solid #ccc; border-radius:4px;"></select>
                            <button id="gsb-load-preset-btn" style="padding:6px 10px; background:#f39c12; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">Yükle</button>
                            <button id="gsb-del-preset-btn" style="padding:6px 10px; background:#e74c3c; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold;">Sil</button>
                        </div>
                    </div>
                </div>
            </div>

            <button id="gsb-btn-all" style="width:100%; padding:10px; margin-bottom:15px; background:#2ecc71; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📑 Tüm Sayfalari İndir</button>

            <div style="border-top:1px solid #eee; padding-top:10px; margin-bottom:5px;">
                <div style="font-size:13px; font-weight:bold; color:#555; margin-bottom:8px; text-align:left;">Belirli Sayfa Araligi:</div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="number" id="gsb-input-start" min="1" value="1" placeholder="Bastan" style="width:35%; padding:8px; border:1px solid #ccc; border-radius:6px; text-align:center;">
                    <span style="color:#777; font-weight:bold;">-</span>
                    <input type="number" id="gsb-input-end" min="1" value="1" placeholder="Sona" style="width:35%; padding:8px; border:1px solid #ccc; border-radius:6px; text-align:center;">
                    <button id="gsb-btn-custom" style="flex:1; padding:8px 0; background:#f39c12; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">İndir</button>
                </div>
            </div>

            <div id="gsb-close" style="position:absolute; top:10px; right:15px; cursor:pointer; font-size:24px; color:#aaa;">&times;</div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('gsb-close').onclick = () => overlay.remove();

        const columnPanel = document.getElementById('gsb-column-selector');
        document.getElementById('gsb-use-columns').onchange = (e) => { columnPanel.style.display = e.target.checked ? 'block' : 'none'; };
        document.getElementById('gsb-select-all').onclick = () => document.querySelectorAll('.gsb-col-checkbox').forEach(cb => cb.checked = true);
        document.getElementById('gsb-select-none').onclick = () => document.querySelectorAll('.gsb-col-checkbox').forEach(cb => cb.checked = false);

        const filterPanel = document.getElementById('gsb-filter-panel');
        document.getElementById('gsb-use-filters').onchange = (e) => { filterPanel.style.display = e.target.checked ? 'block' : 'none'; };

        const filterTypeSelect = document.getElementById('gsb-filter-type');
        const filterVal2Input = document.getElementById('gsb-filter-val2');
        filterTypeSelect.onchange = (e) => { filterVal2Input.style.display = e.target.value === 'between' ? 'block' : 'none'; };

        function renderFilters() {
            const list = document.getElementById('gsb-active-filters-list');
            list.innerHTML = '';
            globalFilters.forEach((f, idx) => {
                let colName = headers[f.colIdx] || ("Sütun " + (f.colIdx + 1));
                let text = "";
                if (f.type === 'contains') text = `<b>${colName}</b>: '${f.val1}' içeriyorsa`;
                else if (f.type === 'not_contains') text = `<b>${colName}</b>: '${f.val1}' içermiyorsa`;
                else if (f.type === 'greater') text = `<b>${colName}</b>: ${f.val1} ve büyük/sonra ise`;
                else if (f.type === 'less') text = `<b>${colName}</b>: ${f.val1} ve küçük/önce ise`;
                else text = `<b>${colName}</b>: ${f.val1} ile ${f.val2} arasindaysa`;

                let li = document.createElement('li');
                li.style.cssText = "display:flex; justify-content:space-between; background:#fff; padding:4px 8px; margin-bottom:4px; border-radius:4px; border:1px solid #ddd;";
                li.innerHTML = `<span>${text}</span> <span style="color:red; cursor:pointer; font-weight:bold;" data-idx="${idx}">X</span>`;
                list.appendChild(li);
            });
            list.querySelectorAll('span[data-idx]').forEach(btn => {
                btn.onclick = function () {
                    globalFilters.splice(parseInt(this.getAttribute('data-idx')), 1);
                    renderFilters();
                };
            });
        }

        renderFilters();

        document.getElementById('gsb-add-filter-btn').onclick = () => {
            let colIdx = parseInt(document.getElementById('gsb-filter-col').value);
            let type = document.getElementById('gsb-filter-type').value;
            let val1 = document.getElementById('gsb-filter-val1').value.trim();
            let val2 = document.getElementById('gsb-filter-val2').value.trim();
            if (!type) { showToast("Lütfen bir kural tipi seçin.", "warning"); return; }
            if (!val1) { showToast("Lütfen bir deger girin.", "warning"); return; }
            if (type === 'between' && (!val1 || !val2)) { showToast("Aralik filtresi için iki deger girmelisiniz.", "warning"); return; }
            globalFilters.push({ colIdx, type, val1, val2 });
            document.getElementById('gsb-filter-val1').value = '';
            document.getElementById('gsb-filter-val2').value = '';
            renderFilters();
        };

        function updatePresetSelect() {
            const select = document.getElementById('gsb-preset-select');
            select.innerHTML = '<option value="">-- Kayitli Sablon Seç --</option>';
            for (let name in savedPresets) {
                let opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                select.appendChild(opt);
            }
        }
        updatePresetSelect();

        document.getElementById('gsb-save-preset-btn').onclick = () => {
            const name = document.getElementById('gsb-preset-name').value.trim();
            if (!name) { showToast("Lütfen sablon için bir isim yazin.", "warning"); return; }
            if (globalFilters.length === 0) { showToast("Kaydedilecek aktif filtre yok. Önce kural ekleyin.", "warning"); return; }
            savedPresets[name] = JSON.parse(JSON.stringify(globalFilters));
            GM_setValue('gsb_filter_presets', JSON.stringify(savedPresets)); // FIX 5
            document.getElementById('gsb-preset-name').value = '';
            updatePresetSelect();
            showToast(`✅ "${name}" basariyla kaydedildi!`, "success");
        };

        document.getElementById('gsb-load-preset-btn').onclick = () => {
            const name = document.getElementById('gsb-preset-select').value;
            if (!name || !savedPresets[name]) { showToast("Lütfen yüklenecek bir sablon seçin.", "warning"); return; }
            globalFilters = JSON.parse(JSON.stringify(savedPresets[name]));
            renderFilters();
            showToast(`📂 "${name}" filtreleri yüklendi!`, "info");
        };

        document.getElementById('gsb-del-preset-btn').onclick = () => {
            const name = document.getElementById('gsb-preset-select').value;
            if (!name || !savedPresets[name]) return;
            delete savedPresets[name];
            GM_setValue('gsb_filter_presets', JSON.stringify(savedPresets)); // FIX 5
            updatePresetSelect();
            showToast(`🗑️ "${name}" silindi.`, "info");
        };

        document.getElementById('gsb-btn-all').onclick = () => startDownload(1, Infinity, downloadFormat === 'xlsx', false);
        document.getElementById('gsb-btn-custom').onclick = () => {
            const start = parseInt(document.getElementById('gsb-input-start').value);
            const end = parseInt(document.getElementById('gsb-input-end').value);
            if (isNaN(start) || isNaN(end) || start > end || start < 1) {
                showToast("⚠️ Lütfen geçerli bir sayfa araligi girin (Örn: 1 - 3).", "warning");
                return;
            }
            startDownload(start, end, downloadFormat === 'xlsx', false);
        };
    }

    // ============================================================
    // SÜRÜKLENEBILIR BASLAMA BUTONU
    // ============================================================
    function injectFloatingButton() {
        if (document.getElementById('gsb-floating-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'gsb-floating-btn';
        // FIX 9: Ayrı text span + progress bar
        btn.innerHTML = `
            <span id="gsb-floating-btn-text">⚙️ Excel</span>
            <div style="position:absolute; bottom:0; left:0; width:100%; height:4px; background:#0a4d28; border-radius:0 0 50px 50px; overflow:hidden;">
                <div id="gsb-progress-bar-inner" style="height:100%; width:0%; background-color:#2ecc71; border-radius:0 0 50px 50px; transition:width 0.3s ease;"></div>
            </div>
        `;

        Object.assign(btn.style, {
            position: 'fixed', bottom: '100px', right: '30px', zIndex: '2147483647',
            padding: '12px 20px', backgroundColor: '#1d6f42', color: 'white',
            border: '2px solid #fff', borderRadius: '50px', cursor: 'move',
            fontSize: '14px', fontWeight: 'bold', boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
            fontFamily: 'Segoe UI, Arial, sans-serif', userSelect: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden'
        });

        let isDragging = false, startX, startY, startLeft, startTop;

        const onMouseMove = (ev) => {
            if (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5) {
                isDragging = true;
                btn.style.left = startLeft + (ev.clientX - startX) + 'px';
                btn.style.top = startTop + (ev.clientY - startY) + 'px';
                btn.style.bottom = 'auto';
                btn.style.right = 'auto';
            }
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        btn.addEventListener('mousedown', (e) => {
            isDragging = false;
            startX = e.clientX; startY = e.clientY;
            startLeft = btn.offsetLeft; startTop = btn.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // FIX 7: async onclick
        btn.addEventListener('click', async () => {
            if (!isDragging) {
                if (isRunning) {
                    const confirmed = await showConfirmModal(
                        "Taramayi durdurup su ana kadar alinan veriyi <b>Excel olarak indirmek</b> istiyor musunuz?"
                    );
                    if (confirmed) {
                        stopRequested = true;
                        updateFloatingBtnText('🛑 İndiriliyor...');
                        btn.style.backgroundColor = '#e74c3c';
                    }
                } else {
                    showModal();
                }
            }
        });

        document.body.appendChild(btn);
    }

    setTimeout(injectFloatingButton, 2000);
})();
