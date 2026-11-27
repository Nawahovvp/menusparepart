// ==== ระบบสลับแท็บ ====
// ==== ระบบสลับแท็บ ====
const tabButtons = document.querySelectorAll('.tab-btn');
const barcodeTabBtn = document.querySelector('[data-tab="barcode"]');
const serialTabBtn = document.querySelector('[data-tab="serial"]');
const grnTabBtn = document.querySelector('[data-tab="grn"]');
const tabPanels = {
  barcode: document.getElementById('tab-barcode'),
  serial: document.getElementById('tab-serial'),
  grn: document.getElementById('tab-grn'),
  address: document.getElementById('tab-address')
};
const scannerModal = document.getElementById('scannerModal');
const closeScannerBtn = document.getElementById('closeScannerBtn');

// Premium Loading Overlay
const loadingOverlay = document.getElementById('main-loading-overlay');
const loadingMsgEl = document.getElementById('loading-msg-el');

function showMainLoading(show, message = '') {
  if (!loadingOverlay) return;
  if (show) {
    if (loadingMsgEl) loadingMsgEl.textContent = message;
    loadingOverlay.classList.remove('is-hidden');
  } else {
    loadingOverlay.classList.add('is-hidden');
  }
}

function updateMainLoadingMsg(message) {
  if (loadingMsgEl) {
    loadingMsgEl.style.opacity = '0';
    setTimeout(() => {
      loadingMsgEl.textContent = message;
      loadingMsgEl.style.opacity = '1';
    }, 200);
  }
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');

    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    Object.keys(tabPanels).forEach(key => {
      tabPanels[key].classList.toggle('active', key === target);
    });

    if (target === 'grn') {
      loadGrnData();
    }
  });
});

const PLANT_URLS = {
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
  '0330': 'https://opensheet.elk.sh/1WYOikuoWE30WXsWglTXfxoj1gmjxlFMJgpN3eXp43Bk/Sheet1',
  '0326': 'https://opensheet.elk.sh/1gtZLR5Tm574o5xRbdrRm9yFzRukGx_UAzUnoah36cxQ/Sheet1',
  '0366': 'https://opensheet.elk.sh/1NtRsaxPkeNb4sAcTm-Tn4oN-o5F6z_56S1nhTg7kvBc/Sheet1',
  '0369': 'https://opensheet.elk.sh/13NYKhEWkWLLnA2DZZEP-zZEz2r33-roUDPMSWoFR3Qk/Sheet1'
};
const PLANT_NAMES = {
  '0301': 'นวนคร',
  '0304': 'พระราม 3',
  '0305': 'ราชบุรี',
  '0307': 'สุราษฎร์',
  '0309': 'นครราชสีมา',
  '0311': 'ศรีราชา',
  '0312': 'พิษณุโลก',
  '0313': 'ภูเก็ต',
  '0319': 'ขอนแก่น',
  '0320': 'ลำปาง',
  '0326': 'วิภาวดี 62',
  '0330': 'ประเวศ',
  '0366': 'เชียงใหม่',
  '0369': 'ระยอง'
};
const EMP_URL = 'https://opensheet.elk.sh/1eqVoLsZxGguEbRCC5rdI4iMVtQ7CK4T3uXRdx8zE3uw/Employee';
const USER_URL = 'https://opensheet.elk.sh/1eqVoLsZxGguEbRCC5rdI4iMVtQ7CK4T3uXRdx8zE3uw/EmployeeWeb';
const SUMMARY_SYNC_URL = 'https://opensheet.elk.sh/1aPBBHRwhmnucSmlDSlLNJ4yK8mQdsUnn67bt2UqMtzw/Summary_Sync';

// ? NEW: ฐาน Parts  Material mapping
const PARTS_URL = 'https://opensheet.elk.sh/1Bs0_VQuEp5hdKX33oIXBebz3avrD4wRoQtK_BUZQfzc/Mainsap_Parts';
const GRN_URL = 'https://opensheet.elk.sh/1orr4yVzy2ViyljrH6ENWnBSysTPy4aOLRD4cBjyPdIM/Serial';

let materialDB = [];
let employeeDB = [];
let userDB = [];
let partsDB = [];     // ? NEW
let partsMap = new Map(); // ? NEW: key=Parts, value=Material
let centralBinMap = new Map();
let grnDB = [];
let summarySyncDB = []; // New for Summary_Sync
let selectedPlant = '';
let dataUrl = '';
let currentUser = null;

let nextIndex = 1;

const dataStatusEl = document.getElementById('dataStatus');
const rowStatusEl = document.getElementById('rowStatus');
const tableBody = document.querySelector('#entryTable tbody');

const empCodeInput = document.getElementById('empCodeInput');
const empStatus = document.getElementById('empStatus');
const grnInvoiceFilter = document.getElementById('grnInvoiceFilter');
const grnDateFilter = document.getElementById('grnDateFilter');
const grnMaterialFilter = document.getElementById('grnMaterialFilter');
const grnTableBody = document.querySelector('#grnTable tbody');
const grnStatusEl = document.getElementById('grnStatus');
const grnRefreshBtn = document.getElementById('grnRefreshBtn');
const grnPrintBtn = document.getElementById('grnPrintBtn');
const grnSelectAll = document.getElementById('grnSelectAll');
const grnFilters = {
  invoice: '',
  date: '',
  material: ''
};

// Address tab
const ADDRESS_URL = 'https://opensheet.elk.sh/1BQr3eoAgSiZ71o9xqvtrtTF1uXbuYyvMZkQqnORPaLk/AddressRec';
const NAME_REC_URL = 'https://opensheet.elk.sh/1BQr3eoAgSiZ71o9xqvtrtTF1uXbuYyvMZkQqnORPaLk/NameRec';
let addressDB = [];
let nameRecDB = [];
let addressNextIndex = 1;

let employeeCode = '';
let employeeName = '';
let employeeTeam = '';

// ==== IndexedDB Wrapper ====
const AppDB = (() => {
  const DB_NAME = 'SmartWarehouseDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'cache';
  let _db = null;

  async function open() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  async function get(key) {
    try {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = e => resolve(e.target.result ? e.target.result.value : null);
        req.onerror = e => reject(e.target.error);
      });
    } catch (e) {
      console.warn('[AppDB] get error:', e);
      return null;
    }
  }

  async function set(key, value) {
    try {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = e => reject(e.target.error);
      });
    } catch (e) {
      console.warn('[AppDB] set error:', e);
    }
  }

  async function remove(key) {
    try {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = e => reject(e.target.error);
      });
    } catch (e) {
      console.warn('[AppDB] remove error:', e);
    }
  }

  return { get, set, remove };
})();

// ==== Caching System ====
const CACHE_KEYS = {
  BARCODE: 'smart_warehouse_barcode_cache',
  SERIAL: 'smart_warehouse_serial_cache'
};

// ==== Migration: localStorage / sessionStorage → IndexedDB ====
async function migrateOldCache() {
  try {
    const keysToMigrate = [
      { storage: localStorage, key: CACHE_KEYS.BARCODE },
      { storage: localStorage, key: CACHE_KEYS.SERIAL },
      { storage: localStorage, key: 'cache_user_data' }
    ];
    for (const { storage, key } of keysToMigrate) {
      const existing = await AppDB.get(key);
      if (!existing) {
        const old = storage.getItem(key);
        if (old) {
          try {
            await AppDB.set(key, JSON.parse(old));
            storage.removeItem(key);
            console.log(`[Migration] '${key}' migrated localStorage → IndexedDB`);
          } catch (e) {
            console.warn(`[Migration] Failed for key '${key}':`, e);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Migration] Unexpected error:', e);
  }
}

async function saveBarcodeCache() {
  const meta = { employeeCode, employeeName, employeeTeam };
  const rows = [];
  const trs = tableBody.querySelectorAll('tr');
  trs.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (inputs.length >= 7) {
      const [inputBarcode, inputMat, inputDesc, inputBin, inputRemain, inputQty, inputPack] = inputs;
      if (inputBarcode.value.trim() || inputMat.value.trim()) {
        rows.push({
          barcode: inputBarcode.value.trim(),
          material: inputMat.value.trim(),
          description: inputDesc.value,
          bin: inputBin.value,
          remain: inputRemain.value,
          qty: inputQty.value,
          pack: inputPack.value
        });
      }
    }
  });
  await AppDB.set(CACHE_KEYS.BARCODE, { meta, rows });
}

async function saveSerialCache() {
  const meta = {
    invoice: serialInvoiceInput.value.trim(),
    material: serialMatInput.value.trim(),
    desc: serialDescInput.value.trim(),
    bin: serialBinInput.value.trim(),
    prefix: serialPrefixInput.value.trim(),
    suffix: serialSuffixInput.value.trim()
  };
  const rows = [];
  const trs = serialTableBody.querySelectorAll('tr');
  trs.forEach(tr => {
    const inputSerial = tr.querySelector('.input-serial');
    const inputSerialCP = tr.querySelector('.input-serial-cp');
    const inputInvoice = tr.querySelector('.input-invoice');
    const inputMat = tr.querySelector('.input-mat');
    const inputDesc = tr.querySelector('.input-desc');
    const inputBin = tr.querySelector('.input-bin');
    const inputDate = tr.querySelector('.input-date');
    const inputPrefix = tr.querySelector('.input-prefix');
    const inputSuffix = tr.querySelector('.input-suffix');

    if (inputSerial && inputSerial.value.trim()) {
      rows.push({
        serial: inputSerial.value.trim(),
        serialCP: inputSerialCP ? inputSerialCP.value : '',
        invoice: inputInvoice ? inputInvoice.value : '',
        material: inputMat ? inputMat.value : '',
        description: inputDesc ? inputDesc.value : '',
        bin: inputBin ? inputBin.value : '',
        date: inputDate ? inputDate.value : '',
        prefix: inputPrefix ? inputPrefix.value : '',
        suffix: inputSuffix ? inputSuffix.value : ''
      });
    }
  });
  await AppDB.set(CACHE_KEYS.SERIAL, { meta, rows });
}

async function loadSerialCache() {
  const cached = await AppDB.get(CACHE_KEYS.SERIAL);
  if (!cached) {
    // If no cache, always start with one empty row
    addSerialRow();
    return;
  }
  try {
    const { meta, rows } = cached;
    if (meta) {
      serialInvoiceInput.value = meta.invoice || '';
      serialMatInput.value = meta.material || '';
      serialDescInput.value = meta.desc || '';
      serialBinInput.value = meta.bin || '';
      serialPrefixInput.value = meta.prefix || '';
      serialSuffixInput.value = meta.suffix || '';
      
      if (meta.material) {
        fillSerialTopByMaterial();
      }
    }
    
    serialTableBody.innerHTML = '';
    serialNextIndex = 1;

    if (rows && rows.length > 0) {
      rows.forEach(rowData => {
        addSerialRow();
        const trs = serialTableBody.querySelectorAll('tr');
        const tr = trs[trs.length - 1];
        const inputSerial = tr.querySelector('.input-serial');
        const inputDate = tr.querySelector('.input-date');
        
        if (inputSerial) {
          inputSerial.value = rowData.serial;
          const inputSerialCP = tr.querySelector('.input-serial-cp');
          const inputInvoice = tr.querySelector('.input-invoice');
          const inputMat = tr.querySelector('.input-mat');
          const inputDesc = tr.querySelector('.input-desc');
          const inputBin = tr.querySelector('.input-bin');
          const inputPrefix = tr.querySelector('.input-prefix');
          const inputSuffix = tr.querySelector('.input-suffix');
          
          if (inputSerialCP) inputSerialCP.value = rowData.serialCP || '';
          if (inputInvoice) inputInvoice.value = rowData.invoice || '';
          if (inputMat) inputMat.value = rowData.material || '';
          if (inputDesc) inputDesc.value = rowData.description || '';
          if (inputBin) inputBin.value = rowData.bin || '';
          if (inputPrefix) inputPrefix.value = rowData.prefix || '';
          if (inputSuffix) inputSuffix.value = rowData.suffix || '';
          if (inputDate) inputDate.value = rowData.date || '';
        }
      });
      // Add one empty row at the end
      addSerialRow();
      reindexSerialRows();
    } else {
      addSerialRow();
    }
    
    updateSerialSummary();
    updateSerialTableLock();
    // No need to call saveSerialCache here if reindexSerialRows already does it
  } catch (e) {
    console.error('Failed to load serial cache', e);
    serialTableBody.innerHTML = '';
    serialNextIndex = 1;
    addSerialRow();
  }
}

async function loadBarcodeCache() {
  const cached = await AppDB.get(CACHE_KEYS.BARCODE);
  if (!cached) return;
  try {
    const { meta, rows } = cached;
    if (meta) {
      if (empCodeInput) {
        empCodeInput.value = meta.employeeCode || '';
        employeeCode = meta.employeeCode || '';
        employeeName = meta.employeeName || '';
        employeeTeam = meta.employeeTeam || '';
        if (employeeName) {
          empStatus.textContent = `รหัสพนักงาน ${employeeCode} : ${employeeName} (${employeeTeam})`;
        }
      }
    }
    if (rows && rows.length > 0) {
      tableBody.innerHTML = '';
      nextIndex = 1;
      rows.forEach((rowData, idx) => {
        addNewRow();
        const trs = tableBody.querySelectorAll('tr');
        const tr = trs[trs.length - 1];
        const inputs = tr.querySelectorAll('input');
        if (inputs.length >= 7) {
          inputs[0].value = rowData.barcode || '';
          inputs[1].value = rowData.material || '';
          inputs[2].value = rowData.description || '';
          inputs[3].value = rowData.bin || '';
          inputs[4].value = rowData.remain || '';
          inputs[5].value = rowData.qty || '';
          inputs[6].value = rowData.pack || '';

          // Trigger total calculation
          const qtyInput = inputs[5];
          const packInput = inputs[6];
          const totalInput = inputs[inputs.length - 1];
          const q = parseInt(qtyInput.value, 10) || 0;
          const p = parseInt(packInput.value, 10) || 0;
          totalInput.value = q * p;
        }
      });
      // Add one empty row at the end if the last one isn't empty
      const lastRow = tableBody.querySelector('tr:last-child');
      if (lastRow) {
        const mat = lastRow.querySelector('input').value;
        if (mat) {
          nextIndex = rows.length + 1;
          addNewRow();
        }
      }
      updateRowIndices();
    }
  } catch (e) {
    console.error('Failed to load barcode cache', e);
  }
}

async function loadMaterialData() {
  const CACHE_KEY = `cache_material_${selectedPlant}`;
  const CACHE_TTL = 30 * 60 * 1000; // 30 นาที

  try {
    if (!dataUrl) throw new Error('missing plant data url');

    const cachedEntry = await AppDB.get(CACHE_KEY);

    // มี cache ยังไม่หมดอายุ → ใช้ทันที
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      materialDB = cachedEntry.data || [];
      if (dataStatusEl) {
        dataStatusEl.textContent = `โหลดฐานข้อมูล ${selectedPlant} จากแคช (จำนวน ${materialDB.length} รายการ)`;
      }
      return;
    }

    // มี cache หมดอายุ → ใช้ข้อมูลเก่าสำหรับ render ครั้งนี้ก่อน แล้ว refresh ใน background
    if (cachedEntry && cachedEntry.data && cachedEntry.data.length > 0) {
      materialDB = cachedEntry.data;
      if (dataStatusEl) {
        dataStatusEl.textContent = `โหลดฐานข้อมูล ${selectedPlant} จากแคช (อัปเดตใน background...)`;
      }
      // refresh in background
      fetch(dataUrl)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.length > 0) {
            materialDB = data;
            AppDB.set(CACHE_KEY, { timestamp: Date.now(), data: materialDB });
            if (dataStatusEl) {
              dataStatusEl.textContent = `โหลดฐานข้อมูล ${selectedPlant} สำเร็จ (จำนวน ${materialDB.length} รายการ)`;
            }
          }
        })
        .catch(e => console.warn('[MaterialData] Background refresh failed:', e.message));
      return;
    }

    // ไม่มี cache เลย → fetch ใหม่ (timeout 45 วิ)
    if (dataStatusEl) dataStatusEl.textContent = `กำลังโหลดข้อมูล ${selectedPlant}...`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(dataUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    materialDB = data || [];

    await AppDB.set(CACHE_KEY, { timestamp: Date.now(), data: materialDB });

    if (dataStatusEl) {
      dataStatusEl.textContent = `โหลดฐานข้อมูล ${selectedPlant} สำเร็จ (จำนวน ${materialDB.length} รายการ)`;
    }
  } catch (err) {
    console.error(err);
    if (dataStatusEl) {
      dataStatusEl.textContent = 'โหลดฐานข้อมูลไม่สำเร็จ กรุณารีหน้าใหม่';
    }
  }
}

async function loadCentralBinData() {
  const CACHE_KEY = 'cache_central_bin_data';
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour
  
  try {
    const url = PLANT_URLS['0301'];
    if (!url) throw new Error('missing central bin url');

    let data;
    const cachedEntry = await AppDB.get(CACHE_KEY);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      data = cachedEntry.data;
    }

    if (!data) {
      const res = await fetch(url);
      data = await res.json();
      await AppDB.set(CACHE_KEY, { timestamp: Date.now(), data });
    }

    centralBinMap = new Map();
    (Array.isArray(data) ? data : []).forEach(row => {
      const mat =
        row.Material || row.MATERIAL || row.material || row['Material Code'] || '';
      const bin =
        row['Storage bin'] ||
        row['STORAGE BIN'] ||
        row.StorageBin ||
        row['Storage Bin'] ||
        row['storage bin'] ||
        row['Stroage bin'] ||
        row['STROAGE BIN'] ||
        '';
      const matKey = String(mat || '').trim();
      const binValue = String(bin || '').trim();
      if (matKey && binValue) {
        centralBinMap.set(matKey, binValue);
      }
    });
  } catch (err) {
    console.error(err);
    centralBinMap = new Map();
  }
}

async function loadEmployeeData() {
  const CACHE_KEY = 'cache_employee_data';
  const CACHE_TTL = 30 * 60 * 1000; // 30 mins
  
  try {
    const cachedEntry = await AppDB.get(CACHE_KEY);
    if (cachedEntry) {
      if (Date.now() - cachedEntry.timestamp < CACHE_TTL) {
        employeeDB = cachedEntry.data;
        empStatus.textContent = `โหลดข้อมูลพนักงานจากแคช (จำนวน ${employeeDB.length} รายการ)`;
        return;
      }
    }

    const res = await fetch(EMP_URL);
    const data = await res.json();
    employeeDB = data;
    await AppDB.set(CACHE_KEY, { timestamp: Date.now(), data: employeeDB });

    empStatus.textContent = `โหลดข้อมูลพนักงานสำเร็จ (จำนวน ${employeeDB.length} รายการ)`;
  } catch (err) {
    console.error(err);
    empStatus.textContent = 'โหลดข้อมูลพนักงานไม่สำเร็จ กรุณารีหน้าใหม่';
  }
}

async function loadUserData() {
  const CACHE_KEY = 'cache_user_data_EmployeeWeb';
  const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 ชม.

  // ถ้าโหลดแล้วและมีข้อมูลอยู่แล้ว ไม่ต้องโหลดซ้ำ
  if (userDB && userDB.length > 0) return;

  try {
    const cachedEntry = await AppDB.get(CACHE_KEY);

    // มี cache อยู่ → ใช้ทันที (ไม่ว่าจะ expired หรือไม่)
    // แล้วค่อย refresh ใน background ถ้า cache หมดอายุ
    if (cachedEntry && cachedEntry.data && cachedEntry.data.length > 0) {
      userDB = cachedEntry.data;
      const isExpired = Date.now() - cachedEntry.timestamp >= CACHE_TTL;
      if (!isExpired) return; // ยังไม่หมดอายุ → ใช้ cache ได้เลย

      // หมดอายุแล้ว → refresh ใน background (ไม่ block login)
      fetch(USER_URL)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.length > 0) {
            userDB = data;
            AppDB.set(CACHE_KEY, { timestamp: Date.now(), data: userDB });
            console.log('[UserData] Background refresh complete:', userDB.length, 'records');
          }
        })
        .catch(e => console.warn('[UserData] Background refresh failed:', e.message));
      return;
    }

    // ไม่มี cache → fetch ใหม่ (เพิ่ม timeout เป็น 30 วิ)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(USER_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    userDB = data || [];

    await AppDB.set(CACHE_KEY, { timestamp: Date.now(), data: userDB });
  } catch (err) {
    console.error('loadUserData error:', err);
    // ถ้า fetch ล้มเหลว ลองใช้ stale cache อีกครั้ง
    const cachedEntry = await AppDB.get(CACHE_KEY);
    if (cachedEntry && cachedEntry.data) {
      console.warn('[UserData] Using stale cache after fetch failure');
      userDB = cachedEntry.data || [];
    } else {
      userDB = [];
    }
  }
}

// ? NEW: โหลดฐาน Parts และทำ map เพื่อค้นหาไว
async function loadPartsData() {
  const CACHE_KEY = 'cache_parts_data';
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour
  
  try {
    let data;
    const cachedEntry = await AppDB.get(CACHE_KEY);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      data = cachedEntry.data;
    }

    if (!data) {
      const res = await fetch(PARTS_URL);
      data = await res.json();
      await AppDB.set(CACHE_KEY, { timestamp: Date.now(), data });
    }

    partsDB = data || [];

    // สร้าง Map: Parts -> Material
    partsMap = new Map();
    partsDB.forEach(row => {
      const parts =
        row.Parts || row.PARTS || row.parts || row.Part || row.PART || row.part || row['Parts Code'] || '';
      const material =
        row.Material || row.MATERIAL || row.material || row['Material Code'] || '';

      const p = String(parts || '').trim().toUpperCase(); // Normalizing to Uppercase
      const m = String(material || '').trim();
      if (p && m) partsMap.set(p, m);
    });

    console.log(`[Parts Data] Mapping Loaded: ${partsMap.size} items`);

    if (dataStatusEl) {
      dataStatusEl.textContent =
        `โหลดฐานข้อมูล ${selectedPlant} สำเร็จ (จำนวน ${materialDB.length} รายการ) | Parts mapping: ${partsMap.size} รายการ`;
    }
  } catch (err) {
    console.error(err);
    if (dataStatusEl) {
      dataStatusEl.textContent =
        `โหลดฐานข้อมูล ${selectedPlant} สำเร็จ (จำนวน ${materialDB.length} รายการ) | โหลด Parts mapping ไม่สำเร็จ`;
    }
  }
}

async function loadSummarySyncData() {
  if (selectedPlant !== '0301' && selectedPlant !== '0326') return;
  const CACHE_KEY = `cache_summary_sync_${selectedPlant}`;
  const CACHE_TTL = 60 * 60 * 1000; // 1 ชม.

  try {
    const cachedEntry = await AppDB.get(CACHE_KEY);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      summarySyncDB = cachedEntry.data || [];
      console.log('Summary Sync loaded from cache:', summarySyncDB.length);
      return;
    }

    // ใช้ stale cache ถ้ามี แล้ว refresh ใน background
    if (cachedEntry && cachedEntry.data && cachedEntry.data.length > 0) {
      summarySyncDB = cachedEntry.data;
      fetch(SUMMARY_SYNC_URL)
        .then(r => r.json())
        .then(data => {
          summarySyncDB = data || [];
          AppDB.set(CACHE_KEY, { timestamp: Date.now(), data: summarySyncDB });
        })
        .catch(e => console.warn('[SummarySync] Background refresh failed:', e.message));
      return;
    }

    // ไม่มี cache → fetch ใหม่ (timeout 45 วิ)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(SUMMARY_SYNC_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await res.json();
    summarySyncDB = data || [];
    console.log('Summary Sync loaded:', summarySyncDB.length);

    await AppDB.set(CACHE_KEY, { timestamp: Date.now(), data: summarySyncDB });
  } catch (err) {
    console.error('Failed to load Summary Sync:', err);
    summarySyncDB = [];
  }
}

function showCallPendingPopup(material, description, totalPending) {
  const modal = document.getElementById('callPendingModal');
  if (!modal) return;

  const matEl = document.getElementById('cpMaterial');
  const descEl = document.getElementById('cpDescription');
  const countEl = document.getElementById('cpCount');

  if (matEl) matEl.textContent = material;
  if (descEl) descEl.textContent = description;
  if (countEl) countEl.textContent = totalPending;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeCallPendingPopup() {
  const modal = document.getElementById('callPendingModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function normalizeMaterialCode(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const len = trimmed.length;

  if (len === 3) return '30000' + trimmed;
  if (len === 4) return '3000' + trimmed;
  if (len === 5) return '300' + trimmed;
  return trimmed;
}

// ? NEW: normalize key สำหรับ Parts (กัน whitespace/ชนิดข้อมูล)
function normalizePartsKey(raw) {
  if (!raw) return '';
  return String(raw).trim().toUpperCase();
}

// ? NEW: ถ้ากรอกเป็น Parts ให้ map เป็น Material
function mapPartsToMaterialIfFound(inputValue) {
  const key = normalizePartsKey(inputValue);
  if (!key) return null;

  console.log(`[Mapping] Checking Part for: "${key}"`);

  // ตรงเป๊ะก่อน
  if (partsMap.has(key)) {
    const mat = partsMap.get(key);
    console.log(`[Mapping] Found Direct Match: ${key} -> ${mat}`);
    return mat;
  }

  // ลองตัดช่องว่างซ้ำ ๆ หรือรูปแบบแปลก (เผื่อกรณีสแกน)
  const compact = key.replace(/\s+/g, '');
  if (compact !== key && partsMap.has(compact)) {
    const mat = partsMap.get(compact);
    console.log(`[Mapping] Found Compact Match: ${compact} -> ${mat}`);
    return mat;
  }

  console.log(`[Mapping] No Part Match Found for: "${key}"`);
  return null;
}

function findMaterialInfo(materialCode) {
  if (!materialCode) return null;

  const m = materialDB.find(row => {
    const mat = row.Material || row.MATERIAL || row.material || row['Material Code'];
    return mat && String(mat).trim() === String(materialCode).trim();
  });

  if (!m) {
    console.warn(`[Material] Not Found: ${materialCode} in ${selectedPlant} Database`);
    return null;
  }

  console.log(`[Material] Found: ${materialCode} - Description: ${m['Material description'] || m.material_description || 'N/A'}`);

  const description =
    m['Material description'] ||
    m['material description'] ||
    m['MATERIAL DESCRIPTION'] ||
    '';

  const storageBin =
    m['Storage bin'] ||
    m['STORAGE BIN'] ||
    m.StorageBin ||
    m['Storage Bin'] ||
    '';

  const unrestricted =
    m['Unrestricted'] ||
    m['unrestricted'] ||
    m['UNRESTRICTED'] ||
    m['Unrestrict'] ||
    '';

  return { description, storageBin, unrestricted };
}

function getCentralBin(materialCode, fallback) {
  const normalized = String(materialCode || '').trim();
  const bin = centralBinMap.get(normalized) || '';
  if (bin) return bin;
  return (fallback || '').trim();
}

function findEmployeeById(id) {
  if (!id) return null;
  const trimmed = String(id).trim();

  return employeeDB.find(row => {
    const rec = row.IDRec || row.idrec || row.Id || row.ID;
    return rec && String(rec).trim() === trimmed;
  });
}

// ? แก้ตรงนี้: กรอก Barcode แล้วค่อยไปหา Material (ทั้งตรงๆ และผ่าน Parts Map)
function fillRowByBarcode(tr) {
  const inputs = tr.querySelectorAll('input');
  const [inputBarcode, inputMat, inputDesc, inputBin, inputRemain, inputQty, inputPack] = inputs;

  let barcodeRaw = inputBarcode.value.trim();
  if (!barcodeRaw) {
    rowStatusEl.textContent = 'กรุณากรอก Barcode';
    return false;
  }

  let targetMaterial = '';
  
  // 1) ลองหาในฐาน Material ตรงๆ ก่อน (กรณี Barcode คือ Material ID)
  const directInfo = findMaterialInfo(normalizeMaterialCode(barcodeRaw));
  
  if (directInfo && directInfo.description) {
    targetMaterial = normalizeMaterialCode(barcodeRaw);
    console.log(`[FillRow] Direct Material Match: ${targetMaterial}`);
  } else {
    // 2) ถ้าไม่เจอ ลองหาใน Parts Map
    const mappedMaterial = mapPartsToMaterialIfFound(barcodeRaw);
    if (mappedMaterial) {
      targetMaterial = mappedMaterial;
      console.log(`[FillRow] Part mapping used: ${barcodeRaw} -> ${targetMaterial}`);
      inputBarcode.classList.add('auto-mapped'); // Visual feedback
    }
  }

  if (!targetMaterial) {
    inputMat.value = '';
    inputDesc.value = '';
    inputBin.value = '';
    inputRemain.value = '';
    rowStatusEl.innerHTML =
      `<span class="not-found">ไม่พบข้อมูล Material หรือ Part: ${barcodeRaw}</span>`;
    inputBarcode.classList.remove('auto-mapped');
    inputBarcode.focus();
    inputBarcode.select();
    return false;
  }

  // 3) อัพเดทช่อง Material และดึงข้อมูลที่เกี่ยวข้อง
  inputMat.value = targetMaterial;
  const info = findMaterialInfo(targetMaterial);

  if (!info || !info.description) {
    inputDesc.value = '';
    inputBin.value = '';
    inputRemain.value = '';
    rowStatusEl.innerHTML =
      `<span class="not-found">ไม่พบ Description สำหรับ Material: ${targetMaterial}</span>`;
    return false;
  }

  inputDesc.value = info.description || '';
  inputBin.value = info.storageBin || '';
  inputRemain.value = info.unrestricted || '';

  rowStatusEl.textContent = '';

  // 4) Check Summary Sync for Plant 0301 and 0326
  if ((selectedPlant === '0301' || selectedPlant === '0326') && summarySyncDB.length > 0) {
    const found = summarySyncDB.find(row => {
      const mat = row.Material || row.MATERIAL || row.material;
      return mat && String(mat).trim() === targetMaterial;
    });
    if (found) {
      const totalPending = found.TotalPending || found.TOTALPENDING || found.totalpending || 0;
      if (parseInt(totalPending) > 0) {
        showCallPendingPopup(targetMaterial, info.description, totalPending);
      }
    }
  }

  return true;
}

function addNewRow() {
  const tr = document.createElement('tr');

  // ปุ่มลบ
  const tdDelete = document.createElement('td');
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'delete-row-btn';
  delBtn.textContent = 'ลบ';
  delBtn.addEventListener('click', () => {
    tr.remove();
    updateRowIndices();

    const rows = tableBody.querySelectorAll('tr');
    if (rows.length === 0) {
      nextIndex = 1;
      addNewRow();
    }
  });
  tdDelete.appendChild(delBtn);
  tr.appendChild(tdDelete);

  // ลำดับ
  const tdIndex = document.createElement('td');
  tdIndex.className = 'index-cell';
  tdIndex.textContent = nextIndex;
  tr.appendChild(tdIndex);

  // Barcode (Primary Input)
  const tdBarcode = document.createElement('td');
  const inputBarcode = document.createElement('input');
  inputBarcode.type = 'text';
  inputBarcode.placeholder = 'กรอก Barcode/Part';
  tdBarcode.appendChild(inputBarcode);
  tr.appendChild(tdBarcode);

  // Material (Resulting ID)
  const tdMat = document.createElement('td');
  const inputMat = document.createElement('input');
  inputMat.type = 'text';
  inputMat.placeholder = 'Material';
  inputMat.readOnly = true;
  tdMat.appendChild(inputMat);
  tr.appendChild(tdMat);

  // Description
  const tdDesc = document.createElement('td');
  const inputDesc = document.createElement('input');
  inputDesc.type = 'text';
  inputDesc.readOnly = true;
  tdDesc.appendChild(inputDesc);
  tr.appendChild(tdDesc);

  // Storage bin
  const tdBin = document.createElement('td');
  const inputBin = document.createElement('input');
  inputBin.type = 'text';
  inputBin.readOnly = true;
  tdBin.appendChild(inputBin);
  tr.appendChild(tdBin);

  // คงเหลือ
  const tdRemain = document.createElement('td');
  const inputRemain = document.createElement('input');
  inputRemain.type = 'text';
  inputRemain.readOnly = true;
  tdRemain.appendChild(inputRemain);
  tr.appendChild(tdRemain);

  // จำนวน
  const tdQty = document.createElement('td');
  const inputQty = document.createElement('input');
  inputQty.type = 'number';
  inputQty.min = '1';
  inputQty.placeholder = '1';
  inputQty.value = 1;
  tdQty.appendChild(inputQty);
  tr.appendChild(tdQty);

  // Pack
  const tdPack = document.createElement('td');
  const inputPack = document.createElement('input');
  inputPack.type = 'number';
  inputPack.min = '1';
  inputPack.placeholder = '1';
  inputPack.value = 1;
  tdPack.appendChild(inputPack);
  tr.appendChild(tdPack);

  // Total Qty (รวมจำนวน)
  const tdTotal = document.createElement('td');
  const inputTotal = document.createElement('input');
  inputTotal.type = 'text';
  inputTotal.readOnly = true;
  inputTotal.value = 1;
  tdTotal.appendChild(inputTotal);
  tr.appendChild(tdTotal);

  inputBarcode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const ok = fillRowByBarcode(tr);
      if (ok) {
        saveBarcodeCache();
        inputQty.focus();
        inputQty.select();
      }
    }
  });

  inputBarcode.addEventListener('blur', () => {
    const val = inputBarcode.value.trim();
    if (!val) return;

    const ok = fillRowByBarcode(tr);
    if (ok) {
      saveBarcodeCache();
      const qtyVal = inputQty.value.trim();
      if (qtyVal && parseInt(qtyVal) > 0) {
        if (!tr.nextElementSibling) {
          nextIndex++;
          addNewRow();
          updateRowIndices();
        }
      }
    }
  });

  inputBarcode.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    handlePasteBarcodes(pastedText, tr);
  });


  const updateTotal = () => {
    const q = parseInt(inputQty.value, 10) || 0;
    const p = parseInt(inputPack.value, 10) || 0;
    inputTotal.value = q * p;
  };

  inputQty.addEventListener('input', () => {
    updateTotal();
    saveBarcodeCache();
  });
  inputPack.addEventListener('input', () => {
    updateTotal();
    saveBarcodeCache();
  });

  inputQty.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!inputMat.value.trim() || !inputDesc.value.trim()) {
        rowStatusEl.textContent = 'กรุณากรอก Barcode ให้ถูกต้องก่อน';
        inputBarcode.focus();
        return;
      }

      const nextRow = tr.nextElementSibling;
      if (nextRow) {
        const nextInput = nextRow.querySelector('td:nth-child(3) input'); // Barcode is 3rd col
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      } else {
        nextIndex++;
        addNewRow();
        updateRowIndices();
      }
    }
  });

  inputQty.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    handlePasteQuantities(pastedText, tr);
  });

  tableBody.appendChild(tr);
  inputBarcode.focus();
}

if (empCodeInput) {
  empCodeInput.addEventListener('input', () => {
    const code = empCodeInput.value.trim();
    employeeCode = code;

    if (!code) {
      empStatus.textContent = 'กรุณากรอกรหัสพนักงาน';
      employeeName = '';
      employeeTeam = '';
      return;
    }

    const emp = findEmployeeById(code);
    if (!emp) {
      empStatus.innerHTML =
        `<span class="not-found">ไม่พบรหัสพนักงาน: ${code}</span>`;
      employeeName = '';
      employeeTeam = '';
      return;
    }

    const name = emp.Name || emp.NAME || emp['Employee Name'] || '';
    const team = emp.Team || emp.TEAM || emp['Team Name'] || '';
    employeeName = name;
    employeeTeam = team;
    empStatus.textContent =
      `รหัสพนักงาน ${code} : ${name} (${team})`;

    saveBarcodeCache();

    const firstMat = document.querySelector('#entryTable tbody tr:first-child input');
    if (firstMat) {
      firstMat.focus();
      firstMat.select();
    }
  });
}

function updateRowIndices() {
  const rows = tableBody.querySelectorAll('tr');
  let idx = 1;
  rows.forEach(tr => {
    const indexCell = tr.querySelector('td.index-cell');
    if (indexCell) {
      indexCell.textContent = idx++;
    }
  })
  nextIndex = idx;
  saveBarcodeCache();
}

function handlePasteBarcodes(text, currentRow) {
  if (!text || !text.trim()) return;

  const lines = text.split(/\r?\n/)
    .map(line => {
      const firstCol = line.split('\t')[0];
      return firstCol.trim();
    })
    .filter(line => line);

  if (lines.length === 0) return;

  if (lines.length === 1) {
    const inputs = currentRow.querySelectorAll('input');
    const inputBarcode = inputs[0];
    inputBarcode.value = lines[0];
    fillRowByBarcode(currentRow);

    // Focus ไปที่ช่องจำนวน
    const inputQty = inputs[5]; // Now 6th input (0:Barcode, 1:Mat, 2:Desc, 3:Bin, 4:Remain, 5:Qty)
    if (inputQty) {
      inputQty.focus();
      inputQty.select();
    }
    return;
  }

  const inputs = currentRow.querySelectorAll('input');
  const inputBarcode = inputs[0];

  inputBarcode.value = lines[0];
  fillRowByBarcode(currentRow);

  for (let i = 1; i < lines.length; i++) {
    nextIndex++;
    addNewRow();
    updateRowIndices();

    const rows = tableBody.querySelectorAll('tr');
    const newRow = rows[rows.length - 1];
    const newInputs = newRow.querySelectorAll('input');
    const newInputBarcode = newInputs[0];

    newInputBarcode.value = lines[i];
    fillRowByBarcode(newRow);
  }

  nextIndex++;
  addNewRow();
  updateRowIndices();

  const rows = tableBody.querySelectorAll('tr');
  const lastDataRow = rows[rows.length - 2]; 
  const lastInputs = lastDataRow.querySelectorAll('input');
  const lastQtyInput = lastInputs[5]; // จำนวน input
  if (lastQtyInput) {
    lastQtyInput.focus();
    lastQtyInput.select();
  }

  if (rowStatusEl) {
    rowStatusEl.textContent = `วางข้อมูล ${lines.length} รายการสำเร็จ`;
  }
}

function handlePasteQuantities(text, currentRow) {
  if (!text || !text.trim()) return;

  // แยกข้อมูลตาม newline และกรอง empty lines
  const quantities = text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !isNaN(line));

  if (quantities.length === 0) return;

  // หาทุกแถวที่มีอยู่
  const allRows = Array.from(tableBody.querySelectorAll('tr'));
  const currentIndex = allRows.indexOf(currentRow);

  if (currentIndex === -1) return;

  // เติมจำนวนในแถวปัจจุบันและแถวถัดไป
  let filledCount = 0;
  for (let i = 0; i < quantities.length && (currentIndex + i) < allRows.length; i++) {
    const row = allRows[currentIndex + i];
    const inputs = row.querySelectorAll('input');
    const inputQty = inputs[5]; // Now 6th input (index 5)

    if (inputQty) {
      inputQty.value = quantities[i];
      // Trigger updateTotal
      const event = new Event('input', { bubbles: true });
      inputQty.dispatchEvent(event);
      filledCount++;
    }
  }

  // ถ้ามีจำนวนเหลือและไม่มีแถวพอ ให้แจ้งเตือน
  if (quantities.length > filledCount) {
    if (rowStatusEl) {
      rowStatusEl.textContent = `วางจำนวน ${filledCount} รายการสำเร็จ (มีข้อมูล ${quantities.length - filledCount} รายการที่ไม่มีแถว)`;
    }
  } else {
    if (rowStatusEl) {
      rowStatusEl.textContent = `วางจำนวน ${filledCount} รายการสำเร็จ`;
    }
  }

  // Focus ไปที่แถวสุดท้ายที่เติมข้อมูล
  const lastFilledRow = allRows[currentIndex + filledCount - 1];
  if (lastFilledRow) {
    const lastInputs = lastFilledRow.querySelectorAll('input');
    const lastQtyInput = lastInputs[5]; // index 5
    if (lastQtyInput) {
      lastQtyInput.focus();
      lastQtyInput.select();
    }
  }
}


function collectPrintData() {
  const rows = Array.from(tableBody.querySelectorAll('tr'));
  const data = [];

  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (inputs.length < 7) return;

    const [inputBarcode, inputMat, inputDesc, inputBin, inputRemain, inputQty, inputPack] = inputs;
    const material = inputMat.value.trim();
    if (!material) return;

    const qty = parseInt(inputQty.value, 10) || 1;

    data.push({
      Material: material,
      จำนวน: qty,
      Pack: inputPack.value || '',
      IDช่าง: employeeCode || '',
      Serial: '-',
      Description: inputDesc.value || '',
      Storagebin: inputBin.value || '',
      ชื่อช่าง: employeeName || '',
      Unit: 'pc',
      แผนก: employeeTeam || ''
    });
  });

  return data;
}

// Small label
function createPrintLabelSmall(row) {
  const label = document.createElement('div');
  label.className = 'label-small';

  const rowDiv = document.createElement('div');
  rowDiv.className = 'row-small';

  const qrCanvas = document.createElement('canvas');
  qrCanvas.className = 'qr-small';
  rowDiv.appendChild(qrCanvas);

  const textContainer = document.createElement('div');
  textContainer.style.display = 'flex';
  textContainer.style.flexDirection = 'column';

  const materialDiv = document.createElement('div');
  materialDiv.className = 'material-small';
  materialDiv.textContent = row.Material;
  textContainer.appendChild(materialDiv);

  const techNameRaw = row.ชื่อช่าง || '';
  const technicianName = techNameRaw.replace(/^นาย\s+/, '').trim();
  if (technicianName) {
    const technicianDiv = document.createElement('div');
    technicianDiv.className = 'technician-small';
    technicianDiv.textContent = technicianName;
    textContainer.appendChild(technicianDiv);
  }

  const dept = (row.แผนก || '').trim();
  if (dept) {
    const departmentDiv = document.createElement('div');
    departmentDiv.className = 'department-small';
    departmentDiv.textContent = dept;
    textContainer.appendChild(departmentDiv);
  }

  rowDiv.appendChild(textContainer);
  label.appendChild(rowDiv);

  const descText = (row.Description || '').trim();
  if (descText) {
    const desc = document.createElement('div');
    desc.className = 'description-small';
    desc.textContent = descText;
    label.appendChild(desc);
  }

  const locLine = document.createElement('div');
  locLine.style.display = 'flex';
  locLine.style.alignItems = 'center';
  locLine.style.fontSize = '12px';
  locLine.style.fontWeight = 'bold';
  locLine.style.lineHeight = '1.1';
  locLine.style.marginLeft = '2mm';
  locLine.style.marginTop = '1px';
  locLine.style.marginBottom = '0';

  const locTextStr = (row.Storagebin || '').trim();
  if (locTextStr) {
    const locText = document.createElement('span');
    locText.textContent = `Loc: ${locTextStr}`;
    locLine.appendChild(locText);
  }

  const barcodeCanvas = document.createElement('canvas');
  barcodeCanvas.className = 'barcode-small';
  locLine.appendChild(barcodeCanvas);
  label.appendChild(locLine);

  const now = new Date();
  const formattedDate =
    `${now.getFullYear().toString().slice(2)}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}` +
    `${String(now.getHours()).padStart(2, '0')}` +
    `${String(now.getMinutes()).padStart(2, '0')}`;

  const lot = document.createElement('div');
  lot.className = 'lot-line-small';

  const parts = [];
  parts.push(`Lot: ${formattedDate}`);
  const qtyText = row.จำนวน ? `(${row.จำนวน})` : '';
  if (qtyText) parts.push(qtyText);
  const packText = (row.Pack || '').trim();
  if (packText) parts.push(packText);
  const unitText = (row.Unit || '').trim();
  if (unitText) parts.push(unitText);

  lot.innerHTML = `<span>${parts.join(' ')}</span>`;
  label.appendChild(lot);

  const qrData = (row.Serial && row.Serial !== '-') ? row.Serial : (row.Material || 'N/A');
  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(qrCanvas, qrData, {
      width: 40,
      height: 40,
      margin: 0,
      errorCorrectionLevel: 'L'
    }, err => { if (err) console.error('QR Error:', err); });
  }

  if (typeof JsBarcode !== 'undefined' && row.Material) {
    JsBarcode(barcodeCanvas, row.Material, {
      format: 'CODE128',
      width: 1,
      height: 15,
      displayValue: false,
      margin: 0
    });
  }

  return label;
}

// Medium label (60x70 mm)
function createPrintLabelMedium(row) {
  const label = document.createElement('div');
  label.className = 'label-medium';

  const rowDiv = document.createElement('div');
  rowDiv.className = 'row-medium';

  const qrCanvas = document.createElement('canvas');
  qrCanvas.className = 'qr-medium';
  rowDiv.appendChild(qrCanvas);

  const textContainer = document.createElement('div');
  textContainer.style.display = 'flex';
  textContainer.style.flexDirection = 'column';

  const materialDiv = document.createElement('div');
  materialDiv.className = 'material-medium';
  materialDiv.textContent = row.Material;
  textContainer.appendChild(materialDiv);

  const techNameRaw = row.ชื่อช่าง || '';
  const technicianName = techNameRaw.replace(/^นาย\s+/, '').trim();
  if (technicianName) {
    const technicianDiv = document.createElement('div');
    technicianDiv.className = 'technician-medium';
    technicianDiv.textContent = technicianName;
    textContainer.appendChild(technicianDiv);
  }

  const dept = (row.แผนก || '').trim();
  if (dept) {
    const departmentDiv = document.createElement('div');
    departmentDiv.className = 'department-medium';
    departmentDiv.textContent = dept;
    textContainer.appendChild(departmentDiv);
  }

  rowDiv.appendChild(textContainer);
  label.appendChild(rowDiv);

  const descText = (row.Description || '').trim();
  if (descText) {
    const desc = document.createElement('div');
    desc.className = 'description-medium';
    desc.textContent = descText;
    label.appendChild(desc);
  }

  const locLine = document.createElement('div');
  locLine.className = 'loc-line-medium';

  const locTextStr = (row.Storagebin || '').trim();
  if (locTextStr) {
    const locText = document.createElement('span');
    locText.textContent = `Loc: ${locTextStr}`;
    locLine.appendChild(locText);
  }

  const barcodeCanvas = document.createElement('canvas');
  barcodeCanvas.className = 'barcode-medium';
  locLine.appendChild(barcodeCanvas);
  label.appendChild(locLine);

  const now = new Date();
  const formattedDate =
    `${now.getFullYear().toString().slice(2)}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}` +
    `${String(now.getHours()).padStart(2, '0')}` +
    `${String(now.getMinutes()).padStart(2, '0')}`;

  const lot = document.createElement('div');
  lot.className = 'lot-line-medium';

  const parts = [];
  parts.push(`Lot: ${formattedDate}`);
  const qtyText = row.จำนวน ? `(${row.จำนวน})` : '';
  if (qtyText) parts.push(qtyText);
  lot.innerHTML = `<span>${parts.join(' ')}</span>`;
  label.appendChild(lot);

  const centralBin = getCentralBin(row.Material, row.Storagebin);
  if (centralBin) {
    const central = document.createElement('div');
    central.className = 'central-bin-medium';
    central.textContent = `Central Bin : ${centralBin}`;
    label.appendChild(central);
  }

  const packText = (row.Pack || '').trim();
  const unitText = (row.Unit || '').trim();
  const packUnitText = `${packText} ${unitText}`.trim();
  if (packUnitText) {
    const centerPackUnit = document.createElement('div');
    centerPackUnit.className = 'center-pack-unit-medium';
    centerPackUnit.textContent = packUnitText;
    label.appendChild(centerPackUnit);
  }

  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(qrCanvas, row.Material || 'N/A', {
      width: 45,
      height: 45,
      margin: 0,
      errorCorrectionLevel: 'L'
    }, err => { if (err) console.error('QR Error:', err); });
  }

  if (typeof JsBarcode !== 'undefined' && row.Material) {
    JsBarcode(barcodeCanvas, row.Material, {
      format: 'CODE128',
      width: 1,
      height: 18,
      displayValue: false,
      margin: 0
    });
  }

  return label;
}

function buildPrintLabelsSmall(data) {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'container-small';
  printArea.appendChild(container);

  const expanded = [];
  data.forEach(row => {
    const qty = Math.max(1, row.จำนวน);
    for (let i = 0; i < qty; i++) {
      expanded.push({ ...row });
    }
  });

  for (let i = 0; i < expanded.length; i += 2) {
    const sticker = document.createElement('div');
    sticker.className = 'sticker-small';

    const label1 = createPrintLabelSmall(expanded[i]);
    sticker.appendChild(label1);

    if (i + 1 < expanded.length) {
      const label2 = createPrintLabelSmall(expanded[i + 1]);
      sticker.appendChild(label2);
    } else {
      const emptyLabel = document.createElement('div');
      emptyLabel.className = 'label-small';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'description-small';
      emptyDiv.textContent = 'ไม่มีข้อมูล';
      emptyLabel.appendChild(emptyDiv);
      sticker.appendChild(emptyLabel);
    }

    container.appendChild(sticker);
  }
}

function buildPrintLabelsMedium(data) {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'container-medium';
  printArea.appendChild(container);

  const expanded = [];
  data.forEach(row => {
    const qty = Math.max(1, row.จำนวน);
    for (let i = 0; i < qty; i++) {
      expanded.push({ ...row });
    }
  });

  expanded.forEach(row => {
    const sticker = document.createElement('div');
    sticker.className = 'sticker-medium';
    const label = createPrintLabelMedium(row);
    sticker.appendChild(label);
    container.appendChild(sticker);
  });
}

// Big label (barcode tab)
function createPrintLabelBig(row) {
  const label = document.createElement('div');
  label.className = 'label-big';

  const rowDiv = document.createElement('div');
  rowDiv.className = 'row-big';

  const leftCol = document.createElement('div');
  leftCol.style.display = 'flex';
  leftCol.style.flexDirection = 'column';
  leftCol.style.alignItems = 'flex-start';

  const qrCanvas = document.createElement('canvas');
  qrCanvas.className = 'qr-big';
  leftCol.appendChild(qrCanvas);

  const barcodeCanvas = document.createElement('canvas');
  barcodeCanvas.className = 'barcode-big';
  leftCol.appendChild(barcodeCanvas);

  rowDiv.appendChild(leftCol);

  const textContainer = document.createElement('div');
  textContainer.className = 'text-container-big';

  const materialDiv = document.createElement('div');
  materialDiv.className = 'material-big';
  materialDiv.textContent = row.Material;
  textContainer.appendChild(materialDiv);

  const techNameRaw = row.ชื่อช่าง || '';
  const technicianName = techNameRaw.replace(/^นาย\s+/, '').trim();
  if (technicianName) {
    const technicianDiv = document.createElement('div');
    technicianDiv.className = 'technician-big';
    technicianDiv.textContent = technicianName;
    textContainer.appendChild(technicianDiv);
  }

  const dept = (row.แผนก || '').trim();
  if (dept) {
    const departmentDiv = document.createElement('div');
    departmentDiv.className = 'department-big';
    departmentDiv.textContent = dept;
    textContainer.appendChild(departmentDiv);
  }

  rowDiv.appendChild(textContainer);

  const descText = (row.Description || '').trim();
  if (descText) {
    const desc = document.createElement('div');
    desc.className = 'description-big';
    desc.textContent = descText;
    rowDiv.appendChild(desc);
  }

  label.appendChild(rowDiv);

  const bottomContainer = document.createElement('div');
  bottomContainer.className = 'bottom-container-big';

  const now = new Date();
  const formattedDate =
    `${now.getFullYear().toString().slice(2)}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}` +
    `${String(now.getHours()).padStart(2, '0')}` +
    `${String(now.getMinutes()).padStart(2, '0')}`;

  const locTextStr = (row.Storagebin || '').trim();
  if (locTextStr) {
    const loc = document.createElement('div');
    loc.className = 'location-big';
    loc.textContent = `Location: ${locTextStr}`;
    bottomContainer.appendChild(loc);
  }

  const lot = document.createElement('div');
  lot.className = 'lot-line-big';
  lot.textContent = `Lot: ${formattedDate} Qty(${row.จำนวน || 1})`;
  bottomContainer.appendChild(lot);

  label.appendChild(bottomContainer);

  const centerPackUnit = document.createElement('div');
  centerPackUnit.className = 'center-pack-unit-big';
  const packText = (row.Pack || '').trim();
  const unitText = (row.Unit || '').trim();
  centerPackUnit.textContent = `${packText} ${unitText}`.trim();
  label.appendChild(centerPackUnit);

  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(qrCanvas, row.Material || 'N/A', {
      width: 55,
      height: 55,
      margin: 0,
      errorCorrectionLevel: 'L'
    }, err => { if (err) console.error('QR Error:', err); });
  }

  if (typeof JsBarcode !== 'undefined' && row.Material) {
    JsBarcode(barcodeCanvas, row.Material, {
      format: 'CODE128',
      width: 1,
      height: 25,
      displayValue: false,
      margin: 0
    });
  }

  return label;
}

function buildPrintLabelsBig(data) {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'container-big';
  printArea.appendChild(container);

  const expanded = [];
  data.forEach(row => {
    const qty = Math.max(1, row.จำนวน);
    for (let i = 0; i < qty; i++) {
      expanded.push({ ...row });
    }
  });

  expanded.forEach(row => {
    const sticker = document.createElement('div');
    sticker.className = 'sticker-big';
    const label = createPrintLabelBig(row);
    sticker.appendChild(label);
    container.appendChild(sticker);
  });
}

function waitForImages(container) {
  const imgs = Array.from(container.querySelectorAll('img'));
  const promises = imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve; // Continue anyway if image fails
    });
  });
  return Promise.all(promises);
}

function sortDataByMaterial(data) {
  if (!Array.isArray(data)) return [];
  return [...data].sort((a, b) => {
    const matA = String(a.Material || '').trim();
    const matB = String(b.Material || '').trim();
    return matA.localeCompare(matB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function handlePrintSmall() {
  const rawData = collectPrintData();
  if (!rawData.length) {
    alert('กรุณากรอก Material อย่างน้อย 1 แถวก่อนพิมพ์');
    return;
  }
  const data = sortDataByMaterial(rawData);
  setPrintMode('small');
  showMainLoading(true, 'กำลังเตรียมพิมพ์...');
  setTimeout(() => {
    buildPrintLabelsSmall(data);
    showMainLoading(false);
    window.print();
  }, 200);
}

function handlePrintBig() {
  const rawData = collectPrintData();
  if (!rawData.length) {
    alert('กรุณากรอก Material อย่างน้อย 1 แถวก่อนพิมพ์');
    return;
  }
  const data = sortDataByMaterial(rawData);
  setPrintMode('big');
  showMainLoading(true, 'กำลังเตรียมพิมพ์...');
  setTimeout(() => {
    buildPrintLabelsBig(data);
    showMainLoading(false);
    window.print();
  }, 200);
}

function handlePrintMedium() {
  const rawData = collectPrintData();
  if (!rawData.length) {
    alert('กรุณากรอก Material อย่างน้อย 1 แถวก่อนพิมพ์');
    return;
  }
  const data = sortDataByMaterial(rawData);
  setPrintMode('medium');
  showMainLoading(true, 'กำลังเตรียมพิมพ์...');
  setTimeout(() => {
    buildPrintLabelsMedium(data);
    showMainLoading(false);
    window.print();
  }, 200);
}

// Fragile label (80x100 mm)
function createPrintLabelFragile(row) {
  const label = document.createElement('div');
  label.className = 'label-fragile';

  // Image Fragile Icon (Broken Glass)
  const icon = document.createElement('div');
  icon.className = 'fragile-icon-container';
  icon.innerHTML = `<img src="broken_glass.png" class="fragile-icon" style="width: 76mm; height: 60mm; object-fit: contain;">`;
  label.appendChild(icon);

  const title = document.createElement('div');
  title.className = 'fragile-title';
  title.style.marginTop = '-5mm'; // Pull up slightly to overlap/overlap nicely
  title.textContent = 'ระวังแตก';
  label.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'fragile-desc';
  desc.innerHTML = 'กระจก อะไหล่แตกหักเสียหายง่าย';
  label.appendChild(desc);

  return label;
}

function buildPrintLabelsFragile(data) {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'container-big'; // Use container-big for 80mm width
  printArea.appendChild(container);

  const expanded = [];
  data.forEach(row => {
    const qty = Math.max(1, row.จำนวน);
    for (let i = 0; i < qty; i++) {
      expanded.push({ ...row });
    }
  });

  expanded.forEach(row => {
    const sticker = document.createElement('div');
    sticker.className = 'sticker-fragile';
    const label = createPrintLabelFragile(row);
    sticker.appendChild(label);
    container.appendChild(sticker);
  });
}

async function handlePrintFragile() {
  let data = collectPrintData();
  if (!data.length) {
    // New: Allow printing without material data (default to 1 sticker)
    data = [{
      Material: '-',
      จำนวน: 1,
      Description: '-',
      Storagebin: '-'
    }];
  }
  setPrintMode('big'); // Use big mode for 80x100
  showMainLoading(true, 'กำลังเตรียมพิมพ์...');
  
  // Build the labels
  buildPrintLabelsFragile(data);
  
  // Wait for images to load before printing
  const printArea = document.getElementById('printArea');
  await waitForImages(printArea);
  
  showMainLoading(false);
  window.print();
}

function setPrintMode(mode) {
  document.body.classList.remove('print-mode-small', 'print-mode-medium', 'print-mode-big');
  if (mode) {
    document.body.classList.add(`print-mode-${mode}`);
  }
}

window.addEventListener('afterprint', () => {
  setPrintMode(null);
});

document.getElementById('printSmallBtn').addEventListener('click', handlePrintSmall);
document.getElementById('printMediumBtn').addEventListener('click', handlePrintMedium);
document.getElementById('printBigBtn').addEventListener('click', handlePrintBig);
document.getElementById('printFragileBtn').addEventListener('click', handlePrintFragile);

// ====== ส่วน Serial Tab ======
const serialInvoiceInput = document.getElementById('serialInvoiceInput');
const serialMatInput = document.getElementById('serialMatInput');
const serialDescInput = document.getElementById('serialDescInput');
const serialBinInput = document.getElementById('serialBinInput');
const serialPrefixInput = document.getElementById('serialPrefixInput');
const serialSuffixInput = document.getElementById('serialSuffixInput');
const serialTopStatus = document.getElementById('serialTopStatus');
const serialTableBody = document.querySelector('#serialTable tbody');
const serialStatusEl = document.getElementById('serialStatus');
const serialSummaryInvoice = document.getElementById('serialSummaryInvoice');
const serialSummaryMaterial = document.getElementById('serialSummaryMaterial');
const serialSummaryCount = document.getElementById('serialSummaryCount');
const saveSerialBtn = document.getElementById('saveSerialBtn');
const printSerialBtn = document.getElementById('printSerialBtn');
const clearAllSerialBtn = document.getElementById('clearAllSerialBtn');
let serialNextIndex = 1;
const SERIAL_LOCK_MESSAGE = 'กรอก Material ก่อนจึงจะกรอก Serial ในตารางได้';
const SERIAL_SAVE_URL = 'https://script.google.com/macros/s/AKfycbxp4CCxoAEpPoyYIkPrVZGgZ6ocB4Z-CM6_rqU67Gl6h9UGATCVUYM2d8uWmDYJVrYfVg/exec';
const confirmModal = document.getElementById('confirmModal');
const confirmModalMessage = document.getElementById('confirmModalMessage');
const confirmSaveBtn = document.getElementById('confirmSaveBtn');
const cancelSaveBtn = document.getElementById('cancelSaveBtn');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const cancelDefaultText = cancelSaveBtn ? cancelSaveBtn.textContent : '';

function getNowString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function updateSerialSummary() {
  if (serialSummaryInvoice) {
    const v = serialInvoiceInput.value.trim() || '-';
    serialSummaryInvoice.querySelector('.serial-chip-value').textContent = v;
  }
  if (serialSummaryMaterial) {
    const v = serialMatInput.value.trim() || '-';
    serialSummaryMaterial.querySelector('.serial-chip-value').textContent = v;
  }
  if (serialSummaryCount) {
    const count = serialTableBody.querySelectorAll('tr').length;
    serialSummaryCount.querySelector('.serial-chip-value').textContent = `${count} แถว`;
  }
}

function isSerialMaterialReady() {
  return serialMatInput && serialMatInput.value.trim();
}

function updateSerialTableLock() {
  if (!serialTableBody) return;
  const ready = isSerialMaterialReady();
  const serialInputs = serialTableBody.querySelectorAll('.serial-entry-input');
  serialInputs.forEach(input => {
    input.disabled = !ready;
  });
  if (!ready && serialStatusEl) {
    serialStatusEl.textContent = SERIAL_LOCK_MESSAGE;
  } else if (ready && serialStatusEl && serialStatusEl.textContent === SERIAL_LOCK_MESSAGE) {
    serialStatusEl.textContent = 'แถวแรกถูกสร้างให้แล้ว กรอก Serial แล้วกด Enter เพื่อสร้างแถวถัดไป';
  }
}

if (serialInvoiceInput) {
  serialInvoiceInput.addEventListener('input', () => {
    updateSerialSummary();
    saveSerialCache();
  });
}
if (serialPrefixInput) {
  serialPrefixInput.addEventListener('input', () => {
    saveSerialCache();
    // Also update prefixes in existing rows if needed? 
    // The current logic seems to set it when row is created.
  });
}
if (serialSuffixInput) {
  serialSuffixInput.addEventListener('input', () => {
    saveSerialCache();
  });
}

function fillSerialTopByMaterial() {
  let mat = serialMatInput.value.trim();
  if (!mat) {
    serialDescInput.value = '';
    serialBinInput.value = '';
    serialTopStatus.textContent = 'กรอก Material เพื่อดึง Description / Storage bin จากฐานข้อมูล';
    serialTopStatus.textContent = '';
    updateSerialSummary();
    updateSerialTableLock();
    return;
  }

  const normalized = normalizeMaterialCode(mat);
  serialMatInput.value = normalized;

  const info = findMaterialInfo(normalized);
  if (!info || !info.description) {
    serialDescInput.value = '';
    serialBinInput.value = '';
    serialTopStatus.innerHTML =
      `<span class="not-found">ไม่พบ Material หรือไม่มี Description: ${normalized}</span>`;
    updateSerialSummary();
    updateSerialTableLock();
    return;
  }

  serialDescInput.value = info.description || '';
  serialBinInput.value = info.storageBin || '';
  serialTopStatus.textContent = '';
  updateSerialSummary();
  updateSerialTableLock();
  saveSerialCache();
}


if (serialMatInput) {
  serialMatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fillSerialTopByMaterial();
      // Focus ไปที่ Invoice field หลังจากกรอก Material
      if (serialInvoiceInput) {
        serialInvoiceInput.focus();
        serialInvoiceInput.select();
      }
    }
  });

  serialMatInput.addEventListener('blur', () => {
    fillSerialTopByMaterial();
  });
}


function handlePasteSerials(text, startingInput) {
  if (!text || !text.trim()) return;

  const lines = text.split(/\r?\n/)
    .map(line => line.split('\t')[0].trim())
    .filter(line => line);

  if (lines.length === 0) return;

  const currentPrefix = serialPrefixInput.value || '';
  const currentSuffix = serialSuffixInput.value || '';

  const existingInTable = new Set();
  const rows = serialTableBody.querySelectorAll('tr');
  rows.forEach(r => {
    const existingCPInput = r.querySelector('.input-serial-cp');
    if (existingCPInput && existingCPInput.value.trim()) {
      existingInTable.add(existingCPInput.value.trim());
    }
  });

  const duplicates = [];
  const validLines = [];
  const seenInPaste = new Set();

  for (const line of lines) {
    const potentialSerialCP = (currentPrefix + line + currentSuffix).trim();

    if (seenInPaste.has(potentialSerialCP)) {
      duplicates.push(`${potentialSerialCP} (ซ้ำในที่วาง)`);
      continue;
    }
    seenInPaste.add(potentialSerialCP);

    if (existingInTable.has(potentialSerialCP)) {
      duplicates.push(`${potentialSerialCP} (ซ้ำในตาราง)`);
      continue;
    }

    let foundInGRN = false;
    if (typeof grnDB !== 'undefined' && grnDB && grnDB.length > 0) {
      const found = grnDB.find(g => g.SerialCP === potentialSerialCP);
      if (found) {
        duplicates.push(`${potentialSerialCP} (ซ้ำในระบบ GRN)`);
        foundInGRN = true;
      }
    }

    if (!foundInGRN) {
      validLines.push(line);
    }
  }

  if (duplicates.length > 0) {
    const maxDisplay = 20;
    let alertMsg = 'พบข้อมูล Serial ซ้ำ:\n' + duplicates.slice(0, maxDisplay).join('\n');
    if (duplicates.length > maxDisplay) {
      alertMsg += `\n...และอีก ${duplicates.length - maxDisplay} รายการ`;
    }
    alert(alertMsg);

    if (validLines.length === 0) {
      if (serialStatusEl) {
        serialStatusEl.textContent = 'ข้อมูลที่วางซ้ำทั้งหมด ยกเลิกการวางข้อมูล';
      }
      return;
    }
  }

  let currentIndex = 0;

  function processNextLine(currentInput) {
    if (currentIndex >= validLines.length || !currentInput) {
      if (serialStatusEl) {
        serialStatusEl.textContent = `วางข้อมูล Serial ${validLines.length} รายการสำเร็จ` + (duplicates.length > 0 ? ` (ข้ามข้อมูลซ้ำ ${duplicates.length} รายการ)` : '');
      }
      return;
    }

    currentInput.value = validLines[currentIndex];

    if (typeof currentInput.commitRow === 'function') {
      currentInput.commitRow();
    }

    currentIndex++;

    // ใช้ setTimeout เพื่อรอให้ DOM อัพเดท (สร้างแถวใหม่เสร็จสิ้น) ก่อนที่จะไปกรอกแถวถัดไป
    setTimeout(() => {
      const currentRows = serialTableBody.querySelectorAll('tr');
      if (currentRows.length > 0) {
        const lastRow = currentRows[currentRows.length - 1];
        const nextInput = lastRow.querySelector('.serial-entry-input');
        if (nextInput !== currentInput) {
          processNextLine(nextInput);
        } else {
          // ถ้ายังเป็น input เดิม แสดงว่าเกิดข้อผิดพลาดอื่น
          if (serialStatusEl) {
            serialStatusEl.textContent = `พบปัญหาในการบันทึก หยุดการวางข้อมูลที่รายการที่ ${currentIndex}`;
          }
        }
      }
    }, 10);
  }

  processNextLine(startingInput);
}

function addSerialRow() {
  const tr = document.createElement('tr');

  const tdDelete = document.createElement('td');
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.textContent = 'ลบ';
  delBtn.className = 'delete-btn';
  delBtn.addEventListener('click', () => {
    tr.remove();
    reindexSerialRows();
    saveSerialCache();
  });
  tdDelete.appendChild(delBtn);
  tr.appendChild(tdDelete);

  const tdIndex = document.createElement('td');
  tdIndex.textContent = serialNextIndex;
  tr.appendChild(tdIndex);

  // เพิ่มคอลัมน์ปุ่ม Scan
  const tdScan = document.createElement('td');
  const btnScan = document.createElement('button');
  btnScan.type = 'button';
  btnScan.className = 'btn-scan-table';
  btnScan.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" style="width:20px;height:20px;fill:currentColor;">
        <path d="M4 4h3v2H5v2H3V4h1zm4 0h9v2H8V4zM17 4h3v4h-2V6h-1V4zM3 16h2v2H4v2H3v-4zm18 0h-2v2h1v2h2v-4zM8 18h9v2H8v-2z"></path>
        <circle cx="12" cy="11" r="3"></circle>
      </svg>`;
  btnScan.addEventListener('click', () => {
    activeSerialInput = inputSerial; // ระบุว่ากำลังจะสแกนเข้า Input ไหน
    toggleScannerModal(true);
  });
  tdScan.appendChild(btnScan);
  tr.appendChild(tdScan);

  // 4. Serial (Visible Input + Hidden Inputs)
  const tdSerial = document.createElement('td');
  const inputSerial = document.createElement('input');
  inputSerial.type = 'text';
  inputSerial.className = 'serial-entry-input input-serial';
  inputSerial.placeholder = 'กรอก Serial แล้วกด Enter';
  inputSerial.disabled = !isSerialMaterialReady();
  tdSerial.appendChild(inputSerial);

  // Hidden fields for logic
  const inputPrefix = document.createElement('input');
  inputPrefix.type = 'hidden';
  inputPrefix.className = 'input-prefix';
  inputPrefix.value = serialPrefixInput.value || '';
  tdSerial.appendChild(inputPrefix);

  const inputSuffix = document.createElement('input');
  inputSuffix.type = 'hidden';
  inputSuffix.className = 'input-suffix';
  inputSuffix.value = serialSuffixInput.value || '';
  tdSerial.appendChild(inputSuffix);

  tr.appendChild(tdSerial);

  // 4.5 SerialCP (Visible)
  const tdSerialCP = document.createElement('td');
  const inputSerialCP = document.createElement('input');
  inputSerialCP.type = 'text';
  inputSerialCP.className = 'input-serial-cp';
  inputSerialCP.readOnly = true;
  tdSerialCP.appendChild(inputSerialCP);
  tr.appendChild(tdSerialCP);

  // 5. Invoice
  const tdInvoice = document.createElement('td');
  const inputInvoice = document.createElement('input');
  inputInvoice.type = 'text';
  inputInvoice.className = 'input-invoice';
  inputInvoice.readOnly = true;
  inputInvoice.value = serialInvoiceInput.value || '';
  tdInvoice.appendChild(inputInvoice);
  tr.appendChild(tdInvoice);

  // 6. Material
  const tdMat = document.createElement('td');
  const inputMat = document.createElement('input');
  inputMat.type = 'text';
  inputMat.className = 'input-mat';
  inputMat.readOnly = true;
  inputMat.value = serialMatInput.value || '';
  tdMat.appendChild(inputMat);
  tr.appendChild(tdMat);

  // 7. Description
  const tdDesc = document.createElement('td');
  const inputDesc = document.createElement('input');
  inputDesc.type = 'text';
  inputDesc.className = 'input-desc';
  inputDesc.readOnly = true;
  inputDesc.value = serialDescInput.value || '';
  tdDesc.appendChild(inputDesc);
  tr.appendChild(tdDesc);

  // 8. Storage bin
  const tdBin = document.createElement('td');
  const inputBin = document.createElement('input');
  inputBin.type = 'text';
  inputBin.className = 'input-bin';
  inputBin.readOnly = true;
  inputBin.value = serialBinInput.value || '';
  tdBin.appendChild(inputBin);
  tr.appendChild(tdBin);

  // 9. Date
  const tdDate = document.createElement('td');
  const inputDate = document.createElement('input');
  inputDate.type = 'text';
  inputDate.className = 'input-date';
  inputDate.readOnly = true;
  inputDate.value = getNowString();
  tdDate.appendChild(inputDate);
  tr.appendChild(tdDate);

  let committed = false;

  function commitSerialRow() {
    if (committed) return;
    const serialVal = inputSerial.value.trim();

    if (!serialVal) {
      serialStatusEl.innerHTML =
        '<span class="not-found">ไม่อนุญาติให้ขึ้นบรรทัดใหม่ถ้า Serial ยังเป็นค่าว่าง</span>';
      return;
    }

    const currentPrefix = serialPrefixInput.value || '';
    const currentSuffix = serialSuffixInput.value || '';
    const potentialSerialCP = (currentPrefix + serialVal + currentSuffix).trim();

    // ตรวจสอบซ้ำในตารางปัจจุบัน
    const rows = serialTableBody.querySelectorAll('tr');
    for (const r of rows) {
      if (r === tr) continue;
      const existingCPInput = r.querySelector('.input-serial-cp');
      if (existingCPInput && existingCPInput.value.trim() === potentialSerialCP) {
        serialStatusEl.innerHTML = `<span class="not-found">Serial ซ้ำในตาราง: ${potentialSerialCP}</span>`;
        inputSerial.select();
        return;
      }
    }

    // ตรวจสอบซ้ำในฐานข้อมูล GRN (ถ้ามี)
    if (grnDB && grnDB.length > 0) {
      const found = grnDB.find(g => g.SerialCP === potentialSerialCP);
      if (found) {
        serialStatusEl.innerHTML = `<span class="not-found">Serial ซ้ำในระบบ (GRN): ${potentialSerialCP}</span>`;
        inputSerial.select();
        return;
      }
    }

    committed = true;

    inputPrefix.value = currentPrefix;
    inputSuffix.value = currentSuffix;
    inputInvoice.value = serialInvoiceInput.value || '';
    inputMat.value = serialMatInput.value || '';
    inputDesc.value = serialDescInput.value || '';
    inputBin.value = serialBinInput.value || '';
    inputDate.value = getNowString();

    inputSerialCP.value = potentialSerialCP;

    serialStatusEl.textContent = 'บันทึก Serial สำเร็จ และสร้างแถวใหม่แล้ว';
    serialNextIndex++;
    addSerialRow();
    updateSerialSummary();
    saveSerialCache();
  }

  inputSerial.commitRow = commitSerialRow;

  inputSerial.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitSerialRow();
    }
  });

  inputSerial.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    handlePasteSerials(pastedText, inputSerial);
  });

  inputSerial.addEventListener('blur', () => {
    if (!inputSerial.value.trim()) return;
    commitSerialRow();
  });

  inputSerial.addEventListener('input', () => {
    const currentPrefix = serialPrefixInput.value || '';
    const currentSuffix = serialSuffixInput.value || '';
    inputSerialCP.value = (currentPrefix + inputSerial.value + currentSuffix).trim();
    saveSerialCache();
  });

  serialTableBody.appendChild(tr);
  inputSerial.focus();
  updateSerialSummary();
  updateSerialTableLock();
}

function reindexSerialRows() {
  const rows = serialTableBody.querySelectorAll('tr');
  let idx = 1;
  rows.forEach(tr => {
    const indexTd = tr.children[1];
    indexTd.textContent = idx++;
  });
  serialNextIndex = idx;

  if (!rows.length) {
    serialNextIndex = 1;
    serialStatusEl.textContent = 'ไม่มีข้อมูลในตาราง สร้างแถวใหม่ให้พร้อมกรอกแล้ว';
    addSerialRow();
  }
  updateSerialSummary();
  saveSerialCache();
}

let serialSortDirection = null;

function updateSortButtonUI(buttonEl, direction) {
  if (!buttonEl) return;
  buttonEl.classList.remove('active-asc', 'active-desc');

  const iconNeutral = buttonEl.querySelector('.sort-icon-neutral');
  const iconAsc = buttonEl.querySelector('.sort-icon-asc');
  const iconDesc = buttonEl.querySelector('.sort-icon-desc');

  if (direction === 'asc') {
    buttonEl.classList.add('active-asc');
    buttonEl.title = 'กำลังเรียง: น้อยไปมาก (คลิกเพื่อเรียง มากไปน้อย)';
    if (iconNeutral) iconNeutral.style.display = 'none';
    if (iconAsc) iconAsc.style.display = 'block';
    if (iconDesc) iconDesc.style.display = 'none';
  } else if (direction === 'desc') {
    buttonEl.classList.add('active-desc');
    buttonEl.title = 'กำลังเรียง: มากไปน้อย (คลิกเพื่อเรียง น้อยไปมาก)';
    if (iconNeutral) iconNeutral.style.display = 'none';
    if (iconAsc) iconAsc.style.display = 'none';
    if (iconDesc) iconDesc.style.display = 'block';
  } else {
    buttonEl.title = 'คลิกเพื่อเรียงลำดับ น้อยไปมาก / มากไปน้อย';
    if (iconNeutral) iconNeutral.style.display = 'block';
    if (iconAsc) iconAsc.style.display = 'none';
    if (iconDesc) iconDesc.style.display = 'none';
  }
}

function sortSerialTable(direction) {
  if (!serialTableBody) return;
  const rows = Array.from(serialTableBody.querySelectorAll('tr'));
  if (rows.length <= 1) return;

  rows.sort((a, b) => {
    const cpA = a.querySelector('.input-serial-cp');
    const cpB = b.querySelector('.input-serial-cp');
    const rawA = a.querySelector('.input-serial');
    const rawB = b.querySelector('.input-serial');

    const valA = (cpA?.value || rawA?.value || '').trim();
    const valB = (cpB?.value || rawB?.value || '').trim();

    // แถวว่างต้องอยู่ล่างสุดเสมอ
    if (!valA && !valB) return 0;
    if (!valA) return 1;
    if (!valB) return -1;

    const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    return direction === 'asc' ? cmp : -cmp;
  });

  rows.forEach(tr => serialTableBody.appendChild(tr));
  reindexSerialRows();
}

const sortSerialBtn = document.getElementById('sortSerialBtn');
if (sortSerialBtn) {
  sortSerialBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    serialSortDirection = (serialSortDirection === 'asc') ? 'desc' : 'asc';
    updateSortButtonUI(sortSerialBtn, serialSortDirection);
    sortSerialTable(serialSortDirection);
  });
}

if (clearAllSerialBtn) {
  clearAllSerialBtn.addEventListener('click', () => {
    if (confirm('ต้องการลบข้อมูล Serial ในตารางทั้งหมดหรือไม่?')) {
      if (serialTableBody) serialTableBody.innerHTML = '';
      localStorage.removeItem(CACHE_KEYS.SERIAL);
      reindexSerialRows();
      serialSortDirection = null;
      updateSortButtonUI(sortSerialBtn, null);
    }
  });
}

function collectSerialPrintData() {
  const rows = Array.from(serialTableBody.querySelectorAll('tr'));
  const data = [];

  rows.forEach(tr => {
    const inputMat = tr.querySelector('.input-mat');
    const inputSerialCP = tr.querySelector('.input-serial-cp');
    const inputDesc = tr.querySelector('.input-desc');
    const inputBin = tr.querySelector('.input-bin');

    if (!inputMat || !inputSerialCP) return;

    const material = inputMat.value.trim();
    const serialCP = inputSerialCP.value.trim();
    const desc = inputDesc ? inputDesc.value : '';
    const bin = inputBin ? inputBin.value : '';

    if (!material || !serialCP) return;

    data.push({
      Material: material,
      Serial: serialCP,
      Description: desc,
      Storagebin: bin
    });
  });

  // พิมพ์ตามลำดับ Sort ที่อยู่ในตารางปัจจุบัน
  return data;
}

function sortDataBySerial(data) {
  if (!Array.isArray(data)) return [];
  return [...data].sort((a, b) => {
    const serA = String(a.Serial || '').trim();
    const serB = String(b.Serial || '').trim();
    return serA.localeCompare(serB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function collectSerialSaveData() {
  const rows = Array.from(serialTableBody.querySelectorAll('tr'));
  const data = [];

  rows.forEach((tr, idx) => {
    const inputSerialCP = tr.querySelector('.input-serial-cp');
    const inputInvoice = tr.querySelector('.input-invoice');
    const inputMat = tr.querySelector('.input-mat');
    const inputDesc = tr.querySelector('.input-desc');
    const inputBin = tr.querySelector('.input-bin');
    const inputDate = tr.querySelector('.input-date');

    if (!inputSerialCP || !inputMat) return;

    const serialCP = inputSerialCP.value.trim();
    const material = inputMat.value.trim();

    if (!serialCP || !material) return;

    data.push({
      IDrow: idx + 1,
      SerialCP: serialCP,
      Invoice: inputInvoice ? inputInvoice.value.trim() : '',
      Material: material,
      Description: inputDesc ? inputDesc.value : '',
      'storage bin': inputBin ? inputBin.value : '',
      Date: inputDate ? inputDate.value : ''
    });
  });

  return data;
}

function resetSerialForm() {
  if (serialInvoiceInput) serialInvoiceInput.value = '';
  if (serialMatInput) serialMatInput.value = '';
  if (serialDescInput) serialDescInput.value = '';
  if (serialBinInput) serialBinInput.value = '';
  if (serialPrefixInput) serialPrefixInput.value = '';
  if (serialSuffixInput) serialSuffixInput.value = '';
  if (serialTableBody) serialTableBody.innerHTML = '';
  serialNextIndex = 1;
  addSerialRow();
  updateSerialSummary();
  updateSerialTableLock();
  if (serialTopStatus) {
    serialTopStatus.textContent = '';
  }
  if (serialStatusEl) {
    serialStatusEl.textContent = 'แถวแรกถูกสร้างให้แล้ว กรอก Serial แล้วกด Enter เพื่อสร้างแถวถัดไป';
  }
  serialSortDirection = null;
  updateSortButtonUI(sortSerialBtn, null);
  localStorage.removeItem(CACHE_KEYS.SERIAL);
}

function toggleConfirmModal(open) {
  if (!confirmModal) return;
  confirmModal.classList.toggle('open', open);
  confirmModal.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function showConfirmModal(message, onConfirm) {
  if (!confirmModal) {
    if (typeof onConfirm === 'function') onConfirm();
    return;
  }

  if (confirmModalMessage) {
    confirmModalMessage.textContent = message;
  }

  toggleConfirmModal(true);

  const handleConfirm = () => {
    toggleConfirmModal(false);
    if (typeof onConfirm === 'function') onConfirm();
    cleanup();
  };

  const handleCancel = () => {
    toggleConfirmModal(false);
    cleanup();
  };

  const handleBackdrop = (event) => {
    if (event.target === confirmModal) {
      toggleConfirmModal(false);
      cleanup();
    }
  };

  const cleanup = () => {
    if (confirmSaveBtn) confirmSaveBtn.removeEventListener('click', handleConfirm);
    if (cancelSaveBtn) cancelSaveBtn.removeEventListener('click', handleCancel);
    confirmModal.removeEventListener('click', handleBackdrop);
  };

  if (confirmSaveBtn) confirmSaveBtn.addEventListener('click', handleConfirm);
  if (cancelSaveBtn) cancelSaveBtn.addEventListener('click', handleCancel);
  confirmModal.addEventListener('click', handleBackdrop);
}

function showInfoModal(title, message) {
  if (!confirmModal) return;
  if (confirmModalTitle) confirmModalTitle.textContent = title;
  if (confirmModalMessage) confirmModalMessage.textContent = message;
  if (confirmSaveBtn) confirmSaveBtn.classList.add('is-hidden');
  if (cancelSaveBtn) cancelSaveBtn.textContent = 'ตกลง';

  toggleConfirmModal(true);

  const handleClose = () => {
    toggleConfirmModal(false);
    if (confirmSaveBtn) confirmSaveBtn.classList.remove('is-hidden');
    if (cancelSaveBtn) cancelSaveBtn.textContent = cancelDefaultText || 'ยกเลิก';
    cleanup();
  };

  const handleBackdrop = (event) => {
    if (event.target === confirmModal) {
      handleClose();
    }
  };

  const cleanup = () => {
    if (cancelSaveBtn) cancelSaveBtn.removeEventListener('click', handleClose);
    confirmModal.removeEventListener('click', handleBackdrop);
  };

  if (cancelSaveBtn) cancelSaveBtn.addEventListener('click', handleClose);
  confirmModal.addEventListener('click', handleBackdrop);
}

function createLabel(row) {
  const label = document.createElement('div');
  label.className = 'label-big label-serial-big';

  const rowDiv = document.createElement('div');
  rowDiv.className = 'row-big';

  const leftCol = document.createElement('div');
  leftCol.style.display = 'flex';
  leftCol.style.flexDirection = 'column';
  leftCol.style.alignItems = 'flex-start';

  const qrCanvasMat = document.createElement('canvas');
  qrCanvasMat.className = 'qr-big';
  leftCol.appendChild(qrCanvasMat);

  const barcodeMatCanvas = document.createElement('canvas');
  barcodeMatCanvas.className = 'barcode-big';
  leftCol.appendChild(barcodeMatCanvas);

  rowDiv.appendChild(leftCol);

  const textRight = document.createElement('div');
  textRight.className = 'text-container-big';

  const materialDiv = document.createElement('div');
  materialDiv.className = 'material-big';
  materialDiv.textContent = row.Material;
  textRight.appendChild(materialDiv);

  rowDiv.appendChild(textRight);
  label.appendChild(rowDiv);

  const infoBlock = document.createElement('div');
  infoBlock.className = 'info-block-big';

  const descText = (row.Description || '').trim();
  if (descText) {
    const descDiv = document.createElement('div');
    descDiv.className = 'description-big';
    descDiv.textContent = descText;
    descDiv.style.marginTop = '0';
    infoBlock.appendChild(descDiv);
  }

  if (row.Serial) {
    const serialRow = document.createElement('div');
    serialRow.className = 'serial-row-big';

    const serialDiv = document.createElement('div');
    serialDiv.className = 'serial-big';
    serialDiv.textContent = `S/N: ${row.Serial}`;
    serialRow.appendChild(serialDiv);

    const qrSerialCanvas = document.createElement('canvas');
    qrSerialCanvas.className = 'qr-serial-big';
    serialRow.appendChild(qrSerialCanvas);

    infoBlock.appendChild(serialRow);

    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(qrSerialCanvas, row.Serial || 'N/A', {
        width: 80,
        height: 80,
        margin: 0,
        errorCorrectionLevel: 'L'
      }, err => {
        if (err) console.error('QR Error for Serial:', err);
      });
    }
  }

  label.appendChild(infoBlock);

  const bottomContainer = document.createElement('div');
  bottomContainer.className = 'bottom-container-big';

  const now = new Date();
  const formattedDate =
    `${now.getFullYear().toString().slice(2)}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}` +
    `${String(now.getHours()).padStart(2, '0')}` +
    `${String(now.getMinutes()).padStart(2, '0')}`;

  const locTextStr = (row.Storagebin || '').trim();
  if (locTextStr) {
    const loc = document.createElement('div');
    loc.className = 'location-big';
    loc.textContent = `Location: ${locTextStr}`;
    bottomContainer.appendChild(loc);
  }

  const lot = document.createElement('div');
  lot.className = 'lot-line-big';
  lot.textContent = `Lot: ${formattedDate}`;
  bottomContainer.appendChild(lot);

  label.appendChild(bottomContainer);

  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(qrCanvasMat, row.Material || 'N/A', {
      width: 55,
      height: 55,
      margin: 0,
      errorCorrectionLevel: 'L'
    }, err => {
      if (err) console.error('QR Error for Material:', err);
    });
  }

  if (typeof JsBarcode !== 'undefined') {
    JsBarcode(barcodeMatCanvas, row.Material || '00000000', {
      format: 'CODE128',
      width: 1,
      height: 25,
      displayValue: false,
      margin: 0
    });
  }

  return label;
}

function buildSerialLabelsForPrint(data) {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'container-big';
  printArea.appendChild(container);

  if (!data.length) {
    container.innerHTML = '<p style="text-align:center;">ไม่พบข้อมูลให้ Print</p>';
    return;
  }

  data.forEach(row => {
    const sticker = document.createElement('div');
    sticker.className = 'sticker-big';

    const label = createLabel(row);
    sticker.appendChild(label);

    container.appendChild(sticker);
  });
}

// ====== Camera Scanner Logic ======
let html5QrcodeScanner = null;
let activeSerialInput = null; // ตัวแปรเก็บ Input ที่กำลังจะถูกเติมค่า

function onScanSuccess(decodedText, decodedResult) {
  // 1. ตรวจสอบว่าพร้อมกรอกหรือไม่
  if (!isSerialMaterialReady()) {
    alert('กรุณากรอก Material ก่อนเริ่มสแกน Serial');
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    toggleScannerModal(false);
    return;
  }

  // 2. ใช้ Input ที่กดปุ่มมา หรือถ้าไม่มีให้หาแถวล่าสุด (Fallback)
  let targetInput = activeSerialInput;

  if (!targetInput) {
    const rows = serialTableBody.querySelectorAll('tr');
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      const input = lastRow.querySelector('.serial-entry-input');
      if (input) targetInput = input;
    }
  }

  if (targetInput) {
    // 3. ใส่ค่าและจำลองการกด Enter
    targetInput.value = decodedText;
    targetInput.focus();

    // Dispatch Enter event เพื่อ trigger logic การบันทึกและสร้างแถวใหม่
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      which: 13,
      bubbles: true
    });
    targetInput.dispatchEvent(event);

    // Feedback เสียงหรือสั่น (ถ้าอุปกรณ์รองรับ)
    if (navigator.vibrate) navigator.vibrate(100);

    // ปิดกล้องอัตโนมัติเมื่อสแกนสำเร็จ
    toggleScannerModal(false);
  }
}

function toggleScannerModal(show) {
  if (!scannerModal) return;
  scannerModal.classList.toggle('open', show);

  const scannerStatus = document.getElementById('scannerStatus');
  if (scannerStatus) scannerStatus.textContent = '';

  if (show) {
    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minEdge * 0.7),
              height: Math.floor(minEdge * 0.7)
            };
          },
          videoConstraints: { facingMode: "environment" },
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true
        },
        /* verbose= */ false
      );
    }
    
    // Proactively clear any existing render before starting a new one
    html5QrcodeScanner.clear().catch(() => {}).then(() => {
      try {
        html5QrcodeScanner.render(onScanSuccess, (error) => {
          // Frame errors ignored
        });
      } catch (err) {
        console.error("Scanner render error:", err);
        if (scannerStatus) {
          scannerStatus.textContent = "ไม่สามารถเปิดกล้องได้: " + err.message;
        }
      }
    });
  } else {
    // ปิด Scanner
    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear()
        .then(() => {
          console.log("[Scanner] Cleared successfully");
        })
        .catch(err => {
          console.error("[Scanner] Clear error:", err);
          // Force UI reset if clear fails
          const reader = document.getElementById('reader');
          if (reader) reader.innerHTML = '';
        });
      activeSerialInput = null; // Reset ตัวแปร
    }
  }
}

if (closeScannerBtn) {
  closeScannerBtn.addEventListener('click', () => {
    toggleScannerModal(false);
  });
}

if (saveSerialBtn) {
  const performSerialSave = async () => {
    const data = collectSerialSaveData();
    if (!data.length) {
      alert('ยังไม่มี Serial ในตารางให้บันทึก');
      return;
    }

    try {
      saveSerialBtn.disabled = true;
      serialStatusEl.textContent = 'กำลังบันทึกข้อมูลลง Google Sheet...';
      showMainLoading(true, 'กำลังบันทึกข้อมูลลง Google Sheet...');

      const body = new URLSearchParams({
        rows: JSON.stringify(data)
      });

      const res = await fetch(SERIAL_SAVE_URL, {
        method: 'POST',
        body
      });

      const result = await res.json();
      if (!result || result.ok !== true) {
        throw new Error((result && result.error) || 'บันทึกไม่สำเร็จ');
      }

      serialStatusEl.textContent = `บันทึกสำเร็จ ${result.inserted || data.length} แถว`;
      showMainLoading(false); // ปิด animation ก่อนโชว์ Modal
      
      // หน่วงเวลาเล็กน้อยเพื่อให้ Animation ปิดสนิทก่อนโชว์ Popup
      setTimeout(() => {
        showInfoModal('บันทึกสำเร็จ', `บันทึกข้อมูล ${result.inserted || data.length} แถวเรียบร้อยแล้ว`);
      }, 150);

      resetSerialForm();
      loadGrnData();
    } catch (err) {
      showMainLoading(false);
      serialStatusEl.textContent = `บันทึกไม่สำเร็จ: ${err.message || err}`;
    } finally {
      saveSerialBtn.disabled = false;
    }
  };

  saveSerialBtn.addEventListener('click', () => {
    showConfirmModal('ต้องการบันทึกข้อมูลลง Google Sheet ใช่หรือไม่', performSerialSave);
  });
}

if (printSerialBtn) {
  printSerialBtn.addEventListener('click', () => {
    const data = collectSerialPrintData();
    if (!data.length) {
      alert('ยังไม่มี Serial ในตารางสำหรับพิมพ์');
      return;
    }

    showMainLoading(true, 'กำลังเตรียมพิมพ์ Serial...');

    setTimeout(() => {
      buildSerialLabelsForPrint(data);

      setTimeout(() => {
        showMainLoading(false);
        window.print();
      }, 300);
    }, 200);
  });
}

const printSerialSmallBtn = document.getElementById('printSerialSmallBtn');
if (printSerialSmallBtn) {
  printSerialSmallBtn.addEventListener('click', () => {
    const rawData = collectSerialPrintData();
    if (!rawData.length) {
      alert('ยังไม่มี Serial ในตารางสำหรับพิมพ์');
      return;
    }

    const data = rawData.map(r => ({
      Material: r.Material,
      Serial: r.Serial,
      จำนวน: 1,
      ชื่อช่าง: `S/N: ${r.Serial}`,
      แผนก: typeof employeeName !== 'undefined' && employeeName ? `โดย: ${employeeName.replace(/^นาย\s+/, '').trim()}` : '',
      Description: r.Description,
      Storagebin: r.Storagebin,
      Pack: '',
      Unit: ''
    }));

    setPrintMode('small');
    showMainLoading(true, 'กำลังเตรียมพิมพ์ Serial (Small)...');

    setTimeout(() => {
      buildPrintLabelsSmall(data);
      setTimeout(() => {
        showMainLoading(false);
        window.print();
      }, 300);
    }, 200);
  });
}

const loginGate = document.getElementById('loginGate');

function normalizeGrnRow(row) {
  return {
    SerialCP: row.SerialCP || row.Serial || row.serialCP || row.serialcp || '',
    Invoice: row.Invoice || row.invoice || '',
    Material: row.Material || row.material || '',
    Description: row.Description || row.description || '',
    Storagebin: row["storage bin"] || row["Storage bin"] || row.StorageBin || row.storageBin || row.storagebin || '',
    Date: row.Date || row.date || ''
  };
}

function extractDatePart(str) {
  if (!str) return '';
  return String(str).split(' ')[0];
}

function applyGrnFilters(data, filters) {
  return data.filter(row => {
    if (filters.invoice && row.Invoice !== filters.invoice) return false;
    if (filters.date && row.Date !== filters.date) return false;
    if (filters.material && row.Material !== filters.material) return false;
    return true;
  });
}

function getUniqueValues(data, key) {
  const set = new Set();
  data.forEach(row => {
    const val = row[key];
    if (val) set.add(val);
  });
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
}

function setGrnSelectOptions(selectEl, values, selectedValue) {
  if (!selectEl) return selectedValue || '';
  selectEl.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'ทั้งหมด';
  selectEl.appendChild(allOption);

  values.forEach(val => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = val;
    selectEl.appendChild(option);
  });

  if (selectedValue && values.includes(selectedValue)) {
    selectEl.value = selectedValue;
  } else {
    selectEl.value = '';
  }

  return selectEl.value;
}

function renderGrnTable(rows) {
  if (!grnTableBody) return;
  grnTableBody.innerHTML = '';

  if (grnSelectAll) grnSelectAll.checked = false;
  rows.forEach(row => {
    const tr = document.createElement('tr');

    const tdSelect = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'grn-checkbox';
    checkbox.dataset.serial = row.SerialCP || '';
    checkbox.dataset.material = row.Material || '';
    checkbox.dataset.description = row.Description || '';
    checkbox.dataset.storagebin = row.Storagebin || '';
    tdSelect.appendChild(checkbox);
    tr.appendChild(tdSelect);

    const tdSerial = document.createElement('td');
    tdSerial.textContent = row.SerialCP || '-';
    tr.appendChild(tdSerial);

    const tdInvoice = document.createElement('td');
    tdInvoice.textContent = row.Invoice || '-';
    tr.appendChild(tdInvoice);

    const tdMaterial = document.createElement('td');
    tdMaterial.textContent = row.Material || '-';
    tr.appendChild(tdMaterial);

    const tdDesc = document.createElement('td');
    tdDesc.textContent = row.Description || '-';
    tr.appendChild(tdDesc);

    const tdBin = document.createElement('td');
    tdBin.textContent = row.Storagebin || '-';
    tr.appendChild(tdBin);

    const tdDate = document.createElement('td');
    tdDate.textContent = row.Date || '-';
    tr.appendChild(tdDate);

    grnTableBody.appendChild(tr);
  });
}

function updateGrnFiltersAndTable() {
  if (!Array.isArray(grnDB) || !grnDB.length) {
    renderGrnTable([]);
    if (grnStatusEl) grnStatusEl.innerHTML = '<span style="color:var(--text-muted)">ไม่พบข้อมูล GRN (grnDB is empty or not an array)</span>';
    console.warn('[GRN] No data to filter. grnDB:', grnDB);
    return;
  }

  console.log('[GRN] updateGrnFiltersAndTable Start. Current filters:', JSON.stringify(grnFilters));

  // Helper: กรองข้อมูลเพื่อสร้างตัวเลือกใน Dropdown (Dependent Filters)
  const getFiltered = (excludeKey) => {
    return grnDB.filter(row => {
      const rowDate = extractDatePart(row.Date);
      if (excludeKey !== 'invoice' && grnFilters.invoice && row.Invoice !== grnFilters.invoice) return false;
      if (excludeKey !== 'material' && grnFilters.material && row.Material !== grnFilters.material) return false;
      if (excludeKey !== 'date' && grnFilters.date && rowDate !== grnFilters.date) return false;
      return true;
    });
  };

  // 1. Date Options (เสมอจากฐานข้อมูลทั้งหมด เพื่อให้เลือกกระโดดข้ามวันได้)
  const dateSet = new Set();
  grnDB.forEach(r => {
    const d = extractDatePart(r.Date);
    if (d) dateSet.add(d);
  });
  const dateValues = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

  // 2. ตั้งค่า Default Date ถ้ายังไม่มีการเลือก
  if (!grnFilters.date && dateValues.length > 0) {
    grnFilters.date = dateValues[0];
  }

  // 3. Invoice Options (กรองตาม Date และ Material ที่เลือกอยู่)
  const invoiceValues = getUniqueValues(getFiltered('invoice'), 'Invoice');

  // 4. Material Options (กรองตาม Date และ Invoice ที่เลือกอยู่)
  const materialValues = getUniqueValues(getFiltered('material'), 'Material');

  // อัพเดท Dropdown UI
  grnFilters.invoice = setGrnSelectOptions(grnInvoiceFilter, invoiceValues, grnFilters.invoice);
  grnFilters.material = setGrnSelectOptions(grnMaterialFilter, materialValues, grnFilters.material);
  grnFilters.date = setGrnSelectOptions(grnDateFilter, dateValues, grnFilters.date);

  // กรองข้อมูลจริงสำหรับแสดงในตาราง
  let filtered = grnDB.filter(row => {
    const rowDate = extractDatePart(row.Date);
    if (grnFilters.invoice && row.Invoice !== grnFilters.invoice) return false;
    if (grnFilters.material && row.Material !== grnFilters.material) return false;
    if (grnFilters.date && rowDate !== grnFilters.date) return false;
    return true;
  });

  if (grnSortDirection) {
    filtered.sort((a, b) => {
      const valA = String(a.SerialCP || '').trim();
      const valB = String(b.SerialCP || '').trim();
      if (!valA && !valB) return 0;
      if (!valA) return 1;
      if (!valB) return -1;
      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return grnSortDirection === 'asc' ? cmp : -cmp;
    });
  }

  console.log('[GRN] filtered length:', filtered.length);
  renderGrnTable(filtered);
  if (grnStatusEl) grnStatusEl.textContent = `พบข้อมูล ${filtered.length} รายการ`;
}

let isGrnLoading = false;
async function loadGrnData(forceRefresh = false) {
  if (isGrnLoading) return;
  isGrnLoading = true;

  const CACHE_KEY = 'cache_grn_data';
  const CACHE_TTL = 30 * 60 * 1000; // 30 นาที

  if (grnStatusEl) grnStatusEl.innerHTML = '<span class="icon spin">↻</span> กำลังโหลดข้อมูล GRN...';
  if (grnRefreshBtn) grnRefreshBtn.classList.add('loading');

  try {
    const cachedEntry = await AppDB.get(CACHE_KEY);

    // มี cache ยังไม่หมดอายุ และไม่ได้ force refresh → ใช้ทันที
    if (!forceRefresh && cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      grnDB = (cachedEntry.data || []).map(normalizeGrnRow);
      updateGrnFiltersAndTable();
      isGrnLoading = false;
      if (grnRefreshBtn) grnRefreshBtn.classList.remove('loading');
      return;
    }

    // มี stale cache → คืนข้อมูลเก่าก่อน แล้วค่อยๆ รีเฟรช
    if (!forceRefresh && cachedEntry && cachedEntry.data && cachedEntry.data.length > 0) {
      grnDB = cachedEntry.data.map(normalizeGrnRow);
      updateGrnFiltersAndTable();
    }

    // fetch ใหม่ (timeout 45 วิ)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    const fetchUrl = GRN_URL;
    const res = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log('[GRN] Data received. Row count:', data ? data.length : 0);
    
    if (!Array.isArray(data)) {
      throw new Error('รูปแบบข้อมูลไม่ถูกต้อง (ไม่ใช่ Array)');
    }

    grnDB = data.map(normalizeGrnRow);
    await AppDB.set(CACHE_KEY, { timestamp: Date.now(), data });
    updateGrnFiltersAndTable();
    console.log('[GRN] Loaded:', grnDB.length, 'records');

  } catch (err) {
    console.error('Error loading GRN data:', err);
    // ถ้า fetch ล้มเหลว แต่มี stale cache → ใช้ต่อโดยไม่แสดง error
    const staleCached = await AppDB.get(CACHE_KEY);
    if (staleCached && staleCached.data && staleCached.data.length > 0) {
      grnDB = staleCached.data.map(normalizeGrnRow);
      updateGrnFiltersAndTable();
      if (grnStatusEl) {
        grnStatusEl.innerHTML = `<span style="color:var(--warning)">ใช้ข้อมูล GRN จาก cache (เซิร์ฟเวอร์ไม่ตอบสนอง)</span>`;
      }
    } else {
      if (grnStatusEl) {
        grnStatusEl.innerHTML = `<span style="color:var(--danger)">โหลดข้อมูลไม่สำเร็จ: ${err.message}</span>`;
      }
      grnDB = [];
      renderGrnTable([]);
    }
  } finally {
    isGrnLoading = false;
    if (grnRefreshBtn) grnRefreshBtn.classList.remove('loading');
  }
}

if (grnInvoiceFilter) {
  const field = grnInvoiceFilter.closest('.grn-field');
  if (field) field.style.display = '';

  grnInvoiceFilter.addEventListener('change', () => {
    grnFilters.invoice = grnInvoiceFilter.value;
    updateGrnFiltersAndTable();
  });
}
if (grnDateFilter) {
  grnDateFilter.addEventListener('change', () => {
    grnFilters.date = grnDateFilter.value;
    updateGrnFiltersAndTable();
  });
}
if (grnMaterialFilter) {
  const field = grnMaterialFilter.closest('.grn-field');
  if (field) field.style.display = '';

  grnMaterialFilter.addEventListener('change', () => {
    grnFilters.material = grnMaterialFilter.value;
    updateGrnFiltersAndTable();
  });
}

if (grnStatusEl) {
  loadGrnData();
}

if (grnRefreshBtn) {
  grnRefreshBtn.addEventListener('click', () => {
    // Rotation animation is already handled by CSS hover/active, 
    // but we can add a transient class if we want more control.
    loadGrnData();
  });
}

if (grnPrintBtn) {
  grnPrintBtn.addEventListener('click', () => {
    if (!grnTableBody) return;
    let targetElements = Array.from(grnTableBody.querySelectorAll('input.grn-checkbox:checked'));

    // ถ้าไม่ได้เลือก Checkbox เลย ให้เอาทั้งหมดที่มีในตาราง (ตาม Filter ปัจจุบัน)
    if (targetElements.length === 0) {
      targetElements = Array.from(grnTableBody.querySelectorAll('input.grn-checkbox'));
    }

    if (!targetElements.length) {
      alert('ไม่มีข้อมูลสำหรับพิมพ์');
      return;
    }

    const rawData = targetElements.map(item => ({
      Material: item.dataset.material || '',
      Serial: item.dataset.serial || '',
      Description: item.dataset.description || '',
      Storagebin: item.dataset.storagebin || ''
    })).filter(row => row.Material && row.Serial);

    if (!rawData.length) {
      alert('ข้อมูลไม่ครบสำหรับพิมพ์');
      return;
    }

    const data = rawData;

    showMainLoading(true, 'กำลังเตรียมพิมพ์ Serial...');

    setTimeout(() => {
      buildSerialLabelsForPrint(data);

      setTimeout(() => {
        showMainLoading(false);
        window.print();
      }, 300);
    }, 200);
  });
}

const grnPrintSmallBtn = document.getElementById('grnPrintSmallBtn');
if (grnPrintSmallBtn) {
  grnPrintSmallBtn.addEventListener('click', () => {
    if (!grnTableBody) return;
    let targetElements = Array.from(grnTableBody.querySelectorAll('input.grn-checkbox:checked'));

    if (targetElements.length === 0) {
      targetElements = Array.from(grnTableBody.querySelectorAll('input.grn-checkbox'));
    }

    if (!targetElements.length) {
      alert('ไม่มีข้อมูลสำหรับพิมพ์');
      return;
    }

    const rawData = targetElements.map(item => ({
      Material: item.dataset.material || '',
      Serial: item.dataset.serial || '',
      Description: item.dataset.description || '',
      Storagebin: item.dataset.storagebin || ''
    })).filter(row => row.Material && row.Serial);

    if (!rawData.length) {
      alert('ข้อมูลไม่ครบสำหรับพิมพ์');
      return;
    }

    const data = rawData.map(r => ({
      Material: r.Material,
      Serial: r.Serial,
      จำนวน: 1,
      ชื่อช่าง: `S/N: ${r.Serial}`,
      แผนก: typeof employeeName !== 'undefined' && employeeName ? `โดย: ${employeeName.replace(/^นาย\s+/, '').trim()}` : '',
      Description: r.Description,
      Storagebin: r.Storagebin,
      Pack: '',
      Unit: ''
    }));

    setPrintMode('small');
    showMainLoading(true, 'กำลังเตรียมพิมพ์ GRN (Small)...');

    setTimeout(() => {
      buildPrintLabelsSmall(data);
      setTimeout(() => {
        showMainLoading(false);
        window.print();
      }, 300);
    }, 200);
  });
}

let grnSortDirection = null;

function sortGrnTable(direction) {
  if (!grnTableBody) return;
  const rows = Array.from(grnTableBody.querySelectorAll('tr'));
  if (rows.length <= 1) return;

  rows.sort((a, b) => {
    const cbA = a.querySelector('input.grn-checkbox');
    const cbB = b.querySelector('input.grn-checkbox');
    const valA = (cbA?.dataset.serial || a.children[1]?.textContent || '').trim();
    const valB = (cbB?.dataset.serial || b.children[1]?.textContent || '').trim();

    if (!valA && !valB) return 0;
    if (!valA) return 1;
    if (!valB) return -1;

    const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    return direction === 'asc' ? cmp : -cmp;
  });

  rows.forEach(tr => grnTableBody.appendChild(tr));
}

const sortGrnSerialBtn = document.getElementById('sortGrnSerialBtn');
if (sortGrnSerialBtn) {
  sortGrnSerialBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    grnSortDirection = (grnSortDirection === 'asc') ? 'desc' : 'asc';
    updateSortButtonUI(sortGrnSerialBtn, grnSortDirection);
    sortGrnTable(grnSortDirection);
  });
}

if (grnSelectAll) {
  grnSelectAll.addEventListener('change', () => {
    if (!grnTableBody) return;
    const checked = grnSelectAll.checked;
    grnTableBody.querySelectorAll('input.grn-checkbox').forEach((checkbox) => {
      checkbox.checked = checked;
    });
  });
}

const grnTableHead = document.querySelector('#grnTable thead');
if (grnTableHead) {
  grnTableHead.addEventListener('click', async (event) => {
    if (event.target.closest('.btn-col-sort')) {
      return;
    }
    const th = event.target.closest('th');
    if (!th) return;
    if (!grnTableBody) return;
    const headerText = (th.querySelector('span')?.textContent || th.textContent).trim();
    if (!headerText) return;
    const colIndex = Array.from(th.parentElement.children).indexOf(th);
    if (colIndex < 0) return;
    if (colIndex === 0) return;

    const values = Array.from(grnTableBody.querySelectorAll('tr'))
      .map(row => {
        const cell = row.children[colIndex];
        return cell ? cell.textContent.trim() : '';
      })
      .filter(val => val !== '');

    if (!values.length) {
      if (grnStatusEl) grnStatusEl.textContent = 'ไม่มีข้อมูลให้คัดลอก';
      return;
    }

    const text = values.join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
      if (grnStatusEl) grnStatusEl.textContent = `คัดลอกคอลัมน์: ${headerText} (${values.length} รายการ)`;
    } catch (err) {
      if (grnStatusEl) grnStatusEl.textContent = 'คัดลอกไม่สำเร็จ';
    }
  });
}
const loginForm = document.getElementById('loginForm');
const loginUserInput = document.getElementById('loginUserInput');
const loginPassInput = document.getElementById('loginPassInput');
const loginRemember = document.getElementById('loginRemember');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const menuBtn = document.getElementById('menuBtn');
const menuPanel = document.getElementById('menuPanel');
const logoutBtn = document.getElementById('logoutBtn');
const menuUserId = document.getElementById('menuUserId');
const menuUserName = document.getElementById('menuUserName');
const menuUserNickname = document.getElementById('menuUserNickname');
const menuUserPlant = document.getElementById('menuUserPlant');
const menuUserPlantCode = document.getElementById('menuUserPlantCode');
const plantGate = document.getElementById('plantGate');
const plantSelect = document.getElementById('plantSelect');
const plantEnterBtn = document.getElementById('plantEnterBtn');
const backToPlantBtn = document.getElementById('backToPlantBtn');
const appShell = document.querySelector('.app-shell');
const badgeText = document.querySelector('.badge span:last-child');
const headerTitle = document.querySelector('.title-block h1');

const LOGIN_STORAGE_KEY = 'barcode-login';

function getUserValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      const value = String(row[key]).trim();
      if (value) return value;
    }
  }
  return '';
}

function mapUserRow(row) {
  return {
    id: getUserValue(row, ['IDRec', 'IdRec', 'idrec']),
    name: getUserValue(row, ['Name', 'NAME', 'name']),
    nickname: getUserValue(row, ['Nicname', 'Nickname', 'NICKNAME', 'nickName', 'nick']),
    plant: getUserValue(row, ['Plant', 'PLANT', 'plant']),
    plantCode: getUserValue(row, ['Plant', 'PLANT', 'plant'])
  };
}

function findUserById(id) {
  const target = String(id || '').trim();
  if (!target) return null;
  const row = userDB.find(item => {
    const value = getUserValue(item, ['IDRec', 'IdRec', 'idrec']);
    return value === target;
  });
  return row ? mapUserRow(row) : null;
}

function setMenuField(el, value) {
  if (el) el.textContent = value || '-';
}

function setMenuUserInfo(user) {
  setMenuField(menuUserId, user ? user.id : '-');
  setMenuField(menuUserName, user ? user.name : '-');
  setMenuField(menuUserNickname, user ? user.nickname : '-');
  setMenuField(menuUserPlant, user ? user.plant : '-');
  setMenuField(menuUserPlantCode, user ? user.plantCode : '-');
}

function getLast4(value) {
  const text = String(value || '').trim();
  return text.slice(-4);
}

function saveLogin(id, password) {
  if (!loginRemember || !loginRemember.checked) {
    localStorage.removeItem(LOGIN_STORAGE_KEY);
    return;
  }
  const payload = {
    id: id || '',
    password: password || ''
  };
  try {
    localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[Login] Failed to save login info:', e.message);
  }
}

function restoreLogin() {
  try {
    const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function showLoginStatus(message, isError = false) {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  if (isError) {
    loginStatus.classList.add('not-found');
  } else {
    loginStatus.classList.remove('not-found');
  }
}

function handleLogin() {
  const id = loginUserInput ? loginUserInput.value.trim() : '';
  const password = loginPassInput ? loginPassInput.value.trim() : '';

  if (!id || !password) {
    showLoginStatus('กรุณากรอก User และ Password', true);
    return;
  }

  if (!userDB || userDB.length === 0) {
    // \u0e23\u0e2d promise \u0e40\u0e14\u0e34\u0e21\u0e17\u0e35\u0e48\u0e40\u0e23\u0e34\u0e48\u0e21\u0e44\u0e27\u0e49\u0e15\u0e2d\u0e19\u0e40\u0e1b\u0e34\u0e14\u0e2b\u0e19\u0e49\u0e32 (\u0e44\u0e21\u0e48\u0e2a\u0e23\u0e49\u0e32\u0e07 request \u0e43\u0e2b\u0e21\u0e48)
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...';
    }
    showLoginStatus('\u0e23\u0e2d\u0e42\u0e2b\u0e25\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19...', false);
    (_userDataReady || loadUserData()).then(() => {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'เข้าสู่ระบบ';
      }
      showLoginStatus('');
      handleLogin();
    }).catch(() => {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'เข้าสู่ระบบ';
      }
      showLoginStatus('\u0e42\u0e2b\u0e25\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48', true);
    });
    return;
  }

  const user = findUserById(id);
  if (!user) {
    showLoginStatus('ไม่พบ User นี้ในระบบ', true);
    return;
  }

  if (password !== getLast4(id)) {
    showLoginStatus('Password ไม่ถูกต้อง (ใช้ 4 ตัวท้ายของ IDRec)', true);
    return;
  }

  currentUser = user;
  setMenuUserInfo(user);
  showLoginStatus('');
  saveLogin(id, password);

  if (loginGate) loginGate.style.display = 'none';

  let autoSelected = false;
  if (user.plant) {
    const code = String(user.plant).trim();

    if (plantSelect) {
      plantSelect.value = code;
      if (plantSelect.value === code && PLANT_URLS[code]) {
        setPlantAndStart();
        autoSelected = true;
      }
    }
  }

  if (!autoSelected && plantGate) {
    plantGate.style.display = 'flex';
  }
}

function toggleMenuPanel(forceOpen) {
  if (!menuPanel) return;
  const shouldOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : !menuPanel.classList.contains('open');
  menuPanel.classList.toggle('open', shouldOpen);
  menuPanel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem(LOGIN_STORAGE_KEY);
  AppDB.remove(CACHE_KEYS.BARCODE);
  AppDB.remove(CACHE_KEYS.SERIAL);
  if (loginRemember) loginRemember.checked = false;
  if (loginUserInput) loginUserInput.value = '';
  if (loginPassInput) loginPassInput.value = '';
  showLoginStatus('');
  setMenuUserInfo(null);
  toggleMenuPanel(false);
  resetAppState();
  if (plantSelect) plantSelect.value = '';
  if (plantGate) plantGate.style.display = 'none';
  if (appShell) appShell.classList.add('is-hidden');
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'hub:logout' }, window.location.origin);
    return;
  }
  if (loginGate) loginGate.style.display = 'flex';
}

function populatePlantSelect() {
  if (!plantSelect) return;
  plantSelect.innerHTML = '<option value="" disabled selected>เลือกสาขา</option>';
  Object.keys(PLANT_NAMES).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${key} ${PLANT_NAMES[key]}`;
    plantSelect.appendChild(option);
  });
}

function setPlantAndStart() {
  if (!plantSelect) return;
  const plant = plantSelect.value;
  if (!plant || !PLANT_URLS[plant]) {
    alert('กรุณาเลือก Plant ก่อนเริ่มใช้งาน');
    return;
  }

  selectedPlant = plant;
  dataUrl = PLANT_URLS[plant];
  updateTabAvailability();

  const plantName = PLANT_NAMES[selectedPlant] || '';

  if (badgeText) {
    badgeText.textContent = `โหมดทำงาน: Barcode (${selectedPlant} ${plantName})`;
  }
  if (headerTitle) {
    headerTitle.textContent = `Smart Warehouse Barcode คลัง ${plantName}`;
  }

  if (plantGate) plantGate.style.display = 'none';
  // Note: appShell stay hidden until all databases loaded inside startApp()

  // Trigger Address Tab default refresh if available
  if (typeof window.refreshAddressDefaults === 'function') {
    window.refreshAddressDefaults();
  }

  startApp();
}

function updateTabAvailability() {
  const showSerialAndGrn = selectedPlant === '0301' || selectedPlant === '0326';

  if (serialTabBtn) serialTabBtn.style.display = showSerialAndGrn ? '' : 'none';
  if (grnTabBtn) grnTabBtn.style.display = showSerialAndGrn ? '' : 'none';

  if (tabPanels.serial) tabPanels.serial.style.display = showSerialAndGrn ? '' : 'none';
  if (tabPanels.grn) tabPanels.grn.style.display = showSerialAndGrn ? '' : 'none';

  const addressTabBtn = document.querySelector('[data-tab="address"]');
  if (addressTabBtn) {
    addressTabBtn.style.display = '';
  }
  if (typeof loadAddressData === 'function' && typeof addressDB !== 'undefined' && addressDB.length === 0) {
    loadAddressData();
  }

  if (!showSerialAndGrn && tabPanels.barcode && barcodeTabBtn) {
    tabButtons.forEach(b => b.classList.remove('active'));
    barcodeTabBtn.classList.add('active');
    Object.keys(tabPanels).forEach(key => {
      tabPanels[key].classList.toggle('active', key === 'barcode');
    });
  }

  const printMediumBtn = document.getElementById('printMediumBtn');
  if (printMediumBtn) {
    if (selectedPlant === '0301' || selectedPlant === '0326') {
      printMediumBtn.style.display = 'none';
    } else {
      printMediumBtn.style.display = '';
    }
  }
}

async function startApp() {
  showMainLoading(true, 'กำลังโหลดข้อมูลเบื้องต้น...');
  
  updateMainLoadingMsg('กำลังโหลดฐานข้อมูลพื้นฐาน...');
  
  const tasks = [
    loadCentralBinData(),
    loadMaterialData(),
    loadPartsData(),
    loadEmployeeData()
  ];

  if (selectedPlant === '0301' || selectedPlant === '0326') {
    tasks.push(loadSummarySyncData());
    tasks.push(loadGrnData());
  }

  try {
    await Promise.all(tasks);
  } catch (err) {
    console.error('Error during parallel data load:', err);
    // Continue anyway, individual loaders show their own errors
  }

  updateMainLoadingMsg('กำลังเตรียมความพร้อมระบบ...');
  // สลับลำดับนิดหน่อยเพื่อให้ UI เคลียร์ก่อนปิด loading

  // Reset GRN filters และตั้งค่า Default Date เป็นวันปัจจุบัน
  grnFilters.invoice = '';
  grnFilters.material = '';
  grnFilters.date = ''; // Default to "All" instead of Today to ensure data is visible

  // ป้องกันแถวซ้ำ (Clear tables before init)
  if (tableBody) tableBody.innerHTML = '';
  nextIndex = 1;
  if (serialTableBody) serialTableBody.innerHTML = '';
  serialNextIndex = 1;

  // โหลด cache จาก IndexedDB → ถ้าไม่มีจะสร้างแถวว่างให้แทน
  const [barcodeCached, serialCached] = await Promise.all([
    AppDB.get(CACHE_KEYS.BARCODE),
    AppDB.get(CACHE_KEYS.SERIAL)
  ]);

  if (barcodeCached && barcodeCached.rows && barcodeCached.rows.length > 0) {
    await loadBarcodeCache();
  } else {
    addNewRow();
  }

  if (serialCached && serialCached.rows && serialCached.rows.length > 0) {
    await loadSerialCache();
  } else {
    addSerialRow();
    updateSerialSummary();
  }
  
  // Show app shell now that everything is loaded
  if (appShell) appShell.classList.remove('is-hidden');

  // ปิด Loading smoothly
  setTimeout(() => {
    showMainLoading(false);
  }, 800);
}

function resetAppState() {
  selectedPlant = '';
  dataUrl = '';
  materialDB = [];
  partsDB = [];
  partsMap = new Map();
  centralBinMap = new Map();
  nextIndex = 1;
  serialNextIndex = 1;
  updateTabAvailability();

  if (tableBody) tableBody.innerHTML = '';
  if (serialTableBody) serialTableBody.innerHTML = '';
  if (rowStatusEl) rowStatusEl.textContent = '';
  if (dataStatusEl) dataStatusEl.textContent = '';
  if (empCodeInput) empCodeInput.value = '';
  if (empStatus) {
    empStatus.textContent = 'กำลังโหลดข้อมูลพนักงาน...';
  }

  if (serialInvoiceInput) serialInvoiceInput.value = '';
  if (serialMatInput) serialMatInput.value = '';
  if (serialDescInput) serialDescInput.value = '';
  if (serialBinInput) serialBinInput.value = '';
  if (serialPrefixInput) serialPrefixInput.value = '';
  if (serialSuffixInput) serialSuffixInput.value = '';
  if (serialTopStatus) {
    serialTopStatus.textContent = 'กรอก Invoice และ Material เพื่อดึง Description / Storage bin จากฐานข้อมูล';
  }
  if (serialStatusEl) {
    serialStatusEl.textContent = 'แถวแรกถูกสร้างให้แล้ว กรอก Serial แล้วกด Enter เพื่อสร้างแถวถัดไป';
  }
  updateSerialSummary();
}

function returnToPlant() {
  resetAppState();
  if (plantSelect) plantSelect.value = '';
  if (badgeText) {
    badgeText.textContent = 'โหมดทำงาน: Barcode';
  }
  if (headerTitle) {
    headerTitle.textContent = 'Smart Warehouse Barcode';
  }
  if (plantGate) plantGate.style.display = 'flex';
  if (appShell) appShell.classList.add('is-hidden');
}

if (appShell) appShell.classList.add('is-hidden');
if (plantEnterBtn) {
  plantEnterBtn.addEventListener('click', setPlantAndStart);
}
if (backToPlantBtn) {
  backToPlantBtn.addEventListener('click', returnToPlant);
}

if (loginGate) loginGate.style.display = 'flex';
if (plantGate) plantGate.style.display = 'none';
setMenuUserInfo(null);
updateTabAvailability();

if (menuBtn && menuPanel) {
  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenuPanel();
  });
  menuPanel.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  document.addEventListener('click', () => {
    toggleMenuPanel(false);
  });
}
if (logoutBtn) {
  logoutBtn.addEventListener('click', handleLogout);
}

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });
}

// ปุ่มลบทั้งหมด
const clearAllBtn = document.getElementById('clearAllBtn');
if (clearAllBtn) {
  clearAllBtn.addEventListener('click', () => {
    if (confirm('ต้องการลบข้อมูลทั้งหมดใช่หรือไม่?')) {
      // ลบแถวทั้งหมด
      const tableBody = document.querySelector('#entryTable tbody');
      if (tableBody) {
        tableBody.innerHTML = '';
        nextIndex = 1;
        addNewRow();
      }

      // ล้าง Cache ด้วย (IndexedDB)
      AppDB.remove(CACHE_KEYS.BARCODE);

      // แสดงข้อความสถานะ
      const rowStatusEl = document.getElementById('rowStatus');
      if (rowStatusEl) {
        rowStatusEl.textContent = 'ลบข้อมูลทั้งหมดเรียบร้อยแล้ว';
      }
    }
  });
}

// ==== Sorting Logic for Barcode Table ====
let barcodeSortState = { col: -1, asc: true };

function setupBarcodeTableSorting() {
  const table = document.getElementById('entryTable');
  if (!table) return;

  const headers = table.querySelectorAll('thead th');
  // Material (index 2), Storage bin (index 4)
  const sortCols = [2, 4];

  sortCols.forEach(index => {
    if (headers[index]) {
      headers[index].style.cursor = 'pointer';
      headers[index].title = 'คลิกเพื่อเรียงลำดับ';
      headers[index].addEventListener('click', () => {
        sortBarcodeTable(index);
      });
    }
  });
}

function sortBarcodeTable(colIndex) {
  const rows = Array.from(tableBody.querySelectorAll('tr'));
  if (rows.length < 2) return;

  // Toggle direction
  if (barcodeSortState.col === colIndex) {
    barcodeSortState.asc = !barcodeSortState.asc;
  } else {
    barcodeSortState.col = colIndex;
    barcodeSortState.asc = true;
  }

  const isAsc = barcodeSortState.asc;

  rows.sort((rowA, rowB) => {
    const inputA = rowA.children[colIndex].querySelector('input');
    const inputB = rowB.children[colIndex].querySelector('input');

    const valA = inputA ? inputA.value.trim().toLowerCase() : '';
    const valB = inputB ? inputB.value.trim().toLowerCase() : '';

    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });

  // Re-append rows in new order
  rows.forEach(row => tableBody.appendChild(row));

  // Update indices
  updateRowIndices();

  // Update header UI
  const table = document.getElementById('entryTable');
  const headers = table.querySelectorAll('thead th');
  headers.forEach((th, idx) => {
    let text = th.textContent.replace(/ ▲| ▼/g, '');
    if (idx === colIndex) {
      text += isAsc ? ' ▲' : ' ▼';
    }
    th.textContent = text;
  });
}

setupBarcodeTableSorting();

// ==== Login and Initialization ====
async function handleAfterLogin() {
  await loadBarcodeCache();
  await loadSerialCache();
}

populatePlantSelect();

// ==== Hub Single Sign-On Auto-Login ====
function tryHubAutoLogin() {
  try {
    const raw =
      localStorage.getItem('plant_hub_user_session_v2') ||
      sessionStorage.getItem('plant_hub_user_session_v2');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const hubUser = parsed && parsed.user ? parsed.user : null;
    if (!hubUser) return false;

    const mapped = mapUserRow(hubUser);
    if (!mapped.id) return false;

    currentUser = mapped;
    setMenuUserInfo(mapped);
    showLoginStatus('');
    if (loginGate) loginGate.style.display = 'none';

    let autoSelected = false;
    if (mapped.plant) {
      const code = String(mapped.plant).trim();
      if (plantSelect) {
        plantSelect.value = code;
        if (plantSelect.value === code && PLANT_URLS[code]) {
          setPlantAndStart();
          autoSelected = true;
        }
      }
    }
    if (!autoSelected && plantGate) {
      plantGate.style.display = 'flex';
    }
    return true;
  } catch (err) {
    console.warn('[Hub SSO] Failed:', err);
    return false;
  }
}

// เริ่มโหลด userDB ทันทีที่หน้า Login เปิด เก็บ promise ไว้เพื่อใช้ซ้ำใน handleLogin
const _userDataReady = migrateOldCache().then(() => loadUserData());

// รอให้ defer scripts ทั้งหมด (รวมถึง address-tab.js) โหลดเสร็จก่อนรัน Auto-SSO
function initBarcodeAuth() {
  const hubLoggedIn = tryHubAutoLogin();
  if (!hubLoggedIn) {
    _userDataReady.then(() => {
      const saved = restoreLogin();
      if (saved && loginUserInput && loginPassInput) {
        loginUserInput.value = saved.id || '';
        loginPassInput.value = saved.password || '';
        if (loginRemember) loginRemember.checked = true;
        handleLogin();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBarcodeAuth);
} else {
  setTimeout(initBarcodeAuth, 0);
}


