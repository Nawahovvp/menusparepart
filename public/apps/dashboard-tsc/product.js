console.log("Product.js is loading...");
// API Config moved to Api.js

// ประกาศตัวแปร Global ไว้ก่อน แต่ยังไม่กำหนดค่า (จะกำหนดค่าเมื่อหน้าเว็บโหลดเสร็จ)
let modal, summaryModal, modalContent, summaryContent, closeModal, closeSummaryModal;
let plantCallFilter, plantFilter, statusFilter, searchInput, searchButton, excelButton, summaryButton, errorFilterButton;
let tableBody, pageNumbersContainer, firstPageButton, prevPageButton, nextPageButton, lastPageButton, itemsPerPageSelect;
let landingPage, mainApp, btnTSC, btnBluetap, btnTrueWifi, backButton, reportTitleText, statusBadges, rowCountInfo, plantBadges, btnAdapterClaim;
let latestDeliveryCountInfo, latestDeliveryValue;
let notReturnCard, notReturnCountValue;
let activeDeliveryFilter = "";

// ตัวแปรข้อมูล
let allData = [];
let currentPage = 1;
let itemsPerPage = 20;
let sortConfig = {};
let currentRowData = null;
let currentProductFilter = null; // 'TSC' or 'Bluetap' or 'Access Point'
let currentCodeFilter = null; // Specific code filter (e.g. 'Sunmi' or '30066406')
let currentDescFilter = null; // Specific description filter
let isLoading = true;
let activeStatusFilter = ""; // Global variable for status filter
let isErrorFilterActive = false; // Toggle state for showing only mismatch errors
let activeNotReturnFilter = false; // Toggle state for showing only "ไม่คืน" items
let isUIInitialized = false; // Track initialization state

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(0);
  
  // Try matching with time (e.g. 13/02/2569 10:25:57 or 1/2/2569 8:30:00)
  const timeMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (timeMatch) {
    const [, day, month, year, hour, minute, second] = timeMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  
  // Try matching without time (e.g. 13/2/2569)
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return new Date(0);
}
function matchesKeyword(row, keyword) {
  if (!row) return false;
  if (!keyword) return true;
  const kw = keyword.toLowerCase().trim();
  const fields = [
    "DateKeep", "Spare Part Code", "Spare Part Name", "Qty", "Store Name", "Store Code", 
    "อุปกรณ์", "WorkOrder", "Serial Old", "SerialKeep", "TIDCall", "TID", "อาการ", 
    "รหัสช่าง", "ชื่อช่าง", "การคืนซาก", "PlantCall", "Plant", "Note", "DateDelivery", 
    "DateCenter", "DeliveryTSC_Detail", "Status", "MatCode", "EQ"
  ];
  return fields.some(field => (row[field] || "").toString().toLowerCase().includes(kw));
}
function escapeCSVValue(value) {
  if (value == null) return '""';
  const stringValue = value.toString();
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
function exportToCSV() {
  if (!allData || allData.length === 0) { alert("ไม่มีข้อมูลในระบบสำหรับการส่งออก CSV"); return; }
  const selectedPlantCall = plantCallFilter.value;
  const selectedPlant = plantFilter.value;
  const selectedStatus = activeStatusFilter;
  const keyword = searchInput.value.toLowerCase().trim();

  let filteredData = allData.filter(row => {
    if (!row) return false;
    return (
      (!currentProductFilter || row["Product"] === currentProductFilter) &&
      (!currentCodeFilter || (row["Spare Part Code"] || "") === currentCodeFilter) &&
      (!selectedPlantCall || (row["PlantCall"] || "") === selectedPlantCall) &&
      (!selectedPlant || (row["Plant"] || "") === selectedPlant) &&
      (!selectedStatus || (row["Status"] || "") === selectedStatus) &&
      matchesKeyword(row, keyword)
    );
  });
  if (filteredData.length === 0) { alert("ไม่มีข้อมูลที่ตรงกับเงื่อนไขการกรอง"); return; }
  filteredData.sort((a, b) => {
    let dateA = parseDate(a["DateKeep"]) || new Date(0);
    let dateB = parseDate(b["DateKeep"]) || new Date(0);
    let woA = a["WorkOrder"] || "";
    let woB = b["WorkOrder"] || "";
    if (dateA.getTime() !== dateB.getTime()) return dateB.getTime() - dateA.getTime();
    return woA.localeCompare(woB);
  });
  let columns = ["Status", "OrderChk", "Product", "DateKeep", "Spare Part Code", "Spare Part Name", "Qty", "Store Name", "Store Code", "อุปกรณ์", "WorkOrder", "Serial Old", "SerialKeep", "TIDCall", "TID", "MatCode", "EQ", "อาการ", "รหัสช่าง", "ชื่อช่าง", "การคืนซาก", "PlantCall", "Plant", "Note", "DateDelivery", "DateCenter", "DeliveryTSC_Detail"];
  if (currentProductFilter === "Bluetap") {
    columns = columns.filter(col => col !== "TIDCall" && col !== "TID" && col !== "Serial Old" && col !== "MatCode" && col !== "EQ");
  } else if (currentProductFilter === "Access Point") {
    columns = columns.filter(col => col !== "TIDCall" && col !== "Serial Old");
  }
  const displayColumns = {
    "Status": "Status",
    "OrderChk": "OrderChk",
    "Product": "Product",
    "DateKeep": "วันที่รับ",
    "Spare Part Code": "Code",
    "Spare Part Name": "Description",
    "Qty": "Qty",
    "Store Name": "Store Name",
    "Store Code": "รหัสร้าน",
    "อุปกรณ์": "อุปกรณ์",
    "WorkOrder": "WorkOrder",
    "Serial Old": "Serial ซ่อม",
    "SerialKeep": "Serial คืน",
    "TID": currentProductFilter === "Access Point" ? "MAC" : "TID",
    "MatCode": "MatCode",
    "EQ": "EQ",
    "TIDCall": "TID ซ่อม",
    "อาการ": "อาการ",
    "รหัสช่าง": "รหัสช่าง",
    "ชื่อช่าง": "ชื่อช่าง",
    "การคืนซาก": "การคืนซาก",
    "PlantCall": "คลังพื้นที่",
    "Plant": "คลังรับคืน",
    "Note": "หมายเหตุ",
    "DateDelivery": "ขนส่ง",
    "DateCenter": "ศูนย์อะไหล่",
    "DeliveryTSC_Detail": "ส่งTSC"
  };
  const csvRows = [];
  csvRows.push(columns.map(col => `"${displayColumns[col]}"`).join(','));
  filteredData.forEach(row => {
    const rowData = columns.map(col => {
      let value = row[col] || "-";
      if (col === "Qty") value = isNaN(parseFloat(value)) ? "-" : parseFloat(value).toFixed(0);
      return escapeCSVValue(value);
    });
    csvRows.push(rowData.join(','));
  });
  const csvContent = csvRows.join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `report_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  TscApi.logActivity("Export Excel", `Category: ${currentProductFilter || 'All'} - Count: ${filteredData.length}`);
  link.click();
  URL.revokeObjectURL(link.href);
}
function generatePivotSummary() {
  const currentPlantCall = plantCallFilter.value;
  const currentPlant = plantFilter.value;
  const currentStatus = statusFilter.value;
  const currentSearch = searchInput.value;

  if (!allData || allData.length === 0) {
    alert("ไม่มีข้อมูลในระบบสำหรับสรุปข้อมูล");
    return;
  }

  let filteredData = allData.filter(row => {
    if (!row) return false;
    return (
      (!currentProductFilter || row["Product"] === currentProductFilter) &&
      (!currentPlantCall || (row["PlantCall"] || "") === currentPlantCall) &&
      (!currentPlant || ((currentProductFilter === "Bluetap" && (currentCodeFilter === "30066406" || currentCodeFilter === "30066303") ? (row["Plant"] || row["PlantCall"]) : row["Plant"]) || "ไม่ระบุ") === currentPlant) &&
      (!currentStatus || (row["Status"] || "") === currentStatus) &&
      matchesKeyword(row, currentSearch)
    );
  });

  if (filteredData.length === 0) {
    summaryContent.innerHTML = '<p style="text-align: center; font-size: 18px; color: #6c757d;">ไม่มีข้อมูลที่ตรงกับเงื่อนไข</p>';
    summaryModal.style.display = "block";
    return;
  }

  const pivotMap = new Map();
  filteredData.forEach(row => {
    const code = row["Spare Part Code"] || "";
    const name = row["Spare Part Name"] || "";
    const status = row["Status"] || "อื่นๆ";
    const qty = parseFloat(row["Qty"]) || 0;

    if (!code) return;

    if (!pivotMap.has(code)) {
      pivotMap.set(code, { code, name, totals: new Map() });
    }
    const item = pivotMap.get(code);
    if (!item.totals.has(status)) {
      item.totals.set(status, 0);
    }
    item.totals.set(status, item.totals.get(status) + qty);
  });

  const allStatuses = [...new Set(filteredData.map(row => row["Status"]).filter(Boolean))].sort();
  if (!allStatuses.includes("อื่นๆ") && filteredData.some(row => !row["Status"])) {
    allStatuses.push("อื่นๆ");
  }
  allStatuses.sort((a, b) => {
    const order = ["คลังพื้นที่", "ระหว่างขนส่ง", "รอส่งเคลม", "ส่งลูกค้าแล้ว", "สำเร็จ", "อื่นๆ"];
    return order.indexOf(a) - order.indexOf(b);
  });

  let html = '<table class="pivot-table"><thead><tr><th>Code</th><th>Description</th>';
  allStatuses.forEach(status => {
    const className = getStatusClass(status);
    html += `<th class="${className}">${status}</th>`;
  });
  html += '<th class="pivot-total">รวม</th></tr></thead><tbody>';

  let grandTotal = 0;
  pivotMap.forEach(item => {
    let rowTotal = 0;
    html += `<tr><td>${item.code}</td><td style="text-align: left; padding-left: 12px;">${item.name}</td>`;

    allStatuses.forEach(status => {
      const qty = item.totals.get(status) || 0;
      rowTotal += qty;
      const className = getStatusClass(status);
      const displayQty = qty.toFixed(0) === "0" ? "-" : qty.toFixed(0);
      html += `<td class="${className}">${displayQty}</td>`;
    });

    grandTotal += rowTotal;
    const displayRowTotal = rowTotal.toFixed(0) === "0" ? "-" : rowTotal.toFixed(0);
    html += `<td class="pivot-total">${displayRowTotal}</td></tr>`;
  });

  html += `<tr class="pivot-total"><td colspan="2"><strong>รวมทั้งหมด</strong></td>`;
  allStatuses.forEach(status => {
    const statusTotal = Array.from(pivotMap.values()).reduce((sum, item) => sum + (item.totals.get(status) || 0), 0);
    const displayStatusTotal = statusTotal.toFixed(0) === "0" ? "-" : statusTotal.toFixed(0);
    html += `<td class="pivot-total">${displayStatusTotal}</td>`;
  });
  const displayGrandTotal = grandTotal.toFixed(0) === "0" ? "-" : grandTotal.toFixed(0);
  html += `<td class="pivot-total"><strong>${displayGrandTotal}</strong></td></tr>`;

  html += '</tbody></table>';
  summaryContent.innerHTML = html;
  summaryModal.style.display = "block";
  TscApi.logActivity("View Summary", `Category: ${currentProductFilter || 'All'}`);
}
function getStatusClass(status) {
  if (status === "สำเร็จ") return "status-success";
  if (status === "ส่งลูกค้าแล้ว") return "status-sent";
  if (status === "ระหว่างขนส่ง") return "status-transport";
  if (status.includes("รอ")) return "status-wait";
  if (status === "คลังพื้นที่") return "status-other";
  return "status-other";
}
function printModalContent() {
  if (!currentRowData) { alert("ไม่พบข้อมูลสำหรับการพิมพ์"); return; }
  const modalData = currentRowData;
  const stickerContent = `
    <div><span class="label">วันที่รับ:</span> <span class="value">${modalData["DateKeep"] || "-"}</span></div>
    <div><span class="label">WorkOrder:</span> <span class="value">${modalData["WorkOrder"] || "-"}</span></div>
    <div><span class="label">Code:</span> <span class="value">${modalData["Spare Part Code"] || "-"}</span></div>
    <div><span class="label">Description:</span> <span class="value">${modalData["Spare Part Name"] || "-"}</span></div>
    <div><span class="label">Qty:</span> <span class="value">${modalData["Qty"] || "-"}</span></div>
    <div><span class="label">Store Name:</span> <span class="value">${modalData["Store Name"] || "-"}</span></div>
    <div><span class="label">Serial ซ่อม:</span> <span class="value">${modalData["Serial Old"] || "-"}</span></div>
    <div><span class="label">Serial คืน:</span> <span class="value">${modalData["SerialKeep"] || "-"}</span></div>
    <div class="description"><span class="label">อาการ:</span> <span class="value">${modalData["อาการ"] || "-"}</span></div>
  `;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>พิมพ์รายละเอียด</title>
        <style>
          body { font-family: 'Prompt', sans-serif; margin: 0; padding: 0; }
          .sticker { width: 80mm; height: 100mm; border: 1px solid #000; padding: 2mm; box-sizing: border-box; font-size: 13pt; line-height: 1.3; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
          .sticker div { margin-bottom: 1.5mm; overflow-wrap: break-word; }
          .sticker div.description { flex: 1; }
          .sticker .label { font-weight: bold; color: #000; font-size: 14pt; }
          .sticker .value { color: #000; }
          h2 { font-size: 14pt; color: #000; margin: 1.5mm 0; }
          @media print {
            body { margin: 0; }
            @page { size: 80mm 100mm; margin: 0; }
          }
        <\/style>
      <\/head>
      <body onload="window.print()">
        <div class="sticker">
          <h2>รายละเอียด</h2>
          ${stickerContent}
        </div>
      <\/body>
    <\/html>
  `);
  printWindow.document.close();
}
function populatePlantCallFilter(data) {
  if (!data || data.length === 0) return;
  const plantCalls = [...new Set(data.map(row => row["PlantCall"]).filter(Boolean))].sort();
  plantCallFilter.innerHTML = '<option value="">ทั้งหมด</option>';
  plantCalls.forEach(plantCall => {
    const option = document.createElement("option");
    option.value = plantCall;
    option.textContent = plantCall;
    plantCallFilter.appendChild(option);
  });
}
function updatePlantFilter(data, selectedPlantCall) {
  if (!data || data.length === 0) return;
  const currentPlantValue = plantFilter.value;
  const filteredData = selectedPlantCall ? data.filter(row => (row["PlantCall"] || "") === selectedPlantCall) : data;
  const plants = [...new Set(filteredData.map(row => row["Plant"]).filter(Boolean))].sort();
  plantFilter.innerHTML = '<option value="">ทั้งหมด</option>';
  plants.forEach(plant => {
    const option = document.createElement("option");
    option.value = plant;
    option.textContent = plant;
    plantFilter.appendChild(option);
  });
  if (currentPlantValue && plants.includes(currentPlantValue)) plantFilter.value = currentPlantValue;
  else plantFilter.value = "";
  updateStatusFilter(data, selectedPlantCall, plantFilter.value);
}
function updateStatusFilter(data, selectedPlantCall, selectedPlant) {
  if (!data || data.length === 0) return;
  const currentStatusValue = statusFilter.value;
  let filteredData = data;
  if (currentProductFilter) filteredData = filteredData.filter(row => row["Product"] === currentProductFilter);
  if (selectedPlantCall) filteredData = filteredData.filter(row => (row["PlantCall"] || "") === selectedPlantCall);
  if (selectedPlant) filteredData = filteredData.filter(row => (row["Plant"] || "ไม่ระบุ") === selectedPlant);
  const statuses = [...new Set(filteredData.map(row => row["Status"]).filter(Boolean))].sort();
  statusFilter.innerHTML = '<option value="">ทั้งหมด</option>';
  statuses.forEach(status => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusFilter.appendChild(option);
  });
  if (currentStatusValue && statuses.includes(currentStatusValue)) statusFilter.value = currentStatusValue;
  else statusFilter.value = "";
}
function getBadgeClass(status) {
  if (status === "สำเร็จ") return "badge-success";
  if (status === "ส่งลูกค้าแล้ว") return "badge-sent";
  if (status === "ระหว่างขนส่ง") return "badge-transport";
  if (status.includes("รอ")) return "badge-wait";
  return "badge-other";
}
function resetSortConfig() {
  sortConfig = {};
  updateSortArrows();
}

function resetAllFilters() {
  currentPage = 1;
  if (searchInput) searchInput.value = "";
  if (plantCallFilter) plantCallFilter.value = "";
  if (plantFilter) plantFilter.value = "";
  if (statusFilter) statusFilter.value = "";
  activeStatusFilter = "";
  activeDeliveryFilter = "";
  activeNotReturnFilter = false;
  if (latestDeliveryCountInfo) {
    latestDeliveryCountInfo.classList.remove("active-status");
  }
  isErrorFilterActive = false;
  if (errorFilterButton) {
    errorFilterButton.classList.remove("active-error-filter");
    errorFilterButton.style.backgroundColor = "";
    errorFilterButton.style.color = "";
  }
}

function addSortListeners() {
  const sortableHeaders = document.querySelectorAll("th.sortable");
  sortableHeaders.forEach(header => {
    header.addEventListener("click", () => {
      const column = header.getAttribute("data-column");
      if (sortConfig.column === column) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortConfig.column = column;
        sortConfig.direction = 'asc';
      }
      updateSortArrows();
      filterAndRenderTable();
    });
  });
}
function updateSortArrows() {
  const sortableHeaders = document.querySelectorAll("th.sortable");
  sortableHeaders.forEach(header => {
    const arrow = header.querySelector(".arrow");
    const column = header.getAttribute("data-column");
    arrow.textContent = (column === sortConfig.column) ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '';
  });
}
function filterAndRenderTable() {
  const selectedPlantCall = plantCallFilter.value;
  const selectedPlant = plantFilter.value;
  const selectedStatus = activeStatusFilter;
  const keyword = searchInput.value.toLowerCase().trim();
  let dataForBadges = allData.filter(row => {
    if (!row) return false;
    return (
      (!currentProductFilter || row["Product"] === currentProductFilter) &&
      (!currentCodeFilter || (row["Spare Part Code"] || "") === currentCodeFilter) &&
      (!currentDescFilter || (row["Spare Part Name"] || "") === currentDescFilter) &&
      (!selectedPlantCall || (row["PlantCall"] || "") === selectedPlantCall) &&
      (!selectedPlant || ((currentProductFilter === "Bluetap" && (currentCodeFilter === "30066406" || currentCodeFilter === "30066303") ? (row["Plant"] || row["PlantCall"]) : row["Plant"]) || "ไม่ระบุ") === selectedPlant) &&
      matchesKeyword(row, keyword)
    );
  });
  
  let errorCount = 0;
  dataForBadges.forEach(row => {
    const serials = row["SerialKeep"] ? row["SerialKeep"].split(/[,/\s]+/).map(s => s.trim()).filter(s => s.length > 0) : [];
    const qtyValue = parseFloat(row["Qty"]) || 0;
    if (qtyValue > 0 && serials.length > 0 && serials.length !== qtyValue) {
      errorCount++;
    }
  });

  if (errorFilterButton) {
    if (errorCount > 0) {
      errorFilterButton.style.display = "inline-block";
    } else {
      errorFilterButton.style.display = "none";
      if (isErrorFilterActive) {
        isErrorFilterActive = false; // Reset if the button disappears
        errorFilterButton.classList.remove("active-error-filter");
        errorFilterButton.style.backgroundColor = "";
        errorFilterButton.style.color = "";
      }
    }
  }

  if (isErrorFilterActive) {
    dataForBadges = dataForBadges.filter(row => {
      const serials = row["SerialKeep"] ? row["SerialKeep"].split(/[,/\s]+/).map(s => s.trim()).filter(s => s.length > 0) : [];
      const qtyValue = parseFloat(row["Qty"]) || 0;
      return (qtyValue > 0 && serials.length > 0 && serials.length !== qtyValue);
    });
  }

  // Filter for "ไม่คืนซาก" (Not Returned)
  if (activeNotReturnFilter) {
    dataForBadges = dataForBadges.filter(row => {
      const returnStatus = (row["การคืนซาก"] || "").toString().trim();
      return returnStatus.includes("ไม่คืน");
    });
  }
  // 1.1 กรองข้อมูลสำหรับสร้าง Plant Badges (ไม่นำ Plant มากรอง เพื่อให้ Badge แสดงครบทุกคลังเสมอ)
  // หา List ของ Plant ทั้งหมดที่มีในระบบ (ภายใต้ Product/PlantCall) เพื่อให้แสดงปุ่มครบแม้ Count = 0
  const allPossiblePlants = [...new Set(allData
    .filter(row =>
      (!currentProductFilter || row["Product"] === currentProductFilter) &&
      (!currentCodeFilter || (row["Spare Part Code"] || "") === currentCodeFilter) &&
      (!currentDescFilter || (row["Spare Part Name"] || "") === currentDescFilter) &&
      (!selectedPlantCall || (row["PlantCall"] || "") === selectedPlantCall)
    )
    .map(row => (currentProductFilter === "Bluetap" && (currentCodeFilter === "30066406" || currentCodeFilter === "30066303") ? (row["Plant"] || row["PlantCall"]) : row["Plant"]) || "ไม่ระบุ")
  )].sort();

  let dataForPlantBadges = allData.filter(row => {
    if (!row) return false;
    return (
      (!currentProductFilter || row["Product"] === currentProductFilter) &&
      (!currentCodeFilter || (row["Spare Part Code"] || "") === currentCodeFilter) &&
      (!currentDescFilter || (row["Spare Part Name"] || "") === currentDescFilter) &&
      (!selectedPlantCall || (row["PlantCall"] || "") === selectedPlantCall) &&
      // ตัดเงื่อนไข Plant ออกชั่วคราวสำหรับ Badge (ลบเงื่อนไข selectedPlant ออกเพื่อให้แสดง Count ของคลังอื่นได้)
      (activeStatusFilter === "PROCESSING_ONLY"
        ? (row["Status"] !== "ส่งลูกค้าแล้ว" && row["Status"] !== "สำเร็จ")
        : (!activeStatusFilter || (row["Status"] || "") === activeStatusFilter)
      ) &&
      matchesKeyword(row, keyword)
    );
  });

  // 1. Calculate and setup Latest Delivery card
  if (latestDeliveryCountInfo) {
    if (currentProductFilter === "TSC" || currentProductFilter === "Access Point") {
      latestDeliveryCountInfo.style.display = "flex";
      
      let latestDateStr = "-";
      let maxTime = 0;
      
      // Calculate latest date from dataForBadges
      dataForBadges.forEach(row => {
        const delivery = row["DeliveryTSC_Detail"];
        if (delivery && delivery !== "-" && delivery !== "") {
          const dt = parseDate(delivery);
          const time = dt.getTime();
          if (!isNaN(time) && time > maxTime) {
            maxTime = time;
            latestDateStr = delivery;
          }
        }
      });
      
      let latestQty = 0;
      if (latestDateStr !== "-") {
        dataForBadges.forEach(row => {
          if (row["DeliveryTSC_Detail"] === latestDateStr) {
            latestQty += (parseFloat(row["Qty"]) || 0);
          }
        });
        latestDeliveryValue.textContent = latestQty.toLocaleString() + " ชิ้น";
        latestDeliveryCountInfo.title = "ข้อมูลของวันที่: " + latestDateStr;
      } else {
        latestDeliveryValue.textContent = "-";
        latestDeliveryCountInfo.title = "";
      }
      
      latestDeliveryCountInfo.onclick = () => {
        if (activeDeliveryFilter === latestDateStr) {
          activeDeliveryFilter = "";
        } else {
          activeDeliveryFilter = latestDateStr;
        }
        currentPage = 1;
        resetSortConfig();
        filterAndRenderTable();
      };
      
      if (activeDeliveryFilter === latestDateStr && latestDateStr !== "-") {
        latestDeliveryCountInfo.classList.add("active-status");
      } else {
        latestDeliveryCountInfo.classList.remove("active-status");
      }
    } else {
      latestDeliveryCountInfo.style.display = "none";
      activeDeliveryFilter = "";
    }
  }

  // 2. กรองข้อมูลสำหรับแสดงในตาราง (นำ Status และ Delivery Filter กลับมาใช้)
  let filteredData = dataForBadges.filter(row => {
    let matchStatus = true;
    if (selectedStatus === "PROCESSING_ONLY") {
      matchStatus = (row["Status"] !== "ส่งลูกค้าแล้ว" && row["Status"] !== "สำเร็จ");
    } else if (selectedStatus) {
      matchStatus = (row["Status"] || "") === selectedStatus;
    }
    
    let matchDelivery = true;
    if (activeDeliveryFilter) {
      matchDelivery = (row["DeliveryTSC_Detail"] === activeDeliveryFilter);
    }
    
    return matchStatus && matchDelivery;
  });

  updatePlantFilter(allData, selectedPlantCall);
  updateStatusFilter(allData, selectedPlantCall, selectedPlant);
  
  // Update Description Badges (New Feature)
  const dataForDescBadges = allData.filter(row => 
    (!currentProductFilter || row["Product"] === currentProductFilter) &&
    (!currentCodeFilter || (row["Spare Part Code"] || "") === currentCodeFilter) &&
    (!selectedPlantCall || (row["PlantCall"] || "") === selectedPlantCall) &&
    (!selectedPlant || ((currentProductFilter === "Bluetap" && (currentCodeFilter === "30066406" || currentCodeFilter === "30066303") ? (row["Plant"] || row["PlantCall"]) : row["Plant"]) || "ไม่ระบุ") === selectedPlant) &&
    (activeStatusFilter === "PROCESSING_ONLY"
      ? (row["Status"] !== "ส่งลูกค้าแล้ว" && row["Status"] !== "สำเร็จ")
      : (!activeStatusFilter || (row["Status"] || "") === activeStatusFilter)
    ) &&
    (!activeDeliveryFilter || row["DeliveryTSC_Detail"] === activeDeliveryFilter) &&
    matchesKeyword(row, keyword)
  );
  updateDescriptionBadges(dataForDescBadges);
  const uniqueWorkOrders = [...new Set(filteredData.map(row => row["WorkOrder"]).filter(Boolean))].length;
  document.getElementById("workOrderCountValue").textContent = uniqueWorkOrders;
  const totalQty = filteredData.reduce((sum, row) => sum + (parseFloat(row["Qty"]) || 0), 0);
  document.getElementById("rowCountValue").textContent = totalQty.toLocaleString();

  // สร้าง Status Badges
  if (statusBadges) {
    statusBadges.innerHTML = '';
    // Calculate statuses
    const statusCounts = {};
    let totalProcessing = 0;

    // ใช้ dataForBadges แทน filteredData เพื่อให้แสดงครบทุกสถานะ
    dataForBadges.forEach(row => {
      const status = row["Status"] || "อื่นๆ";
      const qty = parseFloat(row["Qty"]) || 0;
      statusCounts[status] = (statusCounts[status] || 0) + qty;

      // Count "Processing" (Not Sent to Customer)
      if (status !== "ส่งลูกค้าแล้ว" && status !== "สำเร็จ") {
        totalProcessing += qty;
      }
    });

    // Update Processing Count
    const processingCountValue = document.getElementById("processingCountValue");
    if (processingCountValue) {
      processingCountValue.innerText = totalProcessing.toLocaleString();

      // Add click event for Processing Card
      const processingCard = document.getElementById("processingCountInfo");
      if (processingCard) {
        processingCard.onclick = () => {
          // Filter excluding 'ส่งลูกค้าแล้ว' and 'สำเร็จ'
          activeStatusFilter = (activeStatusFilter === "PROCESSING_ONLY") ? "" : "PROCESSING_ONLY";
          currentPage = 1;
          resetSortConfig();
          filterAndRenderTable();
        };
        
        if (activeStatusFilter === "PROCESSING_ONLY") {
          processingCard.classList.add("active-status");
        } else {
          processingCard.classList.remove("active-status");
        }
      }
    }
    const order = ["รอส่งเคลม", "คลังกลาง", "ระหว่างขนส่ง", "คลังพื้นที่", "ส่งลูกค้าแล้ว", "สำเร็จ", "อื่นๆ"];
    const sortedStatuses = Object.keys(statusCounts).sort((a, b) => {
      let idxA = order.indexOf(a); if (idxA === -1) idxA = 99;
      let idxB = order.indexOf(b); if (idxB === -1) idxB = 99;
      return idxA - idxB;
    });
    sortedStatuses.forEach(status => {
      const card = document.createElement("div");

      // Determine Class and Icon
      let cardClass = "status-other";
      let iconClass = "fas fa-circle";

      if (status === "คลังกลาง") { cardClass = "status-plant"; iconClass = "fas fa-building"; }
      else if (status === "ระหว่างขนส่ง") { cardClass = "status-transit"; iconClass = "fas fa-shipping-fast"; }
      else if (status === "รอส่งเคลม") { cardClass = "status-claim"; iconClass = "fas fa-box"; }
      else if (status.includes("รอ")) { cardClass = "status-pending"; iconClass = "fas fa-clock"; }
      else if (status.includes("ส่งลูกค้าแล้ว") || status === "สำเร็จ") { cardClass = "status-success"; iconClass = "fas fa-check-circle"; }
      else if (status === "คลังพื้นที่") { cardClass = "status-plant"; iconClass = "fas fa-warehouse"; }

      card.className = `status-card ${cardClass}`;

      // Highlight if selected
      if (status === selectedStatus) {
        card.classList.add("active-status");
      }

      // Event Click
      card.onclick = () => {
        activeStatusFilter = (activeStatusFilter === status) ? "" : status;
        currentPage = 1;
        resetSortConfig();
        filterAndRenderTable();
      };

      card.innerHTML = `
        <div class="status-card-icon">
          <i class="${iconClass}"></i>
        </div>
        <div class="status-card-info">
          <span class="status-card-label">${status}</span>
          <span class="status-card-count">${statusCounts[status].toLocaleString()}</span>
        </div>
      `;
      statusBadges.appendChild(card);
      
      // Move "รอบล่าสุด" to be after "ส่งลูกค้าแล้ว"
      if (status === "ส่งลูกค้าแล้ว" && latestDeliveryCountInfo && latestDeliveryCountInfo.style.display !== "none") {
        statusBadges.appendChild(latestDeliveryCountInfo);
      }
    });

    // If "ส่งลูกค้าแล้ว" wasn't generated, but we have "รอบล่าสุด", append it at the end
    if (latestDeliveryCountInfo && latestDeliveryCountInfo.style.display !== "none" && !sortedStatuses.includes("ส่งลูกค้าแล้ว")) {
      statusBadges.appendChild(latestDeliveryCountInfo);
    }
  }

  // สร้าง Plant Badges
  if (plantBadges) {
    plantBadges.innerHTML = '';
    const plantCounts = {};
    dataForPlantBadges.forEach(row => {
      const isSpecialClaim = (currentProductFilter === "Bluetap" && (currentCodeFilter === "30066406" || currentCodeFilter === "30066303"));
      const plant = (isSpecialClaim ? (row["Plant"] || row["PlantCall"]) : row["Plant"]) || "ไม่ระบุ";
      const qty = parseFloat(row["Qty"]) || 0;
      plantCounts[plant] = (plantCounts[plant] || 0) + qty;
    });
    // ใช้ allPossiblePlants แทน Object.keys(plantCounts) เพื่อให้แสดงครบทุกคลัง
    const sortedPlants = allPossiblePlants;

    sortedPlants.forEach(plant => {
      const count = plantCounts[plant] || 0;
      if (count === 0) return;

      const card = document.createElement("div");
      card.className = "status-card status-other status-plant-item";

      if (plant === selectedPlant) {
        card.style.transform = "translateY(-3px)";
        card.style.boxShadow = "0 8px 20px rgba(0,0,0,0.15)";
        card.style.border = "1px solid #667eea";
      }

      card.onclick = () => {
        const targetValue = (plantFilter.value === plant) ? "" : plant;
        
        // Add option if it doesn't exist in the hidden select to allow setting value
        if (targetValue && !Array.from(plantFilter.options).some(o => o.value === targetValue)) {
          const opt = document.createElement("option");
          opt.value = targetValue;
          opt.textContent = targetValue;
          plantFilter.appendChild(opt);
        }
        
        plantFilter.value = targetValue;
        currentPage = 1;
        resetSortConfig();
        filterAndRenderTable();
      };

      card.innerHTML = `
        <div class="status-card-icon">
          <i class="fas fa-map-marker-alt"></i>
        </div>
        <div class="status-card-info">
          <span class="status-card-label">${plant}</span>
          <span class="status-card-count">${count.toLocaleString()}</span>
        </div>
      `;
      plantBadges.appendChild(card);
    });
  }

function updateDescriptionBadges(data) {
  if (!descriptionBadges) return;
  descriptionBadges.innerHTML = '';
  
  // Only show for True WiFi (Access Point) and TSC as requested
  if (currentProductFilter !== "Access Point" && currentProductFilter !== "TSC") {
    descriptionBadges.style.display = "none";
    return;
  }
  
  descriptionBadges.style.display = "flex";
  
  // Get unique descriptions and calculate quantities
  const descCounts = {};
  data.forEach(row => {
    const desc = row["Spare Part Name"];
    if (desc) {
      const qty = parseFloat(row["Qty"]) || 0;
      descCounts[desc] = (descCounts[desc] || 0) + qty;
    }
  });

  const customOrderTSC = [
    "เครื่อง S80",
    "เครื่อง A80",
    "ADEPTER",
    "ขาตั้งพลาสติก",
    "ชุดเสาเหล็ก",
    "ฝาหลัง รุ่น S80",
    "สาย RS232"
  ];

  let cardsData = Object.keys(descCounts).map(desc => {
    let displayName = desc;
    if (currentProductFilter === "Access Point") {
      displayName = desc.replace(/TRUE WIFI/gi, '').replace(/\(ฝ\)/g, '').trim();
    } else if (currentProductFilter === "TSC") {
      // Remove SMART CARD EDC and (ฝ), and normalize multiple spaces
      displayName = desc.replace(/SMART\s*CARD\s*EDC/gi, '').replace(/\(ฝ\)/g, '').trim();
      displayName = displayName.replace(/\s{2,}/g, ' ');
    }
    return {
      desc: desc,
      displayName: displayName,
      qty: descCounts[desc] || 0
    };
  });

  const stripForMatch = (text) => text.replace(/\s+/g, '').toLowerCase();
  const customOrderMatch = customOrderTSC.map(stripForMatch);

  if (currentProductFilter === "TSC") {
    cardsData.sort((a, b) => {
      let normA = stripForMatch(a.displayName);
      let normB = stripForMatch(b.displayName);
      
      let indexA = customOrderMatch.indexOf(normA);
      let indexB = customOrderMatch.indexOf(normB);
      
      // Fallback to partial match if exact fails
      if (indexA === -1) indexA = customOrderMatch.findIndex(order => normA.includes(order));
      if (indexB === -1) indexB = customOrderMatch.findIndex(order => normB.includes(order));

      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      if (indexA !== indexB) return indexA - indexB;
      return a.displayName.localeCompare(b.displayName);
    });
  } else {
    cardsData.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  
  if (cardsData.length === 0) {
    descriptionBadges.style.display = "none";
    return;
  }

  cardsData.forEach(item => {
    const desc = item.desc;
    const displayName = item.displayName;
    const qty = item.qty;

    const card = document.createElement("div");
    card.className = "status-card status-other";
    
    const isSelected = (desc === currentDescFilter);
    
    if (isSelected) {
      card.style.transform = "translateY(-3px)";
      card.style.boxShadow = "0 8px 20px rgba(17,153,142,0.4)";
      card.style.border = "none";
      card.style.background = "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)";
    }

    card.onclick = () => {
      currentDescFilter = (currentDescFilter === desc) ? null : desc;
      currentPage = 1;
      resetSortConfig();
      filterAndRenderTable();
    };

    const iconStyle = isSelected 
      ? "background: white; color: #11998e;" 
      : "background: linear-gradient(135deg, #11998e, #38ef7d); color: white;";
    const textStyle = isSelected ? "color: white;" : "";

    card.innerHTML = `
      <div class="status-card-icon" style="${iconStyle}">
        <i class="fas fa-tag"></i>
      </div>
      <div class="status-card-info" style="justify-content: center; display: flex; flex-direction: column;">
        <span class="status-card-label" style="white-space: normal; line-height: 1.2; margin-bottom: 4px; ${textStyle}">${displayName}</span>
        <span class="status-card-count" style="${textStyle}">${qty.toLocaleString()} ชิ้น</span>
      </div>
    `;
    descriptionBadges.appendChild(card);
  });
}
  if (sortConfig.column) {
    filteredData.sort((a, b) => {
      let valueA = a[sortConfig.column] || "";
      let valueB = b[sortConfig.column] || "";
      const dateColumns = ['DateKeep', 'DateDelivery', 'DateCenter', 'DeliveryTSC_Detail'];
      if (dateColumns.includes(sortConfig.column)) {
        let dateA = parseDate(valueA);
        let dateB = parseDate(valueB);
        if (isNaN(dateA.getTime())) dateA = new Date(0);
        if (isNaN(dateB.getTime())) dateB = new Date(0);
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortConfig.column === 'Qty') {
        let numA = parseFloat(valueA) || 0;
        let numB = parseFloat(valueB) || 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      } else {
        valueA = valueA.toString().toLowerCase();
        valueB = valueB.toString().toLowerCase();
        return sortConfig.direction === 'asc'
          ? (valueA > valueB ? 1 : valueA < valueB ? -1 : 0)
          : (valueA < valueB ? 1 : valueA > valueB ? -1 : 0);
      }
    });
  } else {
    filteredData.sort((a, b) => {
      // 1. Sort by Status priority
      const statusOrder = {
        "คลังพื้นที่": 1,
        "รอส่งคืน": 2,
        "ระหว่างขนส่ง": 3,
        "รอส่งเคลม": 4,
        "ส่งลูกค้าแล้ว": 5
      };
      
      const statusA = (a["Status"] || "").trim();
      const statusB = (b["Status"] || "").trim();
      
      const rankA = statusOrder[statusA] || 99;
      const rankB = statusOrder[statusB] || 99;
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // 2. Sort by DateKeep (Latest first - Descending)
      let dateA = parseDate(a["DateKeep"]);
      let dateB = parseDate(b["DateKeep"]);
      if (isNaN(dateA.getTime())) dateA = new Date(0);
      if (isNaN(dateB.getTime())) dateB = new Date(0);
      
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      
      // 3. Sort by Spare Part Code (Ascending)
      const codeA = (a["Spare Part Code"] || "").toString();
      const codeB = (b["Spare Part Code"] || "").toString();
      return codeA.localeCompare(codeB);
    });
  }
  renderTable(filteredData);
}
function renderTable(data) {
  try {
    tableBody.innerHTML = '';
    console.log("Rendering table...", isLoading ? "Loading" : "Data ready");

    const isNonTscProduct = (currentProductFilter === "Bluetap" || currentProductFilter === "Access Point");
    
    // Determine which columns to hide based on product type
    let colsToHide = [];
    if (currentProductFilter === "Bluetap") {
      colsToHide = ["TIDCall", "TID", "Serial Old", "MatCode", "EQ"];
    } else if (currentProductFilter === "Access Point") {
      colsToHide = ["TIDCall", "Serial Old", "TID"];
    } else {
      // For TSC Dummy or other, hide MatCode and EQ by default if not needed
      colsToHide = ["MatCode", "EQ"];
    }

    // Safely toggle columns
    const allToggleableCols = ["TIDCall", "TID", "Serial Old", "MatCode", "EQ"];
    allToggleableCols.forEach(col => {
      const th = document.querySelector(`th[data-column="${col}"]`);
      if (th) {
        th.style.display = colsToHide.includes(col) ? 'none' : '';
      }
    });

    if (isLoading) {
      tableBody.innerHTML = '<tr><td colspan="23" style="text-align: center; padding: 20px; font-size: 18px; color: #007bff;"><i class="fas fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>';
      return;
    }
    if (!data || data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="23">ไม่มีข้อมูลที่ตรงกับเงื่อนไข</td></tr>';
      return;
    }
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedData = data.slice(startIdx, endIdx);

    paginatedData.forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.style.animationDelay = `${i * 0.05}s`;

      // Color by Status
      const status = row["Status"] || "";
      if (status === "สำเร็จ" || status === "ส่งลูกค้าแล้ว") {
        tr.style.backgroundColor = "#d4edda"; // Light Green
      } else if (status === "รอส่งเคลม") {
        tr.style.backgroundColor = "#BBDEFB"; // Light Blue for รอส่งเคลม
        tr.style.color = "#0D47A1"; // Dark Navy text
      } else if (status.includes("รอ")) {
        tr.style.backgroundColor = "#f8d7da"; // Light Red
      } else if (status === "ระหว่างขนส่ง") {
        tr.style.backgroundColor = "#fff3cd"; // Light Yellow
      } else if (status === "คลังพื้นที่") {
        tr.style.backgroundColor = "#f2f2f2"; // Light Gray
      } else if (status === "คลังกลาง") {
        tr.style.backgroundColor = "#d1ecf1"; // Light Blue
      } else {
        tr.style.backgroundColor = "#ffffff";
      }

      let columns = ["Status", "OrderChk", "Product", "DateKeep", "Spare Part Code", "Spare Part Name", "Qty", "Store Name", "Store Code", "อุปกรณ์", "WorkOrder", "Serial Old", "SerialKeep", "TIDCall", "TID", "MatCode", "EQ", "อาการ", "รหัสช่าง", "ชื่อช่าง", "การคืนซาก", "PlantCall", "Plant", "Note", "DateDelivery", "DateCenter", "DeliveryTSC_Detail"];
      if (isNonTscProduct) {
        columns = columns.filter(col => !colsToHide.includes(col));
      } else {
        // Even for TSC, hide MatCode if in hide list
        columns = columns.filter(col => !colsToHide.includes(col));
      }
      columns.forEach(col => {
        const td = document.createElement("td");
        let cellValue = row[col] || "-";
        let displayValue = cellValue;
        if (col === "Qty") {
          displayValue = isNaN(parseFloat(displayValue)) ? "-" : parseFloat(displayValue).toFixed(0);
          
          // Check for mismatch between Qty and SerialKeep count
          // Split by comma, slash, or any whitespace character
          const serials = row["SerialKeep"] ? row["SerialKeep"].split(/[,/\s]+/).map(s => s.trim()).filter(s => s.length > 0) : [];
          const qtyValue = parseFloat(displayValue) || 0;
          if (qtyValue > 0 && serials.length > 0 && serials.length !== qtyValue) {
            td.innerHTML = `<span style="background-color: #dc3545; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.9em; box-shadow: 0 2px 4px rgba(220,53,69,0.2);" title="Mismatch: Qty is ${qtyValue} but ${serials.length} serials provided.">${displayValue}</span>`;
            td.classList.add("text-left");
            tr.appendChild(td);
            return;
          }
          
        } else if (col === "Status") {
          if (cellValue === "สำเร็จ") {
            displayValue = "สำเร็จ";
            td.style.color = "#28a745";
            td.style.fontWeight = "bold";
          }
          else if (cellValue === "ส่งลูกค้าแล้ว") {
            displayValue = "ส่งลูกค้าแล้ว";
            td.style.color = "#28a745";
            td.style.fontWeight = "bold";
          }
          else if (cellValue === "ระหว่างขนส่ง") {
            displayValue = "ระหว่างขนส่ง";
            td.style.color = "#fd7e14";
            td.style.fontWeight = "bold";
          }
          else if (cellValue === "รอส่งเคลม") {
            displayValue = cellValue;
            td.style.color = "#0D47A1";
            td.style.fontWeight = "bold";
          }
          else if (cellValue.includes("รอ")) {
            displayValue = cellValue;
            td.style.color = "#dc3545";
            td.style.fontWeight = "bold";
          }
          else {
            td.style.color = "#6c757d";
          }
        } else if (col === "OrderChk") {
          if (cellValue === "CheckOrder") {
            td.innerHTML = `<span style="background-color: #ffc107; color: #000; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.9em; box-shadow: 0 2px 4px rgba(255,193,7,0.3);"><i class="fas fa-exclamation-triangle"></i> CheckOrder</span>`;
            td.classList.add("text-center");
            tr.appendChild(td);
            return;
          }
        } else if (col === "DateKeep") {
          const today = new Date();
          const d = today.getDate();
          const m = today.getMonth() + 1;
          const yBE = today.getFullYear() + 543;
          
          const todayStr1 = `${d}/${m}/${yBE}`;
          const todayStr2 = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${yBE}`;
          
          if (displayValue && (displayValue.includes(todayStr1) || displayValue.includes(todayStr2))) {
            td.innerHTML = `<span style="background-color: #ff7b00; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.9em; box-shadow: 0 2px 4px rgba(255,123,0,0.3);">${displayValue}</span>`;
            td.classList.add("text-center");
            tr.appendChild(td);
            return;
          }
        }
        td.textContent = displayValue;
        td.classList.add("text-left");
        tr.appendChild(td);
      });
      const detailTd = document.createElement("td");
      const btn = document.createElement("button");
      btn.innerHTML = '<i class="fas fa-eye"></i> ดูข้อมูล';
      btn.className = "detail-button";
      btn.onclick = () => {
        currentRowData = row;
        
        const status = row["Status"] || "-";
        let statusClass = "status-other-bg";
        if (status === "สำเร็จ") statusClass = "status-success-bg";
        else if (status === "ส่งลูกค้าแล้ว") statusClass = "status-sent-bg";
        else if (status === "ระหว่างขนส่ง") statusClass = "status-transport-bg";
        else if (status.includes("รอ")) statusClass = "status-wait-bg";

        const formatQty = (v) => isNaN(parseFloat(v)) ? "-" : parseFloat(v).toFixed(0);

        const html = `
          <!-- Key Summary Bar -->
          <div class="compact-summary-bar">
            <div class="summary-item">
              <span class="summary-label">WorkOrder</span>
              <span class="summary-value">${row["WorkOrder"] || "-"}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Store Code</span>
              <span class="summary-value">${row["Store Code"] || "-"}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Product Type</span>
              <span class="summary-value">${row["Product"] || "-"}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Status</span>
              <span class="summary-value"><span class="modal-status-badge ${statusClass}">${status}</span></span>
            </div>
          </div>

          <div class="detail-grid-wider">
            <!-- Column 1: Store & Product -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
              <!-- Section: Store -->
              <div class="detail-section-compact">
                <div class="detail-section-title-compact"><i class="fas fa-store"></i> ข้อมูลสาขา/ร้าน</div>
                <div class="detail-list-compact">
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">ชื่อร้าน:</span>
                    <span class="detail-value-compact">${row["Store Name"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">รหัสร้าน:</span>
                    <span class="detail-value-compact">${row["Store Code"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">คลังพื้นที่:</span>
                    <span class="detail-value-compact">${row["PlantCall"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">คลังรับคืน:</span>
                    <span class="detail-value-compact">${row["Plant"] || "-"}</span>
                  </div>
                </div>
              </div>

              <!-- Section: Product -->
              <div class="detail-section-compact">
                <div class="detail-section-title-compact"><i class="fas fa-cube"></i> รายละเอียดสินค้า</div>
                <div class="detail-list-compact">
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">ประเภท:</span>
                    <span class="detail-value-compact">${row["Product"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">ชื่ออะไหล่:</span>
                    <span class="detail-value-compact">${row["Spare Part Name"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">รหัสอะไหล่/จำนวน:</span>
                    <span class="detail-value-compact">${row["Spare Part Code"] || "-"} / ${formatQty(row["Qty"])} ชิ้น</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">อุปกรณ์:</span>
                    <span class="detail-value-compact">${row["อุปกรณ์"] || "-"}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Column 2: Technical & Timeline -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
              <!-- Section: Technical -->
              <div class="detail-section-compact">
                <div class="detail-section-title-compact"><i class="fas fa-microchip"></i> ข้อมูลเทคนิค</div>
                <div class="detail-list-compact">
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">Serial เดิม:</span>
                    <span class="detail-value-compact">${row["Serial Old"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">Serial คืน:</span>
                    <span class="detail-value-compact">${row["SerialKeep"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">MAC/TID:</span>
                    <span class="detail-value-compact">${row["TID"] || row["MatCode"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">EQ:</span>
                    <span class="detail-value-compact">${row["EQ"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">อาการเสีย:</span>
                    <span class="detail-value-compact">${row["อาการ"] || "-"}</span>
                  </div>
                </div>
              </div>

              <!-- Section: Timeline -->
              <div class="detail-section-compact">
                <div class="detail-section-title-compact"><i class="fas fa-clock"></i> ไทม์ไลน์/ช่าง</div>
                <div class="detail-list-compact">
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">วันที่รับ/ส่ง:</span>
                    <span class="detail-value-compact">${row["DateKeep"] || "-"} / ${row["DateDelivery"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">ศูนย์/ส่งลูกค้า:</span>
                    <span class="detail-value-compact">${row["DateCenter"] || "-"} / ${row["DeliveryTSC_Detail"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">ช่างซ่อม:</span>
                    <span class="detail-value-compact">${row["รหัสช่าง"] || ""} ${row["ชื่อช่าง"] || "-"}</span>
                  </div>
                  <div class="detail-item-compact">
                    <span class="detail-label-compact">หมายเหตุ:</span>
                    <span class="detail-value-compact">${row["Note"] || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        modalContent.innerHTML = html;
        modal.style.display = "block";
      };
      detailTd.appendChild(btn);
      tr.appendChild(detailTd);
      tableBody.appendChild(tr);
    });
    updatePagination(data.length);
  } catch (e) {
    console.error("Error in renderTable:", e);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="23" style="text-align: center; color: red;">Error rendering table: ${e.message}</td></tr>`;
    }
  }
}

function updatePagination(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  currentPage = Math.min(currentPage, totalPages);
  if (currentPage < 1) currentPage = 1;
  pageNumbersContainer.innerHTML = '';
  const maxPageButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
  if (endPage - startPage + 1 < maxPageButtons) startPage = Math.max(1, endPage - maxPageButtons + 1);
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = "page-number";
    if (i === currentPage) btn.classList.add("active");
    btn.addEventListener("click", () => { currentPage = i; filterAndRenderTable(); });
    pageNumbersContainer.appendChild(btn);
  }
  firstPageButton.disabled = currentPage === 1;
  prevPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;
  lastPageButton.disabled = currentPage === totalPages;
  firstPageButton.onclick = () => { currentPage = 1; filterAndRenderTable(); };
  prevPageButton.onclick = () => { if (currentPage > 1) { currentPage--; filterAndRenderTable(); } };
  nextPageButton.onclick = () => { if (currentPage < totalPages) { currentPage++; filterAndRenderTable(); } };
  lastPageButton.onclick = () => { currentPage = totalPages; filterAndRenderTable(); };
}
// Function to initialize product data (called after login)
// Helper to check if DOM is ready and force render
function initUI() {
  if (isUIInitialized) return;
  console.log("Initializing UI elements and listeners...");

  // เชื่อมต่อตัวแปรกับ HTML Elements
  modal = document.getElementById("detailModal");
  summaryModal = document.getElementById("summaryModal");
  modalContent = document.getElementById("modalContent");
  summaryContent = document.getElementById("summaryContent");
  closeModal = document.getElementById("closeModal");
  closeSummaryModal = document.getElementById("closeSummaryModal");
  plantCallFilter = document.getElementById("plantCallFilter");
  plantFilter = document.getElementById("plantFilter");
  statusFilter = document.getElementById("statusFilter");
  searchInput = document.getElementById("searchInput");
  searchButton = document.getElementById("searchButton");
  excelButton = document.getElementById("excelButton");
  summaryButton = document.getElementById("summaryButton");
  errorFilterButton = document.getElementById("errorFilterButton");
  tableBody = document.querySelector("#data-table tbody");
  pageNumbersContainer = document.getElementById("pageNumbers");
  firstPageButton = document.getElementById("firstPage");
  prevPageButton = document.getElementById("prevPage");
  nextPageButton = document.getElementById("nextPage");
  lastPageButton = document.getElementById("lastPage");
  itemsPerPageSelect = document.getElementById("itemsPerPage");
  landingPage = document.getElementById("landingPage");
  mainApp = document.getElementById("mainApp");
  btnTSC = document.getElementById("btnTSC");
  btnBluetap = document.getElementById("btnBluetap");
  btnBluetapClaim = document.getElementById("btnBluetapClaim");
  btnAdapterClaim = document.getElementById("btnAdapterClaim");
  btnTrueWifi = document.getElementById("btnTrueWifi");
  backButton = document.getElementById("backButton");
  reportTitleText = document.getElementById("reportTitleText");
  statusBadges = document.getElementById("statusBadges");
  rowCountInfo = document.getElementById("rowCountInfo");
  workOrderCountInfo = document.getElementById("workOrderCountInfo");
  plantBadges = document.getElementById("plantBadges");
  descriptionBadges = document.getElementById("descriptionBadges");
  latestDeliveryCountInfo = document.getElementById("latestDeliveryCountInfo");
  notReturnCard = document.getElementById("notReturnCard");
  notReturnCountValue = document.getElementById("notReturnCountValue");
  latestDeliveryValue = document.getElementById("latestDeliveryValue");

  if (!searchInput) {
    console.warn("Search input not found, deferring initialization...");
    return;
  }

  // กำหนด Event Listeners
  if (workOrderCountInfo) {
    workOrderCountInfo.onclick = () => {
      plantCallFilter.value = "";
      plantFilter.value = "";
      activeStatusFilter = "";
      searchInput.value = "";
      resetSortConfig();
      filterAndRenderTable();
    };
  }
  if (btnTSC) {
    btnTSC.onclick = () => {
      console.log("TSC Button Clicked");
      currentProductFilter = "TSC";
      currentCodeFilter = null;
      currentDescFilter = null;
      reportTitleText.textContent = "รายงานการเก็บเครื่องคืนลูกค้า";
      const tidHeader = document.querySelector('th[data-column="TID"]');
      if (tidHeader) tidHeader.innerHTML = 'TID <span class="arrow"></span>';
      landingPage.style.display = "none";
      mainApp.style.display = "block";
      resetAllFilters();
      resetSortConfig();
      filterAndRenderTable();
      TscApi.logActivity("View Category", "TSC");
    };
  }
  if (btnBluetap) {
    btnBluetap.onclick = () => {
      console.log("Bluetap Button Clicked");
      currentProductFilter = "Bluetap";
      currentCodeFilter = "SUNMI";
      currentDescFilter = null;
      reportTitleText.textContent = "รายงานการเก็บเครื่อง Sunmi คืนลูกค้า";
      landingPage.style.display = "none";
      mainApp.style.display = "block";
      resetAllFilters();
      resetSortConfig();
      filterAndRenderTable();
      TscApi.logActivity("View Category", "Bluetap");
    };
  }
  if (btnBluetapClaim) {
    btnBluetapClaim.onclick = () => {
      console.log("Bluetap Claim Button Clicked");
      currentProductFilter = "Bluetap";
      currentCodeFilter = "30066406";
      currentDescFilter = null;
      reportTitleText.textContent = "รายงานการเคลมเครื่อง Bluetap รุ่นใหม่";
      landingPage.style.display = "none";
      mainApp.style.display = "block";
      resetAllFilters();
      resetSortConfig();
      filterAndRenderTable();
      TscApi.logActivity("View Category", "Bluetap Claim");
    };
  }
  if (btnAdapterClaim) {
    btnAdapterClaim.onclick = () => {
      console.log("Adapter Claim Button Clicked");
      currentProductFilter = "Bluetap";
      currentCodeFilter = "30066303";
      currentDescFilter = null;
      reportTitleText.textContent = "รายงานการเคลม Adapter Pos Nss";
      landingPage.style.display = "none";
      mainApp.style.display = "block";
      resetAllFilters();
      resetSortConfig();
      filterAndRenderTable();
      TscApi.logActivity("View Category", "Adapter Claim");
    };
  }
  if (btnTrueWifi) {
    btnTrueWifi.onclick = () => {
      console.log("True Wifi Button Clicked");
      currentProductFilter = "Access Point";
      currentCodeFilter = null;
      currentDescFilter = null;
      reportTitleText.textContent = "รายการการเก็บอะไหล่คืน True WiFi";
      const tidHeader = document.querySelector('th[data-column="TID"]');
      if (tidHeader) tidHeader.innerHTML = 'MAC <span class="arrow"></span>';
      landingPage.style.display = "none";
      mainApp.style.display = "block";
      resetAllFilters();
      resetSortConfig();
      filterAndRenderTable();
      TscApi.logActivity("View Category", "Access Point (True WiFi)");
    };
  }
  if (backButton) {
    backButton.onclick = () => {
      landingPage.style.display = "flex";
      mainApp.style.display = "none";
      currentProductFilter = null;
      currentCodeFilter = null;
      currentDescFilter = null;
    };
  }
  if (rowCountInfo) {
    rowCountInfo.onclick = () => {
      plantCallFilter.value = "";
      plantFilter.value = "";
      statusFilter.value = "";
      searchInput.value = "";
      resetSortConfig();
      filterAndRenderTable();
    };
  }

  if (closeModal) closeModal.onclick = () => { modal.style.display = "none"; currentRowData = null; };
  if (closeSummaryModal) closeSummaryModal.onclick = () => { summaryModal.style.display = "none"; };
  window.onclick = e => {
    if (e.target == modal) { modal.style.display = "none"; currentRowData = null; }
    if (e.target == summaryModal) { summaryModal.style.display = "none"; }
  };

  if (excelButton) excelButton.onclick = exportToCSV;
  if (summaryButton) summaryButton.onclick = generatePivotSummary;
  if (errorFilterButton) {
    errorFilterButton.onclick = () => {
      isErrorFilterActive = !isErrorFilterActive;
      if (isErrorFilterActive) {
        errorFilterButton.classList.add("active-error-filter");
        errorFilterButton.style.backgroundColor = "#dc3545";
        errorFilterButton.style.color = "white";
      } else {
        errorFilterButton.classList.remove("active-error-filter");
        errorFilterButton.style.backgroundColor = "";
        errorFilterButton.style.color = "";
      }
      currentPage = 1;
      filterAndRenderTable();
    };
  }
  if (itemsPerPageSelect) itemsPerPageSelect.onchange = e => { itemsPerPage = parseInt(e.target.value); currentPage = 1; filterAndRenderTable(); };
  
  // Enhanced Search Handlers
  if (searchInput) {
    searchInput.oninput = () => {
      currentPage = 1;
      if (searchInput.value.trim() !== "") {
        // Clear status filters when typing for a "Global Search"
        activeStatusFilter = "";
        isErrorFilterActive = false;
        if (errorFilterButton) {
          errorFilterButton.classList.remove("active-error-filter");
          errorFilterButton.style.backgroundColor = "";
          errorFilterButton.style.color = "";
        }
      }
      filterAndRenderTable();
    };
    
    searchInput.onkeyup = e => { 
      if (e.key === "Enter") { 
        resetSortConfig(); 
        filterAndRenderTable(); 
      } 
    };
  }
  
  if (searchButton) {
    searchButton.onclick = () => { 
      resetSortConfig(); 
      filterAndRenderTable(); 
    };
  }
  if (plantCallFilter) plantCallFilter.onchange = () => { currentPage = 1; resetSortConfig(); filterAndRenderTable(); };
  if (plantFilter) plantFilter.onchange = () => { currentPage = 1; resetSortConfig(); filterAndRenderTable(); };
  if (statusFilter) statusFilter.onchange = () => { currentPage = 1; resetSortConfig(); filterAndRenderTable(); };

  addSortListeners();

  if (allData && allData.length > 0) {
    populatePlantCallFilter(allData);
    filterAndRenderTable();
  }

  isUIInitialized = true;
}

// Function to initialize product data (called after login)
async function initProductData() {
  if (allData.length > 0) {
    // Data already loaded, ensure UI is consistent
    isLoading = false;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUI);
    } else {
      initUI();
    }
    return;
  }
  console.log("Initializing Product Data...");

  try {
    if (typeof TscApi === 'undefined') {
      throw new Error("TscApi is not defined. Please check if Api.js is loaded.");
    }

    // Use TscApi to fetch data
    const [data, claimData] = await Promise.all([
      TscApi.getProductData(),
      TscApi.getBluetapClaimData().catch(e => { console.error("Error loading claim data", e); return []; })
    ]);

    if (!Array.isArray(data)) {
      throw new Error("Data format is not an array");
    }
    console.log("Data loaded:", data.length, "rows");

    // Process data
    data.forEach(row => {
      // Normalize Product values for consistent filtering across the app
      let prodValue = (row["Product"] || "").toString().trim().toUpperCase();
      let sparePartCode = (row["Spare Part Code"] || "").toString().trim().toUpperCase();
      let sparePartName = (row["Spare Part Name"] || "").toString().trim().toUpperCase();
      
      if (prodValue.includes("BLUETAP") || sparePartCode.includes("SUNMI") || sparePartName.includes("SUNMI")) {
        row["Product"] = "Bluetap";
        
        // Special mapping for Bluetap Claim (New Model)
        const codeTrimmed = (row["Spare Part Code"] || "").toString().trim();
        if (codeTrimmed === "30066406") {
          // Use 'คลังพื้นที่' as the Status for this specific model as requested
          if (row["คลังพื้นที่"]) {
            row["Status"] = row["คลังพื้นที่"];
          }
        }
      } else if (prodValue.includes("WIFI") || prodValue.includes("ACCESS") || prodValue.includes("AP")) {
        row["Product"] = "Access Point";
      } else {
        // Default to TSC for TSC-related terms or empty/unrecognized values
        row["Product"] = "TSC";
      }
      
      // Apply status mappings - True WiFi (Access Point) shows original database status
      if (row["Product"] !== "Access Point") {
        if (row["Status"] === "ส่งTSCแล้ว") row["Status"] = "ส่งลูกค้าแล้ว";
      }
      
      // Apply rules for Bluetap specifically for คลังวิภาวดี 62
      // But skip if the status already indicates completion (ส่งลูกค้าแล้ว or สำเร็จ)
      const isClaimModel = (row["Spare Part Code"] || "").toString().trim() === "30066406";
      const currentStatus = (row["Status"] || "").toString().trim();
      if (row["Product"] === "Bluetap" && row["Plant"] === "คลังวิภาวดี 62" && !isClaimModel && currentStatus !== "ส่งลูกค้าแล้ว" && currentStatus !== "สำเร็จ") {
        row["Status"] = "รอส่งเคลม";
        row["DeliveryTSC_Detail"] = "-";
      }
    });

    const plantMap = {
      "318": "คลังกาแฟ", "301": "Stock กทม", "369": "Stock คลังระยอง", "326": "Stock วิภาวดี 62", 
      "319": "Stock ขอนแก่น", "309": "Stock โคราช", "366": "Stock เชียงใหม่", "304": "Stock พระราม 3", 
      "312": "Stock พิษณุโลก", "313": "Stock ภูเก็ต", "305": "Stock ราชบุรี", "320": "Stock ลำปาง", 
      "311": "Stock ศรีราชา", "307": "Stock สุราษฎร์", "317": "ศูนย์ REFURBISH", "367": "SA ฉะเชิงเทรา", 
      "364": "SA บางบัวทอง", "324": "SA ปัตตานี", "363": "SA ปากเกร็ด", "368": "SA ร้อยเอ็ด", 
      "323": "SA ลำลูกกา", "303": "SA สงขลา", "365": "SA สมุทรปราการ", "362": "SA หนองแขม", 
      "315": "SA อยุธยา", "310": "SA อุดรธานี1", "322": "SA อุดรธานี2", "330": "Stock ประเวศ"
    };

    if (Array.isArray(claimData) && claimData.length > 0) {
      const newClaimRows = claimData.map(newRow => {
        const claimSpc = (newRow["Spare Part Code"] || "30066406").toString().trim();
        // หาข้อมูลที่เหลือที่ WorkOrder และ Spare Part Code ตรงกับตารางหลัก (เพื่อ Merge)
        const matchedRow = data.find(r => 
          (r["WorkOrder"] || "").toString().trim() === (newRow["WorkOrder No"] || "").toString().trim() &&
          ((r["Spare Part Code"] || "").toString().trim() === claimSpc || 
           (r["Spare Part Code"] || "").toString().trim() === "30066406")
        );
        const oldRow = matchedRow || {};
        
        // เพื่อเป็นตารางหลัก โดยนำข้อมูลที่เหลือมารวม
        const mergedRow = {
          ...oldRow,
          "WorkOrder": newRow["WorkOrder No"],
          "Store Code": newRow["Store Code"],
          "Store Name": newRow["Store name"],
          "Product": "Bluetap", // แสดงในหมวด Bluetap
          "Spare Part Code": claimSpc,
          "Spare Part Name": newRow["Spare Part Name"] || oldRow["Spare Part Name"] || "เครื่อง Blue Tap (NFC) (ฝ)",
          "Qty": newRow["QTY"] || "1",
          "อุปกรณ์": newRow["อุปกรณ์"],
          "อาการ": newRow["อาการ"],
          "รหัสช่าง": newRow["รหัสช่าง"],
          "ชื่อช่าง": newRow["ชื่อช่าง"],
          "การคืนซาก": newRow["การคืนซาก"] || oldRow["การคืนซาก"],
          "Serial Old": newRow["Serial No"] || oldRow["Serial Old"],
          "DateKeep": oldRow["DateKeep"] || newRow["วันที่เปิดงาน"] || "-"
        };
        
        // จัดการ Status และ OrderChk สำหรับรุ่นเคลม
        if (!matchedRow) {
          mergedRow["Status"] = "รอคืนคลัง";
          
          // ถ้า Status เป็น รอคืนคลัง ให้นำวันที่จาก Approve Date Time มาแสดง
          if (newRow["Approve Date Time"]) {
            const approveDateStr = newRow["Approve Date Time"].toString().trim();
            mergedRow["DateKeep"] = approveDateStr.split(' ')[0] || mergedRow["DateKeep"];
          }
          
          // ถ้า WorkOrder ไม่ตรงกับตารางหลัก ให้แสดง - เสมอตามเงื่อนไขใหม่
          mergedRow["OrderChk"] = "-";
        } else {
          mergedRow["OrderChk"] = "-";
          if (mergedRow["Spare Part Code"] === "30066406") {
            if (mergedRow["คลังพื้นที่"]) {
              mergedRow["Status"] = mergedRow["คลังพื้นที่"];
            } else if (!mergedRow["Status"]) {
              mergedRow["Status"] = "รอส่งเคลม";
            }
          }
        }
        
        // ถ้า Status เป็น รอคืนคลัง หรือ รอส่งคลัง ให้ทำ Mapping ค่า Plant ไปแสดงที่ คลังพื้นที่ (PlantCall)
        if (mergedRow["Status"] === "รอคืนคลัง" || mergedRow["Status"] === "รอส่งคลัง") {
          const plantId = (newRow["Plant"] || "").toString().trim();
          if (plantMap[plantId]) {
            mergedRow["PlantCall"] = plantMap[plantId];
          }
        }

        return mergedRow;
      });
      
      // นำข้อมูลเดิมที่ไม่ใช่ตารางหลัก (ที่มี WorkOrder ซ้ำกับข้อมูลใหม่ และเป็นอะไหล่ตัวเดียวกัน) ออก
      let finalData = data.filter(row => {
        const wo = (row["WorkOrder"] || "").toString().trim();
        const spc = (row["Spare Part Code"] || "").toString().trim();
        
        const isReplacedByClaim = claimData.some(cRow => {
            const cWo = (cRow["WorkOrder No"] || "").toString().trim();
            const claimSpc = (cRow["Spare Part Code"] || "30066406").toString().trim();
            return cWo === wo && (spc === claimSpc || spc === "30066406");
        });
        
        return !isReplacedByClaim;
      });
      
      // สำหรับข้อมูลรอง (Bluetap Claim รุ่นใหม่) ที่ไม่มี WorkOrder ในตารางหลัก
      finalData.forEach(row => {
        if (row["Product"] === "Bluetap" && (row["Spare Part Code"] || "").toString().trim() === "30066406") {
          // เงื่อนไขใหม่: ถ้า WorkOrder ไม่ตรงกับตารางเคลม (ซึ่งอยู่นอก claimWorkOrders แล้ว) ให้แสดง CheckOrder
          row["OrderChk"] = "CheckOrder";
        }
      });
      
      // การแสดงตารางในลักษณะ UNION โดยนำข้อมูลใหม่ไปต่อท้าย
      finalData.push(...newClaimRows);
      
      allData = finalData;
    } else {
      allData = data;
    }

  } catch (error) {
    console.error("Error loading data:", error);

    // Add visual error indication
    const updateError = () => {
      // Re-fetch tableBody if null
      if (!tableBody) tableBody = document.querySelector("#data-table tbody");

      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="23" style="text-align: center; color: red;">
          <div style="padding: 20px;">
            <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 10px;"></i><br>
            <strong>เกิดข้อผิดพลาดในการโหลดข้อมูล</strong><br>
            ${error.message || "ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้"}<br>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 15px; cursor: pointer;">ลองใหม่อีกครั้ง</button>
          </div>
        </td></tr>`;
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateError);
    } else {
      updateError();
    }
  } finally {
    // Ensure loading state is cleared and UI is initialized REGARDLESS of success/failure
    isLoading = false;

    const onDataReady = () => {
      initUI();
      if (allData && allData.length > 0) {
        populatePlantCallFilter(allData);
      }
      filterAndRenderTable();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDataReady);
    } else {
      onDataReady();
    }
    console.log("Product Data Initialization Finished. isLoading =", isLoading);
  }
}

// Attach to window for global access
// Open specific category directly (replaces landingPage when launched from Hub submenu)
function openDashboardView(view) {
  initUI();
  const lp = document.getElementById("landingPage");
  const ma = document.getElementById("mainApp");
  const ts = document.getElementById("tscStoreApp");
  const titleEl = document.getElementById("reportTitleText");
  const tidHeader = document.querySelector('th[data-column="TID"]');

  if (lp) lp.style.display = "none";

  const key = (view || "tsc").toLowerCase();
  if (key === "tsc-store") {
    if (ma) ma.style.display = "none";
    if (ts) ts.style.display = "block";
    return;
  }

  if (ts) ts.style.display = "none";
  if (ma) ma.style.display = "block";

  if (key === "bluetap") {
    currentProductFilter = "Bluetap";
    currentCodeFilter = "SUNMI";
    currentDescFilter = null;
    if (titleEl) titleEl.textContent = "รายงานการเก็บเครื่อง Sunmi คืนลูกค้า";
    TscApi.logActivity("View Category", "Bluetap");
  } else if (key === "bluetap-claim") {
    currentProductFilter = "Bluetap";
    currentCodeFilter = "30066406";
    currentDescFilter = null;
    if (titleEl) titleEl.textContent = "รายงานการเคลมเครื่อง Bluetap รุ่นใหม่";
    TscApi.logActivity("View Category", "Bluetap Claim");
  } else if (key === "adapter-claim") {
    currentProductFilter = "Bluetap";
    currentCodeFilter = "30066303";
    currentDescFilter = null;
    if (titleEl) titleEl.textContent = "รายงานการเคลม Adapter Pos Nss";
    TscApi.logActivity("View Category", "Adapter Claim");
  } else if (key === "truewifi") {
    currentProductFilter = "Access Point";
    currentCodeFilter = null;
    currentDescFilter = null;
    if (titleEl) titleEl.textContent = "รายการการเก็บอะไหล่คืน True WiFi";
    if (tidHeader) tidHeader.innerHTML = 'MAC <span class="arrow"></span>';
    TscApi.logActivity("View Category", "Access Point (True WiFi)");
  } else {
    currentProductFilter = "TSC";
    currentCodeFilter = null;
    currentDescFilter = null;
    if (titleEl) titleEl.textContent = "รายงานการเก็บเครื่องคืนลูกค้า";
    if (tidHeader) tidHeader.innerHTML = 'TID <span class="arrow"></span>';
    TscApi.logActivity("View Category", "TSC");
  }

  resetAllFilters();
  resetSortConfig();
  filterAndRenderTable();
}

window.initProductData = initProductData;
window.openDashboardView = openDashboardView;

// รอให้หน้าเว็บโหลดเสร็จสมบูรณ์ก่อนเริ่มทำงาน (สำคัญมาก)
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");
  initUI();
});










