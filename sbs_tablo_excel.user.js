// ==UserScript==
// @name         SBS Tablo Excel
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Spor Bilgi Sistemi - Verileri excel olarak indirme userscritpi
// @author       Mahmut Elmas with the help of AI
// @match        *://spor.gsb.gov.tr/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @updateURL    https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Excel/main/sbs_tablo_excel.user.js
// @downloadURL  https://raw.githubusercontent.com/mahmutelmas06/Spor-Bilgi-Sistemi-Excel/main/sbs_tablo_excel.user.js
// @run-at       document-end
// @exclude      https://spor.gsb.gov.tr/SayfayaYonlendir.aspx
// @exclude      https://spor.gsb.gov.tr/MainSicilLisans.aspx
// @exclude      https://spor.gsb.gov.tr/Login/?AppId=1&ReturnUrl=%2f
// @exclude      https://spor.gsb.gov.tr/edevletbasvuru/*
// ==/UserScript==

(function () {
    'use strict';

    // --- Ayar Değişikliği Uyarı Modalı ---
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
            <h4 style="margin: 0 0 10px 0; color: #1d6f42;">Ayar Güncellendi</h4>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #333;">
                <b>${settingName}</b>: <span style="color:#e74c3c; font-weight:bold;">${newValue}</span><br><br>
                Değişikliklerin etkili olması için sayfayı yenileyin.
            </p>
        `;

        const btnContainer = document.createElement('div');
        Object.assign(btnContainer.style, { display: 'flex', gap: '10px', justifyContent: 'center' });

        const btnRefresh = document.createElement('button');
        btnRefresh.innerText = 'Yenile';
        Object.assign(btnRefresh.style, {
            padding: '8px 15px', backgroundColor: '#3498db', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', flex: '1'
        });
        btnRefresh.onclick = () => location.reload();

        const btnLater = document.createElement('button');
        btnLater.innerText = 'Sonra Yenile';
        Object.assign(btnLater.style, {
            padding: '8px 15px', backgroundColor: '#95a5a6', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', flex: '1'
        });
        btnLater.onclick = () => overlay.remove();

        btnContainer.appendChild(btnRefresh);
        btnContainer.appendChild(btnLater);
        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // --- Tampermonkey Gelişmiş Menü Ayarları ---
    let downloadFormat = GM_getValue('gsb_format', 'xlsx');
    let waitMode = GM_getValue('gsb_wait_mode', 'auto');

    GM_registerMenuCommand("⚙️ İndirme Formatı (Şu an: " + downloadFormat.toUpperCase() + ")", () => {
        downloadFormat = downloadFormat === 'xlsx' ? 'csv' : 'xlsx';
        GM_setValue('gsb_format', downloadFormat);
        showRefreshModal("İndirme Formatı", downloadFormat.toUpperCase());
    });

    GM_registerMenuCommand("⏳ Sayfa Geçişi (Şu an: " + (waitMode === 'auto' ? 'OTOMATİK' : 'MANUEL') + ")", () => {
        waitMode = waitMode === 'auto' ? 'manual' : 'auto';
        GM_setValue('gsb_wait_mode', waitMode);
        showRefreshModal("Sayfa Geçiş Modu", waitMode === 'auto' ? 'OTOMATİK' : 'MANUEL ONAYLI');
    });

    let isRunning = false;
    let globalFilters = [];

    // --- Şık Bildirim (Toast) Sistemi ---
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

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }

    // --- Tablo Yardımcıları ---
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

        if (includeHeader) {
            const headRows = Array.from(tableElement.querySelectorAll("thead tr"));
            headRows.forEach(row => {
                let allCols = Array.from(row.querySelectorAll("th")).map(col => col.innerText.trim());
                let filteredCols = selectedIndices ? allCols.filter((_, idx) => selectedIndices.includes(idx)) : allCols;
                if (filteredCols.length > 0) {
                    if (antrenorAdi) filteredCols.push("Antrenör Ad Soyad");
                    rows.push(filteredCols);
                }
            });
        }

        const tbodyRows = Array.from(tableElement.querySelectorAll("tbody tr"));
        tbodyRows.forEach(row => {
            if (row.classList.contains('no-records-found') || row.innerText.includes("kayıttan") || row.innerText.includes("Yükleniyor")) return;

            let allCells = Array.from(row.querySelectorAll("td")).map(col => col.innerText.trim());

            let passesFilters = true;
            for (let f of appliedFilters) {
                let cellText = (allCells[f.colIdx] || "").trim();
                let searchVal1 = (f.val1 || "").trim();
                let searchVal2 = (f.val2 || "").trim();

                let cellTextLower = cellText.toLocaleLowerCase('tr-TR');
                let searchVal1Lower = searchVal1.toLocaleLowerCase('tr-TR');

                if (f.type === 'contains') {
                    if (!cellTextLower.includes(searchVal1Lower)) passesFilters = false;
                }
                else if (f.type === 'not_contains') {
                    if (cellTextLower.includes(searchVal1Lower)) passesFilters = false;
                }
                else if (['between', 'greater', 'less'].includes(f.type)) {
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

                    let v1Date = parseDate(searchVal1);
                    let v1Time = parseTime(searchVal1);

                    if (v1Date !== null) {
                        let cDate = parseDate(cellText);
                        let v2Date = parseDate(searchVal2);
                        if (cDate === null) passesFilters = false;
                        else if (f.type === 'between' && (cDate < v1Date || cDate > v2Date)) passesFilters = false;
                        else if (f.type === 'greater' && cDate < v1Date) passesFilters = false;
                        else if (f.type === 'less' && cDate > v1Date) passesFilters = false;
                    }
                    else if (v1Time !== null) {
                        let cTime = parseTime(cellText);
                        let v2Time = parseTime(searchVal2);
                        if (cTime === null) passesFilters = false;
                        else if (f.type === 'between' && (cTime < v1Time || cTime > v2Time)) passesFilters = false;
                        else if (f.type === 'greater' && cTime < v1Time) passesFilters = false;
                        else if (f.type === 'less' && cTime > v1Time) passesFilters = false;
                    }
                    else {
                        let cleanedStr = cellText.replace(/[^0-9,\.-]/g, '');
                        cleanedStr = cleanedStr.replace(/\./g, '').replace(',', '.');
                        let cellNum = parseFloat(cleanedStr);
                        let num1 = parseFloat(searchVal1.replace(/\./g, '').replace(',', '.'));
                        let num2 = parseFloat(searchVal2.replace(/\./g, '').replace(',', '.'));

                        if (isNaN(cellNum)) {
                            passesFilters = false;
                        } else {
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
                cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
            });

            worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: data[0].length } };

            worksheet.columns.forEach(column => {
                let maxL = 0;
                column.eachCell({ includeEmpty: true }, (c, rowNumber) => {
                    if (rowNumber > 1) {
                        c.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
                    }
                    if (c.value) {
                        let text = c.value.toString();
                        let lines = text.split('\n');
                        lines.forEach(line => {
                            if (line.length > maxL) maxL = line.length;
                        });
                    }
                });
                column.width = Math.min(Math.max(maxL + 4, 12), 60);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), fileName + ".xlsx");
            showToast("✅ Gelişmiş Excel (.xlsx) başarıyla oluşturuldu!", "success");
        } catch (e) {
            console.error("Excel Hatası:", e);
            showToast("❌ Excel oluşturulurken hata oluştu. Lütfen konsolu kontrol edin.", "error");
        }
    }

    // --- Ana Aktarım Döngüsü ---
    async function startDownload(startPage, endPage, useExcelJS, isCurrentOnly = false) {
        if (isRunning) return;

        let activeTable = getActiveTable();
        if (!activeTable) { showToast("⚠️ Ekranda indirilecek tablo bulunamadı!", "error"); return; }

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
            const floatingBtn = document.getElementById('gsb-floating-btn');
            showToast("⏳ Tarama başlıyor... Lütfen bekleyin.", "info", 4000);

            let currentAntrenorAdi = "";
            const lblAntrenor = document.getElementById('lblAntrenorAdSoyad');
            if (lblAntrenor && lblAntrenor.innerText.trim() !== "") {
                currentAntrenorAdi = lblAntrenor.innerText.trim();
            }

            const activeTabPane = document.querySelector('.tab-pane.active.in') || document.querySelector('.tab-pane.active') || document;
            const tableContainer = activeTable.closest('.bootstrap-table') || activeTabPane;

            async function waitForDataChange(oldRawSignature, maxWait = 25) {
                let i = 0;
                let absoluteTimeout = 0;

                while (i < maxWait && absoluteTimeout < 50) {
                    await new Promise(r => setTimeout(r, 400));
                    absoluteTimeout++;

                    let tbl = getActiveTable();
                    let newSig = getPageRawSignature(tbl);

                    if (waitMode === 'auto') {
                        let isLoading = false;
                        const loaders = tableContainer.querySelectorAll('.fixed-table-loading, .blockOverlay, .loading-message');
                        loaders.forEach(l => {
                            if (l.offsetWidth > 0 && l.offsetHeight > 0) isLoading = true;
                        });
                        if (isLoading) continue;
                    }

                    if (tbl && newSig !== oldRawSignature && newSig !== "") {
                        await new Promise(r => setTimeout(r, 400));
                        return newSig;
                    }

                    i++;

                    if (i >= maxWait && waitMode === 'manual') {
                        let userWantsToFinish = confirm("⏳ ZAMAN AŞIMI! (Veri değişmedi)\n\nİnternet bağlantınız yavaş olabilir veya sayfanın yüklenmesi hala tamamlanmadı.\n\nİndirmeyi BİTİRİP şimdiye kadar olanları Excel'e aktarmak için: [TAMAM / OK]\nBeklemeye DEVAM ETMEK için: [İPTAL / CANCEL] tuşuna basın.");
                        if (!userWantsToFinish) {
                            i = 0;
                            absoluteTimeout = 0;
                        }
                    }
                }
                return null;
            }

            // GÜNCELLEME 1: Dinamik Kayıt Sayısı Seçimi (Önceki 100 limiti yerine)
            if (endPage === Infinity && activeTable) {
                const dropDownLinks = Array.from(tableContainer.querySelectorAll('.page-list .dropdown-menu li a'));

                if (dropDownLinks.length > 0) {
                    // Dropdown listesindeki en son elemanı seç (En yüksek rakam veya Tümü)
                    const maxLink = dropDownLinks[dropDownLinks.length - 1];
                    let maxText = maxLink.innerText.trim() || 'Maks';

                    if (floatingBtn) floatingBtn.innerHTML = `⏳ ${maxText} Kayıt Seçiliyor...`;

                    if (!maxLink.parentElement.classList.contains('active')) {
                        let preMaxSig = getPageRawSignature(activeTable);
                        maxLink.click();
                        await waitForDataChange(preMaxSig, 25);
                        activeTable = getActiveTable();
                    }
                } else {
                    if (floatingBtn) floatingBtn.innerHTML = `⏳ Sayfa Ayarlanıyor...`;
                }
            }

            let allData = [];
            let pagesScraped = 0;

            let initialSig = getPageRawSignature(activeTable);
            let emptyCheckCounter = 0;
            while(initialSig === "" && emptyCheckCounter < 10) {
                await new Promise(r => setTimeout(r, 500));
                activeTable = getActiveTable();
                initialSig = getPageRawSignature(activeTable);
                emptyCheckCounter++;
            }
            let currentRawSignature = initialSig;

            let activeBtn = tableContainer.querySelector('.pagination li.active a, .pagination li.page-item.active a, .page-number.active a');
            let currentUIPage = activeBtn ? parseInt(activeBtn.innerText.trim()) : 1;
            if (isNaN(currentUIPage)) currentUIPage = 1;

            if (!isCurrentOnly && startPage > 1 && startPage !== currentUIPage) {
                if (floatingBtn) floatingBtn.innerHTML = `⏳ ${startPage}. Sayfaya Atlanıyor...`;
                let targetBtn = Array.from(tableContainer.querySelectorAll('.pagination li a')).find(a => parseInt(a.innerText.trim()) === startPage);

                if (activeTable.id) {
                    const script = document.createElement('script');
                    script.textContent = `try { $('#${activeTable.id}').bootstrapTable('selectPage', ${startPage}); } catch(e) {}`;
                    document.body.appendChild(script);
                    script.remove();
                } else if (targetBtn) {
                    targetBtn.click();
                }

                let newSig = await waitForDataChange(currentRawSignature, 25);
                if (!newSig) showToast(`⚠️ Sayfaya atlama doğrulanamadı. Elimizdeki veriyi indiriyoruz.`, "warning");
                else currentRawSignature = newSig;
            }

            let currentPageNum = isCurrentOnly ? 1 : startPage;
            let targetEndPage = isCurrentOnly ? 1 : endPage;

            while (currentPageNum <= targetEndPage) {
                if (floatingBtn && !isCurrentOnly) floatingBtn.innerHTML = `⏳ Sayfa: ${currentPageNum}...`;

                let rowsToSave = getTableRows(pagesScraped === 0, getActiveTable(), selectedIndices, currentActiveFilters, currentAntrenorAdi);
                allData = allData.concat(rowsToSave);
                pagesScraped++;

                if (currentPageNum >= targetEndPage) break;

                let nextBtn = tableContainer.querySelector('.pagination li.page-next a, .pagination li.next a');
                let nextLi = nextBtn ? nextBtn.closest('li') : null;

                // GÜNCELLEME 2: Son sayfa UX Kontrolü
                if (!nextBtn || (nextLi && nextLi.classList.contains('disabled'))) {
                    if (floatingBtn) floatingBtn.innerHTML = `⏳ Son sayfa kontrolü yapılıyor...`;
                    await new Promise(r => setTimeout(r, 800)); // Okuması için kısa bekleme
                    break;
                }

                if (floatingBtn) floatingBtn.innerHTML = `⏳ ${currentPageNum + 1}. Sayfaya Geçiliyor...`;

                let tbl = getActiveTable();
                if (tbl && tbl.id) {
                    const script = document.createElement('script');
                    script.textContent = `try { $('#${tbl.id}').bootstrapTable('nextPage'); } catch(e) {}`;
                    document.body.appendChild(script);
                    script.remove();
                } else {
                    nextBtn.click();
                }

                let newSig = await waitForDataChange(currentRawSignature, 25);
                if (!newSig) {
                    if (floatingBtn) floatingBtn.innerHTML = `⏳ Son sayfa kontrolü yapılıyor...`;
                    showToast(`⚠️ Sayfa değişmedi, son sayfaya ulaşılmış olabilir. Mevcut liste indiriliyor.`, "info");
                    break;
                }
                currentRawSignature = newSig;
                currentPageNum++;
            }

            if (allData.length > 0) {
                // Excel hazırlama sürecini göster
                if (floatingBtn) floatingBtn.innerHTML = `⏳ Excel Dosyası Hazırlanıyor...`;
                const tabName = document.querySelector('.nav-tabs li.active a')?.innerText.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'GSB_Veri';
                let rangeText = isCurrentOnly ? "TekSayfa" : (endPage === Infinity ? "TumSayfalar" : `Sayfa${startPage}-${startPage + pagesScraped - 1}`);
                const fileName = `${tabName}_${rangeText}_${new Date().toLocaleDateString().replace(/\./g,'-')}`;
                await generateExcel(allData, fileName, downloadFormat === 'xlsx');
            } else {
                showToast("Filtrelere uyan hiçbir veri bulunamadı.", "warning");
            }
        } finally {
            isRunning = false;
            const fb = document.getElementById('gsb-floating-btn');
            if (fb) fb.innerHTML = '⚙️ Excel Aktarım';
        }
    }

    // --- Modal Menü ---
    function showModal() {
        if (document.getElementById('gsb-modal-overlay')) return;

        globalFilters = [];
        let savedPresets = {};
        try {
            savedPresets = JSON.parse(localStorage.getItem('gsb_filter_presets')) || {};
        } catch(e) { console.warn("Filtre geçmişi okunamadı."); }

        const table = getActiveTable();
        const headers = Array.from(table?.querySelectorAll("thead th") || []).map((th, i) => th.innerText.trim() || ("Sütun " + (i + 1)));

        const overlay = document.createElement('div');
        overlay.id = 'gsb-modal-overlay';
        Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: '2147483647', display: 'flex', justifyContent: 'center', alignItems: 'center' });

        const modal = document.createElement('div');
        Object.assign(modal.style, { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', width: '420px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', fontFamily: 'Segoe UI, sans-serif' });

        let columnListHtml = headers.map((h, i) => `
            <div style="display:flex; align-items:center; margin-bottom:5px; font-size:13px;">
                <input type="checkbox" class="gsb-col-checkbox" id="col-${i}" checked style="margin-right:8px;">
                <label for="col-${i}">${h}</label>
            </div>
        `).join('');

        let filterOptionsHtml = headers.map((h, i) => `<option value="${i}">${h}</option>`).join('');

        modal.innerHTML = `
            <h3 style="margin:0 0 15px 0; color:#1d6f42; text-align:center;">📊 Excel Aktarım </h3>

            <div style="background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:10px; border:1px solid #eee;">
                <label style="display:flex; align-items:center; cursor:pointer; font-weight:bold; color:#333; font-size:13px;">
                    <input type="checkbox" id="gsb-use-columns" style="margin-right:10px;"> Sütunları Gizle / Seç
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
                    <input type="checkbox" id="gsb-use-filters" style="margin-right:10px;"> Gelişmiş Filtre Ekle
                </label>
                <div id="gsb-filter-panel" style="display:none; margin-top:10px; border-top:1px solid #cce3d6; padding-top:10px;">
                    <select id="gsb-filter-col" style="width:100%; padding:6px; margin-bottom:5px; border-radius:4px; border:1px solid #ccc; font-size:12px;">${filterOptionsHtml}</select>
                    <select id="gsb-filter-type" style="width:100%; padding:6px; margin-bottom:5px; border-radius:4px; border:1px solid #ccc; font-size:12px;">
                        <option value="contains">Şunu İçeriyorsa (Metin)</option>
                        <option value="not_contains">Şunu İçermiyorsa (Metin)</option>
                        <option value="between">Şu Aralıkta İse (Tarih, Saat, Sayı)</option>
                        <option value="greater">Büyük veya Sonra İse (>=)</option>
                        <option value="less">Küçük veya Önce İse (<=)</option>
                    </select>
                    <input type="text" id="gsb-filter-val1" placeholder="Değer 1" style="width:100%; padding:6px; margin-bottom:5px; border-radius:4px; border:1px solid #ccc; font-size:12px;">
                    <input type="text" id="gsb-filter-val2" placeholder="Değer 2 (Sadece Aralık için)" style="width:100%; padding:6px; margin-bottom:5px; border-radius:4px; border:1px solid #ccc; font-size:12px; display:none;">
                    <button id="gsb-add-filter-btn" style="width:100%; padding:6px; background:#1d6f42; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">➕ Kuralı Ekle</button>

                    <ul id="gsb-active-filters-list" style="list-style:none; padding-left:0; margin-top:10px; margin-bottom:0; font-size:11px; color:#555;"></ul>

                    <div style="margin-top:10px; border-top:1px dashed #9bc2aa; padding-top:10px;">
                        <div style="font-size:12px; font-weight:bold; color:#1d6f42; margin-bottom:5px;">💾 Kayıtlı Şablonlar</div>
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

            <button id="gsb-btn-one" style="width:100%; padding:10px; margin-bottom:8px; background:#3498db; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📄 Sadece Bu Sayfayı İndir</button>
            <button id="gsb-btn-all" style="width:100%; padding:10px; margin-bottom:15px; background:#2ecc71; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📑 Tüm Sayfaları İndir</button>

            <div style="border-top:1px solid #eee; padding-top:10px; margin-bottom: 5px;">
                <div style="font-size:13px; font-weight:bold; color:#555; margin-bottom:8px; text-align:left;">Belirli Sayfa Aralığı:</div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="number" id="gsb-input-start" min="1" placeholder="Baştan" style="width:35%; padding:8px; border:1px solid #ccc; border-radius:6px; text-align:center;">
                    <span style="color:#777; font-weight:bold;">-</span>
                    <input type="number" id="gsb-input-end" min="1" placeholder="Sona" style="width:35%; padding:8px; border:1px solid #ccc; border-radius:6px; text-align:center;">
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
        filterTypeSelect.onchange = (e) => {
            filterVal2Input.style.display = e.target.value === 'between' ? 'block' : 'none';
        };

        function renderFilters() {
            const list = document.getElementById('gsb-active-filters-list');
            list.innerHTML = '';
            globalFilters.forEach((f, idx) => {
                let colName = headers[f.colIdx] || "Bilinmeyen Sütun";
                let text = f.type === 'contains' ? `<b>${colName}</b>: '${f.val1}' içeriyorsa` :
                           f.type === 'not_contains' ? `<b>${colName}</b>: '${f.val1}' içermiyorsa` :
                           f.type === 'greater' ? `<b>${colName}</b>: ${f.val1} ve büyük/sonra ise` :
                           f.type === 'less' ? `<b>${colName}</b>: ${f.val1} ve küçük/önce ise` :
                           `<b>${colName}</b>: ${f.val1} ile ${f.val2} arasındaysa`;

                let li = document.createElement('li');
                li.style.cssText = "display:flex; justify-content:space-between; background:#fff; padding:4px 8px; margin-bottom:4px; border-radius:4px; border:1px solid #ddd;";
                li.innerHTML = `<span>${text}</span> <span style="color:red; cursor:pointer; font-weight:bold;" data-idx="${idx}">X</span>`;
                list.appendChild(li);
            });

            list.querySelectorAll('span[data-idx]').forEach(btn => {
                btn.onclick = function() {
                    globalFilters.splice(this.getAttribute('data-idx'), 1);
                    renderFilters();
                };
            });
        }

        document.getElementById('gsb-add-filter-btn').onclick = () => {
            let colIdx = parseInt(document.getElementById('gsb-filter-col').value);
            let type = document.getElementById('gsb-filter-type').value;
            let val1 = document.getElementById('gsb-filter-val1').value.trim();
            let val2 = document.getElementById('gsb-filter-val2').value.trim();

            if (!val1) { showToast("Lütfen bir değer girin.", "warning"); return; }
            if (type === 'between' && (!val1 || !val2)) {
                showToast("Aralık filtresi için iki geçerli değer girmelisiniz.", "warning"); return;
            }

            globalFilters.push({ colIdx, type, val1, val2 });
            document.getElementById('gsb-filter-val1').value = '';
            document.getElementById('gsb-filter-val2').value = '';
            renderFilters();
        };

        function updatePresetSelect() {
            const select = document.getElementById('gsb-preset-select');
            select.innerHTML = '<option value="">-- Kayıtlı Şablon Seç --</option>';
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
            if (!name) { showToast("Lütfen şablon için bir isim yazın.", "warning"); return; }
            if (globalFilters.length === 0) { showToast("Kaydedilecek aktif bir filtre yok. Önce kural ekleyin.", "warning"); return; }

            savedPresets[name] = JSON.parse(JSON.stringify(globalFilters));
            localStorage.setItem('gsb_filter_presets', JSON.stringify(savedPresets));
            document.getElementById('gsb-preset-name').value = '';
            updatePresetSelect();
            showToast(`✅ "${name}" başarıyla kaydedildi!`, "success");
        };

        document.getElementById('gsb-load-preset-btn').onclick = () => {
            const name = document.getElementById('gsb-preset-select').value;
            if (!name || !savedPresets[name]) { showToast("Lütfen yüklenecek bir şablon seçin.", "warning"); return; }

            globalFilters = JSON.parse(JSON.stringify(savedPresets[name]));
            renderFilters();
            showToast(`📂 "${name}" filtreleri yüklendi!`, "info");
        };

        document.getElementById('gsb-del-preset-btn').onclick = () => {
            const name = document.getElementById('gsb-preset-select').value;
            if (!name || !savedPresets[name]) return;

            delete savedPresets[name];
            localStorage.setItem('gsb_filter_presets', JSON.stringify(savedPresets));
            updatePresetSelect();
            showToast(`🗑️ "${name}" silindi.`, "info");
        };

        document.getElementById('gsb-btn-one').onclick = () => startDownload(null, null, downloadFormat === 'xlsx', true);
        document.getElementById('gsb-btn-all').onclick = () => startDownload(1, Infinity, downloadFormat === 'xlsx', false);
        document.getElementById('gsb-btn-custom').onclick = () => {
            const start = parseInt(document.getElementById('gsb-input-start').value);
            const end = parseInt(document.getElementById('gsb-input-end').value);

            if (isNaN(start) || isNaN(end) || start > end || start < 1) {
                showToast("⚠️ Lütfen geçerli bir sayfa aralığı girin (Örn: 3 ve 5).", "warning");
                return;
            }
            startDownload(start, end, downloadFormat === 'xlsx', false);
        };
    }

    // --- Sürüklenebilir Başlatma Butonu ---
    function injectFloatingButton() {
        if (document.getElementById('gsb-floating-btn')) return;
        const btn = document.createElement('div');
        btn.id = 'gsb-floating-btn';
        btn.innerHTML = '⚙️ Excel Aktarım';

        Object.assign(btn.style, {
            position: 'fixed', bottom: '100px', right: '30px', zIndex: '2147483647',
            padding: '12px 20px', backgroundColor: '#1d6f42', color: 'white',
            border: '2px solid #fff', borderRadius: '50px', cursor: 'move',
            fontSize: '14px', fontWeight: 'bold', boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
            fontFamily: 'Segoe UI, Arial, sans-serif', userSelect: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
        });

        let isDragging = false, startX, startY, startLeft, startTop;

        const onMouseMove = (ev) => {
            if (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5) {
                isDragging = true;
                btn.style.left = startLeft + (ev.clientX - startX) + 'px';
                btn.style.top = startTop + (ev.clientY - startY) + 'px';
                btn.style.bottom = 'auto'; btn.style.right = 'auto';
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

        btn.addEventListener('click', () => {
            if (!isDragging) showModal();
        });
        document.body.appendChild(btn);
    }

    setTimeout(injectFloatingButton, 2000);
})();
