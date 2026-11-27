/**
 * TANK.JS
 * Main application controller, state management, and event listeners.
 */

// Global State
let currentSystem = 'Summary';
let allDataset   = null;
let stockData    = null;
let detailCache  = {};
let editingInvID = null;
let pendingImages = [];
let existingImages = [];
let isDualAddMode = false;
let dualPendingImages = { Tank: [], Recripte: [] };
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxZoom = 1;
let lightboxPanX = 0;
let lightboxPanY = 0;
let lightboxDidGesture = false;
let filterProduct = 'all';
let debounceTimer = null;
let showFullInvoiceInfo = false;
let showHiddenHistory = false;
let editingSystem = null;
let backgroundSaveQueue = Promise.resolve();

const PRINT_MODE_STORAGE_KEY = 'tankRechargePrintMode_v3';
let exportPreviewMode = (() => {
  try {
    return localStorage.getItem(PRINT_MODE_STORAGE_KEY) === 'v1' ? 'v1' : 'v2';
  } catch (_) {
    return 'v2';
  }
})();

function isCurrentUserAdmin() {
  return Boolean(currentUser && String(currentUser.Status || currentUser.Auth || '').trim().toLowerCase() === 'admin');
}

function isShowingHiddenHistory() {
  return Boolean(isCurrentUserAdmin() && showHiddenHistory);
}

function toggleHiddenHistory(checked) {
  if (!isCurrentUserAdmin()) {
    showHiddenHistory = false;
    return;
  }
  showHiddenHistory = Boolean(checked);
  const toggleEl = document.getElementById('showHiddenHistoryToggle');
  if (toggleEl) toggleEl.checked = showHiddenHistory;
  processLocalData();
  const minDateLabel = (typeof MIN_DISPLAY_DATE !== 'undefined' && MIN_DISPLAY_DATE)
    ? formatDisplayDate(MIN_DISPLAY_DATE)
    : '';
  showToast(
    showHiddenHistory
      ? 'แสดงข้อมูลตารางที่ซ่อนไว้ทั้งหมดแล้ว'
      : `ซ่อนข้อมูลก่อนวันที่ ${minDateLabel} แล้ว`,
    'info'
  );
}

function getActiveExportPreviewMode() {
  return 'v2';
}

function syncPrintModeToggleUI() {
  const wrap = document.getElementById('printModeSwitchContainer');
  if (wrap) wrap.style.display = 'none';
}

function setExportPreviewMode(mode) {
  if (!isCurrentUserAdmin()) return;
  exportPreviewMode = (mode === 'v2') ? 'v2' : 'v1';
  try { localStorage.setItem(PRINT_MODE_STORAGE_KEY, exportPreviewMode); } catch (_) {}
  syncPrintModeToggleUI();
  showToast(
    exportPreviewMode === 'v2'
      ? 'เปลี่ยนรูปแบบพิมพ์ Preview เป็น: แบบ 2'
      : 'เปลี่ยนรูปแบบพิมพ์ Preview เป็น: แบบเดิม',
    'info'
  );
}

function toggleExportPreviewMode(checked) {
  setExportPreviewMode(checked ? 'v2' : 'v1');
}

function updateAddButtonVisibility() {
  const addBtn = document.getElementById('addBtn');
  const isAdmin = isCurrentUserAdmin();
  if (addBtn) addBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  syncPrintModeToggleUI();
}

// Single-page Summary view
function switchSystem() {
  currentSystem = 'Summary';
  updateAddButtonVisibility();
  processLocalData();
}

function toggleFullInvoiceInfo(checked) {
  showFullInvoiceInfo = checked;
  processLocalData();
}

function toggleLegend() {
  const content = document.getElementById('legendContent');
  const arrow = document.getElementById('legendArrow');
  if (content.style.maxHeight && content.style.maxHeight !== '0px') {
    content.style.maxHeight = '0px';
    arrow.style.transform = 'rotate(0deg)';
  } else {
    content.style.maxHeight = content.scrollHeight + 'px';
    arrow.style.transform = 'rotate(180deg)';
  }
}

function setProductFilter(prod, btn) {
  filterProduct = prod;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  processLocalData();
}

function clearFilters() {
  filterProduct = 'all';
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  const allBtn = document.querySelector('.filter-chip');
  if (allBtn) allBtn.classList.add('active');
  processLocalData();
}

function processLocalData() {
  updateAddButtonVisibility();
  if (!allDataset) return;
  detailCache = {}; 
  const buildCache = (arr, sys) => {
    for (const d of (arr || [])) {
      const k = sys + '_' + d.invDeliveryID;
      if (!detailCache[k]) detailCache[k] = [];
      detailCache[k].push(d);
    }
  };
  buildCache(allDataset.tankDetail, 'Tank');
  buildCache(allDataset.recDetail, 'Recripte');

  updateStats(); 
  const summArr = buildSummaryTimeline(true);
  renderSummaryTable(summArr);
}

function buildSummaryTimeline(applyProductFilter = true) {
  const summArr = [];
  const tMain = allDataset.tankMain || [];
  for (const t of tMain) {
    if (applyProductFilter && filterProduct !== 'all') {
      const items = detailCache['Tank_' + t.invDeliveryID] || [];
      if (!items.some(it => it.product === filterProduct && it.qty > 0)) continue;
    }
    summArr.push({ type: 'Tank', date: t.date, rec: t });
  }
  const rMain = allDataset.recMain || [];
  const recByDate = {};
  for (const r of rMain) {
    if (applyProductFilter && filterProduct !== 'all') {
      const items = detailCache['Recripte_' + r.invDeliveryID] || [];
      if (!items.some(it => it.product === filterProduct && it.qty > 0)) continue;
    }
    if (!recByDate[r.date]) recByDate[r.date] = [];
    recByDate[r.date].push(r);
  }
  for (const date in recByDate) {
    summArr.push({ type: 'Recripte', date: date, invoices: recByDate[date] });
  }
  summArr.sort((a, b) => {
    const dateOrder = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateOrder !== 0) return dateOrder;
    // On the same day, returns (Recripte) happen before new shipments (Tank),
    // so in newest-to-oldest order, Tank comes first (-1) and Recripte comes second (1).
    if (a.type === b.type) return 0;
    return a.type === 'Tank' ? -1 : 1;
  });
  return summArr;
}

function computeRunningBalance(summArr) {
  const products = ['ไนโตรเจน 1.5 Q', 'ออกซิเจน 1.5 Q', 'ออกซิเจน 0.5 Q'];
  const balance = {};
  products.forEach(p => balance[p] = 0);
  const recStatsMap = {};

  for (let i = summArr.length - 1; i >= 0; i--) {
    const r = summArr[i];
    if (r.type === 'Tank') {
      const items = detailCache['Tank_' + r.rec.invDeliveryID] || [];
      products.forEach(p => {
        balance[p] += items.filter(it => it.product === p).reduce((sum, it) => sum + (it.qty || 0), 0);
      });
    } else {
      recStatsMap[i] = {};
      products.forEach(p => {
        let recQty = 0;
        for (const inv of r.invoices) {
          const items = detailCache['Recripte_' + inv.invDeliveryID] || [];
          recQty += items.filter(it => it.product === p).reduce((sum, it) => sum + (it.qty || 0), 0);
        }
        const availableBefore = balance[p];
        const overReturnQty = Math.max(0, recQty - availableBefore);
        const remainingAfter = Math.max(0, availableBefore - recQty);
        balance[p] = remainingAfter;
        recStatsMap[i][p] = { availableBefore, remainingAfter, overReturnQty, recQty };
      });
    }
  }
  return { finalBalance: balance, recStatsMap };
}

function updateStockStats() {
  const stockN2El  = document.getElementById('stockN2');
  const stockO2LEl = document.getElementById('stockO2L');
  const stockO2SEl = document.getElementById('stockO2S');

  const remainN2El  = document.getElementById('remainN2');
  const remainO2LEl = document.getElementById('remainO2L');
  const remainO2SEl = document.getElementById('remainO2S');

  const getRawVal = (matId) => {
    if (!stockData || stockData[matId] === undefined || stockData[matId] === null) {
      return null;
    }
    const val = Number(stockData[matId]);
    return isNaN(val) ? null : val;
  };

  const getPendingVal = (elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return 0;
    const txt = el.textContent.trim();
    if (txt === '—' || txt === '') return 0;
    const n = Number(txt.replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const updateCard = (stockEl, remainEl, matId, pendingVal) => {
    const stockVal = getRawVal(matId);
    if (stockEl) {
      stockEl.textContent = stockVal !== null ? stockVal.toLocaleString() : '—';
    }
    if (remainEl) {
      if (stockVal !== null) {
        const remain = stockVal - pendingVal;
        remainEl.textContent = remain.toLocaleString();
        remainEl.style.color = remain >= 0 ? 'var(--success)' : 'var(--danger)';
      } else {
        remainEl.textContent = '—';
        remainEl.style.color = '';
      }
    }
  };

  if (typeof STOCK_MATERIAL_MAP !== 'undefined') {
    const pendingN2  = getPendingVal('statN2');
    const pendingO2L = getPendingVal('statO2L');
    const pendingO2S = getPendingVal('statO2S');

    updateCard(stockN2El,  remainN2El,  STOCK_MATERIAL_MAP.N2,  pendingN2);
    updateCard(stockO2LEl, remainO2LEl, STOCK_MATERIAL_MAP.O2L, pendingO2L);
    updateCard(stockO2SEl, remainO2SEl, STOCK_MATERIAL_MAP.O2S, pendingO2S);
  }
}

function updateStats() {
  if (!allDataset) return;
  const isGroupedRec = (currentSystem === 'Recripte');
  const isTank = (currentSystem === 'Tank');
  const isSumm = (currentSystem === 'Summary');

  if (currentSystem === 'Tank' || currentSystem === 'Recripte') {
    const mainArr = currentSystem === 'Tank' ? allDataset.tankMain : allDataset.recMain;
    const detArr  = currentSystem === 'Tank' ? allDataset.tankDetail : allDataset.recDetail;
    document.getElementById('statTotal').textContent = (mainArr || []).length;
    let n2 =0, o2l=0, o2s=0;
    for (const r of (detArr || [])) {
      if (r.product.includes('ไนโตรเจน')) n2 += Number(r.qty) || 0;
      else if (r.product.includes('0.5')) o2s += Number(r.qty) || 0;
      else if (r.product.includes('ออกซิเจน')) o2l += Number(r.qty) || 0;
    }
    document.getElementById('statN2').textContent = n2;
    document.getElementById('statO2L').textContent = o2l;
    document.getElementById('statO2S').textContent = o2s;
  } else {
    const tMain = allDataset.tankMain || [];
    document.getElementById('statTotal').textContent = tMain.length;
    const { finalBalance } = computeRunningBalance(buildSummaryTimeline(false));
    const outN2 = finalBalance['ไนโตรเจน 1.5 Q'] || 0;
    const outO2L = finalBalance['ออกซิเจน 1.5 Q'] || 0;
    const outO2S = finalBalance['ออกซิเจน 0.5 Q'] || 0;
    document.getElementById('statN2').textContent = outN2;
    document.getElementById('statO2L').textContent = outO2L;
    document.getElementById('statO2S').textContent = outO2S;
    
    let latestTankDate = '';
    for (const r of tMain) { if (!latestTankDate || r.date > latestTankDate) latestTankDate = r.date; }
    let lN2 = 0, lO2L = 0, lO2S = 0;
    if (latestTankDate) {
       const latestInvs = tMain.filter(r => r.date === latestTankDate).map(r => r.invDeliveryID);
       for (const r of (allDataset.tankDetail || [])) {
          if (latestInvs.includes(r.invDeliveryID)) {
             if (r.product.includes('ไนโตรเจน')) lN2 += Number(r.qty) || 0;
             else if (r.product.includes('0.5')) lO2S += Number(r.qty) || 0;
             else if (r.product.includes('ออกซิเจน')) lO2L += Number(r.qty) || 0;
          }
       }
    }
    const iconN2 = document.getElementById('statN2')?.closest('.stat-card')?.querySelector('.stat-icon');
    const iconO2L = document.getElementById('statO2L')?.closest('.stat-card')?.querySelector('.stat-icon');
    const iconO2S = document.getElementById('statO2S')?.closest('.stat-card')?.querySelector('.stat-icon');
    if (iconN2) { if (outN2 !== lN2) iconN2.classList.add('blink'); else iconN2.classList.remove('blink'); }
    if (iconO2L) { if (outO2L !== lO2L) iconO2L.classList.add('blink'); else iconO2L.classList.remove('blink'); }
    if (iconO2S) { if (outO2S !== lO2S) iconO2S.classList.add('blink'); else iconO2S.classList.remove('blink'); }
  }

  updateStockStats();
}

// Modals
function openAddModal() {
  isDualAddMode = true;
  editingInvID = null;
  editingSystem = null;
  pendingImages = [];
  existingImages = [];
  dualPendingImages = { Tank: [], Recripte: [] };

  document.getElementById('modalTitle').textContent = '➕ เพิ่มข้อมูล';
  document.getElementById('dualAddForm').style.display = 'block';
  document.getElementById('singleEditForm').style.display = 'none';

  const today = getTodayStr();
  document.getElementById('dualDate').value = today;
  ['tank', 'rec'].forEach(prefix => {
    document.getElementById(prefix + 'InvID').value = '';
    ['N2', 'O2L', 'O2S'].forEach(k => {
      document.getElementById(`${prefix}-qty-${k}`).value = '';
    });
    document.getElementById(prefix + 'ImgCamera').value = '';
    document.getElementById(prefix + 'ImgGallery').value = '';
  });

  document.getElementById('cardTankForm').classList.remove('collapsed');
  document.getElementById('cardRecForm').classList.remove('collapsed');
  renderDualImagePreviews('Tank');
  renderDualImagePreviews('Recripte');
  updateDualCardStatus('Tank');
  updateDualCardStatus('Recripte');
  openModal();
}

function toggleDualCard(sys) {
  const cardId = sys === 'Tank' ? 'cardTankForm' : 'cardRecForm';
  const card = document.getElementById(cardId);
  if (card) card.classList.toggle('collapsed');
}

function updateDualCardStatus(sys) {
  const prefix = sys === 'Tank' ? 'tank' : 'rec';
  const badge = document.getElementById(prefix + 'FormStatus');
  if (!badge) return;

  const invID = document.getElementById(prefix + 'InvID').value.trim();
  const hasImg = (dualPendingImages[sys] || []).length > 0;
  const hasQty = ['N2', 'O2L', 'O2S'].some(k => {
    const val = document.getElementById(`${prefix}-qty-${k}`).value;
    return val !== '' && val !== null;
  });

  if (invID && hasImg && hasQty) {
    badge.textContent = 'พร้อมบันทึก ✓';
    badge.classList.add('ready');
  } else if (invID || hasImg || hasQty) {
    badge.textContent = 'กำลังกรอก...';
    badge.classList.remove('ready');
  } else {
    badge.textContent = 'ยังไม่กรอก';
    badge.classList.remove('ready');
  }
}

async function openEditModal(invID, sysOverride) {
  if (!allDataset) return;
  isDualAddMode = false;
  editingSystem = sysOverride || currentSystem;
  const isTank = (editingSystem === 'Tank');
  const mainArr = isTank ? allDataset.tankMain : allDataset.recMain;
  const rec = (mainArr || []).find(r => r.invDeliveryID === invID);
  if (!rec) return;

  document.getElementById('dualAddForm').style.display = 'none';
  document.getElementById('singleEditForm').style.display = 'block';

  editingInvID = invID;
  pendingImages = [];
  existingImages = (rec.images && rec.images.length) ? [...rec.images] : parseImageUrls(rec.image);
  document.getElementById('modalTitle').textContent = isTank ? '✏️ แก้ไขใบส่งอัด' : '✏️ แก้ไขใบรับคืน';
  document.getElementById('fldInvLabel').textContent = isTank ? 'เลขที่ใบส่งอัด *' : 'เลขที่ใบรับคืน *';
  document.getElementById('fldImgSectionLabel').textContent = isTank
    ? 'รูปภาพใบส่งอัด (เพิ่มได้หลายรูป)'
    : 'รูปภาพใบรับคืน (เพิ่มได้หลายรูป)';
  document.getElementById('fldInvID').value    = rec.invDeliveryID;
  document.getElementById('fldDate').value     = rec.date;
  document.getElementById('fldInvID').disabled = true;
  clearQtyFields();
  resetImageUI();
  renderExistingImagesUI();

  let details = detailCache[editingSystem + '_' + invID];
  if (!details) {
    showLoading('โหลดรายการสินค้า...');
    try {
      details = await apiGet('getDetailList', { invDeliveryID: invID });
      detailCache[editingSystem + '_' + invID] = details || [];
    } catch (e) { details = []; }
    hideLoading();
  }
  populateQtyFromDetails(details);
  openModal();
}

function openModal()  { document.getElementById('mainModal').classList.add('open'); }
function closeModal() {
  document.getElementById('mainModal').classList.remove('open');
  document.getElementById('saveBtn').disabled = false;
}

function populateQtyFromDetails(details) {
  clearQtyFields();
  for (const d of (details || [])) {
    const k = labelToKey(d.product);
    if (k) document.getElementById('qty-' + k).value = d.qty;
  }
}

function clearQtyFields() {
  ['N2','O2L','O2S'].forEach(k => { document.getElementById('qty-'+k).value = ''; });
}

// Actions
async function saveRecord() {
  if (isDualAddMode) {
    return saveDualRecords();
  }

  const invID = (editingInvID || document.getElementById('fldInvID').value.trim()).toUpperCase();
  const date  = document.getElementById('fldDate').value;

  if (!invID) { showToast(editingSystem === 'Tank' ? 'กรุณากรอกเลขที่ใบส่งอัด' : 'กรุณากรอกเลขที่ใบรับคืน', 'error'); return; }
  if (!date)  { showToast('กรุณาเลือกวันที่', 'error'); return; }

  const details = Object.entries(PRODUCT_LABEL_MAP)
    .map(([k, label]) => ({ product: label, qty: document.getElementById('qty-' + k).value }))
    .filter(d => d.qty !== '' && d.qty !== null);

  if (!details.length) { showToast('กรุณากรอกจำนวนสินค้าอย่างน้อย 1 รายการ', 'error'); return; }

  const isAdd = !editingInvID;
  if (isAdd && pendingImages.length === 0) {
    showToast('กรุณาแนบรูปภาพใบส่งอัด/ใบรับคืน อย่างน้อย 1 รูป', 'error');
    return;
  }

  // --- OPTIMISTIC UPDATE START ---
  const sys = editingSystem || currentSystem;
  
  // 1. Update Main Dataset
  const mainKey = sys === 'Tank' ? 'tankMain' : 'recMain';
  const mainArr = allDataset[mainKey];
  const combinedImages = [...existingImages, ...pendingImages.map(p => p.dataUrl)];
  const newItem = {
    invDeliveryID: invID,
    date: date,
    image: combinedImages[0] || '',
    images: combinedImages
  };

  if (isAdd) {
    mainArr.push(newItem);
  } else {
    const idx = mainArr.findIndex(r => r.invDeliveryID === invID);
    if (idx !== -1) mainArr[idx] = newItem;
  }

  // 2. Update Details Dataset
  const detKey = sys === 'Tank' ? 'tankDetail' : 'recDetail';
  const detArr = allDataset[detKey];
  
  // Remove old details for this invID (both Add/Edit to be safe, though mostly for Edit)
  allDataset[detKey] = detArr.filter(d => d.invDeliveryID !== invID);
  
  // Add new details
  const detailObjects = details.map(d => ({
    invDeliveryID: invID,
    date: date,
    product: d.product,
    qty: Number(d.qty)
  }));
  allDataset[detKey].push(...detailObjects);

  // 3. Trigger UI Re-render immediately
  saveDatasetCache(allDataset);
  processLocalData();
  closeModal();
  showToast('อัปเดตข้อมูลในตารางแล้ว กำลังบันทึกลงเซิร์ฟเวอร์...', 'info');
  // --- OPTIMISTIC UPDATE END ---

  // Snapshot all form values before starting the background request. The user may
  // switch systems or open another form while this save is still in flight.
  const savePayload = {
    sys,
    invID,
    date,
    images: pendingImages.map(p => ({ imageData: p.dataUrl, imageFilename: p.filename })),
    existingImages: [...existingImages],
    details: details.map(d => ({ ...d }))
  };
  backgroundSaveQueue = backgroundSaveQueue.then(() => saveRecordInBackground(savePayload));
}

function collectDualSectionData(sys) {
  const prefix = sys === 'Tank' ? 'tank' : 'rec';
  const invID = document.getElementById(prefix + 'InvID').value.trim().toUpperCase();
  const date = document.getElementById('dualDate').value;
  const images = dualPendingImages[sys] || [];
  const details = Object.entries(PRODUCT_LABEL_MAP)
    .map(([k, label]) => ({ product: label, qty: document.getElementById(`${prefix}-qty-${k}`).value }))
    .filter(d => d.qty !== '' && d.qty !== null);
  const hasAnyInput = Boolean(invID || images.length > 0 || details.length > 0);
  return {
    sys,
    label: sys === 'Tank' ? 'ระบบส่งอัดท่อ' : 'ระบบรับคืนท่อ',
    invID,
    date,
    images,
    details,
    hasAnyInput
  };
}

async function saveDualRecords() {
  const tankData = collectDualSectionData('Tank');
  const recData = collectDualSectionData('Recripte');
  const toSave = [tankData, recData].filter(s => s.hasAnyInput);

  if (!toSave.length) {
    showToast('กรุณากรอกข้อมูลอย่างน้อย 1 ระบบ (ส่งอัดท่อ หรือ รับคืนท่อ)', 'error');
    return;
  }

  for (const s of toSave) {
    if (!s.invID) {
      showToast(`[${s.label}] กรุณากรอก${s.sys === 'Tank' ? 'เลขที่ใบส่งอัด' : 'เลขที่ใบรับคืน'}`, 'error');
      return;
    }
    if (!s.date) {
      showToast(`[${s.label}] กรุณาเลือกวันที่`, 'error');
      return;
    }
    if (!s.details.length) {
      showToast(`[${s.label}] กรุณากรอกจำนวนสินค้าอย่างน้อย 1 รายการ`, 'error');
      return;
    }
    if (!s.images.length) {
      showToast(`[${s.label}] กรุณาแนบรูปภาพอย่างน้อย 1 รูป`, 'error');
      return;
    }
  }

  // Optimistic update for all sections being saved
  for (const s of toSave) {
    const mainKey = s.sys === 'Tank' ? 'tankMain' : 'recMain';
    const detKey = s.sys === 'Tank' ? 'tankDetail' : 'recDetail';
    const imageUrls = s.images.map(p => p.dataUrl);
    const newItem = {
      invDeliveryID: s.invID,
      date: s.date,
      image: imageUrls[0] || '',
      images: imageUrls
    };

    const mainArr = allDataset[mainKey] || [];
    const idx = mainArr.findIndex(r => r.invDeliveryID === s.invID);
    if (idx !== -1) mainArr[idx] = newItem;
    else mainArr.push(newItem);
    allDataset[mainKey] = mainArr;

    allDataset[detKey] = (allDataset[detKey] || []).filter(d => d.invDeliveryID !== s.invID);
    allDataset[detKey].push(...s.details.map(d => ({
      invDeliveryID: s.invID,
      date: s.date,
      product: d.product,
      qty: Number(d.qty)
    })));
  }

  saveDatasetCache(allDataset);
  processLocalData();
  closeModal();
  showToast(`อัปเดตข้อมูล ${toSave.map(s => s.invID).join(' และ ')} แล้ว กำลังบันทึกลงเซิร์ฟเวอร์...`, 'info');

  for (const s of toSave) {
    const savePayload = {
      sys: s.sys,
      invID: s.invID,
      date: s.date,
      images: s.images.map(p => ({ imageData: p.dataUrl, imageFilename: p.filename })),
      existingImages: [],
      details: s.details.map(d => ({ ...d }))
    };
    backgroundSaveQueue = backgroundSaveQueue.then(() => saveRecordInBackground(savePayload));
  }
}

async function saveRecordInBackground({ sys, invID, date, images, existingImages: keptUrls, details }) {
  try {
    const firstImg = images && images[0] ? images[0] : { imageData: '', imageFilename: 'invoice.jpg' };
    const r1 = await apiPost({
      action: 'saveTank',
      invDeliveryID: invID,
      date,
      imageData: firstImg.imageData,
      imageFilename: firstImg.imageFilename,
      images,
      existingImages: keptUrls
    }, sys);
    if (r1 && r1.error) throw new Error(r1.error);
    if (r1 && Array.isArray(r1.imageUrls)) {
      const mainKey = sys === 'Tank' ? 'tankMain' : 'recMain';
      const rec = (allDataset[mainKey] || []).find(r => r.invDeliveryID === invID);
      if (rec) {
        const synced = parseImageUrls(r1.imageUrls);
        rec.images = synced;
        rec.image = synced[0] || '';
      }
    }
    const r2 = await apiPost({ action: 'saveDetails', invDeliveryID: invID, date, details }, sys);
    if (r2 && r2.error) throw new Error(r2.error);

    saveDatasetCache(allDataset);
    showToast(`บันทึก ${invID} สำเร็จ ✓`, 'success');
  } catch (err) {
    console.error('Background save failed:', err);
    showToast(`บันทึก ${invID} ไม่สำเร็จ: ${err.message || err}`, 'error');
    // The UI was updated optimistically. Refresh quietly so a failed save does
    // not leave the local table showing data that is absent from the server.
    await loadData(true, true);
  }
}

function confirmDelete(invID, sysOverride) {
  const sys = sysOverride || currentSystem;
  const isTank = (sys === 'Tank');
  const typeText = isTank ? 'ใบส่งอัด' : 'ใบรับคืน';
  document.getElementById('confirmText').textContent = `ลบ${typeText} "${invID}" และรายการทั้งหมดที่เกี่ยวข้อง?`;
  document.getElementById('confirmOkBtn').onclick = () => {
    const mainKey = isTank ? 'tankMain' : 'recMain';
    const detKey = isTank ? 'tankDetail' : 'recDetail';
    allDataset[mainKey] = (allDataset[mainKey] || []).filter(r => r.invDeliveryID !== invID);
    allDataset[detKey] = (allDataset[detKey] || []).filter(d => d.invDeliveryID !== invID);
    saveDatasetCache(allDataset);
    processLocalData();
    closeConfirm();
    showToast(`ลบ ${invID} แล้ว กำลังอัปเดตเซิร์ฟเวอร์...`, 'info');

    backgroundSaveQueue = backgroundSaveQueue.then(async () => {
      try {
        const r = await apiPost({ action: 'deleteTank', invDeliveryID: invID }, sys);
        if (r && r.error) throw new Error(r.error);
        showToast(`ลบ ${invID} สำเร็จ ✓`, 'success');
      } catch (err) {
        console.error('Background delete failed:', err);
        showToast(`ลบ ${invID} ไม่สำเร็จ: ${err.message || err}`, 'error');
        await loadData(true, true);
      }
    });
  };
  document.getElementById('confirmOverlay').classList.add('open');
}
function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('open'); }

// Images
function compressImageFile(file, maxDim = 1400, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.onload = e => {
      const dataUrl = e.target.result;
      if (file.size <= 180 * 1024) {
        resolve({ dataUrl, filename: file.name || 'invoice.jpg' });
        return;
      }
      const img = new Image();
      img.onerror = () => resolve({ dataUrl, filename: file.name || 'invoice.jpg' });
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        const baseName = (file.name || 'invoice').replace(/\.[^.]+$/, '');
        resolve({
          dataUrl: compressed.length < dataUrl.length ? compressed : dataUrl,
          filename: compressed.length < dataUrl.length ? `${baseName}.jpg` : (file.name || 'invoice.jpg')
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function handleImageSelect(evt) {
  const files = Array.from((evt && evt.target && evt.target.files) || []);
  if (!files.length) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const result = await compressImageFile(file);
      pendingImages.push(result);
      renderImagePreviews();
    } catch (err) {
      showToast(`ไม่สามารถอ่านไฟล์ "${file.name}" ได้`, 'error');
    }
  }
  if (evt.target && 'value' in evt.target) evt.target.value = '';
}

function renderImagePreviews() {
  const grid = document.getElementById('imgPreviewGrid');
  if (!grid) return;
  if (!pendingImages.length) {
    grid.style.display = 'none';
    grid.innerHTML = '';
    return;
  }
  grid.style.display = 'flex';
  grid.innerHTML = pendingImages.map((img, idx) => `
    <div class="img-preview-item" onclick="event.stopPropagation();">
      <img src="${img.dataUrl}" alt="preview ${idx + 1}" onclick="openLightbox(pendingImages.map(p => p.dataUrl), ${idx})" />
      <button type="button" class="img-remove-btn" onclick="removePendingImage(${idx}, event)" title="ลบรูปนี้">✕</button>
    </div>
  `).join('');
}

function renderExistingImagesUI() {
  const existingWrap = document.getElementById('existingImgWrap');
  if (!existingWrap) return;
  if (!existingImages.length) {
    existingWrap.innerHTML = '';
    return;
  }
  existingWrap.innerHTML = `
    <p style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px;">รูปภาพปัจจุบัน (${existingImages.length} รูป — กด ✕ เพื่อลบ หรืออัปโหลดเพิ่มด้านบน)</p>
    <div class="img-preview-grid" style="justify-content:flex-start;margin-top:6px;">
      ${existingImages.map((url, idx) => `
        <div class="img-preview-item">
          <img src="${esc(url)}" alt="existing ${idx + 1}" referrerpolicy="no-referrer" onclick="openLightbox(existingImages, ${idx})" />
          <button type="button" class="img-remove-btn" onclick="removeExistingImage(${idx}, event)" title="ลบรูปนี้">✕</button>
        </div>
      `).join('')}
    </div>`;
}

function removePendingImage(idx, evt) {
  if (evt) evt.stopPropagation();
  pendingImages.splice(idx, 1);
  renderImagePreviews();
}

function removeExistingImage(idx, evt) {
  if (evt) evt.stopPropagation();
  existingImages.splice(idx, 1);
  renderExistingImagesUI();
}

function resetImageUI() {
  document.getElementById('imgFileInputCamera').value = '';
  document.getElementById('imgFileInputGallery').value = '';
  renderImagePreviews();
}

async function handleDualImageSelect(sys, evt) {
  const files = Array.from((evt && evt.target && evt.target.files) || []);
  if (!files.length) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const result = await compressImageFile(file);
      dualPendingImages[sys].push(result);
      renderDualImagePreviews(sys);
      updateDualCardStatus(sys);
    } catch (err) {
      showToast(`ไม่สามารถอ่านไฟล์ "${file.name}" ได้`, 'error');
    }
  }
  if (evt.target && 'value' in evt.target) evt.target.value = '';
}

function renderDualImagePreviews(sys) {
  const prefix = sys === 'Tank' ? 'tank' : 'rec';
  const grid = document.getElementById(prefix + 'ImgPreviewGrid');
  if (!grid) return;
  const list = dualPendingImages[sys] || [];
  if (!list.length) {
    grid.style.display = 'none';
    grid.innerHTML = '';
    return;
  }
  grid.style.display = 'flex';
  grid.innerHTML = list.map((img, idx) => `
    <div class="img-preview-item" onclick="event.stopPropagation();">
      <img src="${img.dataUrl}" alt="preview ${idx + 1}" onclick="openDualPendingLightbox('${sys}', ${idx})" />
      <button type="button" class="img-remove-btn" onclick="removeDualPendingImage('${sys}', ${idx}, event)" title="ลบรูปนี้">✕</button>
    </div>
  `).join('');
}

function removeDualPendingImage(sys, idx, evt) {
  if (evt) evt.stopPropagation();
  dualPendingImages[sys].splice(idx, 1);
  renderDualImagePreviews(sys);
  updateDualCardStatus(sys);
}

function openDualPendingLightbox(sys, idx) {
  const list = (dualPendingImages[sys] || []).map(p => p.dataUrl);
  openLightbox(list, idx);
}

function bindDragDropZone(zoneId, onFiles) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
  });
}

function setupDragDrop() {
  bindDragDropZone('uploadZone', files => handleImageSelect({ target: { files } }));
  bindDragDropZone('tankUploadZone', files => handleDualImageSelect('Tank', { target: { files } }));
  bindDragDropZone('recUploadZone', files => handleDualImageSelect('Recripte', { target: { files } }));
}

// Lightbox
function openLightbox(urlOrUrls, startIndex = 0) {
  const list = Array.isArray(urlOrUrls)
    ? urlOrUrls.filter(Boolean)
    : parseImageUrls(urlOrUrls);
  if (!list.length) return;
  lightboxImages = list;
  lightboxIndex = Math.max(0, Math.min(startIndex, list.length - 1));
  updateLightboxView();
  document.getElementById('lightbox').classList.add('open');
}

function openLightboxByInv(sys, invID, startIndex = 0) {
  if (!allDataset) return;
  const arr = sys === 'Tank' ? allDataset.tankMain : allDataset.recMain;
  const rec = (arr || []).find(r => r.invDeliveryID === invID);
  if (!rec) return;
  const imgs = (rec.images && rec.images.length) ? rec.images : parseImageUrls(rec.image);
  openLightbox(imgs, startIndex);
}

function openLightboxByRecDate(date, startIndex = 0) {
  if (!allDataset) return;
  const invs = (allDataset.recMain || []).filter(r => r.date === date);
  const imgs = [];
  for (const inv of invs) {
    const list = (inv.images && inv.images.length) ? inv.images : parseImageUrls(inv.image);
    imgs.push(...list);
  }
  openLightbox(imgs, startIndex);
}

function applyLightboxTransform(instant = false) {
  const imgEl = document.getElementById('lightboxImg');
  const zoomBtn = document.getElementById('lightboxZoomBtn');
  const isZoomed = lightboxZoom > 1.05;
  if (imgEl) {
    imgEl.style.transition = instant ? 'none' : 'transform 0.12s ease-out';
    imgEl.style.transform = `translate3d(${lightboxPanX}px, ${lightboxPanY}px, 0) scale(${lightboxZoom})`;
    imgEl.style.cursor = isZoomed ? 'grab' : (lightboxImages.length > 1 ? 'pointer' : 'zoom-in');
  }
  if (zoomBtn) {
    zoomBtn.classList.toggle('active', isZoomed);
    zoomBtn.textContent = isZoomed ? `🔍 ${lightboxZoom.toFixed(1)}x` : '🔍 ซูม';
  }
}

function resetLightboxZoom() {
  lightboxZoom = 1;
  lightboxPanX = 0;
  lightboxPanY = 0;
  lightboxDidGesture = false;
  applyLightboxTransform(true);
}

function toggleLightboxZoom() {
  if (lightboxZoom > 1.05) {
    resetLightboxZoom();
  } else {
    lightboxZoom = 2.5;
    lightboxPanX = 0;
    lightboxPanY = 0;
    applyLightboxTransform();
  }
}

function onLightboxImgClick(evt) {
  if (evt) evt.stopPropagation();
  if (lightboxDidGesture) {
    lightboxDidGesture = false;
    return;
  }
  if (lightboxZoom > 1.05) {
    resetLightboxZoom();
    return;
  }
  if (lightboxImages.length > 1) stepLightbox(1);
}

function updateLightboxView() {
  if (!lightboxImages.length) return;
  resetLightboxZoom();
  const imgEl = document.getElementById('lightboxImg');
  imgEl.src = lightboxImages[lightboxIndex];
  const hasMulti = lightboxImages.length > 1;
  imgEl.style.cursor = hasMulti ? 'pointer' : 'zoom-in';
  imgEl.title = hasMulti ? 'กดเพื่อดูรูปถัดไป' : 'กดปุ่มซูมหรือจีบนิ้วเพื่อขยาย';
  document.getElementById('lightboxPrev').style.display = hasMulti ? 'flex' : 'none';
  document.getElementById('lightboxNext').style.display = hasMulti ? 'flex' : 'none';
  const counter = document.getElementById('lightboxCounter');
  counter.style.display = hasMulti ? 'block' : 'none';
  counter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
}

function stepLightbox(delta) {
  if (lightboxImages.length <= 1) return;
  lightboxIndex = (lightboxIndex + delta + lightboxImages.length) % lightboxImages.length;
  updateLightboxView();
}

function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

// Loading / Toasts / Error
function showLoading(t) {
  document.getElementById('loadingText').textContent = t || 'กำลังโหลด...';
  document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('show'); }
function showToast(msg, type = 'info') {
  hideLoading();
  const wrap = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${msg}`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
function onError(err) {
  hideLoading();
  if(document.getElementById('saveBtn')) document.getElementById('saveBtn').disabled = false;
  showToast('เกิดข้อผิดพลาด: ' + (err.message || err), 'error');
  console.error(err);
}

// ===== EXPORT REFILL FORM =====
const EXPORT_PRODUCTS = [
  { key: 'ไนโตรเจน 1.5 Q', label: 'ถังไนโตรเจน 1.5 Q', short: 'N₂ 1.5Q' },
  { key: 'ออกซิเจน 1.5 Q', label: 'ถังออกซิเจน 1.5Q', short: 'O₂ 1.5Q' },
  { key: 'ออกซิเจน 0.5 Q', label: 'ถังออกซิเจน 0.5Q', short: 'O₂ 0.5Q' }
];

function openExportModalByDate(targetDate, targetInvID) {
  const overlay = document.getElementById('exportOverlay');
  if (overlay) overlay.classList.remove('open');

  const summArr = buildSummaryTimeline(false);
  if (!summArr.length) {
    showToast('ยังไม่มีข้อมูลในระบบ', 'info');
    return;
  }

  const selDate = targetDate || summArr[0].date;

  renderExportFormForDate(selDate, targetInvID);

  // ไม่แสดงฟอร์มบนหน้าจอ เรียกหน้าต่างพิมพ์ทันที
  setTimeout(() => {
    const origTitle = document.title;
    document.title = '\u200E';
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  }, 100);
}

function openExportModal(targetInvID) {
  if (targetInvID) {
    const t = (allDataset.tankMain || []).find(x => x.invDeliveryID === targetInvID);
    if (t) {
      openExportModalByDate(t.date, targetInvID);
      return;
    }
  }
  openExportModalByDate();
}

function closeExportModal() {
  const overlay = document.getElementById('exportOverlay');
  if (overlay) overlay.classList.remove('open');
}

function changeExportDate(date) {
  renderExportFormForDate(date);
}

function changeExportInvoice(invID) {
  const t = (allDataset.tankMain || []).find(x => x.invDeliveryID === invID);
  if (t) {
    renderExportFormForDate(t.date, invID);
  }
}

function getExportMetricsByDate(summArr, recStatsMap, targetDate, productKey) {
  const recIdx = summArr.findIndex(r => r.type === 'Recripte' && r.date === targetDate);
  if (recIdx !== -1 && recStatsMap[recIdx] && recStatsMap[recIdx][productKey]) {
    const st = recStatsMap[recIdx][productKey];
    return {
      prevPending: Number(st.availableBefore) || 0,
      returned: Number(st.recQty) || 0,
      remainingAfter: Number(st.remainingAfter) || 0,
      overReturnQty: Number(st.overReturnQty) || 0
    };
  }

  const prevPending = getPendingReturnByDate(summArr, recStatsMap, targetDate, productKey);
  return {
    prevPending,
    returned: 0,
    remainingAfter: prevPending,
    overReturnQty: 0
  };
}

function getPreviousActivityDate(summArr, targetDate) {
  const prevEntry = (summArr || []).find(r => r.date && r.date < targetDate);
  return prevEntry ? prevEntry.date : '';
}

function renderExportFormForDate(targetDate, targetInvID) {
  const tankRecs = (allDataset.tankMain || []).filter(t => t.date === targetDate);
  const activeTank = targetInvID ? tankRecs.find(t => t.invDeliveryID === targetInvID) : (tankRecs[0] || null);

  const docNoEl = document.getElementById('expDocNo');
  const docDateEl = document.getElementById('expDocDate');
  
  if (docNoEl) {
    if (targetInvID) {
      docNoEl.textContent = targetInvID;
    } else if (tankRecs.length) {
      docNoEl.textContent = tankRecs.map(t => t.invDeliveryID).join(', ');
    } else {
      docNoEl.textContent = '—';
    }
  }

  if (docDateEl) {
    docDateEl.textContent = formatDisplayDate(targetDate);
  }

  // Compute running balance & recStatsMap (same as summary table)
  const summArr = buildSummaryTimeline(false);
  const { recStatsMap } = computeRunningBalance(summArr);

  const tableEl = document.getElementById('exportTable');
  const thead = document.getElementById('exportTableHead');
  const tbody = document.getElementById('exportTableBody');
  const tfoot = document.getElementById('exportTableFoot');
  const remarksEl = document.getElementById('exportRemarks');
  if (!tbody) return;

  const mode = getActiveExportPreviewMode();
  const isV2 = (mode === 'v2');
  if (tableEl) {
    tableEl.classList.toggle('export-table-v2', isV2);
    tableEl.dataset.mode = mode;
  }

  if (isV2) {
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th rowspan="2" class="col-no" style="width: 38px;">ลำดับ</th>
          <th rowspan="2" class="col-desc" style="text-align: left;">รายการ</th>
          <th colspan="3" class="exp-grp-left">ยอดคงค้างเดิม / รับคืนวันนี้</th>
          <th colspan="2" class="exp-grp-right">ส่งอัดวันนี้ / ยอดสุทธิ</th>
        </tr>
        <tr>
          <th class="col-v2-num">ค้างยกมา<span class="exp-sub-tag">(1)</span></th>
          <th class="col-v2-num">ส่งคืนครั้งนี้<span class="exp-sub-tag">(2)</span></th>
          <th class="col-v2-num">ค้างส่งคืน<span class="exp-sub-tag">(3)=(1)-(2)</span></th>
          <th class="col-v2-num exp-col-sent">ส่งอัดครั้งนี้<span class="exp-sub-tag">(4)</span></th>
          <th class="col-v2-final exp-col-final">รวมค้างส่งคืน<span class="exp-sub-tag">(5)=(3)+(4)</span></th>
        </tr>
      `;
    }

    let rowsHTML = '';
    EXPORT_PRODUCTS.forEach((p, idx) => {
      let sent = 0;
      if (activeTank && targetInvID) {
        const items = detailCache['Tank_' + activeTank.invDeliveryID] || [];
        sent = items.filter(it => it.product === p.key).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
      } else {
        tankRecs.forEach(t => {
          const items = detailCache['Tank_' + t.invDeliveryID] || [];
          sent += items.filter(it => it.product === p.key).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
        });
      }

      const m = getExportMetricsByDate(summArr, recStatsMap, targetDate, p.key);
      const rowTotal = m.remainingAfter + sent;

      const prevDisplay = m.prevPending > 0 ? m.prevPending : '-';
      const recDisplay = m.returned > 0 ? m.returned : '-';
      const remDisplay = m.overReturnQty > 0
        ? `<span style="color:#c53030;">-</span><div style="font-size:0.68rem; color:#c53030; font-weight:600; line-height:1.1;">(เกิน ${m.overReturnQty})</div>`
        : (m.remainingAfter > 0 ? m.remainingAfter : '-');
      const sentDisplay = sent > 0 ? sent : '-';
      const rowTotalDisplay = rowTotal > 0 ? rowTotal : '-';

      rowsHTML += `
        <tr>
          <td class="col-no" style="text-align: center; font-weight: 600; color: #718096;">${idx + 1}</td>
          <td class="col-desc exp-item-name">${esc(p.label)}</td>
          <td class="col-v2-num" style="text-align: center;">
            <input type="text" inputmode="numeric" class="export-num-input exp-prev-input" data-idx="${idx}" value="${prevDisplay}" onfocus="if(this.value==='-')this.value=''" onblur="if(!this.value||this.value.trim()==='0'||this.value.trim()==='')this.value='-'; recalcExportTotals()" oninput="recalcExportTotals()">
          </td>
          <td class="col-v2-num" style="text-align: center;">
            <input type="text" inputmode="numeric" class="export-num-input exp-rec-input" data-idx="${idx}" value="${recDisplay}" onfocus="if(this.value==='-')this.value=''" onblur="if(!this.value||this.value.trim()==='0'||this.value.trim()==='')this.value='-'; recalcExportTotals()" oninput="recalcExportTotals()">
          </td>
          <td class="col-v2-num" style="text-align: center; font-weight: 700;" id="expRowRem_${idx}">${remDisplay}</td>
          <td class="col-v2-num" style="text-align: center;">
            <input type="text" inputmode="numeric" class="export-num-input exp-sent-input" data-idx="${idx}" style="color: #1e40af;" value="${sentDisplay}" onfocus="if(this.value==='-')this.value=''" onblur="if(!this.value||this.value.trim()==='0'||this.value.trim()==='')this.value='-'; recalcExportTotals()" oninput="recalcExportTotals()">
          </td>
          <td class="col-v2-final" style="text-align: center;">
            <strong class="exp-row-total" id="expRowTotal_${idx}" style="font-size: 1.05rem; color: #c53030;">${rowTotalDisplay}</strong>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHTML;
    if (tfoot) {
      tfoot.innerHTML = `
        <tr class="export-total-row">
          <td colspan="2" style="text-align: right; padding-right: 12px;">รวมทั้งหมด</td>
          <td style="text-align: center;" id="expTotalPrev">-</td>
          <td style="text-align: center;" id="expTotalRec">-</td>
          <td style="text-align: center;" id="expTotalPending">-</td>
          <td style="text-align: center; color: #1e40af;" id="expTotalSent">-</td>
          <td style="text-align: center; color: #c53030;" id="expGrandTotal">-</td>
        </tr>
      `;
    }

    if (remarksEl) {
      const prevDate = getPreviousActivityDate(summArr, targetDate);
      const prevDateSuffix = prevDate ? ` (ณ วันที่ ${formatDisplayDate(prevDate)})` : '';
      remarksEl.innerHTML = `
        <strong>หมายเหตุ:</strong>
        <div style="margin-top: 2px;">- <strong>ค้างยกมา (1)</strong> คือยอดถังค้างสะสมจากรอบก่อนหน้า${prevDateSuffix}</div>
        <div>- <strong>ค้างส่งคืน (3)</strong> เป็นจำนวนถังที่ยังคงค้างถังที่ยังอยู่ระหว่างรอการส่งคืนให้กับบริษัทหลังหักรับคืนวันนี้</div>
        <div>- <strong>รวมค้างส่งคืน (5)</strong> เป็นจำนวนรวมรายการทั้งหมดที่ยังรอการส่งถังส่งอัด คืนให้กับบริษัท ณ ปัจจุบัน</div>
      `;
    }
  } else {
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th class="col-no" style="width: 45px;">ลำดับ</th>
          <th class="col-desc" style="text-align: left;">รายการ</th>
          <th class="col-qty" style="width: 105px;">จำนวนส่ง</th>
          <th class="col-qty" style="width: 105px;">ค้างส่งคืน</th>
          <th class="col-total" style="width: 120px;">รวมค้างส่งคืน</th>
        </tr>
      `;
    }

    let rowsHTML = '';
    EXPORT_PRODUCTS.forEach((p, idx) => {
      let sent = 0;
      if (activeTank && targetInvID) {
        const items = detailCache['Tank_' + activeTank.invDeliveryID] || [];
        sent = items.filter(it => it.product === p.key).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
      } else {
        tankRecs.forEach(t => {
          const items = detailCache['Tank_' + t.invDeliveryID] || [];
          sent += items.filter(it => it.product === p.key).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
        });
      }

      const pending = getPendingReturnByDate(summArr, recStatsMap, targetDate, p.key);
      const rowTotal = sent + pending;

      const sentDisplay = sent > 0 ? sent : '-';
      const pendingDisplay = pending > 0 ? pending : '-';
      const rowTotalDisplay = rowTotal > 0 ? rowTotal : '-';

      rowsHTML += `
        <tr>
          <td class="col-no" style="text-align: center; font-weight: 600; color: #718096;">${idx + 1}</td>
          <td class="col-desc exp-item-name">${esc(p.label)}</td>
          <td class="col-qty" style="text-align: center;">
            <input type="text" inputmode="numeric" class="export-num-input exp-sent-input" data-idx="${idx}" value="${sentDisplay}" onfocus="if(this.value==='-')this.value=''" onblur="if(!this.value||this.value.trim()==='0'||this.value.trim()==='')this.value='-'; recalcExportTotals()" oninput="recalcExportTotals()">
          </td>
          <td class="col-qty" style="text-align: center;">
            <input type="text" inputmode="numeric" class="export-num-input exp-pending-input" data-idx="${idx}" value="${pendingDisplay}" onfocus="if(this.value==='-')this.value=''" onblur="if(!this.value||this.value.trim()==='0'||this.value.trim()==='')this.value='-'; recalcExportTotals()" oninput="recalcExportTotals()">
          </td>
          <td class="col-total" style="text-align: center;">
            <strong class="exp-row-total" id="expRowTotal_${idx}" style="font-size: 1.05rem; color: #2b6cb0;">${rowTotalDisplay}</strong>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHTML;
    if (tfoot) {
      tfoot.innerHTML = `
        <tr class="export-total-row">
          <td colspan="2" style="text-align: right; padding-right: 16px;">รวมทั้งหมด</td>
          <td style="text-align: center;" id="expTotalSent">-</td>
          <td style="text-align: center;" id="expTotalPending">-</td>
          <td style="text-align: center; color: #c53030;" id="expGrandTotal">-</td>
        </tr>
      `;
    }

    if (remarksEl) {
      remarksEl.innerHTML = `
        <strong>หมายเหตุ:</strong>
        <div style="margin-top: 2px;">- ข้อมูลคงค้างส่งคืน เป็นจำนวนถังที่ยังคงค้างถังที่ยังอยู่ระหว่างรอการส่งคืนให้กับบริษัท</div>
        <div>- รวมค้างส่งคืน เป็นจำนวนรวมรายการทั้งหมดที่ยังรอการส่งถังส่งอัด คืนให้กับบริษัท ณ ปัจจุบัน</div>
      `;
    }
  }

  recalcExportTotals();
}

function getPendingReturnByDate(summArr, recStatsMap, targetDate, productKey) {
  // 1. ดึงจากค่า "ค้างส่งคืน" (remainingAfter) ของแถวรับคืนในวันนั้นโดยตรง
  const recIdx = summArr.findIndex(r => r.type === 'Recripte' && r.date === targetDate);
  if (recIdx !== -1 && recStatsMap[recIdx] && recStatsMap[recIdx][productKey]) {
    return Number(recStatsMap[recIdx][productKey].remainingAfter) || 0;
  }

  // 2. กรณีวันนั้นไม่มีแถวรับคืน ให้ใช้ยอดค้างสะสมก่อนการส่งอัดของวันนั้น
  const products = ['ไนโตรเจน 1.5 Q', 'ออกซิเจน 1.5 Q', 'ออกซิเจน 0.5 Q'];
  const bal = {};
  products.forEach(p => bal[p] = 0);

  for (let i = summArr.length - 1; i >= 0; i--) {
    const r = summArr[i];
    if (r.date === targetDate && r.type === 'Tank') {
      return bal[productKey] || 0;
    }
    if (r.type === 'Tank') {
      const items = detailCache['Tank_' + r.rec.invDeliveryID] || [];
      products.forEach(p => {
        bal[p] += items.filter(it => it.product === p).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
      });
    } else {
      products.forEach(p => {
        let recQty = 0;
        for (const inv of r.invoices) {
          const items = detailCache['Recripte_' + inv.invDeliveryID] || [];
          recQty += items.filter(it => it.product === p).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
        }
        bal[p] = Math.max(0, bal[p] - recQty);
      });
    }
  }
  return bal[productKey] || 0;
}

function recalcExportTotals() {
  const parseVal = v => {
    if (!v) return 0;
    const str = String(v).trim();
    if (str === '-' || str === '' || isNaN(str)) return 0;
    return Number(str) || 0;
  };

  const tableEl = document.getElementById('exportTable');
  const isV2 = Boolean(tableEl && tableEl.dataset.mode === 'v2');

  if (isV2) {
    const prevInputs = document.querySelectorAll('.exp-prev-input');
    const recInputs = document.querySelectorAll('.exp-rec-input');
    const sentInputs = document.querySelectorAll('.exp-sent-input');

    let totalPrev = 0;
    let totalRec = 0;
    let totalPending = 0;
    let totalSent = 0;
    let grandTotal = 0;

    sentInputs.forEach((sentEl, idx) => {
      const pVal = parseVal(prevInputs[idx] ? prevInputs[idx].value : 0);
      const rVal = parseVal(recInputs[idx] ? recInputs[idx].value : 0);
      const sVal = parseVal(sentEl.value);
      const over = Math.max(0, rVal - pVal);
      const rem = Math.max(0, pVal - rVal);
      const rowTot = rem + sVal;

      const remEl = document.getElementById(`expRowRem_${idx}`);
      if (remEl) {
        remEl.innerHTML = over > 0
          ? `<span style="color:#c53030;">-</span><div style="font-size:0.68rem; color:#c53030; font-weight:600; line-height:1.1;">(เกิน ${over})</div>`
          : (rem > 0 ? rem : '-');
      }

      const rowTotEl = document.getElementById(`expRowTotal_${idx}`);
      if (rowTotEl) {
        rowTotEl.textContent = rowTot > 0 ? rowTot : '-';
      }

      totalPrev += pVal;
      totalRec += rVal;
      totalPending += rem;
      totalSent += sVal;
      grandTotal += rowTot;
    });

    const totPrevEl = document.getElementById('expTotalPrev');
    const totRecEl = document.getElementById('expTotalRec');
    const totPendEl = document.getElementById('expTotalPending');
    const totSentEl = document.getElementById('expTotalSent');
    const grandTotEl = document.getElementById('expGrandTotal');

    if (totPrevEl) totPrevEl.textContent = totalPrev > 0 ? totalPrev : '-';
    if (totRecEl) totRecEl.textContent = totalRec > 0 ? totalRec : '-';
    if (totPendEl) totPendEl.textContent = totalPending > 0 ? totalPending : '-';
    if (totSentEl) totSentEl.textContent = totalSent > 0 ? totalSent : '-';
    if (grandTotEl) grandTotEl.textContent = grandTotal > 0 ? grandTotal : '-';
    return;
  }

  const sentInputs = document.querySelectorAll('.exp-sent-input');
  const pendingInputs = document.querySelectorAll('.exp-pending-input');

  let totalSent = 0;
  let totalPending = 0;
  let grandTotal = 0;

  sentInputs.forEach((sentEl, idx) => {
    const pendingEl = pendingInputs[idx];
    const sVal = parseVal(sentEl.value);
    const pVal = parseVal(pendingEl ? pendingEl.value : 0);
    const rowTot = sVal + pVal;

    const rowTotEl = document.getElementById(`expRowTotal_${idx}`);
    if (rowTotEl) {
      rowTotEl.textContent = rowTot > 0 ? rowTot : '-';
    }

    totalSent += sVal;
    totalPending += pVal;
    grandTotal += rowTot;
  });

  const totSentEl = document.getElementById('expTotalSent');
  const totPendEl = document.getElementById('expTotalPending');
  const grandTotEl = document.getElementById('expGrandTotal');

  if (totSentEl) totSentEl.textContent = totalSent > 0 ? totalSent : '-';
  if (totPendEl) totPendEl.textContent = totalPending > 0 ? totalPending : '-';
  if (grandTotEl) grandTotEl.textContent = grandTotal > 0 ? grandTotal : '-';
}

function printExportForm() {
  const origTitle = document.title;
  document.title = '\u200E';
  window.print();
  setTimeout(() => {
    document.title = origTitle;
  }, 1000);
}

let _savedPrintTitle = '';
window.addEventListener('beforeprint', () => {
  _savedPrintTitle = document.title;
  document.title = '\u200E';
});
window.addEventListener('afterprint', () => {
  if (_savedPrintTitle) document.title = _savedPrintTitle;
});

function copyExportTable() {
  const docNo = document.getElementById('expDocNo') ? document.getElementById('expDocNo').textContent.trim() : '';
  const docDate = document.getElementById('expDocDate') ? document.getElementById('expDocDate').textContent.trim() : '';
  const tableEl = document.getElementById('exportTable');
  const isV2 = Boolean(tableEl && tableEl.dataset.mode === 'v2');

  let text = `ใบรับ-ส่งถังบรรจุก๊าซ\n`;
  text += `Sender : บริษัท ซีพี รีเทลลิงค์ จำกัด (ศูนย์วิภาวดี62)\n`;
  text += `Recipient: บริษัท ไทยสเปเชียลแก๊ส จำกัด\n`;
  text += `เลขที่เอกสาร: ${docNo} | วันที่: ${docDate}\n`;
  text += `--------------------------------------------------\n`;

  const rows = document.querySelectorAll('#exportTableBody tr');
  if (isV2) {
    text += `ลำดับ\tรายการ\tค้างยกมา\tส่งคืนครั้งนี้\tค้างส่งคืน\tส่งอัดครั้งนี้\tรวมค้างส่งคืน\n`;
    rows.forEach((tr, i) => {
      const nameEl = tr.querySelector('.exp-item-name');
      const prevEl = tr.querySelector('.exp-prev-input');
      const recEl = tr.querySelector('.exp-rec-input');
      const remEl = document.getElementById(`expRowRem_${i}`);
      const sentEl = tr.querySelector('.exp-sent-input');
      const totEl = tr.querySelector('.exp-row-total');

      const name = nameEl ? nameEl.textContent.trim() : '';
      const prev = prevEl && prevEl.value.trim() && prevEl.value.trim() !== '0' ? prevEl.value.trim() : '-';
      const rec = recEl && recEl.value.trim() && recEl.value.trim() !== '0' ? recEl.value.trim() : '-';
      const rem = remEl && remEl.textContent.trim() && remEl.textContent.trim() !== '0' ? remEl.textContent.trim() : '-';
      const sent = sentEl && sentEl.value.trim() && sentEl.value.trim() !== '0' ? sentEl.value.trim() : '-';
      const total = totEl && totEl.textContent.trim() && totEl.textContent.trim() !== '0' ? totEl.textContent.trim() : '-';

      text += `${i + 1}\t${name}\t${prev}\t${rec}\t${rem}\t${sent}\t${total}\n`;
    });

    const getTot = id => {
      const el = document.getElementById(id);
      return el && el.textContent.trim() && el.textContent.trim() !== '0' ? el.textContent.trim() : '-';
    };
    text += `--------------------------------------------------\n`;
    text += `รวมทั้งหมด\t\t${getTot('expTotalPrev')}\t${getTot('expTotalRec')}\t${getTot('expTotalPending')}\t${getTot('expTotalSent')}\t${getTot('expGrandTotal')}\n`;
  } else {
    text += `ลำดับ\tรายการ\tจำนวนส่ง\tค้างส่งคืน\tรวมค้างส่งคืน\n`;

    rows.forEach((tr, i) => {
      const nameEl = tr.querySelector('.exp-item-name');
      const sentEl = tr.querySelector('.exp-sent-input');
      const pendingEl = tr.querySelector('.exp-pending-input');
      const totEl = tr.querySelector('.exp-row-total');

      const name = nameEl ? nameEl.textContent.trim() : '';
      const sent = sentEl && sentEl.value.trim() && sentEl.value.trim() !== '0' ? sentEl.value.trim() : '-';
      const pending = pendingEl && pendingEl.value.trim() && pendingEl.value.trim() !== '0' ? pendingEl.value.trim() : '-';
      const total = totEl && totEl.textContent.trim() && totEl.textContent.trim() !== '0' ? totEl.textContent.trim() : '-';

      text += `${i + 1}\t${name}\t${sent}\t${pending}\t${total}\n`;
    });

    const totSentEl = document.getElementById('expTotalSent');
    const totPendEl = document.getElementById('expTotalPending');
    const grandTotEl = document.getElementById('expGrandTotal');

    const totSent = totSentEl && totSentEl.textContent.trim() && totSentEl.textContent.trim() !== '0' ? totSentEl.textContent.trim() : '-';
    const totPend = totPendEl && totPendEl.textContent.trim() && totPendEl.textContent.trim() !== '0' ? totPendEl.textContent.trim() : '-';
    const grandTot = grandTotEl && grandTotEl.textContent.trim() && grandTotEl.textContent.trim() !== '0' ? grandTotEl.textContent.trim() : '-';

    text += `--------------------------------------------------\n`;
    text += `รวมทั้งหมด\t\t${totSent}\t${totPend}\t${grandTot}\n`;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('คัดลอกข้อมูลตารางเรียบร้อยแล้ว 📋', 'success');
    }).catch(() => fallbackCopyExport(text));
  } else {
    fallbackCopyExport(text);
  }
}

function fallbackCopyExport(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    showToast('คัดลอกข้อมูลตารางเรียบร้อยแล้ว 📋', 'success');
  } catch (e) {
    showToast('ไม่สามารถคัดลอกได้อัตโนมัติ', 'error');
  }
  document.body.removeChild(ta);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  loadData();
  setupDragDrop();

  const lb = document.getElementById('lightbox');
  if (lb) {
    let touchStartX = 0;
    let panStartX = 0;
    let panStartY = 0;
    let basePanX = 0;
    let basePanY = 0;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let isPanning = false;
    let isPinching = false;

    const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    lb.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        isPinching = true;
        isPanning = false;
        lightboxDidGesture = true;
        pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
        pinchStartZoom = lightboxZoom;
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        if (lightboxZoom > 1.05) {
          isPanning = true;
          panStartX = e.touches[0].clientX;
          panStartY = e.touches[0].clientY;
          basePanX = lightboxPanX;
          basePanY = lightboxPanY;
        }
      }
    }, { passive: true });

    lb.addEventListener('touchmove', e => {
      if (isPinching && e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault();
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        lightboxZoom = Math.max(1, Math.min(4, pinchStartZoom * (dist / pinchStartDist)));
        if (lightboxZoom <= 1.05) {
          lightboxPanX = 0;
          lightboxPanY = 0;
        }
        applyLightboxTransform(true);
      } else if (isPanning && e.touches.length === 1 && lightboxZoom > 1.05) {
        e.preventDefault();
        const dx = e.touches[0].clientX - panStartX;
        const dy = e.touches[0].clientY - panStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) lightboxDidGesture = true;
        lightboxPanX = basePanX + dx;
        lightboxPanY = basePanY + dy;
        applyLightboxTransform(true);
      }
    }, { passive: false });

    lb.addEventListener('touchend', e => {
      if (isPinching && e.touches.length < 2) {
        isPinching = false;
        if (lightboxZoom <= 1.05) resetLightboxZoom();
        return;
      }
      if (isPanning) {
        isPanning = false;
        return;
      }
      if (!e.changedTouches || !e.changedTouches.length || lightboxImages.length <= 1 || lightboxZoom > 1.05) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        lightboxDidGesture = true;
        stepLightbox(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    // Desktop mouse drag-to-pan when zoomed & wheel zoom
    const imgEl = document.getElementById('lightboxImg');
    let isMouseDragging = false;
    let mouseStartX = 0;
    let mouseStartY = 0;
    let mouseBasePanX = 0;
    let mouseBasePanY = 0;

    if (imgEl) {
      imgEl.addEventListener('mousedown', e => {
        if (e.button !== 0 || lightboxZoom <= 1.05) return;
        e.preventDefault();
        isMouseDragging = true;
        lightboxDidGesture = false;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        mouseBasePanX = lightboxPanX;
        mouseBasePanY = lightboxPanY;
        imgEl.style.cursor = 'grabbing';
      });
    }

    document.addEventListener('mousemove', e => {
      if (!isMouseDragging) return;
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) lightboxDidGesture = true;
      lightboxPanX = mouseBasePanX + dx;
      lightboxPanY = mouseBasePanY + dy;
      applyLightboxTransform(true);
    });

    document.addEventListener('mouseup', () => {
      if (!isMouseDragging) return;
      isMouseDragging = false;
      if (imgEl && lightboxZoom > 1.05) imgEl.style.cursor = 'grab';
    });

    lb.addEventListener('wheel', e => {
      if (!lb.classList.contains('open')) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      lightboxZoom = Math.max(1, Math.min(4, lightboxZoom + delta));
      if (lightboxZoom <= 1.05) {
        lightboxZoom = 1;
        lightboxPanX = 0;
        lightboxPanY = 0;
      }
      applyLightboxTransform(true);
    }, { passive: false });
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeModal();
    closeConfirm();
    if (typeof closeHelpModal === 'function') closeHelpModal();
    if (typeof closeExportModal === 'function') closeExportModal();
    if (typeof closeOverNoteModal === 'function') closeOverNoteModal();
    if (typeof closeOverReportModal === 'function') closeOverReportModal();
  }
  if (document.getElementById('lightbox').classList.contains('open')) {
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  }
});

// ============================================================
// OVER RETURN NOTE MODAL & GOOGLE SHEET (Sheet: Over)
// ============================================================
function openOverNoteModal(date, invDeliveryID, product, overQty) {
  const hiddenDate = document.getElementById('overModalDate');
  const hiddenInv = document.getElementById('overModalInvID');
  const hiddenProd = document.getElementById('overModalProduct');
  const hiddenQty = document.getElementById('overModalQty');
  const hiddenEditTs = document.getElementById('overModalEditingTimestamp');

  if (hiddenDate) hiddenDate.value = date || '';
  if (hiddenInv) hiddenInv.value = invDeliveryID || '';
  if (hiddenProd) hiddenProd.value = product || '';
  if (hiddenQty) hiddenQty.value = overQty || 0;
  if (hiddenEditTs) hiddenEditTs.value = '';

  const dateEl = document.getElementById('overInfoDate');
  const invEl = document.getElementById('overInfoInv');
  const prodEl = document.getElementById('overInfoProduct');
  const qtyEl = document.getElementById('overInfoQty');
  const noteInput = document.getElementById('overNoteText');
  const btnEdit = document.getElementById('btnEditOverNoteModal');
  const btnDelete = document.getElementById('btnDeleteOverNoteModal');

  if (dateEl) dateEl.textContent = formatDisplayDate(date);
  if (invEl) invEl.textContent = invDeliveryID || '—';
  if (prodEl) prodEl.textContent = product || '—';
  if (qtyEl) qtyEl.textContent = `${overQty} ถัง`;

  // Check if a note already exists for this date and product
  const matched = (allDataset.overList || []).filter(o => 
    (parseDateStr(o.date) === parseDateStr(date) || String(o.date).trim() === String(date).trim()) && 
    String(o.product).trim() === String(product).trim()
  );

  const btnSave = document.getElementById('btnSaveOverNote');

  if (matched.length) {
    const latest = matched[0];
    if (noteInput) {
      noteInput.value = latest.note || '';
      noteInput.readOnly = true;
      noteInput.style.opacity = '0.85';
      noteInput.style.cursor = 'default';
      noteInput.title = 'กดปุ่ม ✏️ ด้านบนเพื่อเริ่มแก้ไข';
    }
    if (hiddenEditTs) hiddenEditTs.value = latest.timestamp || '';
    if (btnEdit) btnEdit.style.display = 'inline-flex';
    if (btnDelete) btnDelete.style.display = 'inline-flex';
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.style.opacity = '0.4';
      btnSave.style.cursor = 'not-allowed';
      btnSave.title = 'กรุณากดปุ่ม ✏️ ด้านบนเพื่อแก้ไขก่อนบันทึก';
    }
  } else {
    if (noteInput) {
      noteInput.value = '';
      noteInput.readOnly = false;
      noteInput.style.opacity = '1';
      noteInput.style.cursor = 'text';
      noteInput.title = '';
    }
    if (btnEdit) btnEdit.style.display = 'none';
    if (btnDelete) btnDelete.style.display = 'none';
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.style.opacity = '1';
      btnSave.style.cursor = 'pointer';
      btnSave.title = 'บันทึกข้อมูลลง Sheet: Over';
    }
    if (noteInput) setTimeout(() => noteInput.focus(), 150);
  }

  const overlay = document.getElementById('overNoteModalOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeOverNoteModal() {
  const overlay = document.getElementById('overNoteModalOverlay');
  if (overlay) overlay.classList.remove('open');
  const noteInput = document.getElementById('overNoteText');
  if (noteInput) {
    noteInput.readOnly = false;
    noteInput.style.opacity = '1';
    noteInput.style.cursor = 'text';
    noteInput.title = '';
  }
  const btnSave = document.getElementById('btnSaveOverNote');
  if (btnSave) {
    btnSave.disabled = false;
    btnSave.style.opacity = '1';
    btnSave.style.cursor = 'pointer';
    btnSave.innerHTML = '💾';
  }
}

function startEditOverNote(timestamp) {
  const noteInput = document.getElementById('overNoteText');
  const hiddenEditTs = document.getElementById('overModalEditingTimestamp');
  const btnSave = document.getElementById('btnSaveOverNote');
  const list = allDataset.overList || [];
  const found = list.find(o => String(o.timestamp).trim() === String(timestamp).trim());
  if (found && noteInput) {
    noteInput.value = found.note || '';
    if (hiddenEditTs) hiddenEditTs.value = found.timestamp || '';
    noteInput.readOnly = false;
    noteInput.style.opacity = '1';
    noteInput.style.cursor = 'text';
    noteInput.title = '';
    noteInput.focus();
    noteInput.select();
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.style.opacity = '1';
      btnSave.style.cursor = 'pointer';
      btnSave.title = 'บันทึกข้อมูลลง Sheet: Over';
    }
    showToast('กำลังแก้ไขหมายเหตุ ✏️', 'info');
  }
}

function startEditCurrentOverNote() {
  const noteInput = document.getElementById('overNoteText');
  const btnSave = document.getElementById('btnSaveOverNote');
  if (noteInput) {
    noteInput.readOnly = false;
    noteInput.style.opacity = '1';
    noteInput.style.cursor = 'text';
    noteInput.title = '';
    noteInput.focus();
    noteInput.select();
  }
  if (btnSave) {
    btnSave.disabled = false;
    btnSave.style.opacity = '1';
    btnSave.style.cursor = 'pointer';
    btnSave.title = 'บันทึกข้อมูลลง Sheet: Over';
  }
  showToast('ปลดล็อคแล้ว พร้อมแก้ไขหมายเหตุ ✏️', 'info');
}

async function confirmDeleteCurrentOverNote() {
  const hiddenEditTs = document.getElementById('overModalEditingTimestamp');
  const ts = hiddenEditTs ? hiddenEditTs.value : '';
  await confirmDeleteOverNote(ts);
}

async function confirmDeleteOverNote(timestamp) {
  if (!confirm('ยืนยันว่าต้องการลบหมายเหตุนี้ออกจาก Sheet: Over หรือไม่?')) return;

  const date = document.getElementById('overModalDate') ? document.getElementById('overModalDate').value : '';
  const invDeliveryID = document.getElementById('overModalInvID') ? document.getElementById('overModalInvID').value : '';
  const product = document.getElementById('overModalProduct') ? document.getElementById('overModalProduct').value : '';

  const btnDelete = document.getElementById('btnDeleteOverNoteModal');
  if (btnDelete) btnDelete.disabled = true;

  try {
    const payload = {
      action: 'deleteOver',
      date,
      invDeliveryID,
      product,
      timestamp: timestamp || ''
    };

    const res = await apiPost(payload);
    if (res && res.error) throw new Error(res.error);

    // Remove from local list
    if (allDataset.overList) {
      if (timestamp) {
        allDataset.overList = allDataset.overList.filter(o => String(o.timestamp).trim() !== String(timestamp).trim());
      } else {
        allDataset.overList = allDataset.overList.filter(o => !(o.date === date && o.product === product));
      }
      saveDatasetCache(allDataset);
    }

    const noteInput = document.getElementById('overNoteText');
    if (noteInput) noteInput.value = '';
    const hiddenEditTs = document.getElementById('overModalEditingTimestamp');
    if (hiddenEditTs) hiddenEditTs.value = '';

    showToast('ลบหมายเหตุออกจาก Sheet: Over สำเร็จ ✓', 'success');
    closeOverNoteModal();
    processLocalData();
  } catch (err) {
    console.error('Delete over note failed:', err);
    showToast('ลบไม่สำเร็จ: ' + (err.message || err), 'error');
  } finally {
    if (btnDelete) btnDelete.disabled = false;
  }
}

async function saveOverNote() {
  const date = document.getElementById('overModalDate') ? document.getElementById('overModalDate').value : '';
  const invDeliveryID = document.getElementById('overModalInvID') ? document.getElementById('overModalInvID').value : '';
  const product = document.getElementById('overModalProduct') ? document.getElementById('overModalProduct').value : '';
  const overQty = Number(document.getElementById('overModalQty') ? document.getElementById('overModalQty').value : 0) || 0;
  const hiddenEditTs = document.getElementById('overModalEditingTimestamp');
  const editingTs = hiddenEditTs ? hiddenEditTs.value.trim() : '';

  const noteInput = document.getElementById('overNoteText');
  if (noteInput && noteInput.readOnly) {
    showToast('กรุณากดปุ่ม ✏️ เพื่อแก้ไขข้อมูลก่อนบันทึก', 'warning');
    return;
  }
  const note = noteInput ? noteInput.value.trim() : '';

  if (!note) {
    showToast('กรุณากรอกหมายเหตุสำหรับการส่งเกิน', 'warning');
    if (noteInput) noteInput.focus();
    return;
  }

  const btn = document.getElementById('btnSaveOverNote');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳';
  }

  try {
    const user = currentUser ? (currentUser.Name || currentUser.User || '') : '';
    const plant = currentUser ? (currentUser.Plant || '') : '';

    const payload = {
      action: editingTs ? 'updateOver' : 'saveOver',
      date,
      invDeliveryID,
      product,
      overQty,
      note,
      user,
      plant,
      timestamp: editingTs
    };

    const res = await apiPost(payload);
    if (res && res.error) {
      throw new Error(res.error);
    }

    if (!allDataset.overList) allDataset.overList = [];
    if (editingTs) {
      const idx = allDataset.overList.findIndex(o => String(o.timestamp).trim() === editingTs);
      if (idx !== -1) {
        allDataset.overList[idx].note = note;
        allDataset.overList[idx].overQty = overQty;
        if (user) allDataset.overList[idx].user = user;
      }
    } else {
      const newRecord = {
        timestamp: new Date().toLocaleString('th-TH'),
        date,
        invDeliveryID,
        product,
        overQty,
        note,
        user,
        plant
      };
      allDataset.overList.unshift(newRecord);
    }
    saveDatasetCache(allDataset);

    closeOverNoteModal();
    processLocalData();
    showToast('บันทึกหมายเหตุลง Google Sheet: Over สำเร็จ ✓', 'success');
  } catch (err) {
    console.error('Save over note failed:', err);
    showToast('บันทึกลง Google Sheet ไม่สำเร็จ: ' + (err.message || err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '💾';
    }
  }
}

// ============================================================
// OVER RETURN REPORT MODAL (Accessed from Settings)
// ============================================================
let _overJumpTimer = null;

function getOverReturnReportItems() {
  const summArr = buildSummaryTimeline(false);
  const { recStatsMap } = computeRunningBalance(summArr);
  const products = ['ไนโตรเจน 1.5 Q', 'ออกซิเจน 1.5 Q', 'ออกซิเจน 0.5 Q'];
  const report = [];

  summArr.forEach((r, idx) => {
    if (r.type !== 'Recripte') return;
    const balMap = recStatsMap[idx] || {};
    products.forEach(p => {
      const stat = balMap[p];
      if (!stat || !(stat.recQty > 0 && stat.overReturnQty > 0)) return;

      const prodInvs = (r.invoices || []).filter(inv => {
        const det = detailCache['Recripte_' + inv.invDeliveryID] || [];
        return det.some(it => it.product === p && (Number(it.qty) || 0) > 0);
      });
      const invList = (prodInvs.length ? prodInvs : (r.invoices || [])).map(inv => inv.invDeliveryID);

      const hasNote = (allDataset && allDataset.overList || []).some(o =>
        (parseDateStr(o.date) === parseDateStr(r.date) || String(o.date).trim() === String(r.date).trim()) &&
        String(o.product).trim() === String(p).trim()
      );

      report.push({
        date: r.date,
        product: p,
        invIDs: invList.join(', '),
        overQty: stat.overReturnQty,
        hasNote
      });
    });
  });

  return report;
}

function openOverReportModal() {
  const isAdmin = currentUser && String(currentUser.Status || currentUser.Auth || '').trim().toLowerCase() === 'admin';
  if (!isAdmin) return;
  if (typeof closeSettingModal === 'function') closeSettingModal();

  const items = getOverReturnReportItems();
  const countEl = document.getElementById('overReportCount');
  const tbody = document.getElementById('overReportTableBody');

  if (countEl) countEl.textContent = `${items.length} รายการ`;

  if (tbody) {
    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
            <div style="font-size: 1.8rem; margin-bottom: 6px;">✅</div>
            <div style="font-weight: 600;">ไม่พบรายการส่งเกินในระบบ</div>
          </td>
        </tr>`;
    } else {
      const getProdDot = (p) => {
        if (p.includes('ไนโตรเจน')) return '💠';
        if (p.includes('0.5')) return '🟡';
        return '🔴';
      };
      tbody.innerHTML = items.map(it => `
        <tr class="over-report-row" onclick="jumpToTimelineOverItem('${esc(it.date)}', '${esc(it.product)}', this)" title="คลิกเพื่อชี้ไปยังข้อมูลส่งเกินในตารางไทม์ไลน์">
          <td style="white-space: nowrap; font-weight: 600;">${esc(formatDisplayDate(it.date))}</td>
          <td style="white-space: nowrap;">
            <span style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600;">
              <span>${getProdDot(it.product)}</span>
              <span>${esc(it.product)}</span>
            </span>
          </td>
          <td style="word-break: break-word; font-size: 0.82rem; color: var(--text-muted);">${esc(it.invIDs || '—')}</td>
          <td style="text-align: center; white-space: nowrap;">
            <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(252,129,129,0.16); border: 1px solid rgba(252,129,129,0.45); color: var(--danger); border-radius: 12px; padding: 2px 10px; font-weight: 800;">
              ${it.overQty}
              ${it.hasNote ? '<span style="color:#68d391; font-size:0.75rem;" title="บันทึกหมายเหตุแล้ว">✓📝</span>' : ''}
            </span>
          </td>
        </tr>
      `).join('');
    }
  }

  const overlay = document.getElementById('overReportOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeOverReportModal() {
  const overlay = document.getElementById('overReportOverlay');
  if (overlay) overlay.classList.remove('open');
}

function jumpToTimelineOverItem(date, product, reportRowEl) {
  // Highlight selected row inside the report window while keeping the report open
  document.querySelectorAll('.over-report-row.active').forEach(el => el.classList.remove('active'));
  if (reportRowEl) reportRowEl.classList.add('active');

  // Ensure the target item is visible if a product filter is active
  if (typeof filterProduct !== 'undefined' && filterProduct !== 'all' && filterProduct !== product) {
    if (typeof clearFilters === 'function') clearFilters();
  }

  // Clear previous timeline highlights
  document.querySelectorAll('.over-jump-highlight').forEach(el => el.classList.remove('over-jump-highlight'));
  document.querySelectorAll('.over-btn-spotlight').forEach(el => el.classList.remove('over-btn-spotlight'));
  if (_overJumpTimer) {
    clearTimeout(_overJumpTimer);
    _overJumpTimer = null;
  }

  setTimeout(() => {
    const btns = Array.from(document.querySelectorAll('.btn-over-tag'));
    const targetBtn = btns.find(b => {
      const bDate = b.getAttribute('data-over-date') || '';
      const bProd = b.getAttribute('data-over-product') || '';
      const sameDate = bDate === date || parseDateStr(bDate) === parseDateStr(date);
      const sameProd = String(bProd).trim() === String(product).trim();
      return sameDate && sameProd;
    });

    if (!targetBtn) {
      showToast('ไม่พบรายการส่งเกินนี้ในตารางไทม์ไลน์', 'warning');
      return;
    }

    const row = targetBtn.closest('tr');
    if (row) row.classList.add('over-jump-highlight');
    targetBtn.classList.add('over-btn-spotlight');

    targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    setTimeout(() => {
      try {
        targetBtn.focus({ preventScroll: true });
      } catch (e) {}
    }, 350);

    _overJumpTimer = setTimeout(() => {
      if (row) row.classList.remove('over-jump-highlight');
      targetBtn.classList.remove('over-btn-spotlight');
      _overJumpTimer = null;
    }, 4500);
  }, 60);
}
