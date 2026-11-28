import { fetchAllData, fetchQuickData } from '../modules/call-sparepart/services/api.js';
import { loadFromCache, saveToCache } from '../modules/call-sparepart/services/cacheService.js';
import {
  PLANT_MAPPING,
  processRawData,
  calculateSummary,
} from '../modules/call-sparepart/utils/helpers.js';

/* ==========================================================================
   1. Plant & Warehouse Directory + User Plant Resolution
   ========================================================================== */

export const PLANT_NAMES = {
  '0301': 'นวนคร',
  '0303': 'SA-สงขลา',
  '0304': 'พระราม 3',
  '0305': 'ราชบุรี',
  '0307': 'สุราษฎร์',
  '0309': 'นครราชสีมา',
  '0310': 'SA-อุดร 1',
  '0311': 'ศรีราชา',
  '0312': 'พิษณุโลก',
  '0313': 'ภูเก็ต',
  '0315': 'SA-อยุธยา',
  '0318': 'คลังวัตถุดิบ',
  '0319': 'ขอนแก่น',
  '0320': 'ลำปาง',
  '0322': 'SA-อุดร 2',
  '0323': 'SA-ลำลูกกา',
  '0324': 'SA-ปัตตานี',
  '0326': 'วิภาวดี 62',
  '0330': 'ประเวศ',
  '0362': 'SA-หนองแขม',
  '0363': 'SA-ปากเกร็ด',
  '0364': 'SA-บางบัวทอง',
  '0365': 'SA-สมุทรปราการ',
  '0366': 'เชียงใหม่',
  '0367': 'SA-ฉะเชิงเทรา',
  '0368': 'SA-ร้อยเอ็ด',
  '0369': 'ระยอง',
};

export const ABC_INVENTORY_URLS = {
  '0301': 'https://opensheet.elk.sh/1x-B1xekpMm4p7fkKucvLjaewtp66uGIp8ZIxJJZAxMk/Sheet1',
  '0304': 'https://opensheet.elk.sh/1miQgObvPdIocjf2Mwn-GZxRvDZy0R5gIl1zhxMWvM-E/Sheet1',
  '0305': 'https://opensheet.elk.sh/1DszRgfGDXe-n-BUqG3ZLj-_4N0mHu7mvw8EnfUOhvvI/Sheet1',
  '0307': 'https://opensheet.elk.sh/1C9vfwtdIO-XjHrDkmp5cUahjmcJ3vk8pTzhFCgHBg1Q/Sheet1',
  '0309': 'https://opensheet.elk.sh/1ntRtlRIndxgEZ3udnh7Nj8LSQiaUdAeAg5j8qd_z8sA/Sheet1',
  '0311': 'https://opensheet.elk.sh/1OKDdqLY_TOjjfLJ58xFiq-WHIDbMrxMcDho6FO5Rq8o/Sheet1',
  '0312': 'https://opensheet.elk.sh/1ilYbVsCqA1cSoUnZwwULCmPkdakobICkyq5JpBJyyAU/Sheet1',
  '0313': 'https://opensheet.elk.sh/12FSbkYSB1zi6xo2WGAsM0jFyp3IkIywLFVF0Zn2axpE/Sheet1',
  '0319': 'https://opensheet.elk.sh/1pYJsp3ZVSwQ1h_Ayqp3BrMTsm-ZtLREU03Qw5WUtgAw/Sheet1',
  '0320': 'https://opensheet.elk.sh/1V5uhH1wekza4FLN2VqtVBfgIA1sbTY_mqq4ohnTmW_M/Sheet1',
  '0326': 'https://opensheet.elk.sh/1gtZLR5Tm574o5xRbdrRm9yFzRukGx_UAzUnoah36cxQ/Sheet1',
  '0330': 'https://opensheet.elk.sh/1WYOikuoWE30WXsWglTXfxoj1gmjxlFMJgpN3eXp43Bk/Sheet1',
  '0366': 'https://opensheet.elk.sh/1NtRsaxPkeNb4sAcTm-Tn4oN-o5F6z_56S1nhTg7kvBc/Sheet1',
  '0369': 'https://opensheet.elk.sh/13NYKhEWkWLLnA2DZZEP-zZEz2r33-roUDPMSWoFR3Qk/Sheet1',
};

const ABC_SHARED_URLS = {
  usageUrl: 'https://opensheet.elk.sh/1xbhZWllmdQM7Q2gZ7ne6Lr_wMrRvNQobbpPDHU_Xk4c/MoveAllPlantX',
  mainsapUrl: 'https://opensheet.elk.sh/1CkfOIe2nDYBLs5aPGkPyZhOeqJkyS7UQ6tuMzxy-mfk/mainsap',
  avgValUrl: 'https://opensheet.elk.sh/1nwXDN6FjmXOHXzlxVv6y0Kv4peU9kjW3q20PAWsp6_4/Sheet1',
  statusUrl: 'https://opensheet.elk.sh/1yP1sq12fSXj00htJewUIugkQCaxA0smO2je7wtEISdw/Orders',
  locationUrl: 'https://opensheet.elk.sh/1x-B1xekpMm4p7fkKucvLjaewtp66uGIp8ZIxJJZAxMk/Sheet1',
  statusReadUrl: 'https://opensheet.elk.sh/18_R8a4qdpY-by3jEmxhf9QasIuB87uJL_OKlVpVQZ5U/StatusData',
  po0301Url: 'https://opensheet.elk.sh/1SPPy8uru1aCZZ-t8fLPYPx_Up-CamdaIoAbRN7fYD_o/PO%20%E0%B8%AA%E0%B8%B1%E0%B9%88%E0%B8%87%E0%B8%82%E0%B8%AD%E0%B8%87',
  note0301Url: 'https://opensheet.elk.sh/1SPPy8uru1aCZZ-t8fLPYPx_Up-CamdaIoAbRN7fYD_o/%E0%B8%AB%E0%B8%A1%E0%B8%B2%E0%B8%A2%E0%B9%80%E0%B8%AB%E0%B8%95%E0%B8%B8',
  pr0301Url: 'https://opensheet.elk.sh/1SPPy8uru1aCZZ-t8fLPYPx_Up-CamdaIoAbRN7fYD_o/PR%20%E0%B8%AA%E0%B8%B1%E0%B9%88%E0%B8%87%E0%B8%82%E0%B8%AD%E0%B8%87',
  po0326Url: 'https://opensheet.elk.sh/1-sjXrVsdMOiUYLomtz4F5OX-oNp9TZgW0IzbvqJTHSo/Sheet1',
  pr0326Url: 'https://opensheet.elk.sh/1Q3rI7EpowgGvh5px9p76cH3jfaW9B1hsW7ZZNXXDuk8/Sheet1',
  poSupplierDataUrl: 'https://opensheet.elk.sh/1wqK1qq3YxmAiba3hcVYtxd60TLX6m3kM2_Te7pSGeGQ/PoSupplier',
};

const TANK_SHEET_ID = '17P5h9MaiRrJpklQb7osAtvHdzrJ1xkqaf8T63kUkOeE';
const TANK_OPENSHEET_BASE = `https://opensheet.elk.sh/${TANK_SHEET_ID}`;
const TANK_STOCK_URL = 'https://opensheet.elk.sh/1gtZLR5Tm574o5xRbdrRm9yFzRukGx_UAzUnoah36cxQ/Sheet1';
const TANK_MATERIAL_MAP = {
  N2: '30011061',
  O2L: '30011063',
  O2S: '30014237',
};

export function normalizePlantCode(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return '';
  if (/^\d{3,4}$/.test(raw)) {
    return raw.padStart(4, '0');
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 4) {
    const padded = digits.padStart(4, '0');
    if (PLANT_NAMES[padded]) return padded;
  }
  return '';
}

export function resolveUserPlantInfo(user, overridePlantCode = '') {
  let plantCode = normalizePlantCode(overridePlantCode);

  if (!plantCode && user) {
    plantCode = normalizePlantCode(user.Plant || user.PlantCode);
  }

  // Fallback: match by user.Plant text, user['หน่วยงาน'], or user.Team
  if (!plantCode && user) {
    const candidates = [user.Plant, user['หน่วยงาน'], user.Team, user.Unit]
      .map((s) => String(s || '').trim())
      .filter(Boolean);

    for (const text of candidates) {
      // Check PLANT_MAPPING from Call Sparepart ("Stock วิภาวดี 62" -> "0326")
      for (const [unitName, code] of Object.entries(PLANT_MAPPING)) {
        if (!/^\d+$/.test(unitName)) {
          const cleanUnit = unitName.replace(/^Stock\s*/i, '').trim().toLowerCase();
          const cleanText = text.replace(/^Stock\s*/i, '').trim().toLowerCase();
          if (cleanText === cleanUnit || text.toLowerCase() === unitName.toLowerCase()) {
            plantCode = normalizePlantCode(code);
            break;
          }
        }
      }
      if (plantCode) break;

      // Check PLANT_NAMES ("วิภาวดี 62", "นวนคร", "โคราช" -> "นครราชสีมา")
      for (const [code, name] of Object.entries(PLANT_NAMES)) {
        const cleanText = text.replace(/^(คลัง|ศูนย์|Stock)\s*/i, '').trim().toLowerCase();
        const cleanName = name.toLowerCase();
        if (cleanText === cleanName || cleanText.includes(cleanName) || cleanName.includes(cleanText)) {
          plantCode = code;
          break;
        }
      }
      if (plantCode) break;
    }
  }

  // Default to 0326 (วิภาวดี 62) or 0301 if still empty
  if (!plantCode) {
    plantCode = '0326';
  }

  const plantName = PLANT_NAMES[plantCode] || plantCode;

  // Resolve Call Sparepart pendingUnit name (e.g. "Stock วิภาวดี 62", "Stock กทม")
  let callPendingUnit = '';
  const mappedEntry = Object.entries(PLANT_MAPPING).find(
    ([unit, code]) => !/^\d+$/.test(unit) && String(code).trim() === plantCode
  );
  if (mappedEntry) {
    callPendingUnit = mappedEntry[0];
  } else if (user?.['หน่วยงาน'] && /Stock/i.test(user['หน่วยงาน'])) {
    callPendingUnit = String(user['หน่วยงาน']).trim();
  } else {
    callPendingUnit = `Stock ${plantName}`;
  }

  // StockDay warehouse name aliases
  const stockDayAliases = new Set([plantName]);
  if (plantCode === '0301') {
    stockDayAliases.add('นวนคร');
    stockDayAliases.add('กทม');
  } else if (plantCode === '0309') {
    stockDayAliases.add('นครราชสีมา');
    stockDayAliases.add('โคราช');
  } else if (plantCode === '0307') {
    stockDayAliases.add('สุราษฎร์');
    stockDayAliases.add('สุราษฎร์ธานี');
  }

  return {
    plantCode,
    plantName,
    callPendingUnit,
    stockDayAliases: Array.from(stockDayAliases),
    hasAbcSheet: Boolean(ABC_INVENTORY_URLS[plantCode]),
  };
}

/* ==========================================================================
   2. StockDay Data Fetching & Processing (Requirement 1)
   ========================================================================== */

const toNum = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

function parseMonthYearScore(my) {
  const parts = String(my || '').trim().split('/');
  if (parts.length !== 2) return 0;
  const m = parseInt(parts[0], 10) || 1;
  const y = parseInt(parts[1], 10) || 2000;
  return y * 100 + m;
}

export async function fetchStockDayDashboard(plantInfo) {
  const res = await fetch('/api/web-data', {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'CallSparePartApp',
    },
  });
  if (!res.ok) {
    throw new Error(`StockDay API HTTP ${res.status}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return { history: [], latest: null, prev: null, warehouseName: plantInfo.plantName, isFallbackAll: false };
  }

  const cleaned = rows.map((row) => {
    const stockBegin = toNum(row['ต้นงวดคลัง']);
    const stockEnd = toNum(row['ปลายงวดคลัง']);
    const engBegin = toNum(row['ต้นงวดวิศวกรรม']);
    const engEnd = toNum(row['ปลายงวดวิศวกรรม']);
    const beginTotal = toNum(row['ต้นงวดมูลค่ารวม']);
    const endTotal = toNum(row['ปลายงวดมูลค่ารวม']) || (stockEnd + engEnd);
    const cost = toNum(row['ต้นทุนขาย']);
    const stockDay = Math.round(toNum(row['Stock Day']));
    const store = toNum(row['Store']);
    const nonStore = toNum(row['NonStore']);
    return {
      Mountyear: String(row['Mountyear'] || '').trim(),
      warehouse: String(row['ชื่อคลัง'] || '').trim(),
      statusGroup: String(row['StatusSAcom'] || '').trim(),
      stockBegin,
      stockEnd,
      engBegin,
      engEnd,
      beginTotal,
      endTotal,
      cost,
      stockDay,
      store,
      nonStore,
    };
  }).filter((r) => r.Mountyear);

  const aliasesLower = plantInfo.stockDayAliases.map((a) => a.toLowerCase().replace(/\s+/g, ''));
  let matchedWarehouse = '';

  const availableWarehouses = Array.from(new Set(cleaned.map((r) => r.warehouse).filter(Boolean)));
  for (const w of availableWarehouses) {
    const wNorm = w.toLowerCase().replace(/\s+/g, '');
    if (aliasesLower.some((alias) => wNorm === alias || wNorm.includes(alias) || alias.includes(wNorm))) {
      matchedWarehouse = w;
      break;
    }
  }

  let history = [];
  let isFallbackAll = false;

  if (matchedWarehouse) {
    history = cleaned
      .filter((r) => r.warehouse === matchedWarehouse)
      .sort((a, b) => parseMonthYearScore(a.Mountyear) - parseMonthYearScore(b.Mountyear));
  } else {
    isFallbackAll = true;
    matchedWarehouse = 'ภาพรวมทุกคลัง';
    const byMonth = new Map();
    cleaned.forEach((r) => {
      const cur = byMonth.get(r.Mountyear) || {
        Mountyear: r.Mountyear,
        warehouse: matchedWarehouse,
        stockBegin: 0,
        stockEnd: 0,
        engBegin: 0,
        engEnd: 0,
        beginTotal: 0,
        endTotal: 0,
        cost: 0,
        store: 0,
        nonStore: 0,
      };
      cur.stockBegin += r.stockBegin;
      cur.stockEnd += r.stockEnd;
      cur.engBegin += r.engBegin;
      cur.engEnd += r.engEnd;
      cur.beginTotal += r.beginTotal;
      cur.endTotal += r.endTotal;
      cur.cost += r.cost;
      cur.store += r.store;
      cur.nonStore += r.nonStore;
      byMonth.set(r.Mountyear, cur);
    });
    history = Array.from(byMonth.values())
      .map((item) => {
        const avgVal = (item.beginTotal + item.endTotal) / 2;
        const stockDay = item.cost > 0 ? Math.round((avgVal / item.cost) * 30) : 0;
        return { ...item, stockDay };
      })
      .sort((a, b) => parseMonthYearScore(a.Mountyear) - parseMonthYearScore(b.Mountyear));
  }

  const latest = history[history.length - 1] || null;
  const prev = history.length > 1 ? history[history.length - 2] : null;

  return {
    warehouseName: matchedWarehouse || plantInfo.plantName,
    isFallbackAll,
    history,
    latest,
    prev,
  };
}

/* ==========================================================================
   3. Gas Cylinder Recharge Data Fetching & Running Balance (Requirement 2)
   ========================================================================== */

function parseTankDateStr(str) {
  if (!str) return '';
  str = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const gvizMatch = str.match(/Date\((\d+),(\d+),(\d+)/);
  if (gvizMatch) {
    const y = gvizMatch[1];
    const m = String(Number(gvizMatch[2]) + 1).padStart(2, '0');
    const d = String(gvizMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Check for "M/D/YYYY H:mm:ss" (Google Sheets US datetime format from Opensheet)
  const usDateTimeMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{1,2}:\d{2}/);
  if (usDateTimeMatch) {
    const p1 = Number(usDateTimeMatch[1]);
    const p2 = Number(usDateTimeMatch[2]);
    const year = usDateTimeMatch[3];
    // US format is M/D/YYYY; if first part > 12, it must be D/M/YYYY
    let month = p1;
    let day = p2;
    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const datePart = str.split(',')[0].split(' ')[0].trim();
  const parts = datePart.split('/');
  if (parts.length === 3 && /^\d{4}$/.test(parts[2])) {
    const p1 = Number(parts[0]);
    const p2 = Number(parts[1]);
    const year = parts[2];
    // Default D/M/YYYY; if second part > 12, it must be M/D/YYYY
    let day = p1;
    let month = p2;
    if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return str;
}

async function fetchJsonWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTankRechargeDashboard() {
  const CACHE_KEY = `tankRechargeDatasetCache_v2_${TANK_SHEET_ID}`;
  const STOCK_CACHE_KEY = 'tankStockCache_v1';

  let dataset = null;
  let stockMap = null;

  try {
    const [tankRows, tankDetailRows, recRows, recDetailRows, stockRows] = await Promise.all([
      fetchJsonWithTimeout(`${TANK_OPENSHEET_BASE}/Tank`, 9000).catch(() => null),
      fetchJsonWithTimeout(`${TANK_OPENSHEET_BASE}/Detail_Tank`, 9000).catch(() => null),
      fetchJsonWithTimeout(`${TANK_OPENSHEET_BASE}/Recripte_Tank`, 9000).catch(() => null),
      fetchJsonWithTimeout(`${TANK_OPENSHEET_BASE}/Recripte_Detail_Tank`, 9000).catch(() => null),
      fetchJsonWithTimeout(TANK_STOCK_URL, 9000).catch(() => null),
    ]);

    if (Array.isArray(tankRows) && Array.isArray(tankDetailRows) && Array.isArray(recRows) && Array.isArray(recDetailRows)) {
      const tankMain = tankRows
        .map((r) => {
          const inv = String(r?.InvDeliveryID ?? r?.invDeliveryID ?? r?.InvoiceID ?? '').trim().toUpperCase();
          if (!inv || inv.toLowerCase() === 'invdeliveryid') return null;
          return { invDeliveryID: inv, date: parseTankDateStr(r?.Date ?? r?.date) };
        })
        .filter(Boolean);

      const validTankIds = new Set(tankMain.map((r) => r.invDeliveryID));
      const tankDetail = tankDetailRows
        .map((r) => {
          const inv = String(r?.InvDeliveryID ?? r?.invDeliveryID ?? r?.InvoiceID ?? '').trim().toUpperCase();
          if (!inv || !validTankIds.has(inv)) return null;
          return {
            invDeliveryID: inv,
            date: parseTankDateStr(r?.Date ?? r?.date),
            product: String(r?.Product ?? r?.product ?? '').trim(),
            qty: toNum(r?.Qty ?? r?.qty),
          };
        })
        .filter(Boolean);

      const recMain = recRows
        .map((r) => {
          const inv = String(r?.InvoiceID ?? r?.invoiceID ?? r?.InvDeliveryID ?? '').trim().toUpperCase();
          if (!inv || inv.toLowerCase() === 'invoiceid') return null;
          return { invDeliveryID: inv, date: parseTankDateStr(r?.Date ?? r?.date) };
        })
        .filter(Boolean);

      const validRecIds = new Set(recMain.map((r) => r.invDeliveryID));
      const recDetail = recDetailRows
        .map((r) => {
          const inv = String(r?.InvoiceID ?? r?.invoiceID ?? r?.InvDeliveryID ?? '').trim().toUpperCase();
          if (!inv || !validRecIds.has(inv)) return null;
          return {
            invDeliveryID: inv,
            date: parseTankDateStr(r?.Date ?? r?.date),
            product: String(r?.Product ?? r?.product ?? '').trim(),
            qty: toNum(r?.Qty ?? r?.qty),
          };
        })
        .filter(Boolean);

      dataset = { tankMain, tankDetail, recMain, recDetail };
    }

    if (Array.isArray(stockRows)) {
      const targets = new Set(Object.values(TANK_MATERIAL_MAP));
      stockMap = {};
      stockRows.forEach((r) => {
        const mat = String(r?.Material || '').trim();
        if (targets.has(mat)) {
          stockMap[mat] = toNum(r?.Unrestricted ?? r?.unrestricted);
        }
      });
      try {
        localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(stockMap));
      } catch {
        // ignore storage quota errors
      }
    }
  } catch (err) {
    console.warn('[HubDashboard] Tank direct fetch fallback:', err);
  }

  // Fallback to localStorage caches shared with tank-recharge app
  if (!dataset) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) dataset = JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  if (!stockMap) {
    try {
      const raw = localStorage.getItem(STOCK_CACHE_KEY);
      if (raw) stockMap = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  if (!dataset) {
    return {
      items: [
        { key: 'N2', label: 'N₂ 1.5Q', fullName: 'ไนโตรเจน 1.5 Q', material: '30011061', pending: 0, stock: null, remain: null, color: '#2dd4bf' },
        { key: 'O2L', label: 'O₂ 1.5Q', fullName: 'ออกซิเจน 1.5 Q', material: '30011063', pending: 0, stock: null, remain: null, color: '#fb7185' },
        { key: 'O2S', label: 'O₂ 0.5Q', fullName: 'ออกซิเจน 0.5 Q', material: '30014237', pending: 0, stock: null, remain: null, color: '#fbbf24' },
      ],
      totalInvoices: 0,
      latestTankDate: '',
      latestRecDate: '',
      totalPending: 0,
    };
  }

  const detailCache = {};
  (dataset.tankDetail || []).forEach((d) => {
    const k = `Tank_${d.invDeliveryID}`;
    if (!detailCache[k]) detailCache[k] = [];
    detailCache[k].push(d);
  });
  (dataset.recDetail || []).forEach((d) => {
    const k = `Recripte_${d.invDeliveryID}`;
    if (!detailCache[k]) detailCache[k] = [];
    detailCache[k].push(d);
  });

  // Build timeline & compute running balance identically to Tank.js
  const summArr = [];
  (dataset.tankMain || []).forEach((t) => {
    summArr.push({ type: 'Tank', date: t.date, rec: t });
  });
  const recByDate = {};
  (dataset.recMain || []).forEach((r) => {
    if (!recByDate[r.date]) recByDate[r.date] = [];
    recByDate[r.date].push(r);
  });
  Object.keys(recByDate).forEach((date) => {
    summArr.push({ type: 'Recripte', date, invoices: recByDate[date] });
  });

  summArr.sort((a, b) => {
    const dateOrder = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateOrder !== 0) return dateOrder;
    if (a.type === b.type) return 0;
    return a.type === 'Tank' ? -1 : 1;
  });

  const products = ['ไนโตรเจน 1.5 Q', 'ออกซิเจน 1.5 Q', 'ออกซิเจน 0.5 Q'];
  const balance = {
    'ไนโตรเจน 1.5 Q': 0,
    'ออกซิเจน 1.5 Q': 0,
    'ออกซิเจน 0.5 Q': 0,
  };

  for (let i = summArr.length - 1; i >= 0; i -= 1) {
    const r = summArr[i];
    if (r.type === 'Tank') {
      const items = detailCache[`Tank_${r.rec.invDeliveryID}`] || [];
      products.forEach((p) => {
        balance[p] += items.filter((it) => it.product === p).reduce((sum, it) => sum + (it.qty || 0), 0);
      });
    } else {
      products.forEach((p) => {
        let recQty = 0;
        for (const inv of r.invoices) {
          const items = detailCache[`Recripte_${inv.invDeliveryID}`] || [];
          recQty += items.filter((it) => it.product === p).reduce((sum, it) => sum + (it.qty || 0), 0);
        }
        balance[p] = Math.max(0, balance[p] - recQty);
      });
    }
  }

  let latestTankDate = '';
  (dataset.tankMain || []).forEach((r) => {
    if (r.date && (!latestTankDate || r.date > latestTankDate)) latestTankDate = r.date;
  });
  let latestRecDate = '';
  (dataset.recMain || []).forEach((r) => {
    if (r.date && (!latestRecDate || r.date > latestRecDate)) latestRecDate = r.date;
  });

  const buildItem = (key, label, fullName, material, color) => {
    const pending = balance[fullName] || 0;
    const stock = stockMap && stockMap[material] !== undefined ? Number(stockMap[material]) : null;
    const remain = stock !== null ? stock - pending : null;
    return { key, label, fullName, material, pending, stock, remain, color };
  };

  const items = [
    buildItem('N2', 'N₂ 1.5Q', 'ไนโตรเจน 1.5 Q', TANK_MATERIAL_MAP.N2, '#2dd4bf'),
    buildItem('O2L', 'O₂ 1.5Q', 'ออกซิเจน 1.5 Q', TANK_MATERIAL_MAP.O2L, '#fb7185'),
    buildItem('O2S', 'O₂ 0.5Q', 'ออกซิเจน 0.5 Q', TANK_MATERIAL_MAP.O2S, '#fbbf24'),
  ];

  const totalPending = items.reduce((s, it) => s + it.pending, 0);

  return {
    items,
    totalInvoices: (dataset.tankMain || []).length,
    latestTankDate,
    latestRecDate,
    totalPending,
  };
}

/* ==========================================================================
   4. Call Sparepart Pending Summary for User's Warehouse (Requirement 3)
   ========================================================================== */

export async function fetchCallDashboardForPlant(plantInfo, forceFresh = false) {
  let rawData = null;

  if (!forceFresh) {
    try {
      const cachedQuick = await loadFromCache('quickData');
      if (cachedQuick?.mainData?.length) {
        rawData = cachedQuick;
      }
    } catch {
      // ignore cache read error
    }
  }

  if (!rawData) {
    try {
      const quick = await fetchQuickData({ fresh: forceFresh });
      if (quick?.mainData?.length) {
        rawData = quick;
        void saveToCache('quickData', quick);
      }
    } catch {
      const full = await fetchAllData({ fresh: forceFresh });
      if (full?.mainData?.length) {
        rawData = full;
      }
    }
  }

  if (!rawData?.mainData?.length) {
    return {
      matchedUnit: plantInfo.callPendingUnit,
      summary: calculateSummary([]),
      topAgingCalls: [],
      avgPendingDays: 0,
      maxPendingDays: 0,
      allStockUnitsCount: 0,
    };
  }

  const processed = processRawData(
    rawData.mainData,
    rawData.requestData || [],
    rawData.poData || [],
    rawData.prData || [],
    rawData.mainSapData || [],
    rawData.vipaData || [],
    rawData.nawaData || [],
    rawData.plantStockData || [],
    rawData.newPartData || [],
    rawData.projectData || [],
    rawData.teamPlantData || [],
    rawData.engData || []
  );

  // Determine available pending units and match user's warehouse
  const unitSet = new Set();
  processed.forEach((r) => {
    const u = String(r['ค้างหน่วยงาน'] || '').trim();
    if (u && u !== 'ไม่ระบุ') unitSet.add(u);
  });

  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const targetNorm = norm(plantInfo.callPendingUnit);
  const plantNameNorm = norm(plantInfo.plantName);

  let matchedUnit = '';
  for (const u of unitSet) {
    const uNorm = norm(u);
    if (uNorm === targetNorm || uNorm === `stock ${plantNameNorm}`) {
      matchedUnit = u;
      break;
    }
  }
  if (!matchedUnit) {
    for (const u of unitSet) {
      const uNorm = norm(u);
      if (uNorm.includes(plantNameNorm) && /stock/i.test(uNorm)) {
        matchedUnit = u;
        break;
      }
    }
  }
  if (!matchedUnit) {
    matchedUnit = plantInfo.callPendingUnit;
  }

  const plantRows = processed.filter((r) => {
    const ticket = String(r['Ticket Number'] || '').trim();
    if (!ticket || ticket === '-') return false;
    return norm(r['ค้างหน่วยงาน']) === norm(matchedUnit);
  });

  const summary = calculateSummary(plantRows);

  // Deduplicate by Ticket Number for top aging calls & average days
  const ticketMap = new Map();
  plantRows.forEach((r) => {
    const ticket = String(r['Ticket Number'] || '').replace(/^'/, '').trim();
    if (!ticket) return;
    const dayRepair = Math.round(parseFloat(r.DayRepair) || 0);
    const existing = ticketMap.get(ticket);
    if (!existing || dayRepair > existing.dayRepair) {
      ticketMap.set(ticket, {
        ticket,
        dayRepair,
        pendingStockDays: Math.round(parseFloat(r.PendingStockDays) || 0),
        company: r.Company || '-',
        storeName: r.Brand || '-',
        material: r.Material || r._rawMaterial || '-',
        description: r.Description || '-',
        statusGroup: r.StatusGroup || r.StatusCall || 'รอของเข้า',
        stockAnswer: r['คลังตอบ'] || 'รอตรวจสอบ',
        team: r.Team || '-',
      });
    }
  });

  const ticketsList = Array.from(ticketMap.values()).sort((a, b) => b.dayRepair - a.dayRepair);
  const totalDays = ticketsList.reduce((s, t) => s + t.dayRepair, 0);
  const avgPendingDays = ticketsList.length > 0 ? Math.round(totalDays / ticketsList.length) : 0;
  const maxPendingDays = ticketsList.length > 0 ? Math.round(ticketsList[0].dayRepair) : 0;

  return {
    matchedUnit,
    summary,
    topAgingCalls: ticketsList.slice(0, 6),
    avgPendingDays,
    maxPendingDays,
    allStockUnitsCount: unitSet.size,
  };
}

/* ==========================================================================
   5. ABC Analysis Data Fetching & Calculations (Requirement 4: 4.1 - 4.7)
   ========================================================================== */

const ABC_DB_NAME = 'ABCSmartOrderingDB';
const ABC_DB_VERSION = 1;
const ABC_STORE_NAME = 'cache';
const ABC_CACHE_PREFIX = 'abc_cache_v2_';
const ABC_SNAPSHOT_PREFIX = 'abc_dash_snapshot_v2_';
const ABC_CACHE_TTL_MS = 15 * 60 * 1000;

// In-memory shared reference cache so switching plants doesn't re-download large shared sheets
const sharedMemoryCache = new Map();

function openAbcDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(ABC_DB_NAME, ABC_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(ABC_STORE_NAME)) {
        db.createObjectStore(ABC_STORE_NAME);
      }
    };
  });
}

async function getAbcCache(key) {
  try {
    const db = await openAbcDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(ABC_STORE_NAME, 'readonly');
      const req = tx.objectStore(ABC_STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setAbcCache(key, data) {
  try {
    const db = await openAbcDB();
    await new Promise((resolve) => {
      const tx = db.transaction(ABC_STORE_NAME, 'readwrite');
      const req = tx.objectStore(ABC_STORE_NAME).put({ ts: Date.now(), data }, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore IDB write error
  }
}

export async function getCachedAbcDashboardSnapshot(plantCode) {
  if (!plantCode) return null;
  const memKey = `${ABC_SNAPSHOT_PREFIX}${plantCode}`;
  if (sharedMemoryCache.has(memKey)) {
    return sharedMemoryCache.get(memKey);
  }
  const entry = await getAbcCache(memKey);
  if (entry?.data) {
    sharedMemoryCache.set(memKey, entry.data);
    return entry.data;
  }
  return null;
}

async function saveAbcDashboardSnapshot(plantCode, snapshot) {
  if (!plantCode || !snapshot) return;
  const memKey = `${ABC_SNAPSHOT_PREFIX}${plantCode}`;
  sharedMemoryCache.set(memKey, snapshot);
  void setAbcCache(memKey, snapshot);
}

async function fetchAbcSource(url, cacheKey, forceRefresh = false, transform = null, useMemory = false) {
  if (!url) return [];
  if (!forceRefresh && useMemory && sharedMemoryCache.has(cacheKey)) {
    return sharedMemoryCache.get(cacheKey);
  }
  const entry = await getAbcCache(cacheKey);
  if (!forceRefresh && entry && entry.data && Date.now() - (entry.ts || 0) < ABC_CACHE_TTL_MS) {
    if (useMemory) sharedMemoryCache.set(cacheKey, entry.data);
    return entry.data;
  }
  try {
    const data = await fetchJsonWithTimeout(url, 18000);
    const processed = transform ? transform(data) : data;
    if (Array.isArray(processed) && processed.length > 0) {
      if (useMemory) sharedMemoryCache.set(cacheKey, processed);
      void setAbcCache(cacheKey, processed);
    }
    return Array.isArray(processed) ? processed : (entry?.data || []);
  } catch (err) {
    if (entry?.data) {
      if (useMemory) sharedMemoryCache.set(cacheKey, entry.data);
      return entry.data;
    }
    console.warn(`[HubDashboard] Failed to fetch ${cacheKey}:`, err);
    return [];
  }
}

function defaultCalculateKeepQty(r) {
  const avg = r.AvgDailyUse || 0;
  if (r.Moving === 'Non Moving' || r.Moving === 'Slowly') return 1;
  if (r.Moving === 'Slow' && r.ABCValue === 'C') return Math.max(1, Math.round(avg * 60));
  if (r.Moving === 'Slow' && r.ABCValue === 'B') return Math.max(1, Math.round(avg * 60));
  if (r.Moving === 'Medium' && r.ABCValue === 'C') return Math.max(2, Math.round(avg * 80));
  if (r.Moving === 'Slow' && r.ABCValue === 'A') return Math.max(3, Math.round(avg * 60));
  if (r.Moving === 'Medium' && r.ABCValue === 'B') return Math.max(4, Math.round(avg * 70));
  if (r.Moving === 'Fast' && r.ABCValue === 'C') return Math.max(5, Math.round(avg * 120));
  if (r.Moving === 'Medium' && r.ABCValue === 'A') return Math.max(6, Math.round(avg * 60));
  if (r.Moving === 'Fast' && r.ABCValue === 'B') return Math.max(8, Math.round(avg * 90));
  if (r.Moving === 'Fast' && r.ABCValue === 'A') return Math.max(10, Math.round(avg * 60));
  return Math.max(1, Math.round(avg * 40));
}

function updateReturnFields(r) {
  const unrestricted = Number(r.Unrestricted || 0);
  let keepQty = Number(defaultCalculateKeepQty(r) || 0);
  const pack = Number(r.MultiplyUnit || 1);
  if (pack > 1 && keepQty > 0) {
    keepQty = Math.ceil(keepQty / pack) * pack;
  }
  const unitPrice = unrestricted > 0 ? Number(r.Value || 0) / unrestricted : 0;
  const returnQty = Math.max(0, unrestricted - keepQty);
  r.ReturnQty = returnQty;
  r.ReturnValue = returnQty * unitPrice;
}

function calcABCValueOnList(list) {
  const sorted = [...list].sort((a, b) => Number(b.Value || 0) - Number(a.Value || 0));
  const total = sorted.reduce((s, r) => s + Number(r.Value || 0), 0);
  let cum = 0;
  const dataMap = new Map();
  list.forEach((r) => dataMap.set(`${r.Plant}-${r.Material}`, r));
  sorted.forEach((r) => {
    cum += Number(r.Value || 0);
    const pct = total ? (cum / total) * 100 : 0;
    const orig = dataMap.get(`${r.Plant}-${r.Material}`);
    if (orig) {
      orig.CumPercent = pct;
      orig.ABCValue = pct <= 70 ? 'A' : pct <= 90 ? 'B' : 'C';
    }
  });
}

function recalculateDefaultPlant(data, selectedPlant, params = { leadTime: 5, safety: 15, cover: 45 }) {
  data.forEach((r) => {
    const leadTime = Number(params.leadTime ?? 5);
    const safetyDays = Number(params.safety ?? 15);
    const coverDays = Number(params.cover ?? 45);
    const qty4m = Number(r.Qty4Month || 0);
    const qty3m = Number(r.Qty3Month || 0);
    const qty2m = Number(r.Qty2Month || 0);
    const qty30d = Number(r.ThirtyDay || 0);
    const unrestricted = Number(r.Unrestricted || 0);
    const mul = Number(r.MultiplyUnit || 1);

    const avg4mDaily = qty4m / 120;
    const avg3mDaily = qty3m / 90;
    const avg2mDaily = qty2m / 60;
    const avg30dDaily = qty30d / 30;
    const has3m = qty3m > 0;
    const baseAvgMonthly = has3m ? qty3m / 3 : qty4m / 4;
    const baseAvgDaily = baseAvgMonthly / 30;

    if (baseAvgMonthly === 0) r.Moving = 'Non Moving';
    else if (baseAvgMonthly < 0.7) r.Moving = 'Slowly';
    else if (baseAvgMonthly < 12) r.Moving = 'Slow';
    else if (baseAvgMonthly < 30) r.Moving = 'Medium';
    else r.Moving = 'Fast';

    r.AvgMonthly = baseAvgMonthly;

    let w4m = 0.70, w3m = 0, w2m = 0.20, w30 = 0.10;
    if (has3m) {
      if (r.Moving === 'Fast') { w4m = 0.30; w3m = 0.30; w2m = 0.20; w30 = 0.20; }
      else if (r.Moving === 'Medium') { w4m = 0.40; w3m = 0.25; w2m = 0.20; w30 = 0.15; }
      else if (r.Moving === 'Slow') { w4m = 0.55; w3m = 0.20; w2m = 0.15; w30 = 0.10; }
      else { w4m = 0.65; w3m = 0.15; w2m = 0.10; w30 = 0.10; }
    } else {
      if (r.Moving === 'Fast') { w4m = 0.40; w2m = 0.30; w30 = 0.30; }
      if (r.Moving === 'Medium') { w4m = 0.50; w2m = 0.30; w30 = 0.20; }
      if (r.Moving === 'Slow') { w4m = 0.65; w2m = 0.25; w30 = 0.10; }
      if (r.Moving === 'Slowly' || r.Moving === 'Non Moving') { w4m = 0.75; w2m = 0.20; w30 = 0.05; }
    }

    if (r.ABCValue === 'A') { w4m -= 0.05; w30 += 0.05; }
    if (r.ABCValue === 'C') { w4m += 0.05; w30 -= 0.05; }

    w4m = Math.max(0.05, Math.min(0.95, w4m));
    w30 = Math.max(0.05, Math.min(0.95, w30));
    w2m = Math.max(0.05, Math.min(0.90, w2m));
    w3m = Math.max(0, w3m);
    const wSum = w4m + w3m + w2m + w30;
    w4m /= wSum; w3m /= wSum; w2m /= wSum; w30 /= wSum;

    const guardBase = baseAvgDaily || avg4mDaily;
    let guarded2mDaily = avg2mDaily;
    let guarded3mDaily = avg3mDaily;
    let guarded30dDaily = avg30dDaily;
    if (guardBase > 0 && avg30dDaily > guardBase * 3) guarded30dDaily = guardBase * 3;
    if (guardBase > 0 && avg2mDaily > guardBase * 2.5) guarded2mDaily = guardBase * 2.5;
    if (has3m && guardBase > 0 && avg3mDaily > guardBase * 2) guarded3mDaily = guardBase * 2;

    if (guardBase > 0) {
      const ratio = avg30dDaily / guardBase;
      if (ratio >= 1.8) {
        const boost = Math.min(0.20, (ratio - 1.8) * 0.10);
        w30 = Math.min(0.95, w30 + boost);
        w4m = 1 - w30;
      }
    }

    let meanDaily = avg4mDaily * w4m + guarded3mDaily * w3m + guarded2mDaily * w2m + guarded30dDaily * w30;
    if (baseAvgDaily > 0 && avg30dDaily === 0) meanDaily *= 0.7;
    if (baseAvgDaily === 0 && avg30dDaily > 0) meanDaily = Math.max(meanDaily, guarded30dDaily * 0.8);
    if (!Number.isFinite(meanDaily) || meanDaily < 0) meanDaily = 0;

    let safetyDaysFinal = safetyDays;
    const status = String(r.Status || '').trim();
    const allowSafetyBoost = selectedPlant !== '0326' || status === 'นวนคร';
    if (allowSafetyBoost) {
      if (r.Moving === 'Medium') safetyDaysFinal += 1;
      else if (r.Moving === 'Slow') safetyDaysFinal += 2;
      else if (r.Moving === 'Slowly') safetyDaysFinal += 4;
    }

    let adjustedCoverDays = coverDays;
    if (selectedPlant === '0326') {
      const isCompressor = String(r.PartType || '').trim() === 'คอมเพรสเซอร์';
      if (!isCompressor) {
        if (r.Moving === 'Medium') adjustedCoverDays += 10;
        else if (r.Moving === 'Slow') adjustedCoverDays += 15;
        else if (r.Moving === 'Slowly') adjustedCoverDays += 20;
      }
    } else {
      if (r.Moving === 'Medium') adjustedCoverDays += 10;
      else if (r.Moving === 'Slow') adjustedCoverDays += 15;
      else if (r.Moving === 'Slowly') adjustedCoverDays += 20;
    }

    r.AvgDailyUse = meanDaily;
    r.Mean = meanDaily * 30;
    const safetyStock = meanDaily * safetyDaysFinal;
    const rop = meanDaily * leadTime + safetyStock;
    r.SafetyStock = safetyStock;
    r.ROP = rop;

    if (has3m && qty3m === 1 && qty30d === 1) {
      r.RecommendedOrder = 0;
      r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
      updateReturnFields(r);
      return;
    }

    if (r.Moving === 'Slow' || r.Moving === 'Slowly') {
      if (meanDaily === 0 || qty30d === 0 || (r.Moving === 'Slowly' && qty30d >= qty4m)) {
        r.RecommendedOrder = 0;
        r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
        updateReturnFields(r);
        return;
      }
    }

    if (unrestricted < rop) {
      let need = Math.max(0, meanDaily * adjustedCoverDays - unrestricted);
      const pack = Number(mul) > 0 ? Number(mul) : 1;
      let packs = Math.floor(need / pack);
      if (need > 0 && packs === 0) packs = 1;
      r.RecommendedOrder = packs * pack;
    } else {
      r.RecommendedOrder = 0;
    }
    r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
    updateReturnFields(r);
  });
}

function recalculate0301(data, params = { leadTime: 5 }) {
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  data.forEach((r) => {
    const rawLT = Number(r.LeadTimeDays != null ? r.LeadTimeDays : (params.leadTime ?? 5));
    let leadTime = rawLT;
    let safetyDays;
    let coverDays;

    const qty4m = Number(r.Qty4Month || 0);
    const qty3m = Number(r.Qty3Month || 0);
    const qty2m = Number(r.Qty2Month || 0);
    const qty30d = Number(r.ThirtyDay || 0);
    const unrestricted = Number(r.Unrestricted || 0);
    const mul = Number(r.MultiplyUnit || 1);
    const prOutstanding = Number(r.PrOutstanding || 0);
    const poOutstanding = Number(r.PoOutstanding || 0);

    const avg4mDaily = qty4m / 120;
    const avg3mDaily = qty3m / 90;
    const avg2mDaily = qty2m / 60;
    const avg30dDaily = qty30d / 30;
    const has3m = qty3m > 0;
    const baseAvgMonthly = has3m ? qty3m / 3 : qty4m / 4;
    const baseAvgDaily = baseAvgMonthly / 30;

    if (baseAvgMonthly === 0) r.Moving = 'Non Moving';
    else if (baseAvgMonthly < 0.7) r.Moving = 'Slowly';
    else if (baseAvgMonthly < 12) r.Moving = 'Slow';
    else if (baseAvgMonthly < 30) r.Moving = 'Medium';
    else r.Moving = 'Fast';

    r.AvgMonthly = baseAvgMonthly;

    if (rawLT >= 3 && rawLT <= 6) {
      safetyDays = 4;
      coverDays = 35;
    } else if (rawLT >= 7 && rawLT <= 13) {
      safetyDays = 5;
      coverDays = 40;
    } else if (rawLT >= 14 && rawLT <= 30) {
      safetyDays = 5;
      coverDays = 45;
    } else {
      leadTime = clamp(rawLT, 7, 365);
      safetyDays = clamp(Math.ceil(leadTime * 0.3), 2, 30);
      if (r.Moving === 'Fast' || r.Moving === 'Medium') {
        coverDays = clamp(leadTime + safetyDays + 15, 30, 140);
      } else if (r.Moving === 'Slow') {
        coverDays = clamp(leadTime * 0.6 + safetyDays, 20, 90);
      } else {
        coverDays = clamp(leadTime * 0.4 + safetyDays, 10, 60);
      }
    }

    let w4m = 0.70, w3m = 0, w2m = 0.20, w30 = 0.10;
    if (has3m) {
      if (r.Moving === 'Fast') { w4m = 0.30; w3m = 0.25; w2m = 0.20; w30 = 0.25; }
      else if (r.Moving === 'Medium') { w4m = 0.35; w3m = 0.25; w2m = 0.20; w30 = 0.20; }
      else if (r.Moving === 'Slow') { w4m = 0.50; w3m = 0.20; w2m = 0.20; w30 = 0.10; }
      else { w4m = 0.60; w3m = 0.20; w2m = 0.15; w30 = 0.05; }
    } else {
      if (r.Moving === 'Fast') { w4m = 0.40; w2m = 0.30; w30 = 0.30; }
      if (r.Moving === 'Medium') { w4m = 0.50; w2m = 0.30; w30 = 0.20; }
      if (r.Moving === 'Slow') { w4m = 0.65; w2m = 0.25; w30 = 0.10; }
      if (r.Moving === 'Slowly' || r.Moving === 'Non Moving') { w4m = 0.75; w2m = 0.20; w30 = 0.05; }
    }

    if (r.ABCValue === 'A') { w4m -= 0.05; w30 += 0.05; }
    if (r.ABCValue === 'C') { w4m += 0.05; w30 -= 0.05; }

    w4m = Math.max(0.05, Math.min(0.95, w4m));
    w30 = Math.max(0.05, Math.min(0.95, w30));
    w2m = Math.max(0.05, Math.min(0.90, w2m));
    w3m = Math.max(0, w3m);
    const wSum = w4m + w3m + w2m + w30;
    w4m /= wSum; w3m /= wSum; w2m /= wSum; w30 /= wSum;

    const guardBase = baseAvgDaily || avg4mDaily;
    let guarded2mDaily = avg2mDaily;
    let guarded3mDaily = avg3mDaily;
    let guarded30dDaily = avg30dDaily;
    if (guardBase > 0 && avg30dDaily > guardBase * 3) guarded30dDaily = guardBase * 3;
    if (guardBase > 0 && avg2mDaily > guardBase * 2.5) guarded2mDaily = guardBase * 2.5;
    if (has3m && guardBase > 0 && avg3mDaily > guardBase * 2) guarded3mDaily = guardBase * 2;

    if (guardBase > 0) {
      const ratio = avg30dDaily / guardBase;
      if (ratio >= 1.8) {
        const boost = Math.min(0.20, (ratio - 1.8) * 0.10);
        w30 = Math.min(0.95, w30 + boost);
        w4m = 1 - w30;
      }
    }

    let meanDaily = avg4mDaily * w4m + guarded3mDaily * w3m + guarded2mDaily * w2m + guarded30dDaily * w30;
    if (baseAvgDaily > 0 && avg30dDaily === 0) meanDaily *= 0.7;
    if (baseAvgDaily === 0 && avg30dDaily > 0) meanDaily = Math.max(meanDaily, guarded30dDaily * 0.8);
    if (!Number.isFinite(meanDaily) || meanDaily < 0) meanDaily = 0;

    r.AvgDailyUse = meanDaily;
    r.Mean = meanDaily * 30;
    r.SafetyDayUsed = safetyDays;
    r.CoverDayUsed = coverDays;
    r.SafetyStock = meanDaily * safetyDays;
    r.ROP = meanDaily * leadTime + r.SafetyStock;

    if (r.Moving === 'Slow' || r.Moving === 'Slowly') {
      if (meanDaily === 0 || qty30d === 0 || (r.Moving === 'Slowly' && qty30d >= qty4m) || (has3m && qty3m === 0 && qty30d === 0)) {
        r.RecommendedOrder = 0;
        r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
        updateReturnFields(r);
        return;
      }
    }

    const netStock = unrestricted + poOutstanding + prOutstanding;
    if (netStock < r.ROP) {
      let need = Math.max(0, meanDaily * coverDays - netStock);
      const pack = Number(mul) > 0 ? Number(mul) : 1;
      let packs = Math.floor(need / pack);
      if (need > 0 && packs === 0) packs = 1;
      r.RecommendedOrder = packs * pack;
    } else {
      r.RecommendedOrder = 0;
    }
    r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
    updateReturnFields(r);
  });
}

function recalculate0326(data, params = { leadTime: 5, safety: 15, cover: 45 }) {
  recalculateDefaultPlant(data, '0326', params);
  const installRows = data.filter((r) => String(r.Status || '').trim() === 'ติดตั้ง');
  if (installRows.length > 0) {
    const poBackup = installRows.map((r) => ({ row: r, value: r.PoOutstanding }));
    installRows.forEach((r) => {
      r.PoOutstanding = (r.PoOutstandingDisplay != null ? r.PoOutstandingDisplay : r.PoOutstanding) || 0;
    });
    recalculate0301(installRows, params);
    poBackup.forEach((item) => {
      item.row.PoOutstanding = item.value;
    });
    installRows.forEach((r) => {
      const rawLT = Number(r.LeadTimeDays || 0);
      let updated = false;
      if (rawLT === 0) {
        r.SafetyDayUsed = 17; r.CoverDayUsed = 45; updated = true;
      } else if (rawLT >= 3 && rawLT <= 6) {
        r.SafetyDayUsed = 14; r.CoverDayUsed = 45; updated = true;
      } else if (rawLT >= 7 && rawLT <= 30) {
        r.SafetyDayUsed = 10; r.CoverDayUsed = 45; updated = true;
      }
      if (updated) {
        const meanDaily = Number(r.AvgDailyUse || 0);
        r.SafetyStock = meanDaily * r.SafetyDayUsed;
        const effectiveLT = rawLT > 0 ? rawLT : Number(params.leadTime ?? 5);
        r.ROP = meanDaily * effectiveLT + r.SafetyStock;
        const unrestricted = Number(r.Unrestricted || 0);
        const prOutstanding = Number(r.PrOutstanding || 0);
        const poOutstanding = Number((r.PoOutstandingDisplay != null ? r.PoOutstandingDisplay : r.PoOutstanding) || 0);
        const netStock = unrestricted + poOutstanding + prOutstanding;
        const mul = Number(r.MultiplyUnit || 1) || 1;
        if (netStock < r.ROP) {
          let need = Math.max(0, meanDaily * r.CoverDayUsed - netStock);
          let packs = Math.floor(need / mul);
          if (need > 0 && packs === 0) packs = 1;
          r.RecommendedOrder = packs * mul;
        } else {
          r.RecommendedOrder = 0;
        }
      }
    });
  }

  data.forEach((r) => {
    const status = String(r.Status || '').trim();
    if (!(status === 'ติดตั้งเรียกเข้า' || status === 'เรียกเข้า')) return;
    const meanDaily = Number(r.AvgDailyUse || 0);
    const unrestricted = Number(r.Unrestricted || 0);
    const pack = Number(r.MultiplyUnit || 1) || 1;
    const dos = Number(r.DOS || 0);
    if (!Number.isFinite(meanDaily) || meanDaily <= 0) {
      r.RecommendedOrder = 0;
      return;
    }
    if (dos < 7) {
      r.CoverDayUsed = 15;
      let need = Math.max(0, meanDaily * 15 - unrestricted);
      let packs = Math.floor(need / pack);
      if (need > 0 && packs === 0) packs = 1;
      r.RecommendedOrder = packs * pack;
    } else {
      r.RecommendedOrder = 0;
    }
  });
}

export async function fetchAbcDashboardForPlant(plantInfo, forceRefresh = false) {
  const selectedPlant = plantInfo.plantCode;
  const invUrl = ABC_INVENTORY_URLS[selectedPlant];

  if (!invUrl) {
    return {
      plantCode: selectedPlant,
      plantName: plantInfo.plantName,
      hasData: false,
      metrics: null,
      lists: { installOrder: [], installCallOrder: [], callOrder: [], allOrder: [], shortageFastMed: [], unupdatedLocation: [] },
    };
  }

  const is0301 = selectedPlant === '0301';
  const is0326 = selectedPlant === '0326';

  const normalizePlant = (val) => {
    const raw = String(val || '').trim();
    if (!raw) return '';
    const num = parseFloat(raw.replace(/,/g, ''));
    if (Number.isFinite(num)) return Math.round(num).toString().padStart(4, '0');
    const digits = raw.replace(/\D/g, '');
    return digits ? digits.padStart(4, '0') : raw;
  };

  const filterUsageByPlant = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => normalizePlant(r?.Plant || r?.plant) === selectedPlant);
  };

  const compactAvgVal = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        const keys = Object.keys(row || {});
        const matKey = keys.find((k) => k.toLowerCase() === 'material');
        const avgKey = keys.find((k) => ['avgval', 'avg_val'].includes(k.toLowerCase()));
        return {
          Material: matKey ? String(row[matKey] ?? '').trim() : '',
          AvgVal: avgKey ? row[avgKey] : 0,
        };
      })
      .filter((r) => r.Material);
  };

  const [
    invRaw,
    usageRaw,
    mainsapRaw,
    avgValRaw,
    statusRaw,
    locationRaw,
    statusGasRaw,
    poDataRaw,
    prDataRaw,
    noteDataRaw,
    poSupplierRaw,
  ] = await Promise.all([
    fetchAbcSource(invUrl, `${ABC_CACHE_PREFIX}inv_${selectedPlant}`, forceRefresh, null, true),
    fetchAbcSource(ABC_SHARED_URLS.usageUrl, `${ABC_CACHE_PREFIX}usage_${selectedPlant}`, forceRefresh, filterUsageByPlant, true),
    fetchAbcSource(ABC_SHARED_URLS.mainsapUrl, `${ABC_CACHE_PREFIX}mainsap`, forceRefresh, null, true),
    fetchAbcSource(ABC_SHARED_URLS.avgValUrl, `${ABC_CACHE_PREFIX}avgval_compact_v1`, forceRefresh, compactAvgVal, true),
    fetchAbcSource(ABC_SHARED_URLS.statusUrl, `${ABC_CACHE_PREFIX}status`, forceRefresh, null, true),
    fetchAbcSource(ABC_SHARED_URLS.locationUrl, `${ABC_CACHE_PREFIX}location`, forceRefresh, null, true),
    !is0301 && !is0326
      ? fetchAbcSource(ABC_SHARED_URLS.statusReadUrl, `${ABC_CACHE_PREFIX}status_read`, forceRefresh, null, true)
      : Promise.resolve([]),
    is0301
      ? fetchAbcSource(ABC_SHARED_URLS.po0301Url, `${ABC_CACHE_PREFIX}po_0301`, forceRefresh, null, true)
      : is0326
      ? fetchAbcSource(ABC_SHARED_URLS.po0326Url, `${ABC_CACHE_PREFIX}po_0326`, forceRefresh, null, true)
      : Promise.resolve([]),
    is0301
      ? fetchAbcSource(ABC_SHARED_URLS.pr0301Url, `${ABC_CACHE_PREFIX}pr_0301`, forceRefresh, null, true)
      : is0326
      ? fetchAbcSource(ABC_SHARED_URLS.pr0326Url, `${ABC_CACHE_PREFIX}pr_0326`, forceRefresh, null, true)
      : Promise.resolve([]),
    is0301
      ? fetchAbcSource(ABC_SHARED_URLS.note0301Url, `${ABC_CACHE_PREFIX}note_all`, forceRefresh, null, true)
      : Promise.resolve([]),
    is0326
      ? fetchAbcSource(ABC_SHARED_URLS.poSupplierDataUrl, `${ABC_CACHE_PREFIX}po_supplier`, forceRefresh, null, true)
      : Promise.resolve([]),
  ]);

  if (!Array.isArray(invRaw) || invRaw.length === 0) {
    return {
      plantCode: selectedPlant,
      plantName: plantInfo.plantName,
      hasData: false,
      metrics: null,
      lists: { installOrder: [], installCallOrder: [], callOrder: [], allOrder: [], shortageFastMed: [], unupdatedLocation: [] },
    };
  }

  const normalizeMatStatus = (val) => {
    let s = String(val || '').trim();
    if (s.startsWith("'")) s = s.slice(1);
    return s.replace(/^0+/, '') || s;
  };

  const extractPlannedDelivTime = (row) =>
    toNum(
      row?.['Planned Deliv. Time'] ||
        row?.['Planned Deliv Time'] ||
        row?.['PlannedDelivTime'] ||
        row?.['Planned Delivery Time'] ||
        row?.['PlannedDeliveryTime'] ||
        row?.['PlannedDeliv'] ||
        0
    );

  const statusGasMap = new Map();
  (statusGasRaw || []).forEach((r) => {
    const p = normalizePlant(r?.Plant || r?.plant);
    const m = normalizeMatStatus(r?.Material || r?.material);
    const s = String(r?.Status || r?.status || '').trim();
    if (p && m) statusGasMap.set(`${p}-${m}`, s);
  });

  const navanakornMap = new Map();
  const lt0301Map = new Map();
  (locationRaw || []).forEach((r) => {
    const mat = String(r?.Material || '').trim();
    if (!mat) return;
    navanakornMap.set(mat, toNum(r?.Unrestricted));
    const lt = extractPlannedDelivTime(r);
    if (lt) lt0301Map.set(mat, lt);
  });

  const statusMap = new Map();
  (statusRaw || []).forEach((r) => {
    const plant = String(r?.Plant || '').trim();
    const material = String(r?.Material || '').trim();
    if (!plant || !material) return;
    const keys = Object.keys(r);
    const sk =
      keys.find(
        (k) =>
          k.toLowerCase().includes('statusmaterial') ||
          k.toLowerCase().includes('status material') ||
          k.includes('สถานะวัสดุ')
      ) || keys.find((k) => k.toLowerCase().includes('status'));
    const status = sk ? String(r[sk] || '').trim() : '';
    if (status) statusMap.set(`${plant}-${material}`, status);
  });

  const avgValMap = new Map();
  (avgValRaw || []).forEach((r) => {
    const mat = String(r?.Material || '').trim();
    if (mat) avgValMap.set(mat, toNum(r?.AvgVal ?? r?.AvgVAL ?? r?.avgval));
  });

  const usageMap = new Map();
  (usageRaw || []).forEach((r) => {
    const plant = String(r?.Plant || '').trim();
    const material = String(r?.Material || '').trim();
    if (!plant || !material) return;
    const keys = Object.keys(r);
    const k2 = keys.find((k) => /2m|2 month|2mount/i.test(k));
    const k3 = keys.find((k) => /3m|3 month|3mount/i.test(k));
    const k4 = keys.find((k) => /4m|4 month|qtyissu/i.test(k));
    const k6 = keys.find((k) => /6m|6 month/i.test(k));
    const k30 = keys.find((k) => /30day|30 day|30/i.test(k));
    const qty4m = k4 ? toNum(r[k4]) : 0;
    const qty6m = k6 ? toNum(r[k6]) : Math.round(qty4m * 1.5);
    usageMap.set(`${plant}-${material}`, {
      Qty2Month: k2 ? toNum(r[k2]) : 0,
      Qty3Month: k3 ? toNum(r[k3]) : 0,
      Qty4Month: qty4m,
      Qty6Month: qty6m,
      ThirtyDay: k30 ? toNum(r[k30]) : 0,
    });
  });

  const mainsapMap = new Map();
  (mainsapRaw || []).forEach((r) => {
    const mat = String(r?.Material || '').trim();
    if (!mat) return;
    mainsapMap.set(mat, {
      MultiplyUnit: r?.['คูณหน่วย'] ? toNum(r['คูณหน่วย']) || 1 : 1,
      Product: r?.Product || '',
      PartType: r?.['ประเภทอะไหล่'] || '',
      UnitPo: toNum(r?.UnitPo || r?.['Unit PO'] || r?.UnitPO || 1) || 1,
    });
  });

  const noteMap = new Map();
  (noteDataRaw || []).forEach((r) => {
    const mat = String(r?.Material || r?.['Material code'] || r?.['Material Code'] || '').trim();
    if (!mat) return;
    noteMap.set(mat, {
      activeFlag: String(r?.Acitive || r?.Active || '').trim(),
    });
  });

  const normalizeMaterialKey = (val) => {
    const raw = String(val || '').trim();
    if (!raw || !is0326) return raw;
    const digits = raw.replace(/\D/g, '');
    if (digits) return digits.replace(/^0+/, '') || '0';
    return raw;
  };

  const timestampedPoSet = new Set();
  if (is0326 && Array.isArray(poSupplierRaw)) {
    poSupplierRaw.forEach((r) => {
      const po = String(r?.PO || r?.Po || r?.po || '').trim();
      if (po) timestampedPoSet.add(po);
    });
  }

  const poMap = new Map();
  if ((is0301 || is0326) && Array.isArray(poDataRaw)) {
    const populatePo = (filterByPlant) => {
      poDataRaw.forEach((r) => {
        const plantVal = normalizePlant(r?.Plant || r?.plant);
        if (filterByPlant && plantVal && plantVal !== selectedPlant) return;
        const keys = Object.keys(r || {});
        if (is0326 && plantVal === '0326') {
          const slocKey = keys.find((k) => {
            const low = k.toLowerCase();
            return (low.includes('storage') && low.includes('location')) || low === 'sloc' || low === 'lgort';
          });
          if (slocKey && String(r[slocKey] || '').trim() !== 'M001') return;
        }
        const matKey = keys.find((k) => k.toLowerCase().includes('material'));
        const material = matKey ? String(r[matKey] || '').trim() : '';
        if (!material) return;
        const stillKey = keys.find((k) => {
          const low = k.toLowerCase();
          return (low.includes('still') && low.includes('deliver')) || (low.includes('open') && low.includes('qty')) || low.includes('ค้างส่ง');
        });
        const stillQty = stillKey ? toNum(r[stillKey]) : 0;
        const poNum = String(r?.['Purchase order'] || r?.['Purchase Order'] || r?.PO || r?.['Purchasing Document'] || '').trim();
        if (is0326 && timestampedPoSet.has(poNum)) return;
        const mKey = normalizeMaterialKey(material);
        poMap.set(mKey, (poMap.get(mKey) || 0) + stillQty);
      });
    };
    populatePo(true);
    if (is0326 && poMap.size === 0) populatePo(false);
  }

  const prMap = new Map();
  if ((is0301 || is0326) && Array.isArray(prDataRaw)) {
    const populatePr = (filterByPlant) => {
      prDataRaw.forEach((r) => {
        const plantVal = normalizePlant(r?.Plant || r?.plant);
        if (filterByPlant && plantVal && plantVal !== selectedPlant) return;
        const keys = Object.keys(r || {});
        if (is0326 && plantVal === '0326') {
          const slocKey = keys.find((k) => {
            const low = k.toLowerCase();
            return (low.includes('storage') && low.includes('location')) || low === 'sloc' || low === 'lgort';
          });
          if (slocKey && String(r[slocKey] || '').trim() !== 'M001') return;
        }
        const matKey = keys.find((k) => k.toLowerCase().includes('material'));
        const material = matKey ? String(r[matKey] || '').trim() : '';
        if (!material) return;
        const reqKey = keys.find((k) => /quantity|qty/i.test(k) && /requested|request|req/i.test(k));
        const ordKey = keys.find((k) => /quantity|qty/i.test(k) && /ordered|order/i.test(k));
        const diff = (reqKey ? toNum(r[reqKey]) : 0) - (ordKey ? toNum(r[ordKey]) : 0);
        const mKey = normalizeMaterialKey(material);
        prMap.set(mKey, (prMap.get(mKey) || 0) + diff);
      });
    };
    populatePr(true);
    if (is0326 && prMap.size === 0) populatePr(false);
  }

  const allData = [];
  invRaw.forEach((r) => {
    const plant = String(r?.Plant || '').trim();
    const material = String(r?.Material || '').trim();
    if (plant !== selectedPlant || !material) return;

    const key = `${plant}-${material}`;
    const usageInfo = usageMap.get(key) || { Qty2Month: 0, Qty3Month: 0, Qty4Month: 0, Qty6Month: 0, ThirtyDay: 0 };
    const main = mainsapMap.get(material) || { MultiplyUnit: 1, Product: '', PartType: '', UnitPo: 1 };
    let status = statusMap.get(key) || '';
    if (!is0301 && !is0326) {
      const gasStatus = statusGasMap.get(`${normalizePlant(plant)}-${normalizeMatStatus(material)}`);
      if (gasStatus) status = gasStatus;
      if (!status) status = 'Active';
    }
    const noteOverride = noteMap.get(material);
    if (is0301 && noteOverride && noteOverride.activeFlag) {
      status = noteOverride.activeFlag.toUpperCase() === 'Y' ? 'Active' : 'Inactive';
    }

    const unrestricted = toNum(r?.Unrestricted ?? r?.['Unrestricted stock']);
    const originalValue = toNum(r?.['Value Unrestricted'] ?? r?.['Value unrestricted']);
    const avgVal = avgValMap.get(material) || 0;
    const value = avgVal > 0 ? unrestricted * avgVal : originalValue;

    const keys = Object.keys(r);
    const sk =
      keys.find((k) => k.toLowerCase().includes('storage') && k.toLowerCase().includes('bin')) ||
      keys.find((k) => k.toLowerCase().includes('storagebin')) ||
      keys.find((k) => k.toLowerCase().includes('bin'));
    const storageBin = sk ? String(r[sk] || '').trim() : '';

    let plannedDelivTime = extractPlannedDelivTime(r);
    if (is0326 && (!plannedDelivTime || plannedDelivTime === 0)) {
      plannedDelivTime = lt0301Map.get(material) || 0;
    }

    const mKey = normalizeMaterialKey(material);
    const poOutstanding = poMap.get(mKey) || 0;
    const poOutstandingDisplay = poOutstanding * (Number(main.UnitPo || 1) || 1);
    const prOutstanding = prMap.get(mKey) || 0;

    allData.push({
      Plant: plant,
      Material: material,
      Description: String(r?.['Material description'] || '').trim(),
      StorageBin: storageBin,
      Unit: String(r?.['Base Unit of Measure'] || '').trim(),
      Navanakorn: navanakornMap.get(material) || 0,
      Unrestricted: unrestricted,
      Value: value,
      Qty6Month: usageInfo.Qty6Month,
      Qty4Month: usageInfo.Qty4Month,
      Qty3Month: usageInfo.Qty3Month,
      Qty2Month: usageInfo.Qty2Month,
      ThirtyDay: usageInfo.ThirtyDay,
      AvgDailyUse: usageInfo.Qty4Month / 120 || 0,
      AvgMonthly: usageInfo.Qty4Month / 4 || 0,
      SafetyStock: 0,
      ROP: 0,
      DOS: 0,
      RecommendedOrder: 0,
      Mean: 0,
      ABCValue: '',
      CumPercent: 0,
      Moving: '',
      ReturnQty: 0,
      ReturnValue: 0,
      MultiplyUnit: main.MultiplyUnit,
      Product: main.Product,
      PartType: main.PartType,
      Status: status,
      LeadTimeDays: plannedDelivTime,
      PoOutstanding: poOutstanding,
      PoOutstandingDisplay: poOutstandingDisplay,
      PrOutstanding: prOutstanding,
    });
  });

  // Match ui.js applyFiltersAndRender pipeline exactly:
  calcABCValueOnList(allData);
  const baseData = allData.filter((r) => Number(r.Unrestricted || 0) > 0 || Number(r.Qty6Month || 0) > 0);

  const defaultParams = { leadTime: 5, safety: 15, cover: 45 };
  if (is0301) {
    recalculate0301(baseData, defaultParams);
  } else if (is0326) {
    recalculate0326(baseData, defaultParams);
  } else {
    recalculateDefaultPlant(baseData, selectedPlant, defaultParams);
  }
  calcABCValueOnList(baseData);

  // Enrich each row with UnitPrice and OrderValue
  baseData.forEach((r) => {
    const unitPrice = r.Unrestricted > 0 ? r.Value / r.Unrestricted : (avgValMap.get(r.Material) || 0);
    r.UnitPrice = unitPrice;
    r.OrderValue = Math.round(r.RecommendedOrder || 0) * unitPrice;
  });

  // 4.1 Status = ติดตั้ง & RecommendedOrder > 0
  const installOrder = baseData
    .filter((r) => String(r.Status || '').trim() === 'ติดตั้ง' && Math.round(r.RecommendedOrder || 0) > 0)
    .sort((a, b) => b.OrderValue - a.OrderValue || b.RecommendedOrder - a.RecommendedOrder);

  // 4.2 Status = ติดตั้งเรียกเข้า & RecommendedOrder > 0
  const installCallOrder = baseData
    .filter((r) => String(r.Status || '').trim() === 'ติดตั้งเรียกเข้า' && Math.round(r.RecommendedOrder || 0) > 0)
    .sort((a, b) => b.OrderValue - a.OrderValue || b.RecommendedOrder - a.RecommendedOrder);

  // 4.3 Status = เรียกเข้า & RecommendedOrder > 0
  const callOrder = baseData
    .filter((r) => String(r.Status || '').trim() === 'เรียกเข้า' && Math.round(r.RecommendedOrder || 0) > 0)
    .sort((a, b) => b.OrderValue - a.OrderValue || b.RecommendedOrder - a.RecommendedOrder);

  // All RecommendedOrder > 0
  const allOrder = baseData
    .filter((r) => Math.round(r.RecommendedOrder || 0) > 0)
    .sort((a, b) => b.OrderValue - a.OrderValue || b.RecommendedOrder - a.RecommendedOrder);

  // 4.6 ของขาด: คงเหลือ = 0 & Status = นวนคร & Moving in (Fast, Medium)
  const shortageFastMed = baseData
    .filter((r) => {
      const stock = Number(r.Unrestricted || 0);
      const status = String(r.Status || '').trim();
      const mov = String(r.Moving || '').trim();
      return stock === 0 && status === 'นวนคร' && (mov === 'Fast' || mov === 'Medium');
    })
    .sort((a, b) => (b.AvgMonthly || 0) - (a.AvgMonthly || 0));

  const shortageWithNawaStock = shortageFastMed.filter((r) => Number(r.Navanakorn || 0) > 0).length;
  const shortageWaitNawa = shortageFastMed.length - shortageWithNawaStock;

  // 4.7 ยังไม่อัพเดต Location: คงเหลือ > 0 & (StorageBin ว่าง หรือ A00-0-0)
  const isUnupdatedBin = (bin) => {
    const clean = String(bin ?? '').trim().toUpperCase();
    return clean === '' || clean === 'A00-0-0';
  };
  const unupdatedLocation = baseData
    .filter((r) => Number(r.Unrestricted || 0) > 0 && isUnupdatedBin(r.StorageBin))
    .sort((a, b) => (b.Value || 0) - (a.Value || 0));

  // OverStock Returnable list (ReturnQty > 0) sorted by ReturnValue desc
  const overstockReturn = baseData
    .filter((r) => Number(r.ReturnQty || 0) > 0)
    .sort((a, b) => (b.ReturnValue || 0) - (a.ReturnValue || 0));

  // 4.4 & 4.5 Total Stock Value & Stock Days
  let totalStockValue = 0;
  let totalReturnValue = 0;
  let returnCount = 0;
  let totalUsage4mValue = 0;

  const abcCounts = { A: 0, B: 0, C: 0 };
  const abcValues = { A: 0, B: 0, C: 0 };
  const movingCounts = { Fast: 0, Medium: 0, Slow: 0, Slowly: 0, 'Non Moving': 0 };
  const movingValues = { Fast: 0, Medium: 0, Slow: 0, Slowly: 0, 'Non Moving': 0 };

  baseData.forEach((r) => {
    const val = Number(r.Value || 0);
    totalStockValue += val;
    if (r.ReturnQty > 0) {
      returnCount += 1;
      totalReturnValue += Number(r.ReturnValue || 0);
    }
    if (r.Unrestricted > 0) {
      const unitPrice = val / r.Unrestricted;
      totalUsage4mValue += Number(r.Qty4Month || 0) * unitPrice;
    }
    if (r.ABCValue && abcCounts[r.ABCValue] !== undefined) {
      abcCounts[r.ABCValue] += 1;
      abcValues[r.ABCValue] += val;
    }
    if (r.Moving && movingCounts[r.Moving] !== undefined) {
      movingCounts[r.Moving] += 1;
      movingValues[r.Moving] += val;
    }
  });

  const monthlyWithdrawalValue = totalUsage4mValue / 4 || 0;
  const dailyUsageValue = totalUsage4mValue / 120 || 0;
  const stockDays = dailyUsageValue > 0 ? Math.round(totalStockValue / dailyUsageValue) : 0;
  const afterStockDays = dailyUsageValue > 0 ? Math.round((totalStockValue - totalReturnValue) / dailyUsageValue) : 0;

  const sumOrderValue = (arr) => arr.reduce((s, r) => s + (r.OrderValue || 0), 0);

  const resultPayload = {
    plantCode: selectedPlant,
    plantName: plantInfo.plantName,
    hasData: true,
    metrics: {
      totalItems: baseData.length,
      totalStockValue,
      monthlyWithdrawalValue,
      stockDays,
      afterStockDays,
      returnCount,
      totalReturnValue,
      installOrderCount: installOrder.length,
      installOrderValue: sumOrderValue(installOrder),
      installCallOrderCount: installCallOrder.length,
      installCallOrderValue: sumOrderValue(installCallOrder),
      callOrderCount: callOrder.length,
      callOrderValue: sumOrderValue(callOrder),
      allOrderCount: allOrder.length,
      allOrderValue: sumOrderValue(allOrder),
      shortageFastMedCount: shortageFastMed.length,
      shortageWithNawaStock,
      shortageWaitNawa,
      unupdatedLocationCount: unupdatedLocation.length,
      unupdatedLocationValue: unupdatedLocation.reduce((s, r) => s + (r.Value || 0), 0),
      abcCounts,
      abcValues,
      movingCounts,
      movingValues,
    },
    lists: {
      installOrder,
      installCallOrder,
      callOrder,
      allOrder,
      shortageFastMed,
      unupdatedLocation,
      overstockReturn,
    },
  };

  void saveAbcDashboardSnapshot(selectedPlant, resultPayload);
  return resultPayload;
}

export function exportAbcListToCsv(rows, tabLabel, plantInfo) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const headers = [
    'Plant',
    'Material',
    'Description',
    'Status',
    'Storage bin',
    'ABC',
    'Moving',
    'นวนคร',
    'คงเหลือ',
    'หน่วย',
    'มูลค่าคงเหลือ (บาท)',
    'เฉลี่ย/เดือน',
    'DOS (วัน)',
    'แนะนำสั่ง',
    'มูลค่าสั่ง (บาท)',
    'ส่งคืนได้ OverStock (ชิ้น)',
    'มูลค่าส่งคืน OverStock (บาท)',
  ];

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['\uFEFF' + headers.map(esc).join(',')];

  rows.forEach((r) => {
    const dosVal = r.DOS > 9999 ? 'มาก' : Number(r.DOS || 0).toFixed(1);
    lines.push(
      [
        r.Plant,
        r.Material,
        r.Description,
        r.Status,
        r.StorageBin,
        r.ABCValue,
        r.Moving,
        r.Navanakorn || 0,
        r.Unrestricted || 0,
        r.Unit || '',
        Math.round(r.Value || 0),
        Number(r.AvgMonthly || 0).toFixed(1),
        dosVal,
        Math.round(r.RecommendedOrder || 0),
        Math.round(r.OrderValue || 0),
        Math.round(r.ReturnQty || 0),
        Math.round(r.ReturnValue || 0),
      ]
        .map(esc)
        .join(',')
    );
  });

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTab = String(tabLabel || 'ABC').replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Dashboard_${plantInfo?.plantCode || 'Plant'}_${safeTab}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/* ==========================================================================
   6. Warehouse Health Score (0-100) Calculator
   ========================================================================== */

export function computeWarehouseHealthScore({ stockDayData, callData, abcData }) {
  let score = 100;
  const factors = [];

  // Factor 1: StockDay vs 180-day target (weight 25)
  const currentStockDay = abcData?.metrics?.stockDays || stockDayData?.latest?.stockDay || 0;
  if (currentStockDay > 180) {
    const penalty = Math.min(25, Math.round(((currentStockDay - 180) / 120) * 25));
    score -= penalty;
    factors.push({ label: `StockDay เกินเป้า (${currentStockDay} วัน)`, status: 'warn' });
  } else if (currentStockDay > 0) {
    factors.push({ label: `StockDay อยู่ในเกณฑ์ (${currentStockDay} วัน)`, status: 'good' });
  }

  // Factor 2: Call Waiting Response & Over 7 Days (weight 25)
  const callTotal = callData?.summary?.total || 0;
  const callWait = callData?.summary?.waitingResponse || 0;
  const callOver7 = callData?.summary?.over7 || 0;
  if (callTotal > 0) {
    const waitPenalty = Math.min(15, Math.round((callWait / Math.max(1, callTotal)) * 20));
    const over7Penalty = Math.min(10, Math.round((callOver7 / Math.max(1, callTotal)) * 15));
    score -= waitPenalty + over7Penalty;
  }
  if (callWait > 0) {
    factors.push({ label: `Call รอคลังตอบ ${callWait} งาน`, status: 'alert' });
  } else {
    factors.push({ label: 'ตอบ Call ครบถ้วน', status: 'good' });
  }

  // Factor 3: Fast/Medium Shortage (weight 25)
  const shortageCount = abcData?.metrics?.shortageFastMedCount || 0;
  if (shortageCount > 0) {
    const penalty = Math.min(25, Math.round(Math.sqrt(shortageCount) * 3));
    score -= penalty;
    factors.push({ label: `ของขาด Fast/Medium ${shortageCount} รายการ`, status: 'alert' });
  } else if (abcData?.hasData) {
    factors.push({ label: 'ไม่มีของขาด Fast/Medium', status: 'good' });
  }

  // Factor 4: Unupdated Storage Bin Location (weight 25)
  const unlocCount = abcData?.metrics?.unupdatedLocationCount || 0;
  if (unlocCount > 0) {
    const penalty = Math.min(25, Math.round(Math.sqrt(unlocCount) * 2.5));
    score -= penalty;
    factors.push({ label: `ยังไม่ผูก Location ${unlocCount} รายการ`, status: 'warn' });
  } else if (abcData?.hasData) {
    factors.push({ label: 'Location ครบถ้วน 100%', status: 'good' });
  }

  return {
    score: Math.max(15, Math.min(100, score)),
    factors,
  };
}

/* ==========================================================================
   7. Customer Return & Claim Dashboard (6 Submenus: dashboard-tsc)
   ========================================================================== */

const TSC_PLANT_MAP_3DIGIT = {
  '318': 'คลังกาแฟ',
  '301': 'Stock กทม',
  '369': 'Stock คลังระยอง',
  '326': 'Stock วิภาวดี 62',
  '319': 'Stock ขอนแก่น',
  '309': 'Stock โคราช',
  '366': 'Stock เชียงใหม่',
  '304': 'Stock พระราม 3',
  '312': 'Stock พิษณุโลก',
  '313': 'Stock ภูเก็ต',
  '305': 'Stock ราชบุรี',
  '320': 'Stock ลำปาง',
  '311': 'Stock ศรีราชา',
  '307': 'Stock สุราษฎร์',
  '317': 'ศูนย์ REFURBISH',
  '367': 'SA ฉะเชิงเทรา',
  '364': 'SA บางบัวทอง',
  '324': 'SA ปัตตานี',
  '363': 'SA ปากเกร็ด',
  '368': 'SA ร้อยเอ็ด',
  '323': 'SA ลำลูกกา',
  '303': 'SA สงขลา',
  '365': 'SA สมุทรปราการ',
  '362': 'SA หนองแขม',
  '315': 'SA อยุธยา',
  '310': 'SA อุดรธานี1',
  '322': 'SA อุดรธานี2',
  '330': 'Stock ประเวศ',
};

let customerReturnMemoryCache = {
  ts: 0,
  allData: null,
  storeBrandData: null,
};
const CUSTOMER_RETURN_CACHE_TTL = 5 * 60 * 1000;

function parseTscDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(0);
  const timeMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (timeMatch) {
    const [, day, month, year, hour, minute, second] = timeMatch;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10));
  }
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }
  return new Date(0);
}

function resolveTscPlantCallName(plantInfo) {
  const code3 = String(plantInfo?.plantCode || '').replace(/^0+/, '');
  if (TSC_PLANT_MAP_3DIGIT[code3]) {
    return TSC_PLANT_MAP_3DIGIT[code3];
  }
  return plantInfo?.callPendingUnit || `Stock ${plantInfo?.plantName || ''}`;
}

function checkSerialMismatch(row) {
  const rawSerial = String(row?.SerialKeep || '').trim();
  if (!rawSerial) return false;
  const serials = rawSerial.split(/[,/\s]+/).map((s) => s.trim()).filter(Boolean);
  const qtyValue = parseFloat(row?.Qty) || 0;
  return qtyValue > 0 && serials.length > 0 && serials.length !== qtyValue;
}

function summarizeProductSubmenu(rows, submenuKey) {
  const workOrderSet = new Set();
  let totalQty = 0;
  let processingQty = 0;
  let completedQty = 0;
  let notReturnCount = 0;
  let notReturnQty = 0;
  let errorMismatchCount = 0;
  let checkOrderCount = 0;
  let latestDeliveryDate = '-';
  let latestDeliveryTime = 0;
  const statusCounts = {};
  const descCounts = {};

  rows.forEach((row) => {
    const wo = String(row?.WorkOrder || '').trim();
    if (wo && wo !== '-') workOrderSet.add(wo);

    const qty = parseFloat(row?.Qty) || 0;
    totalQty += qty;

    const status = String(row?.Status || 'อื่นๆ').trim() || 'อื่นๆ';
    statusCounts[status] = (statusCounts[status] || 0) + qty;

    const isCompleted = status === 'ส่งลูกค้าแล้ว' || status === 'สำเร็จ';
    if (isCompleted) {
      completedQty += qty;
    } else {
      processingQty += qty;
    }

    const retStatus = String(row?.['การคืนซาก'] || '').trim();
    if (retStatus.includes('ไม่คืน')) {
      notReturnCount += 1;
      notReturnQty += qty;
    }

    if (checkSerialMismatch(row)) {
      errorMismatchCount += 1;
    }

    if (String(row?.OrderChk || '').trim() === 'CheckOrder') {
      checkOrderCount += 1;
    }

    const delivery = String(row?.DeliveryTSC_Detail || '').trim();
    if (delivery && delivery !== '-') {
      const dt = parseTscDate(delivery);
      const t = dt.getTime();
      if (!Number.isNaN(t) && t > latestDeliveryTime) {
        latestDeliveryTime = t;
        latestDeliveryDate = delivery;
      }
    }

    const desc = String(row?.['Spare Part Name'] || '').trim();
    if (desc) {
      descCounts[desc] = (descCounts[desc] || 0) + qty;
    }
  });

  let latestDeliveryQty = 0;
  if (latestDeliveryDate !== '-') {
    rows.forEach((row) => {
      if (String(row?.DeliveryTSC_Detail || '').trim() === latestDeliveryDate) {
        latestDeliveryQty += parseFloat(row?.Qty) || 0;
      }
    });
  }

  // Build Description Breakdown Pills (matching product.js customOrderTSC / Access Point)
  const customOrderTSC = [
    'เครื่อง S80',
    'เครื่อง A80',
    'ADEPTER',
    'ขาตั้งพลาสติก',
    'ชุดเสาเหล็ก',
    'ฝาหลัง รุ่น S80',
    'สาย RS232',
  ];
  const stripForMatch = (text) => String(text || '').replace(/\s+/g, '').toLowerCase();
  const customOrderMatch = customOrderTSC.map(stripForMatch);

  const descBreakdown = Object.keys(descCounts).map((desc) => {
    let displayName = desc;
    if (submenuKey === 'truewifi') {
      displayName = desc.replace(/TRUE WIFI/gi, '').replace(/\(ฝ\)/g, '').trim();
    } else if (submenuKey === 'tsc') {
      displayName = desc.replace(/SMART\s*CARD\s*EDC/gi, '').replace(/\(ฝ\)/g, '').trim().replace(/\s{2,}/g, ' ');
    }
    return {
      desc,
      displayName: displayName || desc,
      qty: descCounts[desc] || 0,
    };
  });

  if (submenuKey === 'tsc') {
    descBreakdown.sort((a, b) => {
      const normA = stripForMatch(a.displayName);
      const normB = stripForMatch(b.displayName);
      let idxA = customOrderMatch.indexOf(normA);
      let idxB = customOrderMatch.indexOf(normB);
      if (idxA === -1) idxA = customOrderMatch.findIndex((o) => normA.includes(o));
      if (idxB === -1) idxB = customOrderMatch.findIndex((o) => normB.includes(o));
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      if (idxA !== idxB) return idxA - idxB;
      return a.displayName.localeCompare(b.displayName, 'th');
    });
  } else {
    descBreakdown.sort((a, b) => b.qty - a.qty);
  }

  // Actionable preview items (prioritize pending / processing / CheckOrder / serial mismatch)
  const statusPriority = {
    'รอคืนคลัง': 1,
    'รอส่งคลัง': 2,
    'คลังพื้นที่': 3,
    'รอส่งคืน': 4,
    'ระหว่างขนส่ง': 5,
    'รอส่งเคลม': 6,
    'คลังกลาง': 7,
    'ส่งลูกค้าแล้ว': 90,
    'สำเร็จ': 91,
  };

  const previewRows = [...rows]
    .sort((a, b) => {
      const chkA = a.OrderChk === 'CheckOrder' ? 0 : 1;
      const chkB = b.OrderChk === 'CheckOrder' ? 0 : 1;
      if (chkA !== chkB) return chkA - chkB;
      const stA = statusPriority[String(a.Status || '').trim()] || 50;
      const stB = statusPriority[String(b.Status || '').trim()] || 50;
      if (stA !== stB) return stA - stB;
      return parseTscDate(b.DateKeep).getTime() - parseTscDate(a.DateKeep).getTime();
    })
    .slice(0, 60)
    .map((r) => ({
      WorkOrder: r.WorkOrder || '-',
      Status: r.Status || '-',
      OrderChk: r.OrderChk || '-',
      DateKeep: r.DateKeep || '-',
      SparePartCode: r['Spare Part Code'] || '-',
      SparePartName: r['Spare Part Name'] || '-',
      Qty: parseFloat(r.Qty) || 0,
      StoreCode: r['Store Code'] || '-',
      StoreName: r['Store Name'] || '-',
      PlantCall: r.PlantCall || '-',
      Plant: r.Plant || '-',
      ReturnStatus: r['การคืนซาก'] || '-',
      SerialKeep: r.SerialKeep || '-',
      TID: r.TID || r.MatCode || '-',
      DeliveryDetail: r.DeliveryTSC_Detail || '-',
      hasSerialMismatch: checkSerialMismatch(r),
    }));

  const completionPct = totalQty > 0 ? Math.round((completedQty / totalQty) * 100) : 0;

  return {
    workOrderCount: workOrderSet.size,
    totalQty,
    processingQty,
    completedQty,
    completionPct,
    notReturnCount,
    notReturnQty,
    errorMismatchCount,
    checkOrderCount,
    latestDeliveryDate,
    latestDeliveryQty,
    statusCounts,
    descBreakdown,
    previewRows,
  };
}

function summarizeTscStoreSubmenu(brandRows) {
  const waiting = brandRows.filter((r) => r.Staus === 'รอส่งคลัง');
  const complete = brandRows.filter((r) => r.Staus === 'ครบ');
  const incomplete = brandRows.filter((r) => r.Staus === 'ไม่ครบ');
  const pending = brandRows.filter((r) => r.Staus === 'รอจัดเก็บ');

  const sumPos = (arr) => arr.reduce((s, r) => s + (parseFloat(r['จำนวนเครื่อง']) || 0), 0);
  const waitingPos = sumPos(waiting);
  const completePos = sumPos(complete);
  const pendingPos = sumPos(pending);
  const incompletePos = incomplete.reduce((s, r) => {
    const total = parseFloat(r['จำนวนเครื่อง']) || 0;
    const returned = parseFloat(r['ส่งคืน']) || 0;
    return s + Math.max(0, total - returned);
  }, 0);

  const totalBranches = brandRows.length;
  const totalPos = sumPos(brandRows);
  const completionPct = totalBranches > 0 ? Math.round((complete.length / totalBranches) * 100) : 0;

  const actionableBranches = brandRows.filter((r) => r.Staus !== 'ครบ');
  const over14DaysCount = actionableBranches.filter((r) => (parseFloat(r['ผ่านมา(วัน)']) || 0) > 14).length;

  const previewRows = [...brandRows]
    .sort((a, b) => {
      const rank = { 'รอจัดเก็บ': 1, 'รอส่งคลัง': 2, 'ไม่ครบ': 3, 'ครบ': 9 };
      const rA = rank[a.Staus] || 5;
      const rB = rank[b.Staus] || 5;
      if (rA !== rB) return rA - rB;
      return (parseFloat(b['ผ่านมา(วัน)']) || 0) - (parseFloat(a['ผ่านมา(วัน)']) || 0);
    })
    .slice(0, 60)
    .map((r) => ({
      StoreCode: r['รหัสสาขา'] || '-',
      StoreName: r['สาขา'] || '-',
      Province: r['จังหวัด'] || '-',
      PosQty: parseFloat(r['จำนวนเครื่อง']) || 0,
      ReturnedQty: parseFloat(r['ส่งคืน']) || 0,
      UserKeep: r['ผู้ส่งคืน'] || '-',
      AgingDays: Math.round(parseFloat(r['ผ่านมา(วัน)']) || 0),
      Status: r.Staus || '-',
      StoreRemark: r['สถานะร้าน'] || '-',
      DateCall: r['วันที่ดำเนินการ'] || '-',
      DateReceipt: r['วันที่คืนคลัง'] || '-',
    }));

  return {
    totalBranches,
    totalPos,
    completionPct,
    over14DaysCount,
    statusMatrix: {
      pending: { label: 'รอจัดเก็บ', branches: pending.length, pos: pendingPos },
      waiting: { label: 'รอส่งคลัง', branches: waiting.length, pos: waitingPos },
      incomplete: { label: 'ไม่ครบ', branches: incomplete.length, pos: incompletePos },
      complete: { label: 'ครบ', branches: complete.length, pos: completePos },
    },
    previewRows,
  };
}

export async function fetchCustomerReturnDashboard(plantInfo, forceRefresh = false) {
  const now = Date.now();
  let allData = null;
  let storeBrandData = null;

  if (
    !forceRefresh &&
    customerReturnMemoryCache.allData &&
    customerReturnMemoryCache.storeBrandData &&
    now - customerReturnMemoryCache.ts < CUSTOMER_RETURN_CACHE_TTL
  ) {
    allData = customerReturnMemoryCache.allData;
    storeBrandData = customerReturnMemoryCache.storeBrandData;
  } else {
    const fetchProxy = async (type) => {
      const res = await fetch(`/api/proxy?type=${encodeURIComponent(type)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`Customer Return API (${type}) HTTP ${res.status}`);
      return res.json();
    };

    const [rawProduct, rawClaim, rawBrand] = await Promise.all([
      fetchProxy('product'),
      fetchProxy('bluetap_claim').catch(() => []),
      fetchProxy('brand').catch(() => []),
    ]);

    const data = Array.isArray(rawProduct) ? rawProduct.map((r) => ({ ...r })) : [];
    const claimData = Array.isArray(rawClaim) ? rawClaim : [];

    // Replicate exact product.js normalization & claim merge logic
    data.forEach((row) => {
      const prodValue = String(row.Product || '').trim().toUpperCase();
      const sparePartCode = String(row['Spare Part Code'] || '').trim().toUpperCase();
      const sparePartName = String(row['Spare Part Name'] || '').trim().toUpperCase();

      if (prodValue.includes('BLUETAP') || sparePartCode.includes('SUNMI') || sparePartName.includes('SUNMI')) {
        row.Product = 'Bluetap';
        const codeTrimmed = String(row['Spare Part Code'] || '').trim();
        if (codeTrimmed === '30066406' && row['คลังพื้นที่']) {
          row.Status = row['คลังพื้นที่'];
        }
      } else if (prodValue.includes('WIFI') || prodValue.includes('ACCESS') || prodValue.includes('AP')) {
        row.Product = 'Access Point';
      } else {
        row.Product = 'TSC';
      }

      if (row.Product !== 'Access Point' && row.Status === 'ส่งTSCแล้ว') {
        row.Status = 'ส่งลูกค้าแล้ว';
      }

      const isClaimModel = String(row['Spare Part Code'] || '').trim() === '30066406';
      const currentStatus = String(row.Status || '').trim();
      if (
        row.Product === 'Bluetap' &&
        row.Plant === 'คลังวิภาวดี 62' &&
        !isClaimModel &&
        currentStatus !== 'ส่งลูกค้าแล้ว' &&
        currentStatus !== 'สำเร็จ'
      ) {
        row.Status = 'รอส่งเคลม';
        row.DeliveryTSC_Detail = '-';
      }
    });

    if (claimData.length > 0) {
      const newClaimRows = claimData.map((newRow) => {
        const claimSpc = String(newRow['Spare Part Code'] || '30066406').trim();
        const matchedRow = data.find(
          (r) =>
            String(r.WorkOrder || '').trim() === String(newRow['WorkOrder No'] || '').trim() &&
            (String(r['Spare Part Code'] || '').trim() === claimSpc ||
              String(r['Spare Part Code'] || '').trim() === '30066406')
        );
        const oldRow = matchedRow || {};
        const mergedRow = {
          ...oldRow,
          WorkOrder: newRow['WorkOrder No'],
          'Store Code': newRow['Store Code'],
          'Store Name': newRow['Store name'],
          Product: 'Bluetap',
          'Spare Part Code': claimSpc,
          'Spare Part Name': newRow['Spare Part Name'] || oldRow['Spare Part Name'] || 'เครื่อง Blue Tap (NFC) (ฝ)',
          Qty: newRow.QTY || '1',
          อุปกรณ์: newRow['อุปกรณ์'],
          อาการ: newRow['อาการ'],
          รหัสช่าง: newRow['รหัสช่าง'],
          ชื่อช่าง: newRow['ชื่อช่าง'],
          การคืนซาก: newRow['การคืนซาก'] || oldRow['การคืนซาก'],
          'Serial Old': newRow['Serial No'] || oldRow['Serial Old'],
          DateKeep: oldRow.DateKeep || newRow['วันที่เปิดงาน'] || '-',
        };

        if (!matchedRow) {
          mergedRow.Status = 'รอคืนคลัง';
          if (newRow['Approve Date Time']) {
            const approveDateStr = String(newRow['Approve Date Time']).trim();
            mergedRow.DateKeep = approveDateStr.split(' ')[0] || mergedRow.DateKeep;
          }
          mergedRow.OrderChk = '-';
        } else {
          mergedRow.OrderChk = '-';
          if (mergedRow['Spare Part Code'] === '30066406') {
            if (mergedRow['คลังพื้นที่']) {
              mergedRow.Status = mergedRow['คลังพื้นที่'];
            } else if (!mergedRow.Status) {
              mergedRow.Status = 'รอส่งเคลม';
            }
          }
        }

        if (mergedRow.Status === 'รอคืนคลัง' || mergedRow.Status === 'รอส่งคลัง') {
          const plantId = String(newRow.Plant || '').trim().replace(/^0+/, '');
          if (TSC_PLANT_MAP_3DIGIT[plantId]) {
            mergedRow.PlantCall = TSC_PLANT_MAP_3DIGIT[plantId];
          }
        }
        return mergedRow;
      });

      const finalData = data.filter((row) => {
        const wo = String(row.WorkOrder || '').trim();
        const spc = String(row['Spare Part Code'] || '').trim();
        const isReplacedByClaim = claimData.some((cRow) => {
          const cWo = String(cRow['WorkOrder No'] || '').trim();
          const claimSpc = String(cRow['Spare Part Code'] || '30066406').trim();
          return cWo === wo && (spc === claimSpc || spc === '30066406');
        });
        return !isReplacedByClaim;
      });

      finalData.forEach((row) => {
        if (row.Product === 'Bluetap' && String(row['Spare Part Code'] || '').trim() === '30066406') {
          row.OrderChk = 'CheckOrder';
        }
      });

      finalData.push(...newClaimRows);
      allData = finalData;
    } else {
      allData = data;
    }

    storeBrandData = (Array.isArray(rawBrand) ? rawBrand : []).map((row) => ({
      ...row,
      จำนวนเครื่อง: row.PosQty || '',
      ส่งคืน: row.PoskeepQty || '',
      ผู้ส่งคืน: row.UserKeep || '',
      'ผ่านมา(วัน)': row['ผ่านมา'] || '',
      Staus: String(row.Staus || '').trim(),
      สถานะร้าน: row.Remark || 'ไม่มีข้อมูล',
      วันที่คืนคลัง: row.DateRecripte || '',
      วันที่ดำเนินการ: row.DateCall || '',
    }));

    customerReturnMemoryCache = {
      ts: now,
      allData,
      storeBrandData,
    };
  }

  const targetPlantCall = resolveTscPlantCallName(plantInfo);
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const targetNorm = norm(targetPlantCall);
  const plantNameNorm = norm(plantInfo?.plantName || '');

  // Check all available PlantCall names in dataset to find best match for user's warehouse
  const availablePlantCalls = Array.from(new Set(allData.map((r) => String(r?.PlantCall || '').trim()).filter(Boolean)));
  let matchedPlantCall = targetPlantCall;
  const exactMatch = availablePlantCalls.find((p) => norm(p) === targetNorm);
  if (exactMatch) {
    matchedPlantCall = exactMatch;
  } else if (plantNameNorm) {
    const partialMatch = availablePlantCalls.find((p) => norm(p).includes(plantNameNorm));
    if (partialMatch) matchedPlantCall = partialMatch;
  }

  const buildScopeSummary = (filterByPlantCall) => {
    const scopedProductRows = filterByPlantCall
      ? allData.filter((r) => norm(r?.PlantCall) === norm(matchedPlantCall))
      : allData;

    const tscRows = scopedProductRows.filter((r) => r.Product === 'TSC');
    const sunmiRows = scopedProductRows.filter(
      (r) => r.Product === 'Bluetap' && String(r['Spare Part Code'] || '').trim() === 'SUNMI'
    );
    const bluetapClaimRows = scopedProductRows.filter(
      (r) => r.Product === 'Bluetap' && String(r['Spare Part Code'] || '').trim() === '30066406'
    );
    const adapterClaimRows = scopedProductRows.filter(
      (r) => r.Product === 'Bluetap' && String(r['Spare Part Code'] || '').trim() === '30066303'
    );
    const truewifiRows = scopedProductRows.filter((r) => r.Product === 'Access Point');

    const tsc = summarizeProductSubmenu(tscRows, 'tsc');
    const tscStore = summarizeTscStoreSubmenu(storeBrandData);
    const sunmi = summarizeProductSubmenu(sunmiRows, 'bluetap');
    const bluetapClaim = summarizeProductSubmenu(bluetapClaimRows, 'bluetap-claim');
    const adapterClaim = summarizeProductSubmenu(adapterClaimRows, 'adapter-claim');
    const truewifi = summarizeProductSubmenu(truewifiRows, 'truewifi');

    const productSubmenus = [tsc, sunmi, bluetapClaim, adapterClaim, truewifi];
    const masterOverview = {
      totalWorkOrders: productSubmenus.reduce((s, m) => s + m.workOrderCount, 0),
      totalQty: productSubmenus.reduce((s, m) => s + m.totalQty, 0),
      totalProcessingQty: productSubmenus.reduce((s, m) => s + m.processingQty, 0),
      totalCompletedQty: productSubmenus.reduce((s, m) => s + m.completedQty, 0),
      totalNotReturnCount: productSubmenus.reduce((s, m) => s + m.notReturnCount, 0),
      totalErrorMismatch: productSubmenus.reduce((s, m) => s + m.errorMismatchCount, 0),
      totalCheckOrder: bluetapClaim.checkOrderCount,
      storePendingBranches:
        tscStore.statusMatrix.pending.branches +
        tscStore.statusMatrix.waiting.branches +
        tscStore.statusMatrix.incomplete.branches,
      storePendingPos:
        tscStore.statusMatrix.pending.pos +
        tscStore.statusMatrix.waiting.pos +
        tscStore.statusMatrix.incomplete.pos,
    };

    return {
      masterOverview,
      submenus: {
        tsc,
        'tsc-store': tscStore,
        bluetap: sunmi,
        'bluetap-claim': bluetapClaim,
        'adapter-claim': adapterClaim,
        truewifi,
      },
    };
  };

  return {
    matchedPlantCall,
    availablePlantCalls,
    plantScope: buildScopeSummary(true),
    nationwideScope: buildScopeSummary(false),
  };
}

