console.log("tsc_store.js is loading...");

// API Config moved to Api.js

// Global variables for TSC Store feature

// Global variables for TSC Store feature
let tscStore_allData = [];
let tscStore_tscData = [];
let tscStore_currentPage = 1;
let tscStore_itemsPerPage = 20;
let tscStore_sortColumn = null;
let tscStore_sortDirection = 'asc';

// Elements
let tscStore_modal, tscStore_modalContent, tscStore_closeModal;
let tscStore_searchInput, tscStore_searchButton, tscStore_statusFilter, tscStore_exportExcelButton;
let tscStore_tableBody, tscStore_pageNumbersContainer;
let tscStore_firstPageButton, tscStore_prevPageButton, tscStore_nextPageButton, tscStore_lastPageButton;
let tscStore_itemsPerPageSelect;
let tscStore_waitingCount, tscStore_completeCount, tscStore_incompleteCount, tscStore_pendingCount;
let tscStore_waitingPosCount, tscStore_completePosCount, tscStore_incompletePosCount, tscStore_pendingPosCount;

function tscStore_init() {
    console.log("Initializing TSC Store...");

    // Initialize elements
    tscStore_modal = document.getElementById("tscStore_detailModal");
    tscStore_modalContent = document.getElementById("tscStore_modalContent");
    tscStore_closeModal = document.getElementById("tscStore_closeModal");
    tscStore_searchInput = document.getElementById("tscStore_searchInput");
    tscStore_searchButton = document.getElementById("tscStore_searchButton");
    tscStore_statusFilter = document.getElementById("tscStore_statusFilter");
    tscStore_exportExcelButton = document.getElementById("tscStore_exportExcel");
    tscStore_tableBody = document.querySelector("#tscStore_dataTable tbody");
    tscStore_pageNumbersContainer = document.getElementById("tscStore_pageNumbers");
    tscStore_firstPageButton = document.getElementById("tscStore_firstPage");
    tscStore_prevPageButton = document.getElementById("tscStore_prevPage");
    tscStore_nextPageButton = document.getElementById("tscStore_nextPage");
    tscStore_lastPageButton = document.getElementById("tscStore_lastPage");
    tscStore_itemsPerPageSelect = document.getElementById("tscStore_itemsPerPage");

    tscStore_waitingCount = document.getElementById("tscStore_waitingCount");
    tscStore_completeCount = document.getElementById("tscStore_completeCount");
    tscStore_incompleteCount = document.getElementById("tscStore_incompleteCount");
    tscStore_pendingCount = document.getElementById("tscStore_pendingCount");

    tscStore_waitingPosCount = document.getElementById("tscStore_waitingPosCount");
    tscStore_completePosCount = document.getElementById("tscStore_completePosCount");
    tscStore_incompletePosCount = document.getElementById("tscStore_incompletePosCount");
    tscStore_pendingPosCount = document.getElementById("tscStore_pendingPosCount");

    // Event Listeners
    if (tscStore_closeModal) tscStore_closeModal.onclick = () => tscStore_modal.style.display = "none";

    window.addEventListener('click', (event) => {
        if (event.target == tscStore_modal) tscStore_modal.style.display = "none";
    });

    if (tscStore_itemsPerPageSelect) {
        tscStore_itemsPerPageSelect.addEventListener("change", (e) => {
            tscStore_itemsPerPage = parseInt(e.target.value);
            tscStore_currentPage = 1;
            tscStore_filterAndRenderTable();
        });
    }

    if (tscStore_exportExcelButton) {
        tscStore_exportExcelButton.addEventListener("click", () => {
            const keyword = tscStore_searchInput.value.toLowerCase();
            const status = tscStore_statusFilter.value;
            let filtered = tscStore_allData.filter(row => {
                const matchesKeyword = (
                    (row["รหัสสาขา"] || "").toLowerCase().includes(keyword) ||
                    (row["สาขา"] || "").toLowerCase().includes(keyword) ||
                    (row["จังหวัด"] || "").toLowerCase().includes(keyword) ||
                    (row["ผู้ส่งคืน"] || "").toLowerCase().includes(keyword) ||
                    (row["สถานะร้าน"] || "").toLowerCase().includes(keyword) ||
                    (row["วันที่คืนคลัง"] || "").toLowerCase().includes(keyword) ||
                    (row["วันที่ดำเนินการ"] || "").toLowerCase().includes(keyword) ||
                    (row["ผ่านมา(วัน)"] || "").toString().toLowerCase().includes(keyword) ||
                    (row["Staus"] || "").toLowerCase().includes(keyword)
                );
                const matchesStatus = !status || (row["Staus"] || "") === status;
                return matchesKeyword && matchesStatus;
            });
            if (tscStore_sortColumn) {
                filtered = tscStore_sortData(filtered, tscStore_sortColumn, tscStore_sortDirection);
            }
            // Add logging
            TscApi.logActivity("Export Excel", `TSC Store - Count: ${filtered.length}`);
            tscStore_exportToCSV(filtered);
        });
    }

    if (tscStore_searchButton) tscStore_searchButton.addEventListener("click", () => { tscStore_currentPage = 1; tscStore_filterAndRenderTable(); });
    if (tscStore_statusFilter) tscStore_statusFilter.addEventListener("change", () => { tscStore_currentPage = 1; tscStore_filterAndRenderTable(); });
    if (tscStore_searchInput) {
        tscStore_searchInput.addEventListener("input", () => {
            tscStore_currentPage = 1;
            if (tscStore_searchInput.value.trim() !== "") {
                // Clear status filter when typing for a "Global Search"
                if (tscStore_statusFilter) tscStore_statusFilter.value = "";
                
                // Clear active card highlights
                const cards = document.querySelectorAll('.tsc-status-card');
                cards.forEach(card => card.classList.remove('active'));
            }
            tscStore_filterAndRenderTable();
        });

        tscStore_searchInput.addEventListener("keyup", (e) => {
            if (e.key === 'Enter') {
                tscStore_currentPage = 1;
                tscStore_filterAndRenderTable();
            }
        });
    }

    // Pagination
    if (tscStore_firstPageButton) tscStore_firstPageButton.onclick = () => { tscStore_currentPage = 1; tscStore_filterAndRenderTable(); };
    if (tscStore_prevPageButton) tscStore_prevPageButton.onclick = () => { if (tscStore_currentPage > 1) { tscStore_currentPage--; tscStore_filterAndRenderTable(); } };
    if (tscStore_nextPageButton) tscStore_nextPageButton.onclick = () => {
        const totalPages = Math.ceil(tscStore_allData.length / tscStore_itemsPerPage);
        if (tscStore_currentPage < totalPages) { tscStore_currentPage++; tscStore_filterAndRenderTable(); }
    };
    if (tscStore_lastPageButton) tscStore_lastPageButton.onclick = () => {
        tscStore_currentPage = Math.ceil(tscStore_allData.length / tscStore_itemsPerPage);
        tscStore_filterAndRenderTable();
    };

    // Sortable headers
    document.querySelectorAll('#tscStore_dataTable .sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-column');
            if (tscStore_sortColumn === column) {
                tscStore_sortDirection = tscStore_sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                tscStore_sortColumn = column;
                tscStore_sortDirection = 'asc';
            }

            document.querySelectorAll('#tscStore_dataTable .sortable').forEach(t => t.classList.remove('asc', 'desc'));
            th.classList.add(tscStore_sortDirection);

            tscStore_filterAndRenderTable();
        });
    });

    // Load Data - MOVED to on-demand
    // tscStore_loadData(); 
}

function tscStore_loadData() {
    Promise.all([
        TscApi.getStoreBrandData(),
        TscApi.getStoreTscData()
    ])
        .then(([brandData, tscDataResponse]) => {
            console.log("TSC Store Data Loaded:", brandData.length);
            tscStore_allData = brandData.map(row => ({
                ...row,
                "จำนวนเครื่อง": row["PosQty"] || "",
                "ส่งคืน": row["PoskeepQty"] || "",
                "ผู้ส่งคืน": row["UserKeep"] || "",
                "ผ่านมา(วัน)": row["ผ่านมา"] || "",
                "Staus": (row["Staus"] || "").trim(),
                "สถานะร้าน": row["Remark"] || "ไม่มีข้อมูล",
                "วันที่คืนคลัง": row["DateRecripte"] || "",
                "วันที่ดำเนินการ": row["DateCall"] || ""
            }));

            tscStore_tscData = tscDataResponse.map(row => {
                const dateRec = row["DateRecripte"] || row["วันที่ส่งคืน"] || row["วันที่คืนคลัง"] || "";
                let status = row["Status"] || row["Staus"] || row["สถานะ"] || "";
                
                // If status is missing but we have a return date, mark as returned
                if (!status && dateRec && dateRec !== "-") status = "ส่งคืนแล้ว";
                
                return {
                    "รหัสสาขา": (row["รหัสสาขา"] || "").toString().trim(),
                    "TID": row["TID"] || "",
                    "PosNo": row["PosNo"] || "",
                    "สถานะร้าน": row["สถานะร้าน"] || "ไม่มีข้อมูล",
                    "วันเข้าดำเนินการ": row["วันเข้าดำเนินการ"] || row["วันเข้าดำเนินการ "] || "ไม่มีข้อมูล",
                    "DateRecripte": dateRec,
                    "ผู้ส่งคืน": row["Employee"] || row["User"] || "ไม่มีข้อมูล",
                    "Status": status.toString().trim()
                };
            });

            tscStore_filterAndRenderTable();
        })
        .catch(error => {
            console.error("TSC Store Load Error:", error);
            // alert("เกิดข้อผิดพลาดในการโหลดข้อมูล TSC Store");
        });
}

function tscStore_filterByStatus(status) {
    tscStore_currentPage = 1;
    if (tscStore_statusFilter) tscStore_statusFilter.value = status;
    if (tscStore_searchInput) tscStore_searchInput.value = '';

    // Create a mock event target if called manually
    const cards = document.querySelectorAll('.tsc-status-card');
    cards.forEach(card => card.classList.remove('active'));

    // Note: finding the card corresponding to status is tricky without event, 
    // but we can look it up if needed. For now just filter.

    tscStore_filterAndRenderTable();
}

function tscStore_parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === "") return null;
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length === 3) {
        if (dateStr.includes('/')) {
            const [day, month, year] = parts.map(Number);
            return new Date(year, month - 1, day);
        } else {
            const [year, month, day] = parts.map(Number);
            return new Date(year, month - 1, day);
        }
    }
    return null;
}

function tscStore_updateStatusSummary(data) {
    const waiting = data.filter(row => row["Staus"] === "รอส่งคลัง");
    const complete = data.filter(row => row["Staus"] === "ครบ");
    const incomplete = data.filter(row => row["Staus"] === "ไม่ครบ");
    const pending = data.filter(row => row["Staus"] === "รอจัดเก็บ");

    const waitingBranches = waiting.length;
    const completeBranches = complete.length;
    const incompleteBranches = incomplete.length;
    const pendingBranches = pending.length;

    const waitingPos = waiting.reduce((sum, row) => sum + (parseFloat(row["จำนวนเครื่อง"]) || 0), 0);
    const completePos = complete.reduce((sum, row) => sum + (parseFloat(row["จำนวนเครื่อง"]) || 0), 0);
    const pendingPos = pending.reduce((sum, row) => sum + (parseFloat(row["จำนวนเครื่อง"]) || 0), 0);

    const incompletePos = incomplete.reduce((sum, row) => {
        const total = parseFloat(row["จำนวนเครื่อง"]) || 0;
        const returned = parseFloat(row["ส่งคืน"]) || 0;
        return sum + (total - returned);
    }, 0);

    if (tscStore_waitingCount) tscStore_waitingCount.textContent = waitingBranches;
    if (tscStore_completeCount) tscStore_completeCount.textContent = completeBranches;
    if (tscStore_incompleteCount) tscStore_incompleteCount.textContent = incompleteBranches;
    if (tscStore_pendingCount) tscStore_pendingCount.textContent = pendingBranches;

    if (tscStore_waitingPosCount) tscStore_waitingPosCount.textContent = waitingPos;
    if (tscStore_completePosCount) tscStore_completePosCount.textContent = completePos;
    if (tscStore_incompletePosCount) tscStore_incompletePosCount.textContent = incompletePos;
    if (tscStore_pendingPosCount) tscStore_pendingPosCount.textContent = pendingPos;
}

function tscStore_sortData(data, column, direction) {
    return [...data].sort((a, b) => {
        let valueA = a[column] || "";
        let valueB = b[column] || "";

        if (column === "จำนวนเครื่อง" || column === "ส่งคืน") {
            valueA = parseFloat(valueA) || 0;
            valueB = parseFloat(valueB) || 0;
        } else if (column === "วันที่ดำเนินการ" || column === "วันที่คืนคลัง") {
            const dateA = tscStore_parseDate(valueA);
            const dateB = tscStore_parseDate(valueB);
            if (!dateA && !dateB) return 0;
            if (!dateA) return direction === 'asc' ? 1 : -1;
            if (!dateB) return direction === 'asc' ? -1 : 1;
            valueA = dateA.getTime();
            valueB = dateB.getTime();
        } else if (column === "ผ่านมา(วัน)") {
            valueA = parseInt(valueA.replace(" วัน", "")) || 0;
            valueB = parseInt(valueB.replace(" วัน", "")) || 0;
        }

        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function tscStore_exportToCSV(data) {
    const headers = ["สถานะ", "รหัสสาขา", "สาขา", "จังหวัด", "สถานะร้าน", "จำนวนเครื่อง", "ส่งคืน", "ผ่านมา(วัน)", "วันที่ดำเนินการ", "ผู้ส่งคืน", "วันที่คืนคลัง"];
    const rows = data.map(row =>
        headers.map(header => {
            let value = row[header] || "";
            if (header === "จำนวนเครื่อง" || header === "ส่งคืน") {
                value = parseFloat(value) === 0 ? "-" : value;
            } else if (header === "ผ่านมา(วัน)") {
                value = parseInt(value.replace(" วัน", "")) === 0 ? "-" : value;
            } else if (header === "สถานะร้าน") {
                value = value || "ไม่มีข้อมูล";
            }
            return `"${value.toString().replace(/"/g, '""')}"`;
        }).join(',')
    );
    const csvContent = [
        headers.join(','),
        ...rows
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'TscBrandData.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function tscStore_filterAndRenderTable() {
    if (!tscStore_searchInput) return;

    const keyword = tscStore_searchInput.value.toLowerCase();
    const status = tscStore_statusFilter.value;

    let filtered = tscStore_allData.filter(row => {
        const matchesKeyword = (
            (row["รหัสสาขา"] || "").toLowerCase().includes(keyword) ||
            (row["สาขา"] || "").toLowerCase().includes(keyword) ||
            (row["จังหวัด"] || "").toLowerCase().includes(keyword) ||
            (row["ผู้ส่งคืน"] || "").toLowerCase().includes(keyword) ||
            (row["สถานะร้าน"] || "").toLowerCase().includes(keyword) ||
            (row["วันที่คืนคลัง"] || "").toLowerCase().includes(keyword) ||
            (row["วันที่ดำเนินการ"] || "").toLowerCase().includes(keyword) ||
            (row["ผ่านมา(วัน)"] || "").toString().toLowerCase().includes(keyword) ||
            (row["Staus"] || "").toLowerCase().includes(keyword)
        );
        const rowStatus = row["Staus"] || "";
        const matchesStatus = !status || rowStatus === status;
        return matchesKeyword && matchesStatus;
    });

    if (tscStore_sortColumn) {
        filtered = tscStore_sortData(filtered, tscStore_sortColumn, tscStore_sortDirection);
    }

    tscStore_updateStatusSummary(filtered);
    tscStore_renderTable(filtered);
}

function tscStore_renderTable(data) {
    if (!tscStore_tableBody) return;

    tscStore_tableBody.innerHTML = '';
    const startIdx = (tscStore_currentPage - 1) * tscStore_itemsPerPage;
    const endIdx = startIdx + tscStore_itemsPerPage;
    const paginatedData = data.slice(startIdx, endIdx);

    paginatedData.forEach((row, i) => {
        const tr = document.createElement("tr");
        tr.style.animationDelay = `${i * 0.05}s`;

        const columns = ["Staus", "รหัสสาขา", "สาขา", "จังหวัด", "สถานะร้าน", "จำนวนเครื่อง", "ส่งคืน", "ผ่านมา(วัน)", "วันที่ดำเนินการ", "ผู้ส่งคืน", "วันที่คืนคลัง"];
        columns.forEach(col => {
            const td = document.createElement("td");
            let value = row[col] || "";
            if (col === "Staus") {
                td.textContent = value || "ไม่มีข้อมูล";
                td.className = value === "ครบ" ? "status-green" : value === "รอจัดเก็บ" ? "status-orange" : "status-red";
            } else if (col === "จำนวนเครื่อง" || col === "ส่งคืน") {
                td.textContent = parseFloat(value) === 0 ? "-" : value;
            } else if (col === "ผ่านมา(วัน)") {
                td.textContent = parseInt(value.replace(" วัน", "")) === 0 ? "-" : value;
            } else if (col === "สถานะร้าน") {
                td.textContent = value || "ไม่มีข้อมูล";
            } else {
                td.textContent = value;
            }
            tr.appendChild(td);
        });

        const detailTd = document.createElement("td");
        const btn = document.createElement("button");
        btn.innerHTML = '<i class="fas fa-eye"></i> ดูข้อมูล';
        btn.className = "detail-button";
        btn.onclick = () => {
            const branchCode = (row["รหัสสาขา"] || "").toString().trim();
            let filteredTscData = tscStore_tscData.filter(tscRow => tscRow["รหัสสาขา"] === branchCode);

            // Deduplicate by รหัสสาขา + TID, preferring rows with DateRecripte
            const uniqueMap = new Map();
            filteredTscData.forEach(tscRow => {
                const key = `${tscRow["รหัสสาขา"]}_${tscRow["TID"]}`;
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, tscRow);
                } else {
                    // If duplicate, prefer the one that has DateRecripte or is marked as success
                    const existing = uniqueMap.get(key);
                    const isExistingSuccess = existing.Status === "ส่งคืนแล้ว" || existing.Status === "ครบ" || (existing.DateRecripte && existing.DateRecripte !== "-");
                    const isNewSuccess = tscRow.Status === "ส่งคืนแล้ว" || tscRow.Status === "ครบ" || (tscRow.DateRecripte && tscRow.DateRecripte !== "-");
                    
                    if (!isExistingSuccess && isNewSuccess) {
                        uniqueMap.set(key, tscRow);
                    }
                }
            });
            filteredTscData = Array.from(uniqueMap.values());

            let tscTableHtml = '';
            if (filteredTscData.length > 0) {
                tscTableHtml = `
                    <div class="table-container" style="margin-top: 15px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                      <table class="modal-table" style="margin: 0; box-shadow: none; border-radius: 0;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">รหัสสาขา</th>
                                <th style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">TID</th>
                                <th style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">PosNo</th>
                                <th style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">สถานะร้าน</th>
                                <th style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">วันเข้าดำเนินการ</th>
                                <th style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">วันที่ส่งคืน</th>
                                <th style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">ผู้ส่งคืน</th>
                                <th style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredTscData.map(tscRow => {
                                const isSuccess = tscRow["Status"] === "ส่งคืนแล้ว" || tscRow["Status"] === "ครบ";
                                const rowStyle = isSuccess ? 'style="background: #dcfce7;"' : 'style="background: white;"';
                                return `
                                <tr ${rowStyle}>
                                    <td style="font-size: 12px; padding: 10px;">${tscRow["รหัสสาขา"] || ""}</td>
                                    <td style="font-size: 12px; padding: 10px;">${tscRow["TID"] || ""}</td>
                                    <td style="font-size: 12px; padding: 10px;">${tscRow["PosNo"] || ""}</td>
                                    <td style="font-size: 12px; padding: 10px;">${tscRow["สถานะร้าน"] || "ไม่มีข้อมูล"}</td>
                                    <td style="font-size: 12px; padding: 10px;">${tscRow["วันเข้าดำเนินการ"] || "ไม่มีข้อมูล"}</td>
                                    <td style="font-size: 12px; padding: 10px;">${tscRow["DateRecripte"] || ""}</td>
                                    <td style="font-size: 12px; padding: 10px;">${tscRow["ผู้ส่งคืน"] || "ไม่มีข้อมูล"}</td>
                                    <td style="font-size: 12px; padding: 10px;" class="${tscRow["Status"] === "รอส่งคืน" ? "status-red" : isSuccess ? "status-green" : tscRow["Status"] === "รอจัดเก็บ" ? "status-orange" : ""}">${tscRow["Status"] || ""}</td>
                                </tr>
                            `;}).join('')}
                        </tbody>
                      </table>
                    </div>
                `;
            } else {
                tscTableHtml = '<div class="no-data" style="padding: 20px; text-align: center; color: #64748b; font-style: italic;">ไม่มีข้อมูลใน TSCData สำหรับรหัสสาขานี้</div>';
            }

            const status = row["Staus"] || "-";
            let statusClass = "status-other-bg";
            if (status === "ครบ") statusClass = "status-success-bg";
            else if (status === "รอจัดเก็บ") statusClass = "status-wait-bg";
            else if (status === "ไม่ครบ" || status === "รอส่งคลัง") statusClass = "status-transport-bg";

            const html = `
                <!-- Key Summary Bar -->
                <div class="compact-summary-bar">
                    <div class="summary-item">
                        <span class="summary-label">รหัสสาขา</span>
                        <span class="summary-value">${row["รหัสสาขา"] || "-"}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">จังหวัด</span>
                        <span class="summary-value">${row["จังหวัด"] || "-"}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">สถานะ</span>
                        <span class="summary-value"><span class="modal-status-badge ${statusClass}">${status}</span></span>
                    </div>
                </div>

                <div class="detail-grid-wider">
                  <!-- Column 1: Store Details -->
                  <div class="detail-section-compact">
                      <div class="detail-section-title-compact"><i class="fas fa-store"></i> รายละเอียดสาขา</div>
                      <div class="detail-list-compact">
                          <div class="detail-item-compact">
                              <span class="detail-label-compact">ชื่อสาขา:</span>
                              <span class="detail-value-compact">${row["สาขา"] || "-"}</span>
                          </div>
                          <div class="detail-item-compact">
                              <span class="detail-label-compact">รหัสสาขา:</span>
                              <span class="detail-value-compact">${row["รหัสสาขา"] || "-"}</span>
                          </div>
                          <div class="detail-item-compact">
                              <span class="detail-label-compact">สถานะร้าน:</span>
                              <span class="detail-value-compact">${row["สถานะร้าน"] || "-"}</span>
                          </div>
                          <div class="detail-item-compact">
                              <span class="detail-label-compact">จังหวัด:</span>
                              <span class="detail-value-compact">${row["จังหวัด"] || "-"}</span>
                          </div>
                      </div>
                  </div>

                  <!-- Column 2: Inventory & Operations -->
                  <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="detail-section-compact">
                        <div class="detail-section-title-compact"><i class="fas fa-boxes"></i> ข้อมูลเครื่อง</div>
                        <div class="detail-list-compact">
                            <div class="detail-item-compact">
                                <span class="detail-label-compact">จำนวนเครื่อง:</span>
                                <span class="detail-value-compact">${parseFloat(row["จำนวนเครื่อง"]) || 0} เครื่อง</span>
                            </div>
                            <div class="detail-item-compact">
                                <span class="detail-label-compact">ส่งคืนแล้ว:</span>
                                <span class="detail-value-compact">${parseFloat(row["ส่งคืน"]) || 0} เครื่อง</span>
                            </div>
                            <div class="detail-item-compact">
                                <span class="detail-label-compact">ผ่านมาแล้ว:</span>
                                <span class="detail-value-compact">${row["ผ่านมา(วัน)"] || "-"}</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-section-compact">
                        <div class="detail-section-title-compact"><i class="fas fa-user-gear"></i> การดำเนินการ</div>
                        <div class="detail-list-compact">
                            <div class="detail-item-compact">
                                <span class="detail-label-compact">วันที่ดำเนินการ:</span>
                                <span class="detail-value-compact">${row["วันที่ดำเนินการ"] || "-"}</span>
                            </div>
                            <div class="detail-item-compact">
                                <span class="detail-label-compact">วันที่คืนคลัง:</span>
                                <span class="detail-value-compact">${row["วันที่คืนคลัง"] || "-"}</span>
                            </div>
                            <div class="detail-item-compact">
                                <span class="detail-label-compact">ผู้ส่งคืน:</span>
                                <span class="detail-value-compact">${row["ผู้ส่งคืน"] || "-"}</span>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>

                <div style="margin: 20px 0 10px 0; font-weight: 700; color: #1e293b; font-size: 15px; display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                  <i class="fas fa-list-check" style="color: #007bff;"></i> รายการเครื่องในสาขา
                </div>
                ${tscTableHtml}
            `;
            tscStore_modalContent.innerHTML = html;
            tscStore_modal.style.display = "block";
        };
        detailTd.appendChild(btn);
        tr.appendChild(detailTd);

        tscStore_tableBody.appendChild(tr);
    });
    tscStore_updatePagination(data);
}

function tscStore_updatePagination(data) {
    if (!tscStore_pageNumbersContainer) return;

    const totalPages = Math.ceil(data.length / tscStore_itemsPerPage);
    tscStore_pageNumbersContainer.innerHTML = '';

    const startPage = Math.max(1, tscStore_currentPage - 1);
    const endPage = Math.min(totalPages, tscStore_currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const pageNumberButton = document.createElement("button");
        pageNumberButton.className = `page-number ${i === tscStore_currentPage ? 'active' : ''}`;
        pageNumberButton.textContent = i;
        pageNumberButton.onclick = () => {
            tscStore_currentPage = i;
            tscStore_filterAndRenderTable();
        };
        tscStore_pageNumbersContainer.appendChild(pageNumberButton);
    }
}
