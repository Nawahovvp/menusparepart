/**
 * API.JS
 * Backend communication and data loading logic.
 */

async function apiGet(action, params = {}, sysOverride) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('system', sysOverride || editingSystem || currentSystem);
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== null && v !== undefined) url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString(), { redirect: 'follow' });
  return await resp.json();
}

async function apiPost(payload, sysOverride) {
  payload.system = sysOverride || editingSystem || currentSystem;
  const resp = await fetch(API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  return await resp.json();
}

/**
 * ดึงข้อมูลชีตผ่าน Opensheet API (มี Timeout ป้องกันหน้าเว็บค้าง)
 */
async function fetchOpensheet(sheetName, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${OPENSHEET_URL}/${encodeURIComponent(sheetName)}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch (e) {
    clearTimeout(timer);
    console.warn(`Opensheet Error for ${sheetName}:`, e.message || e);
    return null;
  }
}

/**
 * ดึงข้อมูลจากชีตใดๆ โดยตรงผ่าน Google Visualization API (GViz JSONP)
 * เร็วตรงจากเซิร์ฟเวอร์ Google และคืนค่าวันที่เป็น Date(YYYY,M,D) ที่แม่นยำ 100%
 */
async function fetchSheetFromGViz(sheetName, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const safeSheetName = sheetName.replace(/[^a-zA-Z0-9]/g, '_');
    const callbackName = 'gvizSheetCb_' + safeSheetName + '_' + Math.floor(Math.random() * 1000000);
    const script = document.createElement('script');
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodeURIComponent(sheetName)}`;

    let resolved = false;
    const timer = setTimeout(() => {
      cleanup();
      if (!resolved) resolve(null);
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[callbackName]; } catch (_) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(resp) {
      resolved = true;
      cleanup();
      try {
        const table = resp && resp.table;
        if (!table || !Array.isArray(table.rows)) {
          resolve(null);
          return;
        }
        const cols = (table.cols || []).map((c, i) => {
          const lbl = (c && c.label) ? String(c.label).trim() : '';
          return lbl || (c && c.id) || `col_${i}`;
        });
        const rows = [];
        for (const r of table.rows) {
          if (!r || !r.c) continue;
          const obj = {};
          r.c.forEach((cell, idx) => {
            const colName = cols[idx] || `col_${idx}`;
            // ใช้ cell.v ก่อนเสมอ เพื่อให้ได้ค่า Date(YYYY,M,D) ที่แม่นยำ 100% ไม่สับสน M/D กับ D/M
            const val = cell ? (cell.v !== undefined && cell.v !== null ? cell.v : (cell.f !== undefined && cell.f !== null ? cell.f : '')) : '';
            obj[colName] = val;
          });
          rows.push(obj);
        }
        resolve(rows);
      } catch (err) {
        console.error(`Error parsing GViz response for ${sheetName}:`, err);
        resolve(null);
      }
    };

    script.onerror = function() {
      resolved = true;
      cleanup();
      resolve(null);
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

/**
 * ดึงข้อมูลของ 1 ชีต: ใช้ Opensheet เป็นหลัก (ครบทุกแถวไม่ตกหล่นทั้งเซลล์ Date และ Text)
 * หาก Opensheet ขัดข้องจะสลับไปใช้ GViz เป็นตัวสำรองอัตโนมัติ
 */
async function fetchSheetData(sheetName) {
  try {
    const openSheetRows = await fetchOpensheet(sheetName);
    if (Array.isArray(openSheetRows) && openSheetRows.length > 0) {
      return openSheetRows;
    }
  } catch (_) {}

  try {
    const gvizRows = await fetchSheetFromGViz(sheetName);
    if (Array.isArray(gvizRows) && gvizRows.length > 0) {
      return gvizRows;
    }
  } catch (_) {}

  return null;
}

function mapTankMainRow(r) {
  if (!r) return null;
  const inv = String(r.InvDeliveryID ?? r.invDeliveryID ?? r.InvoiceID ?? r.invoiceID ?? r.col_0 ?? '').trim();
  if (!inv || inv.toLowerCase() === 'invdeliveryid' || inv.toLowerCase() === 'invoiceid') return null;
  const rawDate = r.Date ?? r.date ?? r.col_1 ?? '';
  const rawImg = r.image ?? r.Image ?? r.images ?? r.Images ?? r.col_2 ?? '';
  const images = parseImageUrls(rawImg);
  return {
    invDeliveryID: inv.toUpperCase(),
    date: parseDateStr(rawDate),
    image: images[0] || '',
    images
  };
}

function mapTankDetailRow(r) {
  if (!r) return null;
  const inv = String(r.InvDeliveryID ?? r.invDeliveryID ?? r.InvoiceID ?? r.invoiceID ?? r.col_1 ?? '').trim();
  if (!inv || inv.toLowerCase() === 'invdeliveryid' || inv.toLowerCase() === 'invoiceid') return null;
  const rawDate = r.Date ?? r.date ?? r.col_0 ?? '';
  const prod = String(r.Product ?? r.product ?? r.col_2 ?? '').trim();
  const rawQty = r.Qty ?? r.qty ?? r.col_3 ?? 0;
  const numQty = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(/,/g, ''));
  return {
    invDeliveryID: inv.toUpperCase(),
    date: parseDateStr(rawDate),
    product: prod,
    qty: isNaN(numQty) ? 0 : numQty
  };
}

function mapRecMainRow(r) {
  if (!r) return null;
  const inv = String(r.InvoiceID ?? r.invoiceID ?? r.InvDeliveryID ?? r.invDeliveryID ?? r.col_0 ?? '').trim();
  if (!inv || inv.toLowerCase() === 'invoiceid' || inv.toLowerCase() === 'invdeliveryid') return null;
  const rawDate = r.Date ?? r.date ?? r.col_1 ?? '';
  const rawImg = r.image ?? r.Image ?? r.images ?? r.Images ?? r.col_2 ?? '';
  const images = parseImageUrls(rawImg);
  return {
    invDeliveryID: inv.toUpperCase(),
    date: parseDateStr(rawDate),
    image: images[0] || '',
    images
  };
}

function mapRecDetailRow(r) {
  if (!r) return null;
  const inv = String(r.InvoiceID ?? r.invoiceID ?? r.InvDeliveryID ?? r.invDeliveryID ?? r.col_1 ?? '').trim();
  if (!inv || inv.toLowerCase() === 'invoiceid' || inv.toLowerCase() === 'invdeliveryid') return null;
  const rawDate = r.Date ?? r.date ?? r.col_0 ?? '';
  const prod = String(r.Product ?? r.product ?? r.col_2 ?? '').trim();
  const rawQty = r.Qty ?? r.qty ?? r.col_3 ?? 0;
  const numQty = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(/,/g, ''));
  return {
    invDeliveryID: inv.toUpperCase(),
    date: parseDateStr(rawDate),
    product: prod,
    qty: isNaN(numQty) ? 0 : numQty
  };
}

/**
 * ดึงข้อมูลครบทุกตารางพร้อมกันผ่าน GViz / Opensheet ทางด่วน (มักใช้เวลาเพียง ~0.4 - 1.2 วินาที)
 */
async function fetchFullDatasetDirect() {
  try {
    const [tankRows, tankDetailRows, recRows, recDetailRows, freshOverList] = await Promise.all([
      fetchSheetData('Tank'),
      fetchSheetData('Detail_Tank'),
      fetchSheetData('Recripte_Tank'),
      fetchSheetData('Recripte_Detail_Tank'),
      fetchOverListFromGViz()
    ]);

    if (!tankRows || !tankDetailRows || !recRows || !recDetailRows) {
      console.warn('Direct sheet fetch incomplete, falling back to Apps Script API...');
      return null;
    }

    const nextDataset = {
      tankMain: tankRows.map(mapTankMainRow).filter(Boolean),
      tankDetail: tankDetailRows.map(mapTankDetailRow).filter(Boolean),
      recMain: recRows.map(mapRecMainRow).filter(Boolean),
      recDetail: recDetailRows.map(mapRecDetailRow).filter(Boolean),
      overList: Array.isArray(freshOverList) ? freshOverList : []
    };

    const validTankIds = new Set(nextDataset.tankMain.map(r => r.invDeliveryID));
    nextDataset.tankDetail = nextDataset.tankDetail.filter(r => validTankIds.has(r.invDeliveryID));

    const validRecIds = new Set(nextDataset.recMain.map(r => r.invDeliveryID));
    nextDataset.recDetail = nextDataset.recDetail.filter(r => validRecIds.has(r.invDeliveryID));

    return nextDataset;
  } catch (err) {
    console.warn('fetchFullDatasetDirect failed:', err);
    return null;
  }
}

const DATASET_CACHE_KEY = 'tankRechargeDatasetCache_v2_' + SHEET_ID;
const STOCK_CACHE_KEY   = 'tankStockCache_v1';

function saveStockCache(data) {
  if (!data) return;
  try {
    localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not persist stock cache:', e);
  }
}

function loadStockCache() {
  try {
    const raw = localStorage.getItem(STOCK_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * ดึงข้อมูล Unrestricted Stock จาก Google Sheets ผ่าน Opensheet API
 * Endpoint: https://opensheet.elk.sh/:STOCK_SPREADSHEET_ID/:STOCK_SHEET_NAME
 */
async function fetchStockFromOpensheet() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const targetUrl = typeof STOCK_OPENSHEET_URL !== 'undefined'
      ? STOCK_OPENSHEET_URL
      : `https://opensheet.elk.sh/${STOCK_SPREADSHEET_ID}/${STOCK_SHEET_NAME}`;

    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Opensheet HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const targetMaterials = new Set(Object.values(STOCK_MATERIAL_MAP));
    const stockMap = {};

    for (const r of rows) {
      if (!r) continue;
      const mat = String(r.Material || '').trim();
      if (targetMaterials.has(mat)) {
        const rawVal = r.Unrestricted ?? r.unrestricted ?? 0;
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || '0').replace(/,/g, ''));
        stockMap[mat] = isNaN(num) ? 0 : num;
      }
    }
    return stockMap;
  } catch (err) {
    clearTimeout(timer);
    console.warn('fetchStockFromOpensheet failed:', err);
    return null;
  }
}

/**
 * ดึงข้อมูล Unrestricted Stock จาก Google Sheets โดยตรงผ่าน Google Visualization API (JSONP)
 * ใช้เป็นตัวสำรองอัตโนมัติหาก Opensheet ไม่ตอบสนอง
 */
async function fetchStockFromGViz() {
  return new Promise((resolve) => {
    const callbackName = 'gvizStockCb_' + Math.floor(Math.random() * 1000000);
    const script = document.createElement('script');
    const materials = Object.values(STOCK_MATERIAL_MAP).join('|');
    const q = encodeURIComponent(`select A,B,C where A matches '.*(${materials}).*'`);
    const url = `https://docs.google.com/spreadsheets/d/${STOCK_SHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodeURIComponent(STOCK_SHEET_NAME)}&tq=${q}`;

    let resolved = false;
    const timer = setTimeout(() => {
      cleanup();
      if (!resolved) resolve(null);
    }, 6000);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[callbackName]; } catch (_) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(resp) {
      resolved = true;
      cleanup();
      try {
        const rows = resp && resp.table && resp.table.rows;
        if (!Array.isArray(rows)) {
          resolve(null);
          return;
        }
        const cols = resp.table.cols || [];
        let matIdx = 0;
        let unresIdx = 2;
        const mIndex = cols.findIndex(c => c && (c.label === 'Material' || c.id === 'A'));
        if (mIndex >= 0) matIdx = mIndex;
        const uIndex = cols.findIndex(c => c && (c.label && c.label.toLowerCase().includes('unrestricted')));
        if (uIndex >= 0) unresIdx = uIndex;

        const stockMap = {};
        for (const row of rows) {
          if (!row || !row.c) continue;
          const mat = String(row.c[matIdx]?.v || '').trim();
          const rawVal = row.c[unresIdx]?.v;
          const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || '0').replace(/,/g, ''));
          if (mat) {
            stockMap[mat] = isNaN(num) ? 0 : num;
          }
        }
        resolve(stockMap);
      } catch (err) {
        console.error('Error parsing GViz stock response:', err);
        resolve(null);
      }
    };

    script.onerror = function() {
      resolved = true;
      cleanup();
      resolve(null);
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

/**
 * ดึงข้อมูลหมายเหตุส่งเกิน (Over Notes) จาก Google Sheets (Sheet: Over) โดยตรงผ่าน GViz (JSONP)
 * ทำงานได้ทันทีโดยไม่ต้องรอ Deploy Apps Script ใหม่
 */
async function fetchOverListFromGViz() {
  return new Promise((resolve) => {
    const callbackName = 'gvizOverCb_' + Math.floor(Math.random() * 1000000);
    const script = document.createElement('script');
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=Over`;

    let resolved = false;
    const timer = setTimeout(() => {
      cleanup();
      if (!resolved) resolve([]);
    }, 6000);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[callbackName]; } catch (_) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(resp) {
      resolved = true;
      cleanup();
      try {
        const rows = resp && resp.table && resp.table.rows;
        if (!Array.isArray(rows)) {
          resolve([]);
          return;
        }
        const overList = [];
        for (const r of rows) {
          if (!r || !r.c) continue;
          const ts = r.c[0]?.f || (r.c[0]?.v ? String(r.c[0].v) : '');
          const dt = r.c[1]?.v ? String(r.c[1].v) : (r.c[1]?.f || '');
          const inv = String(r.c[2]?.v || '').trim();
          const prod = String(r.c[3]?.v || '').trim();
          const qty = Number(r.c[4]?.v) || 0;
          const note = String(r.c[5]?.v || '').trim();
          const user = String(r.c[6]?.v || '').trim();
          const plant = String(r.c[7]?.v || '').trim();

          // Skip header row if present
          if (inv.toLowerCase() === 'invoiceid' || prod.toLowerCase() === 'product') continue;

          if (note || dt || prod) {
            overList.push({
              timestamp: ts,
              date: parseDateStr(dt),
              invDeliveryID: inv,
              product: prod,
              overQty: qty,
              note: note,
              user: user,
              plant: plant
            });
          }
        }
        resolve(overList);
      } catch (err) {
        console.error('Error parsing GViz Over response:', err);
        resolve([]);
      }
    };

    script.onerror = function() {
      resolved = true;
      cleanup();
      resolve([]);
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

/**
 * โหลดข้อมูลสต็อก Unrestricted (Stale-While-Revalidate)
 * เรียกข้อมูลผ่าน Opensheet ก่อน หากไม่สำเร็จจะสลับไปใช้ GViz เป็นตัวสำรองอัตโนมัติ
 */
async function loadStockData(forceRefresh = false) {
  if (!stockData && !forceRefresh) {
    const cached = loadStockCache();
    if (cached) {
      stockData = cached;
      if (typeof updateStockStats === 'function') updateStockStats();
    }
  }

  try {
    let freshStock = await fetchStockFromOpensheet();

    // Fallback สำรองหาก Opensheet ขัดข้อง
    if (!freshStock || Object.keys(freshStock).length === 0) {
      freshStock = await fetchStockFromGViz();
    }

    if (freshStock && Object.keys(freshStock).length > 0) {
      stockData = freshStock;
      saveStockCache(freshStock);
      if (typeof updateStockStats === 'function') updateStockStats();
    }
  } catch (err) {
    console.warn('Failed to load fresh stock data:', err);
  }
}

function saveDatasetCache(dataset) {
  if (!dataset) return;
  try {
    // Avoid storing huge base64 data URLs in localStorage during optimistic updates
    const stripDataUrls = (arr) => (arr || []).map(r => ({
      ...r,
      image: (r.image && r.image.startsWith('data:image')) ? '' : r.image,
      images: (r.images || []).filter(u => u && !u.startsWith('data:image'))
    }));
    const compact = {
      tankMain: stripDataUrls(dataset.tankMain),
      tankDetail: dataset.tankDetail || [],
      recMain: stripDataUrls(dataset.recMain),
      recDetail: dataset.recDetail || [],
      overList: dataset.overList || []
    };
    localStorage.setItem(DATASET_CACHE_KEY, JSON.stringify(compact));
    if (dataset.overList) {
      localStorage.setItem('tankOverNotesCache_v1', JSON.stringify(dataset.overList));
    }
  } catch (e) {
    console.warn('Could not persist dataset cache:', e);
  }
}

function loadDatasetCache() {
  try {
    const raw = localStorage.getItem(DATASET_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.tankMain) && Array.isArray(parsed.recMain)) {
      if (!Array.isArray(parsed.overList)) {
        try {
          const rawOver = localStorage.getItem('tankOverNotesCache_v1');
          parsed.overList = rawOver ? JSON.parse(rawOver) : [];
        } catch (_) {
          parsed.overList = [];
        }
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Invalid dataset cache:', e);
  }
  return null;
}

async function loadData(forceRefresh = false, silent = false) {
  loadStockData(forceRefresh);

  if (!allDataset && !forceRefresh) {
    const cached = loadDatasetCache();
    if (cached) {
      allDataset = cached;
      processLocalData();
      // Refresh quietly in background (Stale-While-Revalidate)
      loadData(true, true);
      return;
    }
  }

  if (!allDataset || forceRefresh) {
    const shouldShowOverlay = !silent && !allDataset;
    if (shouldShowOverlay) showLoading('กำลังโหลดข้อมูล....');
    try {
      // 1. ดึงข้อมูลทางด่วนผ่าน GViz / Opensheet (เร็ว ~0.4 - 1.2 วินาที และวันที่แม่นยำ 100%)
      let nextDataset = await fetchFullDatasetDirect();

      // 2. หากการดึงทางด่วนติดขัด จึงสลับไปใช้ Apps Script API เดิมเป็นตัวสำรอง
      if (!nextDataset) {
        console.info('Using Apps Script fallback for full dataset...');
        const [result, freshOverList] = await Promise.all([
          apiGet('getAllData'),
          fetchOverListFromGViz()
        ]);

        let resolvedOverList = [];
        if (Array.isArray(freshOverList) && freshOverList.length > 0) {
          resolvedOverList = freshOverList;
        } else if (result && Array.isArray(result.overList) && result.overList.length > 0) {
          resolvedOverList = result.overList;
        } else {
          resolvedOverList = (allDataset && allDataset.overList) || [];
        }

        nextDataset = {
          tankMain: (result.tankMain || []).map(r => {
            const images = parseImageUrls(r.image);
            return {
              invDeliveryID: String(r.invDeliveryID || '').trim().toUpperCase(),
              date: parseDateStr(r.date),
              image: images[0] || '',
              images
            };
          }).filter(x => x.invDeliveryID),

          tankDetail: (result.tankDetail || []).map(r => ({
            invDeliveryID: String(r.invDeliveryID || '').trim().toUpperCase(),
            date: parseDateStr(r.date),
            product: String(r.product || '').trim(),
            qty: Number(r.qty) || 0
          })).filter(x => x.invDeliveryID),

          recMain: (result.recMain || []).map(r => {
            const images = parseImageUrls(r.image);
            return {
              invDeliveryID: String(r.invDeliveryID || '').trim().toUpperCase(),
              date: parseDateStr(r.date),
              image: images[0] || '',
              images
            };
          }).filter(x => x.invDeliveryID),

          recDetail: (result.recDetail || []).map(r => ({
            invDeliveryID: String(r.invDeliveryID || '').trim().toUpperCase(),
            date: parseDateStr(r.date),
            product: String(r.product || '').trim(),
            qty: Number(r.qty) || 0
          })).filter(x => x.invDeliveryID),

          overList: resolvedOverList
        };

        const validTankIds = new Set(nextDataset.tankMain.map(r => r.invDeliveryID));
        nextDataset.tankDetail = nextDataset.tankDetail.filter(r => validTankIds.has(r.invDeliveryID));

        const validRecIds = new Set(nextDataset.recMain.map(r => r.invDeliveryID));
        nextDataset.recDetail = nextDataset.recDetail.filter(r => validRecIds.has(r.invDeliveryID));
      }

      const prevJson = allDataset ? JSON.stringify(allDataset) : '';
      allDataset = nextDataset;
      saveDatasetCache(allDataset);

      if (silent && prevJson === JSON.stringify(allDataset)) {
        return; // Data unchanged; avoid redundant DOM re-render
      }
    } catch (err) {
      if (silent) {
        console.error('Background data refresh failed:', err);
        if (!allDataset) showToast('โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณารีเฟรชอีกครั้ง', 'error');
      } else {
        onError(err);
      }
      return;
    } finally {
      if (shouldShowOverlay) hideLoading();
    }
  }
  processLocalData();
}
