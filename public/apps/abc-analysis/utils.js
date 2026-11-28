// General helpers
function getPlantCalculationOverride(plantCode) {
    const overrides = (typeof window !== "undefined" && window.plantCalculationOverrides) || {};
    return overrides[plantCode] || overrides["*"] || null;
}

function toNumber(v) { return parseFloat((v || "0").toString().replace(/,/g, '')) || 0; }
function formatNumber(n) { return Number(n).toLocaleString('th-TH'); }
function formatCurrency(n) { return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatShortCurrency(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + " พันล้าน";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + " M";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + " K";
    return n.toFixed(2);
}

function formatDateFromYMD(raw) {
    if (!raw) return "";
    const s = raw.toString().trim();
    if (/^\d{8}$/.test(s)) {
        const y = s.slice(0, 4);
        const m = s.slice(4, 6);
        const d = s.slice(6, 8);
        return `${d}/${m}/${y}`;
    }
    return s;
}

function getOwnerName(userId) {
    switch (userId) {
        case '7556706': return 'ทศพล (แจ๊ค)';
        case '7512395': return 'ประวิทย์ (เอฟ)';
        case '7514198': return 'ทศพล (น๊อต)';
        case '7617585': return 'กิตติเทพ (เทพ)';
        case '7514499': return 'ธนพล (เบิร์ด)';
        case '7512147': return 'เสรีชัย (เบลล์)';
        case '7512141': return 'อาทิตย์ (ม่อน)';
        case '7513235': return 'ฤทธิพงษ์ (เป้)';
        case '7512424': return 'พิพัฒน์ (บัน)';
        case '7513032': return 'วิศรุต (แบงค์)';
        case '7832535': return 'ปรานต์ตะวัน (ไม้)';
        case '7834952': return 'นพดล (เดียร์)';
        default: return userId || '';
    }
}

// Safe localStorage and sessionStorage fallbacks for environments where they throw SecurityError (e.g., file:// protocol in some configurations or private mode)
const safeStorage = (type) => {
    let storage;
    try {
        storage = window[type];
        if (!storage) throw new Error('Storage is not defined');
        const key = '__storage_test__';
        storage.setItem(key, key);
        storage.removeItem(key);
        return storage;
    } catch (e) {
        console.warn(`[SafeStorage] ${type} is not available. Using in-memory fallback.`, e);
        const memoryStorage = {};
        return {
            getItem: (key) => key in memoryStorage ? memoryStorage[key] : null,
            setItem: (key, value) => { memoryStorage[key] = String(value); },
            removeItem: (key) => { delete memoryStorage[key]; },
            clear: () => { for (const key in memoryStorage) delete memoryStorage[key]; },
            key: (index) => Object.keys(memoryStorage)[index] || null,
            get length() { return Object.keys(memoryStorage).length; }
        };
    }
};

const safeLocalStorage = safeStorage('localStorage');
const safeSessionStorage = safeStorage('sessionStorage');

function renderAbcHeader(plantLabelText, rawMovementHtml) {
    const headerH1 = document.querySelector('h1');
    if (!headerH1) return;

    const cleanMovement = (rawMovementHtml || '')
        .replace(/เคลือนไหว/g, 'เคลื่อนไหว')
        .replace(/6เดือน/g, '6 เดือน');

    const parts = cleanMovement.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
    const labelTxt = parts[0] || '';
    const rangeTxt = parts.slice(1).join(' ').replace(/^วันที่\s*:\s*/i, '').trim();

    let metaInnerHtml = '';
    if (labelTxt && rangeTxt) {
        metaInnerHtml = `
            <span class="abc-meta-chip"><i class="fas fa-chart-line"></i> ${labelTxt}</span>
            <span class="abc-meta-sep">•</span>
            <span class="abc-meta-date"><i class="far fa-calendar-alt"></i> วันที่: <strong>${rangeTxt}</strong></span>
        `;
    } else if (cleanMovement) {
        metaInnerHtml = `<span class="abc-meta-chip"><i class="fas fa-chart-line"></i> ${cleanMovement}</span>`;
    }

    headerH1.className = 'abc-app-header';
    headerH1.innerHTML = `
        <span class="abc-brand-block">
            <span class="abc-brand-emblem" aria-hidden="true"><i class="fas fa-chart-pie"></i></span>
            <span class="abc-brand-copy">
                <span class="abc-brand-title-row">
                    <span class="abc-brand-title">ABC Analysis &amp; Smart Ordering System</span>
                    ${plantLabelText ? `<span class="abc-plant-pill"><i class="fas fa-warehouse"></i> ${plantLabelText}</span>` : ''}
                </span>
                ${metaInnerHtml ? `<span class="abc-brand-meta">${metaInnerHtml}</span>` : ''}
            </span>
        </span>
    `;
}

