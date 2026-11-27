/**
 * UI-RENDERERS.JS
 * Table rendering and UI update logic.
 */

function renderStandardTable(rows) {
  const tbody = document.getElementById('mainTbody');
  document.getElementById('tableCount').textContent = `(${rows.length} รายการ)`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบข้อมูลที่ตรงกับตัวกรอง</p></div></td></tr>`;
    return;
  }

  const getQty = (items, lbl) => {
    const f = items.filter(it => it.product === lbl);
    if (!f.length) return `<div style="text-align:center; color:var(--border)">-</div>`;
    const sumQty = f.reduce((sum, it) => sum + (it.qty || 0), 0);
    if (sumQty <= 0) return `<div style="text-align:center; color:var(--border)">-</div>`;
    const k = labelToKey(lbl);
    const cls = k === 'N2' ? 'badge-n2' : k === 'O2L' ? 'badge-o2' : 'badge-o2s';
    return `<div style="text-align:center;"><span class="badge ${cls}" style="min-width:35px; text-align:center;">${sumQty}</span></div>`;
  };

  tbody.innerHTML = rows.map(r => {
    const imgs = (r.images && r.images.length) ? r.images : parseImageUrls(r.image);
    const imgHTML = imgs.length
      ? `<div style="position:relative;display:inline-block;">
           <img src="${esc(imgs[0])}" class="img-thumb" loading="lazy" decoding="async" alt="Invoice" referrerpolicy="no-referrer" onclick="openLightboxByInv('${esc(currentSystem)}','${esc(r.invDeliveryID)}')" />
           ${imgs.length > 1 ? `<span style="position:absolute;bottom:-4px;right:-6px;background:var(--accent1);color:#0d192e;font-size:.65rem;font-weight:800;border-radius:99px;padding:1px 5px;">+${imgs.length - 1}</span>` : ''}
         </div>`
      : `<span class="no-image">—</span>`;
    const sid = escAttr(r.invDeliveryID);
    
    const items = detailCache[currentSystem + '_' + r.invDeliveryID] || [];

    let manageHTML = '-';
    if (currentUser && String(currentUser.Status || currentUser.Auth || '').trim().toLowerCase() === 'admin') {
      manageHTML = `
        <button class="btn btn-success btn-sm" onclick="openEditModal('${esc(r.invDeliveryID)}')">✏️ แก้ไข</button>
        <button class="btn btn-danger btn-sm" style="margin-left:6px;" onclick="confirmDelete('${esc(r.invDeliveryID)}')">🗑️ ลบ</button>
      `;
    }

    return `
      <tr>
        <td style="display:none;"></td>
        <td style="display:none;"></td>
        <td>${formatDisplayDate(r.date)}</td>
        <td><strong>${esc(r.invDeliveryID)}</strong></td>
        <td class="hide-mobile">${imgHTML}</td>
        <td>${getQty(items, 'ไนโตรเจน 1.5 Q')}</td>
        <td>${getQty(items, 'ออกซิเจน 1.5 Q')}</td>
        <td>${getQty(items, 'ออกซิเจน 0.5 Q')}</td>
        <td style="text-align:left;white-space:nowrap;">
          ${manageHTML}
        </td>
      </tr>`;
  }).join('');
}

function renderRecTableGrouped(groupedRows) {
  const tbody = document.getElementById('mainTbody');
  const totalCount = groupedRows.reduce((sum, g) => sum + g.invoices.length, 0);
  document.getElementById('tableCount').textContent = `(${totalCount} รายการ)`;

  if (!groupedRows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบข้อมูลที่ตรงกับตัวกรอง</p></div></td></tr>`;
    return;
  }

  const getQtyLinkGroup = (invoices, lbl) => {
    let els = [];
    const k = labelToKey(lbl);
    const cls = k === 'N2' ? 'badge-n2' : k === 'O2L' ? 'badge-o2' : 'badge-o2s';
    
    for (const inv of invoices) {
      const items = detailCache['Recripte_' + inv.invDeliveryID] || [];
      const filtered = items.filter(it => it.product === lbl);
      const sumQty = filtered.reduce((sum, it) => sum + (it.qty || 0), 0);
      
      if (sumQty > 0) {
        const invIDText = showFullInvoiceInfo ? ` (${esc(inv.invDeliveryID)})` : '';
        const textContent = `${sumQty}${invIDText}`;
        const imgs = (inv.images && inv.images.length) ? inv.images : parseImageUrls(inv.image);
        let imgEmoji = '';
        if (imgs.length) {
          const badge = imgs.length > 1 ? `<span style="font-size:0.65rem;font-weight:800;margin-left:2px;">${imgs.length}</span>` : '';
          imgEmoji = `<button type="button" onclick="event.stopPropagation(); openLightboxByInv('Recripte','${esc(inv.invDeliveryID)}');" 
            style="background:rgba(99,179,237,0.15); border:1px solid rgba(99,179,237,0.3); border-radius:6px; cursor:pointer; min-width:26px; height:26px; display:flex; align-items:center; justify-content:center; color:var(--accent1); padding:0 4px; margin-left:6px;" title="ดูรูปภาพ (${imgs.length} รูป)">📸${badge}</button>`;
        }
        els.push(`
          <div style="margin-bottom:6px; text-align:center; display:flex; align-items:center; justify-content:center;">
            <span class="badge ${cls}" style="display:inline-flex; align-items:center; padding:4px 10px; border:1px solid rgba(255,255,255,0.1);">
              <span style="font-weight:700; font-size:1rem;">${textContent}</span>
              ${imgEmoji}
            </span>
          </div>`);
      }
    }
    return els.length > 0 ? els.join('') : `<div style="text-align:center; color:var(--border)">-</div>`;
  };

  tbody.innerHTML = groupedRows.map(g => {
    const dateID = escAttr(g.date);
    return `
      <tr style="cursor:pointer;" onclick="toggleGroupDetail('${esc(g.date)}', this)">
        <td><strong class="expand-icon" style="color:var(--accent-rec); margin-right:8px;">▶</strong></td>
        <td style="display:none;"></td>
        <td><strong style="color:var(--accent-rec);">${formatDisplayDate(g.date)}</strong></td>
        <td style="display:none;"></td>
        <td class="hide-mobile" style="display:none;"></td>
        <td>${getQtyLinkGroup(g.invoices, 'ไนโตรเจน 1.5 Q')}</td>
        <td>${getQtyLinkGroup(g.invoices, 'ออกซิเจน 1.5 Q')}</td>
        <td>${getQtyLinkGroup(g.invoices, 'ออกซิเจน 0.5 Q')}</td>
        <td style="display:none;"></td>
      </tr>
      <tr class="detail-row"><td colspan="9">
        <div class="detail-inner" id="group-detail-${dateID}">
          <div class="detail-table-wrap" id="group-detail-content-${dateID}"></div>
        </div>
      </td></tr>`;
  }).join('');
}

function renderSummaryTable(rows) {
  const tbody = document.getElementById('mainTbody');
  tbody.parentElement.classList.add('compact-table');
  document.getElementById('tableCount').textContent = `(${rows.length} รายการ)`;
  const thDate = document.getElementById('thDate');
  if (thDate) thDate.style.display = showFullInvoiceInfo ? 'table-cell' : 'none';

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบข้อมูลที่ตรงกับตัวกรอง</p></div></td></tr>`;
    return;
  }

  const getQtyTank = (items, lbl, invID, imgs = []) => {
    const f = items.filter(it => it.product === lbl);
    if (!f.length) return `<div style="text-align:center; color:var(--border)">-</div>`;
    const sumQty = f.reduce((sum, it) => sum + (it.qty || 0), 0);
    if (sumQty <= 0) return `<div style="text-align:center; color:var(--border)">-</div>`;
    
    if (imgs && imgs.length) {
      return `<div style="text-align:center;"><strong style="font-size:1.15rem; color:var(--accent1);"><a href="#" onclick="openLightboxByInv('Tank','${esc(invID)}'); event.stopPropagation(); return false;" style="color:var(--accent1); text-decoration:none;">${sumQty}</a></strong></div>`;
    }
    return `<div style="text-align:center;"><strong style="font-size:1.15rem; color:var(--accent1);">${sumQty}</strong></div>`;
  };

  const getQtyRecGroup = (invoices, lbl, prevTankSum = null, balStat = null, recDate = '') => {
    const els = [];
    let recSum = 0;
    
    for (const inv of invoices) {
      const items = detailCache['Recripte_' + inv.invDeliveryID] || [];
      const filtered = items.filter(it => it.product === lbl);
      recSum += filtered.reduce((sum, it) => sum + (it.qty || 0), 0);
    }

    const availableBeforeReturn = balStat ? balStat.availableBefore : recSum;
    const remainingAfterReturn = balStat ? balStat.remainingAfter : 0;
    const overReturnQty = balStat ? balStat.overReturnQty : 0;
    const hasOverReturn = recSum > 0 && overReturnQty > 0;
    const isBalanceZero = remainingAfterReturn === 0 && overReturnQty === 0;
    const isMismatch = (prevTankSum !== null) && (recSum !== prevTankSum) && !isBalanceZero;
    
    let statusColor, highlightStyle;
    if (isBalanceZero) {
      statusColor = 'var(--success)';
      highlightStyle = `border: 2px solid var(--success); background: rgba(104,211,145,0.15); border-radius: 20px; padding: 2px 10px; display:inline-block;`;
    } else if (hasOverReturn || isMismatch) {
      statusColor = 'var(--danger)';
      highlightStyle = `border: 2px solid var(--danger); background: rgba(252,129,129,0.15); border-radius: 20px; padding: 2px 10px; display:inline-block;`;
    } else {
      statusColor = 'var(--accent-rec)';
      highlightStyle = '';
    }

    const balanceColor = remainingAfterReturn === 0 ? 'var(--success)' : 'var(--danger)';
    const invIDsStr = (invoices || []).map(x => x.invDeliveryID).join(',');
    const hasNote = (allDataset.overList || []).some(o => 
      (parseDateStr(o.date) === parseDateStr(recDate) || String(o.date).trim() === String(recDate).trim()) && 
      String(o.product).trim() === String(lbl).trim()
    );
    const noteIcon = hasNote
      ? `<span style="color:#68d391; font-weight:700;" title="บันทึกหมายเหตุแล้ว">✓📝</span>`
      : `<span style="opacity:0.85;" title="คลิกเพื่อบันทึกหมายเหตุ">📝</span>`;

    const remainingHTML = `<div style="margin-top:4px;font-size:.72rem;color:var(--text-muted);white-space:nowrap;">
      ค้างส่งคืน: <strong style="color:${balanceColor};">${remainingAfterReturn}</strong>
    </div>${hasOverReturn ? `<div style="margin-top:2px;font-size:.72rem;color:var(--text-muted);white-space:nowrap;">
      <button type="button" class="btn-over-tag" data-over-date="${esc(recDate)}" data-over-product="${esc(lbl)}" title="คลิกเพื่อใส่หมายเหตุและบันทึกลง Sheet: Over" onclick="event.stopPropagation(); openOverNoteModal('${esc(recDate)}', '${esc(invIDsStr)}', '${esc(lbl)}', ${overReturnQty});" style="background:rgba(252,129,129,0.15); border:1px solid rgba(252,129,129,0.45); border-radius:12px; color:var(--danger); padding:2px 8px; font-size:0.72rem; cursor:pointer; display:inline-flex; align-items:center; gap:4px; line-height:1.2; transition:all 0.15s ease;" onmouseover="this.style.background='rgba(252,129,129,0.3)'; this.style.borderColor='var(--danger)'" onmouseout="this.style.background='rgba(252,129,129,0.15)'; this.style.borderColor='rgba(252,129,129,0.45)'">
        <span>จำนวนส่งเกิน:</span>
        <strong style="color:var(--danger); font-size:0.76rem;">${overReturnQty}</strong>
        ${noteIcon}
      </button>
    </div>` : ''}`;

    if (recSum === 0) {
      return `<div style="text-align:center;color:var(--border);">—${remainingHTML}</div>`;
    }

    for (const inv of invoices) {
      const items = detailCache['Recripte_' + inv.invDeliveryID] || [];
      const filtered = items.filter(it => it.product === lbl);
      const sumQty = filtered.reduce((sum, it) => sum + (it.qty || 0), 0);
      if (sumQty > 0) {
        const textContent = `${sumQty}`;
        const imgs = (inv.images && inv.images.length) ? inv.images : parseImageUrls(inv.image);
        const content = imgs.length
           ? `<a href="#" onclick="openLightboxByInv('Recripte','${esc(inv.invDeliveryID)}'); event.stopPropagation(); return false;" style="color:${statusColor}; text-decoration:none;">${textContent}</a>`
           : textContent;
        els.push(content);
      }
    }
    const combinedHTML = `<div style="text-align:center;"><strong style="font-size:1.15rem; color:${statusColor}; ${highlightStyle}">${els.join('+')}</strong></div>`;
    return `${combinedHTML}${remainingHTML}`;
  };

  // --- Compute running balance from oldest to newest ---
  const { recStatsMap } = computeRunningBalance(rows);

  // --- Map each Recripte row to the preceding Tank row (chronologically) ---
  const prevTankByRecIdx = {};
  let latestTank = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.type === 'Tank') {
      latestTank = r;
    } else {
      prevTankByRecIdx[i] = latestTank;
    }
  }

  // --- Group rows by Date (newest date first) ---
  const dateGroups = [];
  const dateGroupMap = {};
  rows.forEach((r, idx) => {
    if (!dateGroupMap[r.date]) {
      const grp = { date: r.date, entries: [] };
      dateGroupMap[r.date] = grp;
      dateGroups.push(grp);
    }
    dateGroupMap[r.date].entries.push({ r, idx });
  });

  const getTankSum = (tank, lbl) => {
    if (!tank) return null;
    const items = detailCache['Tank_' + tank.rec.invDeliveryID] || [];
    return items.filter(it => it.product === lbl).reduce((sum, it) => sum + (it.qty || 0), 0);
  };

  // --- Filter visible date groups (hide older than MIN_DISPLAY_DATE unless Admin toggled showHiddenHistory) ---
  const showAllHistory = (typeof isShowingHiddenHistory === 'function') && isShowingHiddenHistory();
  const minDate = (!showAllHistory && typeof MIN_DISPLAY_DATE !== 'undefined' && MIN_DISPLAY_DATE) ? MIN_DISPLAY_DATE : '';
  const visibleDateGroups = minDate ? dateGroups.filter(dg => dg.date >= minDate) : dateGroups;
  const visibleRowCount = visibleDateGroups.reduce((sum, dg) => sum + dg.entries.length, 0);
  document.getElementById('tableCount').textContent = `(${visibleRowCount} รายการ)`;

  if (!visibleDateGroups.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบข้อมูลที่ตรงกับตัวกรอง</p></div></td></tr>`;
    return;
  }

  // --- Render date groups ---
  let outHTML = '';
  visibleDateGroups.forEach((dg, gIdx) => {
    if (gIdx > 0) {
      outHTML += `<tr class="date-spacer"><td colspan="9"></td></tr>`;
    }

    outHTML += `
      <tr class="date-group-header date-row date-row-first">
        <td colspan="8" style="border-top-left-radius:12px; border-top-right-radius:12px; border-right:1.5px solid rgba(99,179,237,0.35);">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span>📅 ${formatDisplayDate(dg.date)}</span>
              <button class="btn-date-print" title="พิมพ์ฟอร์มส่งอัดประจำวันที่ ${formatDisplayDate(dg.date)}" onclick="event.stopPropagation(); openExportModalByDate('${esc(dg.date)}');">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                <span>พิมพ์</span>
              </button>
            </div>
            <span style="font-size:0.74rem; color:var(--text-muted); font-weight:500;">${dg.entries.length} รายการ</span>
          </div>
        </td>
      </tr>`;

    const totalEntries = dg.entries.length;
    dg.entries.forEach((entry, eIdx) => {
      const { r, idx } = entry;
      const isFirst = false;
      const isLastEntry = (eIdx === totalEntries - 1);

      if (r.type === 'Tank') {
        const items = detailCache['Tank_' + r.rec.invDeliveryID] || [];
        const imgs = (r.rec.images && r.rec.images.length) ? r.rec.images : parseImageUrls(r.rec.image);
        const imgHTML = imgs.length
          ? `<div style="position:relative;display:inline-block;">
               <img src="${esc(imgs[0])}" class="img-thumb" loading="lazy" decoding="async" style="width:34px;height:34px;" alt="Inv" referrerpolicy="no-referrer" onclick="openLightboxByInv('Tank','${esc(r.rec.invDeliveryID)}'); event.stopPropagation();" />
               ${imgs.length > 1 ? `<span style="position:absolute;bottom:-4px;right:-6px;background:var(--accent1);color:#0d192e;font-size:.6rem;font-weight:800;border-radius:99px;padding:1px 4px;">+${imgs.length - 1}</span>` : ''}
             </div>`
          : '<span class="no-image">—</span>';
        const detailID = `summ-detail-${idx}`;
        const clickHandler = `toggleSummDetail('Tank','${esc(r.rec.invDeliveryID)}',${idx},this)`;
        const rowCls = `row-tank date-row${isFirst ? ' date-row-first' : ''}`;
        const detCls = `detail-row date-row${isLastEntry ? ' date-row-last' : ''}`;
        const docColStyle = showFullInvoiceInfo ? '' : 'display:none;';
        outHTML += `
           <tr class="${rowCls}" style="cursor:pointer;" onclick="${clickHandler}">
             <td style="text-align:center;"><strong class="expand-icon" style="color:var(--text-muted);">▶</strong></td>
             <td>
               <span class="badge" style="background:var(--accent1);color:#000;font-size:0.7rem;padding:2px 7px;">ส่งอัด</span>
             </td>
             <td style="${docColStyle}"><strong style="color:var(--text-primary);">${esc(r.rec.invDeliveryID)}</strong></td>
             <td style="display:none;"></td>
             <td class="hide-mobile">${imgHTML}</td>
             <td style="text-align:center;">${getQtyTank(items, 'ไนโตรเจน 1.5 Q', r.rec.invDeliveryID, imgs)}</td>
             <td style="text-align:center;">${getQtyTank(items, 'ออกซิเจน 1.5 Q', r.rec.invDeliveryID, imgs)}</td>
             <td style="text-align:center;">${getQtyTank(items, 'ออกซิเจน 0.5 Q', r.rec.invDeliveryID, imgs)}</td>
             <td style="display:none;"></td>
           </tr>
           <tr class="${detCls}"><td colspan="9">
             <div class="detail-inner" id="${detailID}">
               <div class="detail-table-wrap" id="${detailID}-content"></div>
             </div>
           </td></tr>`;
      } else {
        const prevTank = prevTankByRecIdx[idx] || null;
        const n2Prev = getTankSum(prevTank, 'ไนโตรเจน 1.5 Q');
        const o2lPrev = getTankSum(prevTank, 'ออกซิเจน 1.5 Q');
        const o2sPrev = getTankSum(prevTank, 'ออกซิเจน 0.5 Q');

        const balMap = recStatsMap[idx] || {};
        const statN2 = balMap['ไนโตรเจน 1.5 Q'] || null;
        const statO2L = balMap['ออกซิเจน 1.5 Q'] || null;
        const statO2S = balMap['ออกซิเจน 0.5 Q'] || null;

        const recImgs = [];
        for (const inv of r.invoices) {
          const imgs = (inv.images && inv.images.length) ? inv.images : parseImageUrls(inv.image);
          recImgs.push(...imgs);
        }
        const recImgHTML = recImgs.length
          ? `<div style="position:relative;display:inline-block;">
               <img src="${esc(recImgs[0])}" class="img-thumb" loading="lazy" decoding="async" style="width:34px;height:34px;" alt="Inv" referrerpolicy="no-referrer" onclick="openLightboxByRecDate('${esc(r.date)}'); event.stopPropagation();" />
               ${recImgs.length > 1 ? `<span style="position:absolute;bottom:-4px;right:-6px;background:var(--accent-rec);color:#fff;font-size:.6rem;font-weight:800;border-radius:99px;padding:1px 4px;">+${recImgs.length - 1}</span>` : ''}
             </div>`
          : '<span class="no-image">—</span>';

        const docColStyle = showFullInvoiceInfo ? '' : 'display:none;';
        const recInvListHTML = r.invoices.map(inv => `<div style="font-size:0.82rem; font-weight:600; color:var(--text-primary); line-height:1.35;">${esc(inv.invDeliveryID)}</div>`).join('');
        const detailID = `summ-detail-${idx}`;
        const clickHandler = `toggleSummDetail('Recripte','${esc(r.date)}',${idx},this)`;
        const mainCls = `row-recripte date-row${isFirst ? ' date-row-first' : ''}`;
        const detCls = `detail-row date-row${isLastEntry ? ' date-row-last' : ''}`;
        outHTML += `
          <tr class="${mainCls}" style="cursor:pointer;" onclick="${clickHandler}">
             <td style="text-align:center;"><strong class="expand-icon" style="color:var(--text-muted);">▶</strong></td>
             <td><span class="badge" style="background:var(--accent-rec);color:#fff;font-size:0.7rem;padding:2px 7px;">รับคืน</span></td>
             <td style="${docColStyle}">${recInvListHTML}</td>
             <td style="display:none;"></td>
             <td class="hide-mobile">${recImgHTML}</td>
             <td style="text-align:center;">${getQtyRecGroup(r.invoices, 'ไนโตรเจน 1.5 Q', n2Prev, statN2, r.date)}</td>
             <td style="text-align:center;">${getQtyRecGroup(r.invoices, 'ออกซิเจน 1.5 Q', o2lPrev, statO2L, r.date)}</td>
             <td style="text-align:center;">${getQtyRecGroup(r.invoices, 'ออกซิเจน 0.5 Q', o2sPrev, statO2S, r.date)}</td>
             <td style="display:none;"></td>
          </tr>
          <tr class="${detCls}"><td colspan="9">
            <div class="detail-inner" id="${detailID}">
              <div class="detail-table-wrap" id="${detailID}-content"></div>
            </div>
          </td></tr>`;
      }
    });
  });

  tbody.innerHTML = outHTML;
}

function toggleSummDetail(type, id, idx, rowEl) {
  const detailEl = document.getElementById(`summ-detail-${idx}`);
  if (!detailEl) return;
  const isOpen = detailEl.classList.toggle('open');
  const icon = rowEl.querySelector('.expand-icon');
  if (icon) {
    icon.textContent = isOpen ? '▼' : '▶';
    icon.style.color = isOpen ? 'var(--accent1)' : 'var(--text-muted)';
  }

  if (isOpen) {
    const contentWrap = document.getElementById(`summ-detail-${idx}-content`);
    let allItems = [];
    if (type === 'Tank') {
      allItems = (detailCache['Tank_' + id] || []).map(it => ({ ...it, invID: id }));
    } else {
      const date = id;
      const recInvs = (allDataset.recMain || []).filter(r => r.date === date);
      for (const inv of recInvs) {
        const det = detailCache['Recripte_' + inv.invDeliveryID] || [];
        det.forEach(d => allItems.push({ ...d, invID: inv.invDeliveryID }));
      }
    }

    if (!allItems.length) { contentWrap.innerHTML = '<p>ยังไม่มีรายการ</p>'; return; }
    const isAdmin = currentUser && String(currentUser.Status || currentUser.Auth || '').trim().toLowerCase() === 'admin';
    const accentColor = type === 'Tank' ? 'var(--accent1)' : 'var(--accent-rec)';

    let imgStripHTML = '';
    let exportBtnHTML = '';
    if (type === 'Tank') {
      const tankRec = (allDataset.tankMain || []).find(r => r.invDeliveryID === id);
      const recDate = tankRec ? tankRec.date : '';
      exportBtnHTML = `
        <button class="btn-print-dark" style="margin-left:auto; padding:4px 10px; font-size:0.8rem;" onclick="event.stopPropagation(); openExportModalByDate('${esc(recDate)}', '${esc(id)}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          <span>พิมพ์ (${esc(id)})</span>
        </button>
      `;
      const imgs = tankRec ? ((tankRec.images && tankRec.images.length) ? tankRec.images : parseImageUrls(tankRec.image)) : [];
      if (imgs.length) {
        imgStripHTML = `
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:0.78rem; color:var(--text-muted); font-weight:600;">📷 รูปภาพ (${imgs.length}):</span>
            ${imgs.map((url, imgIdx) => `
              <img src="${esc(url)}" class="img-thumb" loading="lazy" decoding="async" style="width:44px;height:44px;cursor:pointer;" alt="Inv" referrerpolicy="no-referrer" onclick="event.stopPropagation(); openLightboxByInv('Tank','${esc(id)}',${imgIdx});" />
            `).join('')}
          </div>`;
      }
    }

    const topBarHTML = (imgStripHTML || exportBtnHTML)
      ? `<div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:10px;">${imgStripHTML}${exportBtnHTML}</div>`
      : '';

    contentWrap.innerHTML = `
      ${topBarHTML}
      <table class="detail-sub-table">
        <thead>
          <tr>
            <th>เลขที่ใบกำกับ</th>
            <th>สินค้า</th>
            <th style="text-align:center;">จำนวน (ถัง)</th>
            ${isAdmin ? '<th style="text-align:left;">จัดการ</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${allItems.map(it => {
            let actionsHTML = '';
            if (isAdmin) {
              const editAction = `openEditModal('${esc(it.invID)}','${type}')`;
              const deleteAction = `confirmDelete('${esc(it.invID)}','${type}')`;
              actionsHTML = `
                <td style="text-align:left;">
                  <button class="btn btn-success btn-sm" style="padding:4px 8px; font-size:0.8rem;" onclick="event.stopPropagation(); ${editAction}">✏️ แก้ไข</button>
                  <button class="btn btn-danger btn-sm" style="padding:4px 8px; font-size:0.8rem; margin-left:4px;" onclick="event.stopPropagation(); ${deleteAction}">🗑️ ลบ</button>
                </td>
              `;
            }
            const cls = badgeClass(it.product);
            const colorStyle = `color:${accentColor}; font-weight:700;`;
            return `
              <tr>
                <td><strong style="${colorStyle}">${esc(it.invID)}</strong></td>
                <td><span class="badge ${cls}">${esc(it.product)}</span></td>
                <td style="text-align:center;"><strong style="${colorStyle}">${it.qty}</strong></td>
                ${actionsHTML}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>`;
  }
}

function toggleGroupDetail(date, row) {
  const dateID = escAttr(date);
  const el = document.getElementById('group-detail-' + dateID);
  if (!el) return;
  const isOpen = el.classList.toggle('open');
  const strong = row.querySelector('.expand-icon');
  if (strong) strong.textContent = isOpen ? '▼' : '▶';

  if (isOpen) {
    const c = document.getElementById('group-detail-content-' + dateID);
    const invoices = (allDataset.recMain || []).filter(r => r.date === date);
    let allItems = [];
    for (const inv of invoices) {
      const details = detailCache['Recripte_' + inv.invDeliveryID] || [];
      details.forEach(d => allItems.push({ ...d, invID: inv.invDeliveryID }));
    }
    if (!allItems.length) { c.innerHTML = '<p>ยังไม่มีรายการ</p>'; return; }
    const isAdmin = currentUser && String(currentUser.Status || currentUser.Auth || '').trim().toLowerCase() === 'admin';
    c.innerHTML = `
      <table class="detail-sub-table">
        <thead>
          <tr>
            <th>เลขที่ใบกำกับ</th>
            <th>รูปภาพ</th>
            <th>สินค้า</th>
            <th style="text-align:center;">จำนวน (ถัง)</th>
            ${isAdmin ? '<th style="text-align:left;">จัดการ</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${allItems.map(it => {
            const invObj = invoices.find(inv => inv.invDeliveryID === it.invID);
            const imgs = invObj ? ((invObj.images && invObj.images.length) ? invObj.images : parseImageUrls(invObj.image)) : [];
            const imgCell = imgs.length
              ? `<div style="position:relative;display:inline-block;">
                   <img src="${esc(imgs[0])}" class="img-thumb" loading="lazy" decoding="async" style="width:34px;height:34px;" alt="Invoice" referrerpolicy="no-referrer" onclick="event.stopPropagation(); openLightboxByInv('Recripte','${esc(it.invID)}')" />
                   ${imgs.length > 1 ? `<span style="position:absolute;bottom:-4px;right:-6px;background:var(--accent1);color:#0d192e;font-size:.6rem;font-weight:800;border-radius:99px;padding:1px 4px;">+${imgs.length - 1}</span>` : ''}
                 </div>`
              : '<span class="no-image">—</span>';
            let actionsHTML = '';
            if (isAdmin) {
              actionsHTML = `
                <td style="text-align:left;">
                  <button class="btn btn-success btn-sm" style="padding:4px 8px; font-size:0.8rem;" onclick="openEditModal('${esc(it.invID)}')">✏️ แก้ไข</button>
                  <button class="btn btn-danger btn-sm" style="padding:4px 8px; font-size:0.8rem; margin-left:4px;" onclick="confirmDelete('${esc(it.invID)}')">🗑️ ลบ</button>
                </td>
              `;
            }
            const cls = badgeClass(it.product);
            const colorStyle = cls === 'badge-n2' ? 'color:var(--accent-n2);' : cls === 'badge-o2' ? 'color:var(--accent-o2);' : 'color:var(--accent-o2s);';
            return `
              <tr>
                <td><strong style="${colorStyle}">${esc(it.invID)}</strong></td>
                <td>${imgCell}</td>
                <td><span class="badge ${cls}">${esc(it.product)}</span></td>
                <td style="text-align:center;"><strong style="${colorStyle}">${it.qty}</strong></td>
                ${actionsHTML}
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }
}

function toggleDetail(invID, btn) {
  const el = document.getElementById('detail-' + escAttr(invID));
  if (!el) return;
  const isOpen = el.classList.toggle('open');
  btn.textContent = isOpen ? '▼' : '▶';

  if (isOpen) {
    const items = detailCache[currentSystem + '_' + invID] || [];
    const c = document.getElementById('detail-content-' + escAttr(invID));
    if (!items.length) { c.innerHTML = '<p>ยังไม่มีรายการ</p>'; return; }
    c.innerHTML = `<table class="detail-sub-table"><thead><tr><th>สินค้า</th><th style="text-align:center;">จำนวน (ถัง)</th><th>วันที่</th></tr></thead>
      <tbody>${items.map(it => {
        const cls = badgeClass(it.product);
        const colorStyle = cls === 'badge-n2' ? 'color:var(--accent-n2);' : cls === 'badge-o2' ? 'color:var(--accent-o2);' : 'color:var(--accent-o2s);';
        return `<tr>
          <td><span class="badge ${cls}">${esc(it.product)}</span></td>
          <td style="text-align:center;"><strong style="${colorStyle}">${it.qty}</strong></td>
          <td>${formatDisplayDate(it.date)}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
}

