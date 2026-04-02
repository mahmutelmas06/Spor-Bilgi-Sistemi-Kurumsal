// ==UserScript==
// @name         SBS Günlük Yoklama Yüzdesi Gösterici
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Kurum personelleri için yazılmış iş takip betiğidir. (API tabanlı, iframe'siz, hızlı)
// @author       YZ yardımıyla mahmut.elmas@yaani.com
// @updateURL    https://raw.githubusercontent.com/mahmutelmas06/sbs-gunluk-yoklama/main/sbs-gunluk-yoklama.user.js
// @downloadURL  https://raw.githubusercontent.com/mahmutelmas06/sbs-gunluk-yoklama/main/sbs-gunluk-yoklama.user.js
// @match        *://spor.gsb.gov.tr/Modules/Antrenman/AntrenmanProgramiListeleme.aspx*
// @match        *://spor.gsb.gov.tr/Modules/Antrenman/AntrenorPersonelDetay.aspx*
// @match        *://spor.gsb.gov.tr/Modules/Antrenman/AntrenorProgrami.aspx*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    // ── Renkli Performans Logu ────────────────────────────────────────────────
    const _nativeInfo = window.console.info.bind(console);
    const _nativeWarn = window.console.warn.bind(console);
    console.log = function () {};

    function perfLog(label, id, ms) {
        const color = ms > 5000 ? '#e74c3c' : ms > 2000 ? '#f39c12' : '#2ecc71';
        _nativeInfo(
            '%c[GSB] %c%s %c#%s %c%ss',
            'color:#0056b3;font-weight:bold;background:#eef4ff;padding:1px 4px;border-radius:3px;',
            'color:#9b59b6;font-weight:bold;',
            label.toUpperCase().padEnd(12),
            'color:#7f8c8d;', id,
            `color:${color};font-weight:bold;`, (ms / 1000).toFixed(2)
        );
    }

    window.onerror = function (message) {
        if (typeof message === 'string' && message.includes('clickToSelect')) return true;
        return false;
    };

    // ── Ayarlar ──────────────────────────────────────────────────────────────
    const SETTINGS_KEY = 'gsb_script_settings_v5_0';
    const DEFAULT_SETTINGS = {
        autoStart:   true,
        concurrency: 5,
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
                box-shadow:0 10px 25px rgba(0,0,0,0.2);z-index:9999;font-family:Arial,sans-serif;overflow:hidden;">
                <div style="background:#0056b3;color:#fff;padding:15px;font-size:16px;font-weight:bold;text-align:center;">⚙️ Script Ayarları</div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:15px;font-size:13px;color:#333;">
                    <label style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                        <b>Otomatik Başlat:</b>
                        <input type="checkbox" id="set-autoStart" ${s.autoStart ? 'checked' : ''} style="transform:scale(1.3);">
                    </label>
                    <label style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                        <b>Eşzamanlı İstek:</b>
                        <select id="set-concurrency" style="padding:5px;border-radius:4px;border:1px solid #ccc;">
                            <option value="1" ${s.concurrency===1?'selected':''}>1 (Tam Stabil)</option>
                            <option value="3" ${s.concurrency===3?'selected':''}>3 (Dengeli)</option>
                            <option value="5" ${s.concurrency===5?'selected':''}>5 (Hızlı)</option>
                            <option value="10" ${s.concurrency===10?'selected':''}>10 (Çok Hızlı)</option>
                        </select>
                    </label>
                    <div style="border-top:1px solid #eee;padding-top:10px;">
                        <b style="display:block;margin-bottom:8px;color:#0056b3;">Çalışacak Dönemler:</b>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-period-past" ${s.periods.includes('past')?'checked':''}> Geçmiş Aylarda Çalış
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-period-current" ${s.periods.includes('current')?'checked':''}> Şimdiki Ayda Çalış
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" id="set-period-future" ${s.periods.includes('future')?'checked':''}> Gelecek Aylarda Çalış
                        </label>
                    </div>
                    <div style="border-top:1px solid #eee;padding-top:10px;">
                        <b style="display:block;margin-bottom:8px;color:#0056b3;">Okunacak Veriler:</b>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-tab-antrenor" ${s.tabs.includes('antrenor')?'checked':''}> Kadro Türü
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;">
                            <input type="checkbox" id="set-tab-yoklama" ${s.tabs.includes('yoklama')?'checked':''}> Genel Durum Yüzdesi
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" id="set-tab-tesis" ${s.tabs.includes('tesis')?'checked':''}> Kullanılan Tesisler
                        </label>
                    </div>
                </div>
                <div style="display:flex;border-top:1px solid #eee;">
                    <button id="btn-settings-cancel" style="flex:1;padding:12px;border:none;background:#f8f9fa;color:#333;cursor:pointer;font-weight:bold;">İptal</button>
                    <button id="btn-settings-save" style="flex:1;padding:12px;border:none;background:#28a745;color:#fff;cursor:pointer;font-weight:bold;">Kaydet ve Yenile</button>
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
            GSB_SETTINGS.tabs = newTabs;
            saveSettings();
        };
    }

    GM_registerMenuCommand('⚙️ Ayarları Aç', openSettingsModal);

    // ── Global Değişkenler ────────────────────────────────────────────────────
    let tasksQueue           = [];
    let isScriptPaused       = !GSB_SETTINGS.autoStart;
    let isProcessorRunning   = false;
    let isAllExpanded        = false;
    let globalProcessorRunId = 0;

    // ── Ay İsimleri ───────────────────────────────────────────────────────────
    const MONTH_MAP = {
        'OCAK':1,'ŞUBAT':2,'MART':3,'NİSAN':4,'MAYIS':5,'HAZİRAN':6,
        'TEMMUZ':7,'AĞUSTOS':8,'EYLÜL':9,'EKİM':10,'KASIM':11,'ARALIK':12
    };
    const TR_DAYS = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

    // ── Dönem Sınıflandırma ───────────────────────────────────────────────────
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

    // ── Kadro Türü ────────────────────────────────────────────────────────────
    function getSicilType(personelTur, sicilNo) {
        if (personelTur === 1) return 'Memur';
        if (personelTur === 2) return 'Sözleşmeli';
        if (personelTur === 3) return 'Sürekli İşçi';
        const s = (sicilNo || '').trim();
        if (!s) return 'EYS';
        if (s.startsWith('1')) return 'Memur';
        if (s.startsWith('2')) return 'Sözleşmeli';
        if (s.startsWith('3')) return 'Sürekli İşçi';
        return 'EYS';
    }

    const KADRO_BG = {
        'Memur':'#3498db','Sözleşmeli':'#27ae60',
        'Sürekli İşçi':'#e67e22','EYS':'#95a5a6'
    };
    function kadroTuruBadge(type) {
        return `<span style="display:inline-block;padding:3px 8px;border-radius:3px;font-size:11px;
            font-weight:bold;background:${KADRO_BG[type]||'#95a5a6'};color:#fff;">${type}</span>`;
    }

    // ── Ders Olmayan Günler ───────────────────────────────────────────────────
    function getMissingDays(dersler, targetY, targetM) {
        const lessonDays = new Set();
        dersler.forEach(d => {
            const m = d.Gun && d.Gun.match(/(\d{2})\.(\d{2})\.(\d{4})/);
            if (m) lessonDays.add(parseInt(m[3]) * 10000 + parseInt(m[2]) * 100 + parseInt(m[1]));
        });
        const daysInMonth = new Date(targetY, targetM, 0).getDate();
        const missing = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const ymd = targetY * 10000 + targetM * 100 + day;
            if (!lessonDays.has(ymd)) {
                const dd  = String(day).padStart(2, '0');
                const mm  = String(targetM).padStart(2, '0');
                const gun = TR_DAYS[new Date(targetY, targetM - 1, day).getDay()];
                missing.push(`${dd}.${mm}.${targetY} ${gun}`);
            }
        }
        return missing;
    }

    // ── API Yardımcısı ────────────────────────────────────────────────────────
    const BASE = '/Modules/Antrenman/AntrenorPersonelDetay.aspx';

    async function apiPost(endpoint, body) {
        const res = await fetch(`${BASE}/${endpoint}`, {
            method:      'POST',
            credentials: 'include',
            headers: {
                'Content-Type':   'application/json; charset=utf-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${endpoint}`);
        const json = await res.json();
        if (!json.d?.Status) throw new Error(`API hata — ${endpoint}: ${json.d?.Message}`);
        return json.d.Data;
    }

    // ── Tarih Yardımcıları ────────────────────────────────────────────────────
    function monthStartISO(year, month) {
        const d = new Date(Date.UTC(year, month - 1, 1) - 3 * 3600000);
        return d.toISOString();
    }
    function monthEndISO(year, month) {
        const lastDay = new Date(year, month, 0).getDate();
        const d = new Date(Date.UTC(year, month - 1, lastDay) - 3 * 3600000);
        return d.toISOString();
    }

    function parseDotDate(str) {
        const m = str && str.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (!m) return null;
        const d = +m[1], mo = +m[2], y = +m[3];
        return { ymd: y * 10000 + mo * 100 + d, ts: new Date(y, mo - 1, d, 12, 0, 0).getTime() };
    }

    function parseMsDate(val) {
        const m = String(val).match(/\d+/);
        return m ? parseInt(m[0]) : null;
    }

    // ── Veri Çekici: Tek Antrenör ─────────────────────────────────────────────
    async function fetchCoachData(coachId, year, month) {
        const payload = { antrenorPersonelId: String(coachId) };

        const requests = [];

        if (GSB_SETTINGS.tabs.includes('antrenor')) {
            requests.push(
                apiPost('AntrenorPersonelDetayliGetir', payload)
                    .then(d => ({ personel: d }))
                    .catch(() => ({ personel: null }))
            );
        } else {
            requests.push(Promise.resolve({ personel: null }));
        }

        const needsYoklama = GSB_SETTINGS.tabs.includes('yoklama') ||
                             GSB_SETTINGS.tabs.includes('tesis');
        if (needsYoklama) {
            requests.push(
                apiPost('ProgramDersGetir', {
                    ...payload,
                    ilkTarih: monthStartISO(year, month),
                    sonTarih: monthEndISO(year, month)
                }).then(d => ({ dersler: d }))
                  .catch(() => ({ dersler: null }))
            );
            requests.push(
                apiPost('AntrenorIzinListesiGetir', payload)
                    .then(d => ({ izinler: d }))
                    .catch(() => ({ izinler: [] }))
            );
        } else {
            requests.push(Promise.resolve({ dersler: null }));
            requests.push(Promise.resolve({ izinler: [] }));
        }

        const results = await Promise.all(requests);
        return Object.assign({}, ...results);
    }

    // ── Yüzde Hesaplayıcı ────────────────────────────────────────────────────
    function calcYuzde(dersler, izinler, year, month) {
        if (!dersler) return null;

        const today       = new Date();
        const todayYMD    = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
        const threeDaysAgoYMD = threeDaysAgo.getFullYear() * 10000 +
                                (threeDaysAgo.getMonth() + 1) * 100 + threeDaysAgo.getDate();

        const leaveRanges = (izinler || []).map(iz => ({
            start: parseMsDate(iz.BaslangicZamani),
            end:   parseMsDate(iz.BitisZamani)
        })).filter(r => r.start && r.end);

        const getDersTs = (d) => {
            const gm = d.Gun && d.Gun.match(/(\d{2})\.(\d{2})\.(\d{4})/);
            const sm = d.DersSaat && d.DersSaat.match(/(\d{1,2}):(\d{2})/);
            if (!gm) return null;
            const saat   = sm ? +sm[1] : 0;
            const dakika = sm ? +sm[2] : 0;
            return new Date(+gm[3], +gm[2] - 1, +gm[1], saat, dakika, 0).getTime();
        };

        const isIzinli = (dersTs) =>
            dersTs !== null && leaveRanges.some(r => dersTs >= r.start && dersTs <= r.end);

        const hedefDersler = dersler.filter(d => {
            const tarih = parseDotDate(d.Gun);
            if (!tarih) return false;
            if (tarih.ymd >= todayYMD) return false;
            if (d.EgitimTuruId === 1) return false;
            return true;
        });

        let brutGereken = 0, izinliGereken = 0, gecmisGereken = 0;
        let gecmisVar = 0, gecmisOgrenciYok = 0, gecmisTesisUygun = 0;
        let gecmisEksik = 0, gecmisIptal = 0;
        let son3GunEksik = 0;
        const uniqueTesisler = new Set();

        hedefDersler.forEach(d => {
            const tarih = parseDotDate(d.Gun);
            brutGereken++;

            if (d.TesisAd && d.TesisAd.trim() && d.TesisAd.trim() !== '-') {
                uniqueTesisler.add(d.TesisAd.trim());
            }

            const dersTs = getDersTs(d);
            if (isIzinli(dersTs)) {
                izinliGereken++;
                return;
            }

            gecmisGereken++;
            const durum = (d.ProgramDersYoklamaDurum || '').trim();

            const isTesisUygun   = durum.includes('Tesis') || durum.includes('uygun değildi');
            const isOgrenciYok   = durum.includes('hiçbiri') || durum.includes('katılmadı');
            const isAlinmis      = d.YoklamaDurum === true || isTesisUygun || isOgrenciYok;
            const isEslestirmeYok = !d.CalismaGrubuAdi || d.CalismaGrubuAdi.trim() === '' || d.CalismaGrubuAdi.trim() === '-';

            if (isAlinmis) {
                gecmisVar++;
                if (isOgrenciYok)   gecmisOgrenciYok++;
                if (isTesisUygun)   gecmisTesisUygun++;
            } else if (isEslestirmeYok) {
                gecmisIptal++;
            } else if (durum === 'İşlem yapılmadı' || durum === '') {
                gecmisEksik++;
                if (tarih.ymd >= threeDaysAgoYMD) son3GunEksik++;
            } else {
                gecmisIptal++;
            }
        });

        const anlikYuzde = gecmisGereken > 0
            ? Math.min(100, (gecmisVar / gecmisGereken) * 100)
            : 100;

        const potansiyel = gecmisGereken > 0
            ? Math.min(100, ((gecmisVar + son3GunEksik) / gecmisGereken) * 100)
            : 100;

        const debugRows = [];
        hedefDersler.forEach(d => {
            const dersTs    = getDersTs(d);
            const izinliMi  = isIzinli(dersTs);
            const durum     = (d.ProgramDersYoklamaDurum || '').trim();
            const isEslestirmeYok = !d.CalismaGrubuAdi || d.CalismaGrubuAdi.trim() === '' || d.CalismaGrubuAdi.trim() === '-';

            let karar, renkClass;
            if (izinliMi) {
                const r = leaveRanges.find(r => dersTs >= r.start && dersTs <= r.end);
                karar = `İZİNLİ (${new Date(r.start).toLocaleDateString('tr-TR')} – ${new Date(r.end).toLocaleDateString('tr-TR')})`;
                renkClass = 'orange';
            } else if (d.YoklamaDurum === true || durum.includes('Tesis') || durum.includes('uygun değildi') || durum.includes('hiçbiri') || durum.includes('katılmadı')) {
                karar = `✅ ALINDI${durum ? ' — ' + durum : ''}`;
                renkClass = 'green';
            } else if (isEslestirmeYok) {
                karar = `⚠️ Eşleştirme Yapılmadı`;
                renkClass = '#856404';
            } else if (durum === 'İşlem yapılmadı' || durum === '') {
                const tarih = parseDotDate(d.Gun);
                if (tarih && tarih.ymd >= threeDaysAgoYMD) {
                    karar = '🟡 Yoklama Alınabilir';
                    renkClass = '#e67e22';
                } else {
                    karar = '❌ Yoklama Alınmadı';
                    renkClass = 'red';
                }
            } else {
                karar = `⚠️ Eşleştirme Yapılmadı`;
                renkClass = '#856404';
            }
            debugRows.push({ gun: d.Gun, saat: d.DersSaat, grup: d.CalismaGrubuAdi || '—', karar, renkClass });
        });

        const bosGunler = getMissingDays(dersler, year, month);

        return {
            anlikYuzde, potansiyel, son3GunEksik,
            brutGereken, izinliGereken, gecmisGereken,
            gecmisVar, gecmisOgrenciYok, gecmisTesisUygun,
            gecmisEksik, gecmisIptal,
            uniqueTesisler,
            _debug: { debugRows, leaveRanges, bosGunler }
        };
    }

    // ── Debug Penceresi ───────────────────────────────────────────────────────
    function openDebugModal(coachId, stats, adSoyad) {
        document.getElementById('gsb-debug-modal')?.remove();
        document.getElementById('gsb-debug-overlay')?.remove();

        const { _debug, brutGereken, izinliGereken, gecmisGereken,
                gecmisVar, gecmisEksik, gecmisIptal, anlikYuzde } = stats;
        const { debugRows, leaveRanges } = _debug;

        const bosGunler = _debug.bosGunler || [];
        const bosGunlerHtml = bosGunler.length === 0
            ? '<div style="color:#27ae60;font-size:11px;padding:4px;">✅ Her gün en az bir ders var</div>'
            : bosGunler.map(g => `<div style="font-size:11px;padding:1px 0;">${g}</div>`).join('');

        // Bu yılın izinlerini filtrele
        const buYil = new Date().getFullYear();
        const sonIzinler = leaveRanges.filter(r => {
            const endYear = new Date(r.end).getFullYear();
            const startYear = new Date(r.start).getFullYear();
            return endYear === buYil || startYear === buYil;
        });

        const izinlerHtml = sonIzinler.map(r => {
            const gunFarki = Math.round((r.end - r.start) / 86400000) + 1;
            return `<tr style="font-size:11px;">
                <td style="padding:2px 6px;">${new Date(r.start).toLocaleDateString('tr-TR')}</td>
                <td style="padding:2px 6px;">${new Date(r.end).toLocaleDateString('tr-TR')}</td>
                <td style="padding:2px 6px;text-align:center;font-weight:bold;color:#0056b3;">${gunFarki}</td>
            </tr>`;
        }).join('');

        const satirlarHtml = debugRows.map(r =>
            `<tr style="font-size:11px;border-bottom:1px solid #eee;">
                <td style="padding:3px 6px;white-space:nowrap;">${r.gun}</td>
                <td style="padding:3px 6px;">${r.saat}</td>
                <td style="padding:3px 6px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.grup}">${r.grup}</td>
                <td style="padding:3px 6px;color:${r.renkClass};font-weight:bold;">${r.karar}</td>
            </tr>`
        ).join('');

        document.body.insertAdjacentHTML('beforeend', `
        <div id="gsb-debug-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.5);z-index:19998;" onclick="document.getElementById('gsb-debug-modal').remove();this.remove();"></div>
        <div id="gsb-debug-modal" style="position:fixed;top:5%;left:50%;transform:translateX(-50%);
            background:#fff;width:820px;max-width:96vw;max-height:90vh;border-radius:10px;
            box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:19999;font-family:Arial,sans-serif;
            display:flex;flex-direction:column;overflow:hidden;">
            <div style="background:#0056b3;color:#fff;padding:12px 16px;font-size:14px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
                <span>🔍 Debug — #${coachId} ${adSoyad || ''}</span>
                <button onclick="document.getElementById('gsb-debug-modal').remove();document.getElementById('gsb-debug-overlay').remove();"
                    style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
            </div>

            <div style="padding:12px 16px;background:#f8f9fa;border-bottom:1px solid #dee2e6;font-size:12px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <b>Özet:</b>
                    Brüt: <b>${brutGereken}</b> |
                    İzinli: <b style="color:orange;">${izinliGereken}</b> |
                    Gereken: <b>${gecmisGereken}</b> |
                    Alınan: <b style="color:green;">${gecmisVar}</b> |
                    Eksik: <b style="color:red;">${gecmisEksik + gecmisIptal}</b> |
                    Yüzde: <b style="color:${anlikYuzde < 90 ? 'red' : 'blue'};">%${anlikYuzde.toFixed(1)}</b>
                </div>
                <button class="btn-gsb-debug-indir" data-coach-id="${coachId}"
                    style="background:#0056b3;color:#fff;border:none;border-radius:4px;padding:4px 10px;
                    font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;">📥 İndir</button>
            </div>

            <div style="display:flex;overflow:hidden;flex:1;">
                <div style="width:260px;min-width:260px;border-right:1px solid #dee2e6;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:10px;">
                    <div>
                        <div style="font-weight:bold;font-size:12px;margin-bottom:6px;color:#0056b3;">📅 İzin Aralıkları — ${buYil} (${sonIzinler.length})</div>
                        <table style="width:100%;border-collapse:collapse;">
                            <thead><tr style="background:#e9f5ff;font-size:11px;">
                                <th style="padding:3px 6px;text-align:left;">Başlangıç</th>
                                <th style="padding:3px 6px;text-align:left;">Bitiş</th>
                                <th style="padding:3px 6px;text-align:center;">Gün</th>
                            </tr></thead>
                            <tbody>${izinlerHtml || '<tr><td colspan="3" style="padding:6px;color:#aaa;">İzin yok</td></tr>'}</tbody>
                        </table>
                    </div>
                    <div style="border-top:1px solid #dee2e6;padding-top:8px;">
                        <div style="font-weight:bold;font-size:12px;margin-bottom:6px;color:#856404;">📆 Ders Olmayan Günler (${bosGunler.length})</div>
                        ${bosGunlerHtml}
                    </div>
                </div>

                <div style="flex:1;overflow-y:auto;padding:10px;">
                    <div style="font-weight:bold;font-size:12px;margin-bottom:6px;color:#0056b3;">📋 Uygulama Dersleri (${debugRows.length} satır geçmiş)</div>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead><tr style="background:#e9f5ff;font-size:11px;">
                            <th style="padding:3px 6px;text-align:left;">Gün</th>
                            <th style="padding:3px 6px;text-align:left;">Saat</th>
                            <th style="padding:3px 6px;text-align:left;">Grup</th>
                            <th style="padding:3px 6px;text-align:left;">Karar</th>
                        </tr></thead>
                        <tbody>${satirlarHtml || '<tr><td colspan="4" style="padding:6px;color:#aaa;">Geçmiş ders yok</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>`);
    }

// ── Debug CSV İndir ───────────────────────────────────────────────────────
    function debugCsvIndir(coachId, stats, adSoyad) {
        const { _debug, brutGereken, izinliGereken, gecmisGereken,
                gecmisVar, gecmisEksik, gecmisIptal, anlikYuzde } = stats;
        const { debugRows, leaveRanges, bosGunler } = _debug;

        const satirlar = [];

        // 1. BÖLÜM: ÖZET BİLGİLER
        satirlar.push('--- ÖZET BİLGİLER ---');
        satirlar.push(`Antrenör;${coachId} - ${adSoyad || ''}`);
        satirlar.push(`Brüt Gereken Ders;${brutGereken}`);
        satirlar.push(`İzinli Ders Sayısı;${izinliGereken}`);
        satirlar.push(`Net Gereken (Geçmiş);${gecmisGereken}`);
        satirlar.push(`Yoklaması Alınan;${gecmisVar}`);
        satirlar.push(`Eksik / İptal;${gecmisEksik + gecmisIptal}`);
        satirlar.push(`Güncel Yüzde;%${anlikYuzde.toFixed(1).replace('.', ',')}`);
        satirlar.push(''); // Boş satır bırak

        // 2. BÖLÜM: İZİN ARALIKLARI
        satirlar.push('--- İZİN ARALIKLARI ---');
        if (leaveRanges && leaveRanges.length > 0) {
            satirlar.push('Başlangıç;Bitiş;Gün Sayısı');
            const buYil = new Date().getFullYear();
            const sonIzinler = leaveRanges.filter(r => {
                const endYear = new Date(r.end).getFullYear();
                const startYear = new Date(r.start).getFullYear();
                return endYear === buYil || startYear === buYil;
            });

            if (sonIzinler.length > 0) {
                sonIzinler.forEach(r => {
                    const basTarih = new Date(r.start).toLocaleDateString('tr-TR');
                    const bitTarih = new Date(r.end).toLocaleDateString('tr-TR');
                    const gunFarki = Math.round((r.end - r.start) / 86400000) + 1;
                    satirlar.push(`${basTarih};${bitTarih};${gunFarki}`);
                });
            } else {
                satirlar.push('Bu yıla ait izin kaydı bulunamadı;;');
            }
        } else {
            satirlar.push('İzin kaydı bulunamadı;;');
        }
        satirlar.push('');

        // 3. BÖLÜM: DERS OLMAYAN GÜNLER
        satirlar.push('--- DERS OLMAYAN GÜNLER ---');
        if (bosGunler && bosGunler.length > 0) {
            satirlar.push('Tarih ve Gün;');
            bosGunler.forEach(g => satirlar.push(`${g};`));
        } else {
            satirlar.push('Her gün en az bir ders var;');
        }
        satirlar.push('');

        // 4. BÖLÜM: UYGULAMA DERSLERİ (GEÇMİŞ)
        satirlar.push('--- UYGULAMA DERSLERİ (PROGRAM) ---');
        if (debugRows && debugRows.length > 0) {
            satirlar.push('Gün;Saat;Grup;Karar');
            debugRows.forEach(r => {
                // Emoji ve özel karakterleri temizle
                const karar = (r.karar || '').replace(/[✅❌🟡⚠️]/g, '').trim();
                // Excel virgülle ayırmayı sevmediği için grup içindeki olası noktalı virgülleri virgüle çevir
                const grup = (r.grup || '').replace(/;/g, ',');
                satirlar.push(`${r.gun};${r.saat};${grup};${karar}`);
            });
        } else {
            satirlar.push('Geçmiş ders bulunamadı;;;');
        }

        // Dosyayı oluştur ve indir (Türkçe karakter desteği için BOM ekliyoruz)
        const csvContent = '\uFEFF' + satirlar.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Dosya ismini biraz daha düzgün formatlayalım
        const temizAdSoyad = (adSoyad || '').replace(/\s+/g, '_');
        a.download = `Yoklama_Raporu_${coachId}_${temizAdSoyad}.csv`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Veri Okunamadı HTML ───────────────────────────────────────────────────
    function veriYokHtml(coachId, mesaj) {
        return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <span style="color:#856404;font-size:11px;font-weight:bold;">${mesaj || '⚠️ Veri okunamadı'}</span>
            <button class="btn-yeniden-dene" data-coach-id="${coachId}"
                style="background:none;border:none;cursor:pointer;font-size:14px;" title="Yeniden dene">🔄</button>
        </div>`;
    }

    // ── Yoklama TD HTML ───────────────────────────────────────────────────────
    function buildYoklamaTdHtml(coachId, stats) {
        if (!stats) return veriYokHtml(coachId, '⚠️ Veri okunamadı');

        const { anlikYuzde, potansiyel, son3GunEksik,
                brutGereken, izinliGereken, gecmisGereken,
                gecmisVar, gecmisOgrenciYok, gecmisTesisUygun,
                gecmisEksik, gecmisIptal } = stats;

        if (gecmisGereken === 0 && izinliGereken > 0) {
            return `<div style="padding:0 5px;">
                <span style="display:inline-block;padding:3px 8px;background:#e67e22;color:white;
                    border-radius:3px;font-size:11px;font-weight:bold;">
                    İZİNLİ (${izinliGereken} ders)
                </span>
            </div>`;
        }

        const color   = anlikYuzde < 90 ? 'rgb(255,0,0)' : 'rgb(0,120,200)';
        const poColor = potansiyel  < 90 ? '#c0392b' : '#1a7abf';

        const islemYazisi = son3GunEksik > 0
            ? `<div style="font-size:10px;color:green;margin-top:4px;background:#fff5f5;
                border:1px solid #f5c6cb;border-radius:3px;padding:4px 6px;">
                <div style="font-weight:bold;">Alınabilir: ${son3GunEksik}</div>
                <div style="color:${poColor};">Alınırsa: <b>%${potansiyel.toFixed(1)}</b></div>
               </div>` : '';

        return `
            <div style="display:flex;align-items:center;width:100%;">
                <div style="flex-grow:1;text-align:left;padding-right:5px;">
                    <span style="color:${color};font-weight:bold;font-size:12px;">%${anlikYuzde.toFixed(1)}</span>
                    <div style="width:100%;background-color:#e0e0e0;height:10px;border-radius:5px;margin-top:2px;">
                        <div style="width:${anlikYuzde}%;background-color:${color};height:100%;border-radius:5px;"></div>
                    </div>
                </div>
                <button class="btn btn-xs btn-default btn-bilgi-ac"
                    style="padding:0 3px;font-size:14px;background:transparent;border:none;cursor:pointer;"
                    title="Hesaplama Detayları">ℹ️</button>
            </div>
            ${islemYazisi}
            <div class="bilgi-paneli" style="display:${isAllExpanded?'block':'none'};margin-top:8px;
                padding:10px;background:#e9f5ff;border:1px solid #b8daff;border-radius:6px;
                font-size:12px;white-space:normal;min-width:210px;color:#004085;
                text-align:left;box-shadow:0 3px 6px rgba(0,0,0,0.1);position:relative;">
                <div style="margin-bottom:8px;font-weight:bold;border-bottom:1px solid #b8daff;padding-bottom:5px;">Geçmiş Özeti</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div>
                        <div style="display:flex;justify-content:space-between;">
                            <span><b>Gereken:</b></span>
                            <span style="font-weight:bold;color:#0056b3;font-size:13px;">${gecmisGereken}</span>
                        </div>
                        <div style="color:#6c757d;font-size:10px;text-align:right;">↳ Brüt: ${brutGereken} | İzinli: ${izinliGereken}</div>
                    </div>
                    <hr style="margin:0;border-top:1px dashed #b8daff;">
                    <div>
                        <div style="display:flex;justify-content:space-between;">
                            <span><b>Alınan:</b></span>
                            <span style="color:green;font-weight:bold;font-size:13px;">${gecmisVar}</span>
                        </div>
                        <div style="color:#6c757d;font-size:10px;text-align:right;">↳ Öğrencilerin hiçbiri katılmadı: ${gecmisOgrenciYok}</div>
                        <div style="color:#6c757d;font-size:10px;text-align:right;">↳ Tesis uygun değildi: ${gecmisTesisUygun}</div>
                    </div>
                    <hr style="margin:0;border-top:1px dashed #b8daff;">
                    <div>
                        <div style="display:flex;justify-content:space-between;">
                            <span><b>Alınmayan:</b></span>
                            <span style="color:red;font-weight:bold;font-size:13px;">${gecmisEksik + gecmisIptal}</span>
                        </div>
                        <div style="color:#6c757d;font-size:10px;text-align:right;">↳ Yoklama alınmadı: ${gecmisEksik}</div>
                        <div style="color:#6c757d;font-size:10px;text-align:right;">↳ Eşleştirme yapılmadı: ${gecmisIptal}</div>
                    </div>
                </div>
                <div style="margin-top:10px;border-top:1px solid #b8daff;padding-top:6px;
                    font-size:10px;color:#6c757d;line-height:1.3;">
                    * Bugün hesaplamaya dahil edilmemiştir.<br>
                    * Teorik dersler hesaba katılmamaktadır.<br>
                    * Öğrencilerin katılmadığı veya tesisin uygun olmadığı dersler alınmış sayılır.
                </div>
            </div>`;
    }

    // ── Tesis Paneli HTML ─────────────────────────────────────────────────────
    function buildTesisPanelHtml(uniqueTesisler) {
        const arr = Array.from(uniqueTesisler).sort();
        const tesisHtml = arr.length > 0
            ? arr.map(t => `<div style="color:#6c757d;font-size:10px;margin-top:1px;">↳ ${t}</div>`).join('')
            : `<div style="color:#6c757d;font-size:10px;">↳ Kayıtlı tesis yok</div>`;
        return `
            <div style="margin-bottom:8px;font-weight:bold;color:#004085;
                border-bottom:1px solid #b8daff;padding-bottom:5px;">
                Kullanılan Tesisler (${arr.length})
            </div>
            ${tesisHtml}`;
    }

    // ── Kuyruk İşleyici ───────────────────────────────────────────────────────
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
            await Promise.all(batch.map(t => runTask(t, currentRunId)));
        }

        if (currentRunId === globalProcessorRunId) isProcessorRunning = false;
    }

    // ── Tek Görev Çalıştırıcı ────────────────────────────────────────────────
    async function runTask(task, runId) {
        if (runId !== globalProcessorRunId) return;

        const { coachId, row, kadroTuruTd, yoklamaTd, tesisTd, gunPanelTd,
                periodYear, periodMonth,
                needsAntrenor, needsYoklama, needsTesis } = task;

        if (kadroTuruTd)  kadroTuruTd.innerHTML = `<span style="color:#aaa;font-size:10px;">🔄</span>`;
        if (yoklamaTd)    yoklamaTd.innerHTML   = `<div style="padding:0 5px;"><span style="color:#5bc0de;font-size:11px;font-weight:bold;">⏳ Çekiliyor...</span></div>`;

        const t0 = Date.now();
        try {
            const data = await fetchCoachData(coachId, periodYear, periodMonth);
            if (runId !== globalProcessorRunId) return;

            perfLog('api-fetch', coachId, Date.now() - t0);

            if (kadroTuruTd && needsAntrenor) {
                if (data.personel) {
                    const tip = getSicilType(data.personel.KurumPersonelTur, data.personel.KurumSicilNo);
                    kadroTuruTd.innerHTML = `<div style="padding:0 5px;">${kadroTuruBadge(tip)}</div>`;
                } else {
                    kadroTuruTd.innerHTML = `<span style="color:#856404;font-size:11px;">⚠️</span>`;
                }
            }

            if (yoklamaTd && needsYoklama) {
                if (data.dersler === null) {
                    yoklamaTd.innerHTML = veriYokHtml(coachId, '⚠️ Dersler okunamadı');
                } else {
                    const stats = calcYuzde(data.dersler, data.izinler, periodYear, periodMonth);
                    task._stats   = stats;
                    task._adSoyad = data.personel ? `${data.personel.Adi} ${data.personel.Soyadi}` : '';
                    yoklamaTd.innerHTML = buildYoklamaTdHtml(coachId, stats);

                    const debugBtn = document.createElement('button');
                    debugBtn.className = 'btn-gsb-debug';
                    debugBtn.dataset.coachId = coachId;
                    debugBtn.title = 'Hesap Detaylarını Gör';
                    debugBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;color:#aaa;padding:0 2px;float:right;';
                    debugBtn.textContent = '🔍';
                    yoklamaTd.appendChild(debugBtn);

                    if (tesisTd && needsTesis && stats) {
                        const panel = tesisTd.querySelector('.sporcu-bilgi-paneli');
                        if (panel) panel.innerHTML = buildTesisPanelHtml(stats.uniqueTesisler);
                    }
                }
            }

            task.status = 'done';

        } catch (e) {
            _nativeWarn('[GSB] Hata', coachId, e.message);
            task.status = 'error';
            if (kadroTuruTd && needsAntrenor) kadroTuruTd.innerHTML = `<span style="color:#856404;font-size:11px;" title="${e.message}">⚠️</span>`;
            if (yoklamaTd   && needsYoklama)  yoklamaTd.innerHTML   = veriYokHtml(coachId, '⚠️ Hata');
        }
    }

    // ── Ana UI Oluşturucu ─────────────────────────────────────────────────────
    function calculateYoklamaUI() {
        const table = document.getElementById('cetgridAntrenman');
        if (!table) return;
        const theadRow = table.querySelector('thead tr');
        if (!theadRow) return;

        const period = getTablePeriod(table);
        if (!period) return;

        const classification  = classifyPeriod(period);
        const isPeriodEnabled = GSB_SETTINGS.periods.includes(classification);
        const isPastOrCurrent = classification === 'past' || classification === 'current';

        const needsAntrenor = GSB_SETTINGS.tabs.includes('antrenor') && isPeriodEnabled;
        const needsYoklama  = GSB_SETTINGS.tabs.includes('yoklama')  && isPeriodEnabled && isPastOrCurrent;
        const needsTesis    = GSB_SETTINGS.tabs.includes('tesis')    && isPeriodEnabled && isPastOrCurrent;

        const nativeThs = Array.from(theadRow.querySelectorAll('th')).filter(
            th => !th.classList.contains('kadro-turu-th') && !th.classList.contains('guncel-yuzde-th'));

        const yuzdeThIndex = nativeThs.findIndex(th => th.getAttribute('data-field') === 'YoklamaYuzdesi');
        if (yuzdeThIndex === -1) return;

        const uygulamaThIndex = nativeThs.findIndex(th => {
            const f = (th.getAttribute('data-field') || '').toLowerCase();
            return f.includes('uygulama') || th.textContent.toLowerCase().includes('uygulama');
        });

        const ogrenciThIndex = nativeThs.findIndex(th => {
            const txt = th.textContent.toLowerCase();
            return txt.includes('katılan') || txt.includes('öğrenci') || txt.includes('sporcu');
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
                <div style="display:flex;justify-content:center;align-items:center;gap:8px;">
                    <span>Genel Durum</span>
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
            if (!isPeriodEnabled || (!needsAntrenor && !needsYoklama && !needsTesis)) return;

            let coachId = null;
            const aTag = row.querySelector('a[onclick*="programOnizleme"]');
            if (aTag) {
                const m = aTag.getAttribute('onclick').match(/programOnizleme\(\d+,\s*(\d+)\)/);
                if (m) coachId = m[1];
            }

            const isZeroUygulama = uygulamaThIndex !== -1 &&
                parseInt((nativeTds[uygulamaThIndex]?.textContent || '').trim(), 10) === 0;

            let kadroTuruTd = null;
            if (needsAntrenor) {
                kadroTuruTd = document.createElement('td');
                kadroTuruTd.className = 'kadro-turu-td';
                kadroTuruTd.style.cssText = 'vertical-align:middle;text-align:center;';
                kadroTuruTd.innerHTML = coachId
                    ? `<span style="color:#ccc;font-size:11px;">⏳</span>`
                    : `<span style="color:#aaa;font-size:11px;">—</span>`;
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
                    yoklamaTd.innerHTML = `<div style="padding:0 5px;"><span style="display:inline-block;
                        padding:3px 8px;background:#17a2b8;color:white;border-radius:3px;
                        font-size:11px;font-weight:bold;">Tüm ay izinli</span></div>`;
                } else if (!coachId) {
                    yoklamaTd.innerHTML = `<span style="color:gray;font-size:10px;">ID Bulunamadı</span>`;
                } else {
                    yoklamaTd.innerHTML = `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:0 5px;">
                            <span style="color:#f0ad4e;font-size:11px;font-weight:bold;">⏳ Bekliyor...</span>
                            <button class="btn-hemen-hesapla" data-coach-id="${coachId}"
                                style="background:none;border:none;cursor:pointer;font-size:14px;">▶️</button>
                        </div>`;
                }
            }

            let tesisTd = null;

            if (needsTesis && ogrenciThIndex !== -1 && coachId && !isZeroUygulama) {
                tesisTd = nativeTds[ogrenciThIndex];
                if (tesisTd && !tesisTd.querySelector('.btn-sporcu-bilgi-ac')) {
                    const origHtml = tesisTd.innerHTML;
                    tesisTd.innerHTML = `
                        <div style="display:flex;justify-content:center;align-items:center;gap:5px;">
                            <span>${origHtml}</span>
                            <button class="btn btn-xs btn-default btn-sporcu-bilgi-ac"
                                style="padding:0 3px;font-size:14px;background:transparent;border:none;cursor:pointer;"
                                title="Tesis Detayları">ℹ️</button>
                        </div>
                        <div class="sporcu-bilgi-paneli" style="display:${isAllExpanded?'block':'none'};
                            position:relative;margin-top:8px;padding:10px;background:#e9f5ff;
                            border:1px solid #b8daff;border-radius:6px;font-size:12px;
                            white-space:normal;min-width:210px;color:#004085;text-align:left;
                            box-shadow:0 3px 6px rgba(0,0,0,0.1);">
                            <span style="color:#5bc0de;font-size:11px;">⏳ Yükleniyor...</span>
                        </div>`;
                }
            }

            if (!coachId || isZeroUygulama) return;

            tasksQueue.push({
                status: 'pending',
                row, coachId, kadroTuruTd, yoklamaTd, tesisTd,
                needsAntrenor, needsYoklama: needsYoklama && !isZeroUygulama,
                needsTesis: needsTesis && !isZeroUygulama,
                gunPanelTd: null,
                periodYear: period.year, periodMonth: period.month
            });
        });

        if (tasksQueue.some(t => t.status === 'pending') && !isProcessorRunning && !isScriptPaused) {
            processQueue();
        }
    }

    // ── Olay Dinleyiciler ─────────────────────────────────────────────────────
    document.addEventListener('click', e => {
        const btnInfo = e.target.closest('.btn-bilgi-ac');
        if (btnInfo) {
            e.stopPropagation(); e.stopImmediatePropagation();
            const p = btnInfo.closest('td')?.querySelector('.bilgi-paneli');
            if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
            return;
        }
        const btnTesis = e.target.closest('.btn-sporcu-bilgi-ac');
        if (btnTesis) {
            e.stopPropagation(); e.stopImmediatePropagation();
            const p = btnTesis.closest('td')?.querySelector('.sporcu-bilgi-paneli');
            if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
            return;
        }
    }, true);

    document.addEventListener('click', e => {
        const btnAll = e.target.closest('#btn-toggle-all-info');
        if (btnAll) {
            isAllExpanded = !isAllExpanded;
            btnAll.innerHTML = isAllExpanded ? '🔼' : '🔽';
            document.querySelectorAll('.bilgi-paneli, .sporcu-bilgi-paneli').forEach(
                p => p.style.display = isAllExpanded ? 'block' : 'none');
        }
        const btnHemen = e.target.closest('.btn-hemen-hesapla');
        if (btnHemen) {
            e.stopPropagation();
            const t = tasksQueue.find(x => x.coachId === btnHemen.dataset.coachId && x.status === 'pending');
            if (t) { t.status = 'processing'; runTask(t, globalProcessorRunId); }
        }
        const btnRetry = e.target.closest('.btn-yeniden-dene');
        if (btnRetry) {
            e.stopPropagation();
            const t = tasksQueue.find(x => x.coachId === btnRetry.dataset.coachId);
            if (t) { t.status = 'processing'; runTask(t, globalProcessorRunId); }
        }

        const btnDebug = e.target.closest('.btn-gsb-debug');
        if (btnDebug) {
            e.stopPropagation();
            const t = tasksQueue.find(x => x.coachId === btnDebug.dataset.coachId);
            if (t && t._stats) openDebugModal(t.coachId, t._stats, t._adSoyad);
        }

        const btnIndir = e.target.closest('.btn-gsb-debug-indir');
        if (btnIndir) {
            e.stopPropagation();
            const cId = btnIndir.dataset.coachId;
            const t = tasksQueue.find(x => x.coachId === cId);
            if (t && t._stats) debugCsvIndir(t.coachId, t._stats, t._adSoyad);
        }
    });

    // ── Tablo Değişim Gözlemcisi ──────────────────────────────────────────────
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


    // ══════════════════════════════════════════════════════════════════════════
    // ── Detay Sayfası Modülü (AntrenorPersonelDetay.aspx) ────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function isDetaySayfasi() {
        return location.pathname.toLowerCase().includes('antrenorpersoneldetay');
    }

    function parseMsDateDetay(val) {
        const m = String(val).match(/\d+/);
        return m ? parseInt(m[0]) : null;
    }

    async function detayIzinleriCek(coachId) {
        try {
            const res = await fetch(
                '/Modules/Antrenman/AntrenorPersonelDetay.aspx/AntrenorIzinListesiGetir',
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ antrenorPersonelId: String(coachId) })
                }
            );
            const json = await res.json();
            if (!json.d?.Status) return [];
            return (json.d.Data || []).map(iz => ({
                start: parseMsDateDetay(iz.BaslangicZamani),
                end:   parseMsDateDetay(iz.BitisZamani)
            })).filter(r => r.start && r.end);
        } catch (e) {
            return [];
        }
    }

    function dersZamaniniHesapla(gunStr, saatStr) {
        const gm = gunStr && gunStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        const sm = saatStr && saatStr.match(/(\d{1,2}):(\d{2})/);
        if (!gm) return null;
        const saat = sm ? +sm[1] : 0;
        const dk   = sm ? +sm[2] : 0;
        return new Date(+gm[3], +gm[2] - 1, +gm[1], saat, dk, 0).getTime();
    }

    function izinAraligindaMi(dersTs, leaveRanges) {
        return dersTs !== null && leaveRanges.some(r => dersTs >= r.start && dersTs <= r.end);
    }

    async function detayYoklamaSutunuDoldur() {
        const m = location.search.match(/antrenorpersonelid=(\d+)/i);
        if (!m) return;
        const coachId = m[1];

        const leaveRanges = await detayIzinleriCek(coachId);
        if (leaveRanges.length === 0) return;

        let attempts = 0;
        const wait = setInterval(() => {
            attempts++;
            const tbody = document.querySelector('#CetGridProgramDers tbody');
            if (!tbody || tbody.querySelector('.no-records-found')) {
                if (attempts > 100) clearInterval(wait);
                return;
            }
            const rows = tbody.querySelectorAll('tr[data-index]');
            if (rows.length === 0) {
                if (attempts > 100) clearInterval(wait);
                return;
            }
            clearInterval(wait);
            detayIzinEtiketle(rows, leaveRanges);
        }, 200);
    }

    function detayIzinEtiketle(rows, leaveRanges) {
        const ths = Array.from(document.querySelectorAll('#CetGridProgramDers thead th'));

        const fieldMap = {};
        ths.forEach((th, i) => {
            const f = th.getAttribute('data-field');
            if (f) fieldMap[f] = i;
        });

        const gunIdx  = fieldMap['Gun'];
        const saatIdx = fieldMap['DersSaat'];
        const yokIdx  = fieldMap['ProgramDersYoklamaDurum'];

        if (gunIdx === undefined || yokIdx === undefined) return;

        rows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length <= yokIdx) return;

            const gunTd  = tds[gunIdx];
            const saatTd = saatIdx !== undefined ? tds[saatIdx] : null;
            const yokTd  = tds[yokIdx];

            if (!gunTd || !yokTd) return;

            const gunStr  = gunTd.textContent.trim();
            const saatStr = saatTd ? saatTd.textContent.trim() : '';
            const dersTs  = dersZamaniniHesapla(gunStr, saatStr);

            if (!izinAraligindaMi(dersTs, leaveRanges)) return;

            if (yokTd.querySelector('.gsb-izinli-badge')) return;

            yokTd.innerHTML = `<span class="gsb-izinli-badge" style="color:white;background-color:#d9534f;
                padding:3px 6px;border-radius:4px;font-weight:bold;display:inline-block;">İZİNLİ</span>`;
        });
    }

    function detayTabloGozlemle() {
        const m = location.search.match(/antrenorpersonelid=(\d+)/i);
        if (!m) return;
        const coachId = m[1];

        let izinCache = null;
        let isWorking = false;

        const obs = new MutationObserver(async () => {
            if (isWorking) return;
            const tbody = document.querySelector('#CetGridProgramDers tbody');
            if (!tbody) return;
            const rows = tbody.querySelectorAll('tr[data-index]');
            if (rows.length === 0) return;
            const unetiketli = Array.from(rows).some(
                tr => !tr.querySelector('.gsb-izinli-badge') &&
                      tr.querySelectorAll('td').length > 3
            );
            if (!unetiketli) return;

            isWorking = true;
            try {
                if (!izinCache) {
                    izinCache = await detayIzinleriCek(coachId);
                }
                if (izinCache && izinCache.length > 0) {
                    detayIzinEtiketle(rows, izinCache);
                }
            } finally {
                isWorking = false;
            }
        });

        obs.observe(document.body, { childList: true, subtree: true });
    }


    // ══════════════════════════════════════════════════════════════════════════
    // ── Sporcu Çalışma Grubu Tarih Kontrolü (AntrenorPersonelDetay.aspx) ─────
    // ══════════════════════════════════════════════════════════════════════════

    function detaySporcuGrupKontrol() {
        // Sporcular sekmesindeki tabloyu bul ve çalışma grubu tarihlerini kontrol et
        let isWorking = false;

        const obs = new MutationObserver(() => {
            if (isWorking) return;

            // Sporcular sekmesindeki tüm tabloları tara — tablo ID'si bilinmiyor
            // Çalışma grubu sütununda <ul> olan tabloyu bul
            const allTables = document.querySelectorAll('table.table');
            let targetTbody = null;

            for (const tbl of allTables) {
                const tbody = tbl.querySelector('tbody');
                if (!tbody) continue;
                const firstRow = tbody.querySelector('tr[data-index]');
                if (!firstRow) continue;
                // Çalışma grubu sütunu: içinde <ul> olan td
                const hasUl = firstRow.querySelector('td ul');
                if (hasUl) {
                    targetTbody = tbody;
                    break;
                }
            }

            if (!targetTbody) return;

            const rows = targetTbody.querySelectorAll('tr[data-index]');
            if (rows.length === 0) return;

            // Zaten işlenmiş mi kontrol et
            const unprocessed = Array.from(rows).some(
                tr => !tr.hasAttribute('data-gsb-grup-checked')
            );
            if (!unprocessed) return;

            isWorking = true;
            try {
                sporcuGrupTarihKontrolEt(rows);
            } finally {
                isWorking = false;
            }
        });

        obs.observe(document.body, { childList: true, subtree: true });
    }

    function sporcuGrupTarihKontrolEt(rows) {
        // Tarih aralığı pattern: dd.mm.yyyy-dd.mm.yyyy
        const rangePattern = /(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/;
        // Son ders tarihi pattern: dd-mm-yyyy
        const sonDersPattern = /(\d{2})-(\d{2})-(\d{4})/;

        rows.forEach(tr => {
            if (tr.hasAttribute('data-gsb-grup-checked')) return;
            tr.setAttribute('data-gsb-grup-checked', 'true');

            const tds = tr.querySelectorAll('td');
            if (tds.length < 7) return;

            // "Katıldığı Son Ders" sütununu bul — tarih formatı dd-mm-yyyy olan sütun
            let sonDersTarih = null;
            let sonDersTd = null;
            for (const td of tds) {
                const txt = td.textContent.trim();
                const m = txt.match(sonDersPattern);
                if (m) {
                    const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3]);
                    sonDersTarih = new Date(year, month - 1, day, 12, 0, 0);
                    sonDersTd = td;
                    break;
                }
            }

            if (!sonDersTarih || !sonDersTd) return;

            // Çalışma grubu sütununu bul — <ul> içeren td
            const grupUl = tr.querySelector('td ul');
            if (!grupUl) return;

            const liItems = grupUl.closest('td').querySelectorAll('li');
            if (liItems.length === 0) return;

            // Herhangi bir grup son ders tarihini kapsıyor mu?
            let herhangiKapsiyor = false;

            liItems.forEach(li => {
                const liText = li.textContent.trim();
                const m = liText.match(rangePattern);
                if (!m) return;

                const rangeStart = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]), 0, 0, 0);
                const rangeEnd   = new Date(parseInt(m[6]), parseInt(m[5]) - 1, parseInt(m[4]), 23, 59, 59);

                if (sonDersTarih >= rangeStart && sonDersTarih <= rangeEnd) {
                    herhangiKapsiyor = true;
                }
            });

            // Hiçbir grup kapsamıyorsa → Son Ders td'sini kırmızı gölgeli yap
            if (!herhangiKapsiyor) {
                sonDersTd.style.backgroundColor = 'rgba(217, 83, 79, 0.15)';
                sonDersTd.style.borderRadius = '3px';
            }
        });
    }


    // ══════════════════════════════════════════════════════════════════════════
    // ── Antrenör Programı PDF Sayfası (AntrenorProgrami.aspx) ────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function isProgramSayfasi() {
        return location.pathname.toLowerCase().includes('antrenorprogrami');
    }

    // PDF overlay için tek bir ResizeObserver — sayfa değişiminde temizlenir
    let _pdfResizeObserver = null;

    async function programSayfasiBaslat() {
        const antIdMatch = location.search.match(/antId=(\d+)/i);
        if (!antIdMatch) {
            _nativeInfo('[GSB] AntrenorProgrami: antId bulunamadı');
            return;
        }
        const coachId = antIdMatch[1];
        _nativeInfo('[GSB] AntrenorProgrami: Antrenör ID =', coachId);

        const leaveRanges = await detayIzinleriCek(coachId);
        if (leaveRanges.length === 0) {
            _nativeInfo('[GSB] AntrenorProgrami: İzin kaydı yok, overlay eklenmeyecek.');
            return;
        }
        _nativeInfo('[GSB] AntrenorProgrami: İzin aralıkları:', leaveRanges.length);

        programPdfOverlayBaslat(leaveRanges);
    }

    function programPdfOverlayBaslat(leaveRanges) {
        let attempts = 0;
        const maxAttempts = 200;

        const waitForCanvas = setInterval(() => {
            attempts++;
            const canvas = document.getElementById('the-canvas');
            const pageCount = document.getElementById('page_count');

            if (!canvas || canvas.width < 100 || !pageCount || pageCount.textContent === '0' || pageCount.textContent === '') {
                if (attempts > maxAttempts) {
                    clearInterval(waitForCanvas);
                    _nativeWarn('[GSB] AntrenorProgrami: Canvas bulunamadı veya render edilmedi');
                }
                return;
            }

            clearInterval(waitForCanvas);
            _nativeInfo('[GSB] AntrenorProgrami: Canvas bulundu, sitenin kendi çizimini bitirmesi bekleniyor...');

            setTimeout(() => {
                programPdfParseEtVeOverlayEkle(canvas, leaveRanges);
            }, 800);

        }, 200);
    }

    async function programPdfParseEtVeOverlayEkle(canvas, leaveRanges) {
        const base64Input = document.getElementById('pdfBase64Data');
        if (!base64Input || !base64Input.value) {
            _nativeWarn('[GSB] AntrenorProgrami: pdfBase64Data bulunamadı');
            return;
        }

        if (typeof pdfjsLib === 'undefined') {
            _nativeWarn('[GSB] AntrenorProgrami: pdfjsLib bulunamadı');
            return;
        }

        try {
            const raw = atob(base64Input.value);
            const uint8 = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);

            const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
            _nativeInfo('[GSB] AntrenorProgrami: PDF yüklendi, toplam sayfa:', pdf.numPages);

            const pageNumEl = document.getElementById('page_num');
            let currentPage = pageNumEl ? parseInt(pageNumEl.textContent) : 1;

            await programSayfaOverlayEkle(pdf, currentPage, canvas, leaveRanges);

            programSayfaDegisiminiIzle(pdf, canvas, leaveRanges);

        } catch (e) {
            _nativeWarn('[GSB] AntrenorProgrami: PDF parse hatası:', e.message);
        }
    }

    async function programSayfaOverlayEkle(pdf, pageNum, canvas, leaveRanges) {
        try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });

            // Mevcut overlay ve ResizeObserver'ı temizle
            let overlayContainer = document.getElementById('gsb-pdf-overlay');
            if (overlayContainer) overlayContainer.remove();
            if (_pdfResizeObserver) {
                _pdfResizeObserver.disconnect();
                _pdfResizeObserver = null;
            }

            const canvasParent = canvas.parentElement;
            if (getComputedStyle(canvasParent).position === 'static') {
                canvasParent.style.position = 'relative';
            }

            overlayContainer = document.createElement('div');
            overlayContainer.id = 'gsb-pdf-overlay';
            overlayContainer.style.cssText = `
                position: absolute;
                top: ${canvas.offsetTop}px;
                left: ${canvas.offsetLeft}px;
                width: ${canvas.offsetWidth}px;
                height: ${canvas.offsetHeight}px;
                pointer-events: none;
                z-index: 10;
            `;
            canvasParent.appendChild(overlayContainer);

            // Tek ResizeObserver — canvas boyut değişince overlay'ı hizalar
            _pdfResizeObserver = new ResizeObserver(() => {
                const oc = document.getElementById('gsb-pdf-overlay');
                if (oc) {
                    oc.style.top = canvas.offsetTop + 'px';
                    oc.style.left = canvas.offsetLeft + 'px';
                    oc.style.width = canvas.offsetWidth + 'px';
                    oc.style.height = canvas.offsetHeight + 'px';
                }
            });
            _pdfResizeObserver.observe(canvas);

            const items = textContent.items;

            // PDF'in yılını bul
            let pdfYear = new Date().getFullYear();
            for (let item of items) {
                if (item.str && item.str.match(/^20\d{2}$/)) {
                    pdfYear = parseInt(item.str);
                    break;
                }
            }

            const trAylar = {'ocak':1,'şubat':2,'mart':3,'nisan':4,'mayıs':5,'haziran':6,'temmuz':7,'ağustos':8,'eylül':9,'ekim':10,'kasım':11,'aralık':12};

            // Satırları grupla (+- 5 piksel tolerans)
            const rowMap = new Map();
            items.forEach(item => {
                if (!item.str || item.str.trim() === '') return;
                const tx = item.transform;
                const y = Math.round(tx[5]);

                let foundY = y;
                for (let key of rowMap.keys()) {
                    if (Math.abs(key - y) <= 5) {
                        foundY = key;
                        break;
                    }
                }

                if (!rowMap.has(foundY)) rowMap.set(foundY, []);
                rowMap.get(foundY).push({ str: item.str, transform: tx, height: item.height });
            });

            let izinliSatirlar = 0;

            rowMap.forEach((rowItems, pdfY) => {
                rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
                const rowText = rowItems.map(r => r.str).join(' ');

                const dateMatch = rowText.match(/(0?[1-9]|[12]\d|3[01])\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)/i);
                if (!dateMatch) return;

                const day = parseInt(dateMatch[1]);
                const monthStr = dateMatch[2].toLowerCase();
                const month = trAylar[monthStr];

                const saatMatch = rowText.match(/(\d{1,2}):(\d{2})/);
                const saat = saatMatch ? parseInt(saatMatch[1]) : 12;
                const dk   = saatMatch ? parseInt(saatMatch[2]) : 0;

                const dersTs = new Date(pdfYear, month - 1, day, saat, dk, 0).getTime();

                const izinli = leaveRanges.some(r => dersTs >= r.start && dersTs <= r.end);
                if (!izinli) return;

                izinliSatirlar++;

                const firstItem = rowItems[0];
                const pt = viewport.convertToViewportPoint(firstItem.transform[4], firstItem.transform[5]);

                const topPercent = (pt[1] / viewport.height) * 100;

                const currentCanvasHeight = canvas.offsetHeight > 100 ? canvas.offsetHeight : 1262;
                const scaleY = currentCanvasHeight / viewport.height;
                const itemCssHeight = (firstItem.height || 10) * scaleY;

                const badge = document.createElement('div');
                badge.className = 'gsb-pdf-izinli-badge';
                badge.style.cssText = `
                    position: absolute;
                    top: ${topPercent}%;
                    right: 15px;
                    transform: translateY(-100%);
                    background: #d9534f;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: ${Math.max(10, Math.min(13, itemCssHeight * 0.9))}px;
                    font-weight: bold;
                    font-family: Arial, sans-serif;
                    line-height: 1;
                    pointer-events: none;
                    white-space: nowrap;
                    opacity: 0.95;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                `;
                badge.textContent = 'İZİNLİ';
                overlayContainer.appendChild(badge);
            });

            _nativeInfo(`[GSB] AntrenorProgrami: Sayfa ${pageNum} — ${izinliSatirlar} izinli satır bulundu`);

        } catch (e) {
            _nativeWarn('[GSB] AntrenorProgrami: Overlay hatası:', e.message);
        }
    }

    function programSayfaDegisiminiIzle(pdf, canvas, leaveRanges) {
        const pageNumEl = document.getElementById('page_num');
        if (!pageNumEl) return;

        let lastPage = pageNumEl.textContent;

        const pageObs = new MutationObserver(() => {
            const newPage = pageNumEl.textContent;
            if (newPage !== lastPage) {
                lastPage = newPage;
                const pageNum = parseInt(newPage);
                if (pageNum > 0) {
                    setTimeout(() => {
                        programSayfaOverlayEkle(pdf, pageNum, canvas, leaveRanges);
                    }, 500);
                }
            }
        });
        pageObs.observe(pageNumEl, { childList: true, characterData: true, subtree: true });

        // Canvas boyut değişikliğini izle — gereksiz yeniden çizimi önlemek için boyut karşılaştırması
        let lastCanvasSize = `${canvas.width}x${canvas.height}`;
        const canvasObs = new MutationObserver(() => {
            const newSize = `${canvas.width}x${canvas.height}`;
            if (newSize !== lastCanvasSize) {
                lastCanvasSize = newSize;
                const pageNum = parseInt(pageNumEl.textContent) || 1;
                setTimeout(() => {
                    programSayfaOverlayEkle(pdf, pageNum, canvas, leaveRanges);
                }, 300);
            }
        });
        canvasObs.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
    }


    // ══════════════════════════════════════════════════════════════════════════
    // ── Başlatıcı ─────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    window.addEventListener('load', () => {
        if (isProgramSayfasi()) {
            setTimeout(() => {
                programSayfasiBaslat();
            }, 1500);
        } else if (isDetaySayfasi()) {
            setTimeout(() => {
                detayYoklamaSutunuDoldur();
                detayTabloGozlemle();
                detaySporcuGrupKontrol();
            }, 1000);
        } else {
            setTimeout(calculateYoklamaUI, 800);
            const container = document.querySelector('.bootstrap-table');
            if (container) observer.observe(container, { childList: true, subtree: true });
        }
    });

    const style = document.createElement('style');
    style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

})();
