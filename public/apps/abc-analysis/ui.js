// ใส่ URL ของ Web App ที่ได้จากการ Deploy Google Apps Script ที่นี่
const STATUS_UPDATE_ENDPOINT = statusGasUrl;

// Help modal
function openHelp() {
    const m = document.getElementById('helpModal');
    if (m) m.style.display = 'flex';
    const menu = document.getElementById('userMenu');
    if (menu) menu.style.display = 'none';
}

function closeHelp() {
    const m = document.getElementById('helpModal');
    if (m) m.style.display = 'none';
}

// --- API Health UI ---
window.updateHealthUI = function () {
    const health = window.apiHealth || {};
    const keys = Object.keys(health);
    let status = 'ok'; // ok, warning, error
    let errorCount = 0;
    let warningCount = 0;

    keys.forEach(k => {
        if (health[k].status === 'error') {
            status = 'error';
            errorCount++;
        } else if (health[k].status === 'warning' && status !== 'error') {
            status = 'warning';
            warningCount++;
        }
    });

    // Create or Update Indicator
    let btn = document.getElementById('api-health-btn');
    if (!btn) {
        const container = document.querySelector('.header-controls') || document.body;
        btn = document.createElement('button');
        btn.id = 'api-health-btn';
        btn.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 10000;
            padding: 10px 15px; border-radius: 30px; border: none;
            font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: all 0.3s; display: flex; align-items: center; gap: 8px;
        `;
        btn.onclick = showApiStatusModal;
        document.body.appendChild(btn);
    }

    if (status === 'ok') {
        btn.style.backgroundColor = '#2ecc71'; // Green
        btn.style.color = 'white';
        btn.innerHTML = '<span>Api OK</span>';
    } else if (status === 'warning') {
        btn.style.backgroundColor = '#f1c40f'; // Yellow
        btn.style.color = '#333';
        btn.innerHTML = `<span>⚠️ Check (${warningCount})</span>`;
    } else {
        btn.style.backgroundColor = '#e74c3c'; // Red
        btn.style.color = 'white';
        btn.innerHTML = `<span>❌ Error (${errorCount})</span>`;
    }
};

window.showApiStatusModal = function () {
    let modal = document.getElementById('api-status-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'api-status-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10001; display: none;
            justify-content: center; align-items: center;
        `;
        modal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 12px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto;">
                <h2 style="margin-top:0; color:#2c3e50; border-bottom:1px solid #eee; padding-bottom:10px;">API Health Status</h2>
                <table style="width:100%; border-collapse: collapse; margin-top:15px;">
                    <thead>
                        <tr style="background:#f8f9fa; color:#666;">
                            <th style="padding:10px; text-align:left;">Name</th>
                            <th style="padding:10px; text-align:center;">Status</th>
                            <th style="padding:10px; text-align:left;">Details</th>
                            <th style="padding:10px; text-align:right;">Time</th>
                        </tr>
                    </thead>
                    <tbody id="api-status-table-body"></tbody>
                </table>
                 <div style="margin-top:20px; text-align:right;">
                    <button onclick="document.getElementById('api-status-modal').style.display='none'" 
                        style="padding:8px 20px; background:#95a5a6; color:white; border:none; border-radius:6px; cursor:pointer;">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    const tbody = document.getElementById('api-status-table-body');
    tbody.innerHTML = '';
    const health = window.apiHealth || {};

    // Sort keys: Errors first, then Warnings, then OK
    const keys = Object.keys(health).sort((a, b) => {
        const order = { 'error': 0, 'warning': 1, 'ok': 2 };
        return order[health[a].status] - order[health[b].status];
    });

    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; color:#999;">No API calls recorded yet.</td></tr>';
    } else {
        keys.forEach(k => {
            const item = health[k];
            const color = item.status === 'ok' ? '#2ecc71' : (item.status === 'warning' ? '#f1c40f' : '#e74c3c');
            const icon = item.status === 'ok' ? '✅' : (item.status === 'warning' ? '⚠️' : '❌');
            const time = new Date(item.timestamp).toLocaleTimeString();

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #eee';
            tr.innerHTML = `
                <td style="padding:10px; font-weight:bold; color:#34495e;">${k}</td>
                <td style="padding:10px; text-align:center;"><span style="color:${color}; font-weight:bold;">${icon} ${item.status.toUpperCase()}</span></td>
                <td style="padding:10px; color:#555; font-size:0.9em;">${item.details}</td>
                <td style="padding:10px; text-align:right; color:#999; font-size:0.8em;">${time}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    modal.style.display = 'flex';
};

function populateOwnerFilter(dataList) {
    const sel = document.getElementById("responsibleFilter");
    const current = sel.value;
    sel.innerHTML = '<option value="">ทุกคน</option>';
    const owners = new Map();
    let hasEmpty = false;
    (dataList || allData).forEach(r => {
        if (r.OwnerId) {
            if (!owners.has(r.OwnerId)) owners.set(r.OwnerId, r.OwnerName || r.OwnerId);
        } else {
            hasEmpty = true;
        }
    });
    if (hasEmpty) {
        const optEmpty = document.createElement("option");
        optEmpty.value = "__EMPTY__";
        optEmpty.textContent = "(ค่าว่าง)";
        sel.appendChild(optEmpty);
    }
    Array.from(owners.entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'th-TH'))
        .forEach(([id, name]) => {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = `${name} (${id})`;
            sel.appendChild(opt);
        });
    if (current && Array.from(sel.options).some(o => o.value === current)) {
        sel.value = current;
    } else {
        sel.value = "";
    }
}

function populateStatusFilter() {
    const statusFilter = document.getElementById("statusFilter");
    const current = statusFilter.value;
    statusFilter.innerHTML = '<option value="">ทุกสถานะ</option><option value="ไม่มีสถานะ">ค่าว่าง</option><option value="Dead">Dead</option>';
    const statusSet = new Set();
    allData.forEach(r => {
        if (r.Status && r.Status.trim() !== "") statusSet.add(r.Status.trim());
    });
    if (selectedPlant === "0326") {
        statusSet.add("Order");
    }
    Array.from(statusSet).sort().forEach(s => {
        const opt = document.createElement("option");
        opt.value = s; opt.textContent = s;
        statusFilter.appendChild(opt);
    });
    if (current && Array.from(statusFilter.options).some(o => o.value === current)) {
        statusFilter.value = current;
    } else {
        statusFilter.value = "";
    }
}

function populatePrgFilter() {
    const sel = document.getElementById("prgFilter");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">ทุก PRG</option>';
    const set = new Set();
    allData.forEach(r => {
        const prg = (r.PurchasingGroup || "").toString().trim();
        if (prg) set.add(prg);
    });
    Array.from(set).sort().forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        sel.appendChild(opt);
    });
    if (current && Array.from(sel.options).some(o => o.value === current)) sel.value = current;
    else sel.value = "";
}

function populateProductFilter(dataList) {
    const sel = document.getElementById("productFilter");
    const list = document.getElementById("productFilterList");
    if (!sel || !list) return;
    const current = sel.value;
    list.innerHTML = "";
    const set = new Set();
    (dataList || allData).forEach(r => {
        const product = (r.Product || "").toString().trim();
        if (product) set.add(product);
    });
    Array.from(set).sort().forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        list.appendChild(opt);
    });
    if (current && Array.from(set).includes(current)) sel.value = current;
}

function populateOrderSelectFilter(dataList) {
    const sel = document.getElementById("orderSelectFilter");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">ทั้งหมด</option>';
    const set = new Set();
    (dataList || allData).forEach(r => {
        const v = (r.OrderSelect || "").toString().trim();
        if (v) set.add(v);
    });
    Array.from(set).sort().forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
    });
    if (current && Array.from(sel.options).some(o => o.value === current)) sel.value = current;
    else sel.value = "";
}

function populateComeonFilter(dataList) {
    const sel = document.getElementById("comeonFilter");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">ทั้งหมด</option>';
    const set = new Set();
    (dataList || allData).forEach(r => {
        const v = (r.Comeon || "").toString().trim();
        if (v) set.add(v);
    });
    Array.from(set).sort().forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
    });
    if (current && Array.from(sel.options).some(o => o.value === current)) sel.value = current;
    else sel.value = "";
}

function setDefaultAndCalculate() {
    document.getElementById("statusFilter").value = "";
    document.getElementById("searchInput").value = "";
    document.getElementById("responsibleFilter").value = "";
    document.getElementById("prgFilter").value = "";
    const navFilter = document.getElementById("navanakornFilter");
    if (navFilter) navFilter.value = "";
    mode = "all"; abcFilter = ""; movingFilter = "";
    populateStatusFilter();
    populatePrgFilter();

    // ตั้งค่าวันที่เริ่มต้นเป็นวันนี้ (ถ้ายังว่าง)
    const dateInput = document.getElementById("orderRoundDate");
    if (dateInput && !dateInput.value) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${y}-${m}-${d}`;
    }

    applyFiltersAndRender();

    // ผูก Event Listener ให้ Date Picker
    if (dateInput && !dateInput.hasAttribute('data-bound')) {
        dateInput.addEventListener('change', () => {
            // เมื่อเปลี่ยนวันที่ ให้โหลดข้อมูล cloud ใหม่
            if (typeof loadActualOrdersFromCloud === 'function') {
                loadActualOrdersFromCloud(); // โหลดใหม่ตามวันที่เลือก
            } else {
                applyFiltersAndRender();
            }
        });
        dateInput.setAttribute('data-bound', 'true');
    }
}

function applyFiltersAndRender(preservePage = false) {
    let data = [...allData];
    calcABCValue();
    data = data.filter(r => Number(r.Unrestricted || 0) > 0 || Number(r.Qty6Month || 0) > 0);

    const search = document.getElementById("searchInput").value.toLowerCase();
    if (search) {
        data = data.filter(r => {
            return Object.values(r).some(val => {
                if (val === null || val === undefined) return false;
                if (typeof val === 'object') return false;
                return String(val).toLowerCase().includes(search);
            });
        });
    }

    const statusVal = document.getElementById("statusFilter").value;
    if (statusVal) {
        if (statusVal === "ไม่มีสถานะ") {
            data = data.filter(r => !r.Status || r.Status.trim() === "");
        } else if (statusVal === "Dead") {
            data = data.filter(r => Number(r.Qty6Month || 0) === 0);
        } else {
            data = data.filter(r => r.Status === statusVal);
        }
    }

    const prgVal = document.getElementById("prgFilter").value;
    if (prgVal) {
        data = data.filter(r => (r.PurchasingGroup || "").toString().trim() === prgVal);
    }
    const orderSelVal = document.getElementById("orderSelectFilter")?.value || "";
    if (orderSelVal) {
        data = data.filter(r => (r.OrderSelect || "") === orderSelVal);
    }
    const comeonVal = document.getElementById("comeonFilter")?.value || "";
    if (comeonVal) {
        data = data.filter(r => (r.Comeon || "") === comeonVal);
    }

    // Toggle conditional Earliest PO columns visibility
    const dataTable = document.getElementById("dataTable");
    if (dataTable) {
        dataTable.classList.toggle("show-earliest-po", selectedPlant === "0301" && comeonVal.includes("เรียกเข้า"));
    }

    const productVal = document.getElementById("productFilter")?.value || "";
    if (productVal) {
        const needle = productVal.toString().trim().toLowerCase();
        data = data.filter(r => (r.Product || "").toString().trim().toLowerCase().includes(needle));
    }

    const params = {
        leadTime: parseInt(document.getElementById("leadTimeDays").value) || 5,
        safety: parseInt(document.getElementById("safetyDays").value) || 3,
        cover: parseInt(document.getElementById("coverDays").value) || 40
    };
    recalculateStockFields(data, params);

    let baseData = [...data];
    let viewData = [...data];

    if (mode === "onlyOrder") {
        viewData = viewData.filter(r => Math.round(r.RecommendedOrder || 0) >= 1);
    }
    else if (mode === "returnable") {
        viewData = viewData.filter(r => (r.ReturnQty || 0) > 0);
    }
    else if (mode === "out_of_stock") {
        viewData = viewData.filter(r =>
            Number(r.Navanakorn || 0) > 0 && Number(r.Unrestricted || 0) === 0
        );
    }
    else if (mode === "out_of_stock_wait") {
        viewData = viewData.filter(r =>
            Number(r.Navanakorn || 0) === 0 && Number(r.Unrestricted || 0) === 0
        );
    }

    populateOwnerFilter(viewData);
    if (typeof populateOrderSelectFilter === "function") {
        populateOrderSelectFilter(baseData);
    }
    if (typeof populateComeonFilter === "function") {
        populateComeonFilter(baseData);
    }
    if (typeof populateProductFilter === "function") {
        populateProductFilter(baseData);
    }
    const ownerVal = document.getElementById("responsibleFilter").value;
    if (ownerVal) {
        if (ownerVal === "__EMPTY__") {
            viewData = viewData.filter(r => !r.OwnerId);
            baseData = baseData.filter(r => !r.OwnerId);
        } else {
            viewData = viewData.filter(r => r.OwnerId === ownerVal);
            baseData = baseData.filter(r => r.OwnerId === ownerVal);
        }
    }

    const navVal = document.getElementById("navanakornFilter")?.value;
    if (navVal) {
        const matchNav = (r) => {
            const n = Number(r.Navanakorn || 0);
            if (navVal === "nav0") return n === 0;
            if (navVal === "navgt0") return n > 0;
            return true;
        };
        viewData = viewData.filter(matchNav);
        baseData = baseData.filter(matchNav);
    }

    const diffVal = document.getElementById("orderDiffFilter").value;
    if (diffVal) {
        const matchDiff = (r) => {
            const rec = Math.round(r.RecommendedOrder || 0);
            const act = Math.round(r.ActualOrder ?? 0);

            switch (diffVal) {
                case "ordered": return act > 0;
                case "pending": return rec >= 1 && act === 0;
                case "cancelled": return r._actualOrderTouched && act === 0;
                default: return true;
            }
        };
        viewData = viewData.filter(matchDiff);
        baseData = baseData.filter(matchDiff);
    }

    if (mode === "onlyOrder") {
        calcABCForMode(viewData, "order");
    } else if (mode === "returnable") {
        calcABCForMode(viewData, "return");
    } else {
        calcABCForMode(viewData, "normal");
    }

    if (abcFilter) {
        viewData = viewData.filter(r => r.ABCValue === abcFilter);
    }
    if (movingFilter) {
        viewData = viewData.filter(r => r.Moving === movingFilter);
    }

    filteredData = [...viewData];

    const numericSortKeys = new Set(["PrOutstanding", "PoOutstanding"]);
    filteredData.sort((a, b) => {
        let x = a[sortKey] ?? 0;
        let y = b[sortKey] ?? 0;
        if (numericSortKeys.has(sortKey)) {
            const nx = Number(x);
            const ny = Number(y);
            const ax = Number.isNaN(nx) ? 0 : nx;
            const ay = Number.isNaN(ny) ? 0 : ny;
            return sortDir === "asc" ? ax - ay : ay - ax;
        }
        if (typeof x === "string") x = x.toLowerCase();
        if (typeof y === "string") y = y.toLowerCase();
        if (x === y) return 0;
        return sortDir === "asc" ? (x > y ? 1 : -1) : (x < y ? 1 : -1);
    });

    if (!preservePage) {
        currentPage = 1;
    }
    renderTable();
    renderPagination();
    updateAllCards(baseData, filteredData);
    updateActiveCards();
}

function updateActiveCards() {
    const setActive = (id, active) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("card-active", active);
    };
    const setDimGroup = (ids, activeId) => {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle("card-dim", Boolean(activeId) && id !== activeId);
        });
    };
    const cardIds = [
        "cardTotalStock",
        "cardOrderItems",
        "cardReturnValue",
        "cardOutOfStock",
        "cardOutOfStockWait",
        "abcA",
        "abcB",
        "abcC",
        "cardFast",
        "cardMedium",
        "cardSlow",
        "cardSlowly",
        "cardDead"
    ];
    const mainFilterIds = [
        "cardTotalStock",
        "cardOrderItems",
        "cardReturnValue",
        "cardOutOfStock",
        "cardOutOfStockWait"
    ];
    const abcFilterIds = ["abcA", "abcB", "abcC"];
    const movingFilterIds = ["cardFast", "cardMedium", "cardSlow", "cardSlowly", "cardDead"];
    cardIds.forEach(id => setActive(id, false));

    if (mode === "all") setActive("cardTotalStock", true);
    else if (mode === "onlyOrder") setActive("cardOrderItems", true);
    else if (mode === "returnable") setActive("cardReturnValue", true);
    else if (mode === OUT_OF_STOCK_MODE) setActive("cardOutOfStock", true);
    else if (mode === OUT_OF_STOCK_WAIT_MODE) setActive("cardOutOfStockWait", true);

    if (abcFilter === "A") setActive("abcA", true);
    else if (abcFilter === "B") setActive("abcB", true);
    else if (abcFilter === "C") setActive("abcC", true);

    if (movingFilter === "Fast") setActive("cardFast", true);
    else if (movingFilter === "Medium") setActive("cardMedium", true);
    else if (movingFilter === "Slow") setActive("cardSlow", true);
    else if (movingFilter === "Slowly") setActive("cardSlowly", true);
    else if (movingFilter === "Non Moving") setActive("cardDead", true);

    const activeMainId =
        mode === "all" ? "cardTotalStock" :
            mode === "onlyOrder" ? "cardOrderItems" :
                mode === "returnable" ? "cardReturnValue" :
                    mode === OUT_OF_STOCK_MODE ? "cardOutOfStock" :
                        mode === OUT_OF_STOCK_WAIT_MODE ? "cardOutOfStockWait" : "";
    const activeAbcId =
        abcFilter === "A" ? "abcA" :
            abcFilter === "B" ? "abcB" :
                abcFilter === "C" ? "abcC" : "";
    const activeMovingId =
        movingFilter === "Fast" ? "cardFast" :
            movingFilter === "Medium" ? "cardMedium" :
                movingFilter === "Slow" ? "cardSlow" :
                    movingFilter === "Slowly" ? "cardSlowly" :
                        movingFilter === "Non Moving" ? "cardDead" : "";

    setDimGroup(mainFilterIds, activeMainId);
    setDimGroup(abcFilterIds, activeAbcId);
    setDimGroup(movingFilterIds, activeMovingId);
}

function calcABCForMode(data, modeType) {
    let sorted = [...data];
    const getVal = (r) => {
        if (modeType === "order") {
            return (r.RecommendedOrder || 0) * (r.Unrestricted > 0 ? (r.Value / r.Unrestricted) : 0);
        }
        if (modeType === "return") {
            return (r.ReturnValue || 0);
        }
        return (r.Value || 0);
    };
    sorted.sort((a, b) => getVal(b) - getVal(a));
    const total = sorted.reduce((s, r) => s + getVal(r), 0);
    let cum = 0;
    sorted.forEach(r => {
        const val = getVal(r);
        cum += val;
        const pct = total ? (cum / total) * 100 : 0;
        const orig = data.find(x => x.Material === r.Material && x.Plant === r.Plant);
        if (orig) {
            orig.CumPercent = pct;
            orig.ABCValue = pct <= 70 ? "A" : pct <= 90 ? "B" : "C";
        }
    });
}

function updateAllCards(baseData, filteredData) {
    const abc = { A: 0, B: 0, C: 0 }, cntABC = { A: 0, B: 0, C: 0 };
    const mov = { Fast: 0, Medium: 0, Slow: 0, Slowly: 0, "Non Moving": 0 },
        cntMov = { Fast: 0, Medium: 0, Slow: 0, Slowly: 0, "Non Moving": 0 };

    let shortshipValue = 0, shortshipCount = 0;
    let shortshipWaitValue = 0, shortshipWaitCount = 0;

    baseData.forEach(r => {
        const nav = Number(r.Navanakorn || 0);
        const stock = Number(r.Unrestricted || 0);
        const value = r.Value || 0;

        if (nav > 0 && stock === 0) {
            shortshipValue += value;
            shortshipCount++;
        } else if (nav === 0 && stock === 0) {
            shortshipWaitValue += value;
            shortshipWaitCount++;
        }
    });

    if (document.getElementById("valOutOfStock")) {
        document.getElementById("valOutOfStock").textContent = formatShortCurrency(shortshipValue);
        document.getElementById("countOutOfStock").textContent = shortshipCount;
    }
    if (document.getElementById("valOutOfStockWait")) {
        document.getElementById("valOutOfStockWait").textContent = formatShortCurrency(shortshipWaitValue);
        document.getElementById("countOutOfStockWait").textContent = shortshipWaitCount;
    }

    filteredData.forEach(r => {
        let valueToUse = 0;
        if (mode === "onlyOrder") {
            valueToUse = (r.RecommendedOrder || 0) * (r.Unrestricted > 0 ? r.Value / r.Unrestricted : 0);
        } else if (mode === "returnable") {
            valueToUse = r.ReturnValue || 0;
        } else {
            valueToUse = r.Value || 0;
        }

        if (r.ABCValue && abc.hasOwnProperty(r.ABCValue)) {
            abc[r.ABCValue] += valueToUse;
            cntABC[r.ABCValue]++;
        }
        if (r.Moving && mov.hasOwnProperty(r.Moving)) {
            mov[r.Moving] += valueToUse;
            cntMov[r.Moving]++;
        }
    });

    document.getElementById("sumA").textContent = formatShortCurrency(abc.A);
    document.getElementById("sumB").textContent = formatShortCurrency(abc.B);
    document.getElementById("sumC").textContent = formatShortCurrency(abc.C);
    document.getElementById("countA").textContent = cntABC.A + " รายการ";
    document.getElementById("countB").textContent = cntABC.B + " รายการ";
    document.getElementById("countC").textContent = cntABC.C + " รายการ";

    document.getElementById("valFast").textContent = formatShortCurrency(mov.Fast);
    document.getElementById("valMedium").textContent = formatShortCurrency(mov.Medium);
    document.getElementById("valSlow").textContent = formatShortCurrency(mov.Slow);
    document.getElementById("valSlowly").textContent = formatShortCurrency(mov.Slowly);
    document.getElementById("valDead").textContent = formatShortCurrency(mov["Non Moving"]);
    document.getElementById("countFast").textContent = cntMov.Fast + " รายการ";
    document.getElementById("countMedium").textContent = cntMov.Medium + " รายการ";
    document.getElementById("countSlow").textContent = cntMov.Slow + " รายการ";
    document.getElementById("countSlowly").textContent = cntMov.Slowly + " รายการ";
    document.getElementById("countDead").textContent = cntMov["Non Moving"] + " รายการ";

    let dataForMainCards;
    if (mode === "onlyOrder") {
        dataForMainCards = baseData.filter(r => Math.round(r.RecommendedOrder || 0) >= 1);
    } else if (mode === "returnable") {
        dataForMainCards = baseData.filter(r => (r.ReturnQty || 0) > 0);
    } else {
        dataForMainCards = baseData;
    }

    let totalStock = 0, orderItems = 0, orderValue = 0,
        returnCount = 0, totalReturnValue = 0, totalCount = 0;

    dataForMainCards.forEach(r => {
        totalCount++;
        const unitPrice = r.Unrestricted > 0 ? r.Value / r.Unrestricted : 0;

        if (mode === "onlyOrder") {
            totalStock += (r.RecommendedOrder || 0) * unitPrice;
        } else if (mode === "returnable") {
            totalStock += r.ReturnValue || 0;
        } else {
            totalStock += r.Value || 0;
        }

        const qty = Math.round(r.RecommendedOrder || 0);
        if (qty > 0) {
            orderItems++;
            orderValue += qty * unitPrice;
        }
        if (r.ReturnQty > 0) {
            returnCount++;
            totalReturnValue += r.ReturnValue || 0;
        }
    });

    document.getElementById("totalStockValue").textContent = formatShortCurrency(totalStock);
    document.getElementById("orderTotalValue").textContent = formatShortCurrency(orderValue);
    document.getElementById("totalCount").textContent = totalCount + " รายการ";
    document.getElementById("orderItemCount").textContent = orderItems;
    document.getElementById("returnItemCount").textContent = returnCount + " รายการ";
    document.getElementById("returnValue").textContent = formatShortCurrency(totalReturnValue);

    let total_usage_4m_base = 0, totalStock_base = 0, totalReturnValue_base = 0;
    baseData.forEach(r => {
        totalStock_base += r.Value || 0;
        totalReturnValue_base += r.ReturnValue || 0;
        if (r.Unrestricted > 0) {
            const unit_price = r.Value / r.Unrestricted;
            total_usage_4m_base += (r.Qty4Month || 0) * unit_price;
        }
    });

    const monthly_withdrawal = total_usage_4m_base / 4 || 0;
    const daily_usage = total_usage_4m_base / 120 || 0;
    const stock_days = daily_usage > 0 ? Math.round(totalStock_base / daily_usage) : 'มาก';
    const after_stock_days = daily_usage > 0 ? Math.round((totalStock_base - totalReturnValue_base) / daily_usage) : 'มาก';

    document.getElementById("monthlyWithdrawalValue").textContent = formatShortCurrency(monthly_withdrawal);
    document.getElementById("stockDaysValue").textContent = stock_days > 9999 ? 'มาก' : stock_days;
    document.getElementById("afterStockDaysValue").textContent = after_stock_days > 9999 ? 'มาก' : after_stock_days;

    updateActualOrderSummary(baseData);
}

function updateActualOrderSummary(baseData) {
    const label = document.getElementById("actualOrderSummary");
    if (!label) return;
    const list = Array.isArray(baseData) ? baseData : [];
    if (list.length === 0) {
        label.textContent = "";
        return;
    }
    const orderList = list.filter(r => Math.round(r.RecommendedOrder || 0) >= 1);
    let count = 0;
    orderList.forEach(r => {
        const act = Number(r.ActualOrder);
        // นับถ้ายอดสั่งจริง > 0 (ไม่สนว่าเป็น Touched หรือ Load มา)
        if (!isNaN(act) && act > 0) count++;
    });
    label.textContent = `สั่งจริงค้างไว้: ${formatNumber(count)}/${formatNumber(orderList.length)} รายการ`;
}

function getStatusClass(status) {
    if (!status || status.trim() === '' || status.trim() === '-') return "status-empty";
    const s = status.toLowerCase().trim();
    const compact = s.replace(/[\s_-]+/g, '');
    if (s.includes('ยกเลิก') || s.includes('cancel') || s.includes('rejected') || s.includes('ปฏิเสธ') || s.includes('reject')) {
        return "status-rejected";
    }
    if (compact.includes('inactive') || compact.includes('nonactive') || s.includes('เลิกใช้') || s.includes('dead') || s.includes('stop') || s.includes('ไม่ใช้')) {
        return "status-rose";
    }
    if (compact.includes('bycase')) {
        return "status-pending";
    }
    if (s.includes('pending') || s.includes('รอดำเนินการ') || s.includes('รอ') || s.includes('hold') || s.includes('wait')) {
        return "status-orange";
    }
    if (s.includes('order') || s.includes('สั่ง') || s.includes('ขอซื้อ') || s.includes('เบิก') || s === 'po' || s === 'pr') {
        return "status-order";
    }
    if (s.includes('ทดแทน') || s.includes('rebuilt') || s.includes('เปลี่ยน')) {
        return "status-lime";
    }
    if (s.includes('return') || s.includes('คืน')) {
        return "status-purple";
    }
    if (s.includes('active') || s.includes('ใช้งาน') || s.includes('ปกติ') || s.includes('approved') || s.includes('อนุมัติ') || s.includes('approve') || s.includes('complete') || s.includes('เสร็จสิ้น') || s.includes('สำเร็จ')) {
        return "status-approved";
    }
    // Distinct deterministic color for every other unique Status string
    const palette = ["status-cyan", "status-pink", "status-indigo", "status-teal", "status-yellow", "status-coral"];
    let hash = 0;
    for (let i = 0; i < compact.length; i++) {
        hash = ((hash << 5) - hash) + compact.charCodeAt(i);
        hash |= 0;
    }
    return palette[Math.abs(hash) % palette.length];
}

let poModalBound = false;
function closePoModal() {
    const modal = document.getElementById("poModal");
    if (modal) modal.style.display = "none";
}

function bindPoModal() {
    if (poModalBound) return;
    const modal = document.getElementById("poModal");
    if (!modal) return;
    const closeBtn = document.getElementById("poModalClose");
    if (closeBtn) closeBtn.addEventListener("click", closePoModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closePoModal();
    });
    poModalBound = true;
}

function openPoModal(material, poList, leadTimeDays) {
    bindPoModal();
    const modal = document.getElementById("poModal");
    if (!modal) return;
    const label = document.getElementById("poMaterialLabel");
    const totalEl = document.getElementById("poTotalQty");
    const table = document.getElementById("poDetailTable");
    const tbody = table ? table.querySelector("tbody") : null;
    const empty = document.getElementById("poEmpty");
    if (label) label.textContent = material || "-";
    if (!tbody) return;
    tbody.innerHTML = "";
    const lt = Number(leadTimeDays) || 0;
    const hasData = Array.isArray(poList) && poList.length > 0;
    if (totalEl) {
        const sum = hasData ? poList.reduce((s, i) => s + (i.isTimestamped ? 0 : Number(i.Qty || 0)), 0) : 0;
        totalEl.textContent = formatNumber(sum);
    }
    if (table) table.style.display = hasData ? "table" : "none";
    if (empty) empty.style.display = hasData ? "none" : "block";
    if (hasData) {
        poList.forEach(item => {
            const tr = document.createElement("tr");
            if (item.isTimestamped) {
                tr.style.opacity = "0.45";
                tr.style.textDecoration = "line-through";
                tr.title = "PO นี้ถูกยืนยัน Supplier แล้ว";
            }
            const poNum = item.PurchasingDocument || "-";
            const poLink = poNum !== "-"
                ? `<a href="#" class="po-number-link" data-po="${poNum}">${poNum}</a>`
                : "-";
            // Calculate new delivery date = DocumentDate + Leadtime
            let newDateDisplay = item.DocumentDate || "-";
            let isOverdue = false;
            if (item.DocumentDate) {
                try {
                    let parsed = null;
                    const raw = item.DocumentDate.toString().trim();
                    // Try DD/MM/YYYY or DD.MM.YYYY
                    const dmy = raw.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
                    if (dmy) {
                        parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
                    }
                    // Try YYYY-MM-DD or YYYY/MM/DD
                    if (!parsed || isNaN(parsed.getTime())) {
                        const ymd = raw.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
                        if (ymd) {
                            parsed = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
                        }
                    }
                    // Fallback to native parsing
                    if (!parsed || isNaN(parsed.getTime())) {
                        parsed = new Date(raw);
                    }
                    if (parsed && !isNaN(parsed.getTime())) {
                        parsed.setHours(0, 0, 0, 0);
                        if (lt > 0) {
                            parsed.setDate(parsed.getDate() + lt);
                        }
                        const dd = String(parsed.getDate()).padStart(2, '0');
                        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                        const yyyy = parsed.getFullYear();
                        newDateDisplay = `${dd}/${mm}/${yyyy}`;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (parsed < today && !item.isTimestamped) {
                            isOverdue = true;
                        }
                    }
                } catch (e) { /* keep original */ }
            }
            const dateHtml = isOverdue
                ? `<span class="po-date-overdue" title="เลยกำหนดส่ง">${newDateDisplay}</span>`
                : `<span class="po-date-normal">${newDateDisplay}</span>`;
            const qtyBadge = `<span class="po-qty-pill">${formatNumber(item.Qty || 0)}</span>`;
            const ltBadge = lt > 0
                ? `<span class="po-lt-pill">${formatNumber(lt)} วัน</span>`
                : `<span style="color:#64748b;">-</span>`;
            tr.innerHTML = `
                <td>${dateHtml}</td>
                <td>${poLink}</td>
                <td class="po-qty">${qtyBadge}</td>
                <td class="po-qty">${ltBadge}</td>
            `;
            // Bind click on PO number link
            const link = tr.querySelector('.po-number-link');
            if (link) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    openPoByNumberModal(poNum);
                });
            }
            tbody.appendChild(tr);
        });
    }
    modal.style.display = "flex";
}

// ==========================================
// PO By Number Detail Modal
// ==========================================
let poByNumberModalBound = false;
let currentPoByNumber = "";
function closePoByNumberModal() {
    const modal = document.getElementById("poByNumberModal");
    if (modal) modal.style.display = "none";
}

function bindPoByNumberModal() {
    if (poByNumberModalBound) return;
    const modal = document.getElementById("poByNumberModal");
    if (!modal) return;
    const closeBtn = document.getElementById("poByNumberModalClose");
    if (closeBtn) closeBtn.addEventListener("click", closePoByNumberModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closePoByNumberModal();
    });
    const tsBtn = document.getElementById("poTimestampBtn");
    if (tsBtn) tsBtn.addEventListener("click", () => savePoTimestamp());
    poByNumberModalBound = true;
}

function openPoByNumberModal(poNumber) {
    bindPoByNumberModal();
    currentPoByNumber = poNumber;
    const modal = document.getElementById("poByNumberModal");
    if (!modal) return;
    const label = document.getElementById("poByNumberLabel");
    const table = document.getElementById("poByNumberDetailTable");
    const tbody = table ? table.querySelector("tbody") : null;
    const empty = document.getElementById("poByNumberEmpty");
    const statusEl = document.getElementById("poTimestampStatus");
    if (label) label.textContent = poNumber || "-";
    if (statusEl) statusEl.textContent = "";
    if (!tbody) return;
    tbody.innerHTML = "";

    // Find matching records from raw PO data
    const rawData = window.poRawData || [];
    const matches = rawData.filter(r => {
        const doc = (r["Purchase order"] || r["Purchase Order"] || r["PO"] || r["Purchasing Document"] || r["PurchasingDocument"] || "").toString().trim();
        return doc === poNumber;
    });

    const hasData = matches.length > 0;
    if (table) table.style.display = hasData ? "table" : "none";
    if (empty) empty.style.display = hasData ? "none" : "block";

    if (hasData) {
        matches.forEach(r => {
            const keys = Object.keys(r);
            const doc = (r["Purchase order"] || r["Purchase Order"] || r["PO"] || r["Purchasing Document"] || r["PurchasingDocument"] || "").toString().trim();

            // Find Document Date
            const dateKey = keys.find(k => {
                const lower = k.toLowerCase();
                return (lower.includes('document') && lower.includes('date')) || lower === 'document date';
            });
            const docDate = dateKey ? (r[dateKey] || '').toString().trim()
                : (r["Document Date"] || r["Doc Date"] || r["DocumentDate"] || "").toString().trim();

            // Find Material
            const matKey = keys.find(k => k.toLowerCase() === 'material' || k.toLowerCase().includes('material'));
            const material = matKey ? (r[matKey] || '').toString().trim() : "";

            // Find Short Text
            const shortTextKey = keys.find(k => k.toLowerCase().includes('short text') || k.toLowerCase() === 'shorttext' || k.toLowerCase() === 'short text');
            const shortText = shortTextKey ? (r[shortTextKey] || '').toString().trim() : (r["Short Text"] || r["ShortText"] || r["Description"] || "").toString().trim();

            // Find Still to be delivered (qty)
            const stillKey = keys.find(k => {
                const lower = k.toLowerCase();
                return (lower.includes('still') && lower.includes('deliver')) ||
                    (lower.includes('open') && (lower.includes('qty') || lower.includes('quantity')));
            });
            const reqKey = keys.find(k => {
                const lower = k.toLowerCase();
                return (lower.includes('quantity') || lower.includes('qty')) && (lower.includes('requested') || lower.includes('request'));
            });
            const toNum = (v) => { const n = parseFloat(String(v || 0).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
            const stillQty = toNum(stillKey ? r[stillKey] : (reqKey ? r[reqKey] : 0));

            const tr = document.createElement("tr");
            const isActiveMat = material && String(document.getElementById("poMaterialLabel")?.textContent || "").trim() === material;
            if (isActiveMat) tr.className = "po-highlight-mat-row";
            tr.innerHTML = `
                <td><span class="po-doc-code">${doc || "-"}</span></td>
                <td><span class="po-date-normal">${docDate || "-"}</span></td>
                <td><span class="po-mat-code">${material || "-"}</span></td>
                <td class="po-short-text">${shortText || "-"}</td>
                <td class="po-qty"><span class="po-qty-pill">${formatNumber(stillQty)}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
    modal.style.display = "flex";
}

async function savePoTimestamp() {
    const poNumber = currentPoByNumber;
    if (!poNumber) {
        alert("ไม่พบเลขที่ PO");
        return;
    }
    const btn = document.getElementById("poTimestampBtn");
    const statusEl = document.getElementById("poTimestampStatus");
    const originalText = btn ? btn.innerHTML : "";
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
        btn.disabled = true;
    }
    try {
        const now = new Date();
        const timestamp = now.toLocaleString('th-TH', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const user = (typeof loggedUser !== 'undefined' && loggedUser && loggedUser.Name) ? loggedUser.Name : "Unknown";
        const url = `${PO_SUPPLIER_ENDPOINT}?action=saveTimestamp&po=${encodeURIComponent(poNumber)}&timestamp=${encodeURIComponent(timestamp)}&user=${encodeURIComponent(user)}&supplier=${encodeURIComponent("Supplier")}`;
        await fetch(url, { method: "GET", mode: "no-cors" });
        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "success",
                title: "บันทึกสำเร็จ",
                text: `บันทึก Timestamp สำหรับ PO ${poNumber} แล้ว`,
                timer: 1800,
                showConfirmButton: false
            });
        } else {
            if (statusEl) {
                statusEl.textContent = "✅ บันทึกสำเร็จ";
                statusEl.style.color = "#27ae60";
            }
        }
    } catch (err) {
        console.error("savePoTimestamp error:", err);
        if (typeof Swal !== "undefined") {
            Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: "โปรดลองอีกครั้ง" });
        } else {
            if (statusEl) {
                statusEl.textContent = "❌ บันทึกไม่สำเร็จ";
                statusEl.style.color = "#e74c3c";
            }
        }
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

let prModalBound = false;
function closePrModal() {
    const modal = document.getElementById("prModal");
    if (modal) modal.style.display = "none";
}
function bindPrModal() {
    if (prModalBound) return;
    const modal = document.getElementById("prModal");
    if (!modal) return;
    const closeBtn = document.getElementById("prModalClose");
    if (closeBtn) closeBtn.addEventListener("click", closePrModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closePrModal();
    });
    prModalBound = true;
}
function openPrModal(material, prList) {
    bindPrModal();
    const modal = document.getElementById("prModal");
    if (!modal) return;
    const label = document.getElementById("prMaterialLabel");
    const totalEl = document.getElementById("prTotalQty");
    const table = document.getElementById("prDetailTable");
    const tbody = table ? table.querySelector("tbody") : null;
    const empty = document.getElementById("prEmpty");
    if (label) label.textContent = material || "-";
    if (!tbody) return;
    tbody.innerHTML = "";
    const hasData = Array.isArray(prList) && prList.length > 0;
    if (totalEl) {
        const sum = hasData ? prList.reduce((s, i) => s + Number(i.Qty || 0), 0) : 0;
        totalEl.textContent = formatNumber(sum);
    }
    if (table) table.style.display = hasData ? "table" : "none";
    if (empty) empty.style.display = hasData ? "none" : "block";
    if (hasData) {
        prList.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${item.PrNumber || "-"}</td>
                <td>${formatDateFromYMD(item.DeliveryDate) || "-"}</td>
                <td class="po-qty">${formatNumber(item.Qty || 0)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    modal.style.display = "flex";
}

let rebuiltModalBound = false;
function closeRebuiltModal() {
    const modal = document.getElementById("rebuiltModal");
    if (modal) modal.style.display = "none";
    lastRebuiltKey = "";
}
function bindRebuiltModal() {
    if (rebuiltModalBound) return;
    const modal = document.getElementById("rebuiltModal");
    if (!modal) return;
    const closeBtn = document.getElementById("rebuiltModalClose");
    if (closeBtn) closeBtn.addEventListener("click", closeRebuiltModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeRebuiltModal();
    });
    rebuiltModalBound = true;
}
let lastRebuiltKey = "";
function openRebuiltModal(rowData) {
    const key = `${rowData.Material || ""}__${rowData.Rebuilt || ""}`;
    let modal = document.getElementById("rebuiltModal");
    if (modal && modal.style.display === "flex" && lastRebuiltKey === key) {
        closeRebuiltModal();
        return;
    }
    lastRebuiltKey = key;
    bindRebuiltModal();
    modal = document.getElementById("rebuiltModal");
    if (!modal) return;
    const matEl = document.getElementById("rebuiltMaterialLabel");
    const codeEl = document.getElementById("rebuiltCodeLabel");
    const qtyEl = document.getElementById("rebuiltQtyLabel");
    const tbody = document.getElementById("rebuiltDetailTable")?.querySelector("tbody");

    if (matEl) matEl.textContent = rowData.Material || "-";
    if (codeEl) codeEl.textContent = rowData.Rebuilt || "-";
    if (qtyEl) qtyEl.textContent = formatNumber(rowData.RebuiltStock || 0);

    if (tbody) {
        // รวมข้อมูลคู่ Rebuilt (เชื่อมไป-กลับ)
        const pairRows = (() => {
            const set = new Set();
            if (rowData.Material) set.add(rowData.Material);
            if (rowData.Rebuilt) set.add(rowData.Rebuilt);
            // เพิ่มรายการที่อ้างถึง material นี้เป็น Rebuilt
            allData.forEach(x => {
                if (rowData.Material && x.Rebuilt === rowData.Material) set.add(x.Material);
                if (rowData.Rebuilt && x.Rebuilt === rowData.Rebuilt) set.add(x.Material);
            });
            // รวมผลลัพธ์
            return allData.filter(x => set.has(x.Material));
        })();

        tbody.innerHTML = "";
        if (pairRows.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="14" style="text-align:center;color:#7f8c8d;padding:12px;">ไม่มีข้อมูล Rebuilt ที่เกี่ยวข้อง</td>`;
            tbody.appendChild(tr);
        } else {
            pairRows.forEach(item => {
                const rebuiltQty = Number(toNumber(item.RebuiltStock || 0));
                const meanVal = Number(item.Mean || 0);
                const safetyVal = Number(item.SafetyStock || 0);
                const ropVal = Number(item.ROP || 0);
                const dosVal = item.DOS > 9999 ? 'มาก' : (Number(item.DOS || 0)).toFixed(1);
                const avgMVal = Number(item.AvgMonthly || 0);
                const rowHtml = `
                    <td>${item.Material}</td>
                    <td>${item.Description || ""}</td>
                    <td>${item.StorageBin || ""}</td>
                    <td>${rebuiltQty > 0 ? formatNumber(rebuiltQty) : ""}</td>
                    <td>${formatNumber(item.Unrestricted || 0)}</td>
                    <td>${item.SubtotalAllPlant != null ? formatNumber(item.SubtotalAllPlant) : "-"}</td>
                    <td>${formatCurrency(item.Value || 0)}</td>
                    <td>${item.LeadTimeDays != null ? formatNumber(item.LeadTimeDays) : ""}</td>
                    <td>${formatNumber(item.Qty6Month || 0)}</td>
                    <td>${formatNumber(item.Qty4Month || 0)}</td>
                    <td>${formatNumber(item.Qty3Month || 0)}</td>
                    <td>${formatNumber(item.Qty2Month || 0)}</td>
                    <td>${formatNumber(item.ThirtyDay || 0)}</td>
                    <td>${avgMVal.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td>${meanVal.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td>${safetyVal.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td>${ropVal.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td>${dosVal}</td>
                    <td>${formatNumber(item.PrOutstanding || 0)}</td>
                    <td>${formatNumber(item.PoOutstanding || 0)}</td>
                    <td>${formatNumber(item.RecommendedOrder || 0)}</td>
                    <td>${formatNumber(item.ActualOrder ?? 0)}</td>
                    <td>${item.Note || ""}</td>
                    <td>${item.Rebuilt || ""}</td>
                    <td>${item.Status || ""}</td>
                `;
                const tr = document.createElement("tr");
                tr.innerHTML = rowHtml;
                tbody.appendChild(tr);
            });
        }
    }
    modal.style.display = "flex";
}

let recModalBound = false;
let currentRecRow = null;
const EXPRESS_ENDPOINT = "https://script.google.com/macros/s/AKfycbycEiGdjEFmLSPSqgBUBBntG0OnaatLTkNozlZTn0RRgZHiuL9HCWisIsmMqth9Dzrv/exec";
let lastExpressPending = null; // เก็บยอดล่าสุดไว้ใช้กรณีดึง opensheet ไม่ได้
function setRecSpinner(show) {
    const sp = document.getElementById("recSpinner");
    const overlay = document.getElementById("recOverlaySpinner");
    if (sp) sp.style.display = show ? "inline-flex" : "none";
    if (overlay) overlay.style.display = show ? "flex" : "none";
}
async function refreshExpressDataFor0326() {
    if (selectedPlant !== "0326" || !express0326Url) return;
    try {
        // อ่านผ่าน opensheet (cors-friendly) ไม่ต้อง cache-bust เพื่อลด 400
        const res = await fetch(express0326Url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        const map = new Map();
        if (Array.isArray(rows)) {
            rows.forEach(r => {
                const plantVal = (r.Plant || r.plant || "").toString().trim();
                if (plantVal && plantVal !== "0326") return;
                const material = (r.material || r.Material || "").toString().trim();
                if (!material) return;
                const statusVal = (r.status || r.Status || "").toString().trim();
                if (statusVal && statusVal !== "รอเบิก") return;
                const qty = toNumber(r.quantity || r.Qty || r.Quantity || 0);
                if (!Number.isFinite(qty)) return;
                map.set(material, (map.get(material) || 0) + qty);
            });
        }
        if (lastExpressPending && lastExpressPending.material) {
            const cur = map.get(lastExpressPending.material) || 0;
            // ถ้าในชีทยังไม่มียอดล่าสุด ให้แสดงรวมชั่วคราว
            if (cur === 0) {
                map.set(lastExpressPending.material, cur + (lastExpressPending.qty || 0));
            }
        }
        const updateOutExpress = (list) => {
            list.forEach(item => {
                if (item.Plant === "0326") {
                    const newSum = map.get(item.Material) || 0;
                    item.OutExpress = newSum;
                }
            });
        };
        updateOutExpress(allData);
        updateOutExpress(filteredData);
        renderTable();
        renderPagination();
        lastExpressPending = null;
    } catch (err) {
        console.warn("refreshExpressDataFor0326 fallback", err?.message || err);
        // fallback: ถ้าดึงไม่ได้ ให้บวกยอดล่าสุดเข้าไปอย่างน้อยในมุมมอง
        if (lastExpressPending && lastExpressPending.material) {
            const addQty = lastExpressPending.qty || 0;
            const applyAdd = (list) => {
                list.forEach(item => {
                    if (item.Plant === "0326" && item.Material === lastExpressPending.material) {
                        const current = Number(item.OutExpress || 0);
                        item.OutExpress = current + addQty;
                    }
                });
            };
            applyAdd(allData);
            applyAdd(filteredData);
            renderTable();
            renderPagination();
            // คง pending ไว้ เพื่อจะได้บวกทับเมื่อดึงสำเร็จรอบหน้า
        }
    }
}
function closeRecModal() {
    const modal = document.getElementById("recModal");
    if (modal) modal.style.display = "none";
    currentRecRow = null;
}
function bindRecModal() {
    if (recModalBound) return;
    const modal = document.getElementById("recModal");
    if (!modal) return;
    const closeBtn = document.getElementById("recModalClose");
    if (closeBtn) closeBtn.addEventListener("click", closeRecModal);
    // ไม่ปิดด้วยการคลิกพื้นหลัง ต้องกดปุ่ม X หรือจบ flow เท่านั้น
    const input = document.getElementById("recActualInput");
    if (input) {
        input.addEventListener("input", () => {
            if (!currentRecRow) return;
            const v = parseFloat(input.value);
            const act = isNaN(v) ? 0 : v;
            currentRecRow.ActualOrder = act;
            currentRecRow._actualOrderTouched = true;
            if (typeof saveActualOrdersToLocalStorage === "function") {
                saveActualOrdersToLocalStorage();
            }
            applyFiltersAndRender();
        });
    }
    const expressBtn = document.getElementById("recExpressBtn");
    if (expressBtn) {
        expressBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await sendExpressOrder();
        });
    }
    recModalBound = true;
}
function openRecModal(rowData) {
    if (selectedPlant !== "0326") return;
    bindRecModal();
    const modal = document.getElementById("recModal");
    if (!modal) return;
    currentRecRow = rowData;
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setText("recMat", rowData.Material || "-");
    setText("recDesc", rowData.Description || "-");
    setText("recBin", rowData.StorageBin || "");
    setText("recNav", formatNumber(rowData.Navanakorn || 0));
    setText("recStock", formatNumber(rowData.Unrestricted || 0));
    setText("rec30Day", formatNumber(rowData.ThirtyDay || 0));
    setText("recAvgM", (rowData.AvgMonthly || 0).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    setText("recMean", (rowData.Mean || 0).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    setText("recRecommend", formatNumber(rowData.RecommendedOrder || 0));
    const input = document.getElementById("recActualInput");
    if (input) {
        input.value = rowData.ActualOrder ?? rowData.RecommendedOrder ?? 0;
    }
    modal.style.display = "flex";
}

// =========================================
// Status Update Modal Logic
// =========================================
let statusModalBound = false;
let currentStatusRow = null;
let selectedStatusVal = "";

function closeStatusModal() {
    const modal = document.getElementById("statusModal");
    if (modal) modal.style.display = "none";
    currentStatusRow = null;
    selectedStatusVal = "";
}

function bindStatusModal() {
    if (statusModalBound) return;
    const modal = document.getElementById("statusModal");
    if (!modal) return;

    // Close buttons
    const closeBtn = document.getElementById("statusModalClose");
    const cancelBtn = document.getElementById("btnCancelStatus");
    if (closeBtn) closeBtn.addEventListener("click", closeStatusModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeStatusModal);

    // Select buttons
    const btns = modal.querySelectorAll(".status-select-btn");
    btns.forEach(btn => {
        btn.addEventListener("click", () => {
            btns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedStatusVal = btn.getAttribute("data-val");
        });
    });

    // Save button
    const saveBtn = document.getElementById("btnSaveStatus");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            if (!currentStatusRow || !selectedStatusVal) {
                alert("กรุณาเลือกสถานะ");
                return;
            }
            await saveStatusToSheet(currentStatusRow, selectedStatusVal);
        });
    }

    statusModalBound = true;
}

function openStatusModal(rowData) {
    bindStatusModal();
    const modal = document.getElementById("statusModal");
    if (!modal) return;
    currentStatusRow = rowData;
    selectedStatusVal = "";

    // Reset buttons
    const btns = modal.querySelectorAll(".status-select-btn");
    btns.forEach(b => b.classList.remove("active"));

    // Set text
    document.getElementById("stPlant").textContent = rowData.Plant || "-";
    document.getElementById("stMaterial").textContent = rowData.Material || "-";
    document.getElementById("stDesc").textContent = rowData.Description || "-";
    document.getElementById("stCurrent").textContent = rowData.Status || "ไม่มีสถานะ";

    modal.style.display = "flex";
}

async function saveStatusToSheet(row, newStatus) {
    // แสดง Loading หรือเปลี่ยนข้อความปุ่มก็ได้ (ในที่นี้ใช้ alert ง่ายๆ หรือ Swal ถ้ามี)
    const saveBtn = document.getElementById("btnSaveStatus");
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "กำลังบันทึก...";
    saveBtn.disabled = true;

    try {
        const user = (loggedUser && loggedUser.Name) ? loggedUser.Name : "Unknown";

        // ป้องกัน Google Sheet ตัดเลข 0 นำหน้า (เช่น 0304 -> 304) โดยเติม ' นำหน้า
        let plantParam = row.Plant || "";
        if (plantParam.toString().startsWith("0")) plantParam = `'${plantParam}`;

        // ป้องกัน Google Sheet ตัดเลข 0 นำหน้า Material หรือแปลงเป็นตัวเลข โดยเติม ' นำหน้า
        let materialParam = row.Material || "";
        materialParam = `'${materialParam}`;

        // ใช้ GET request แบบ no-cors (หรือ cors ถ้า script รองรับ)
        // ส่งพารามิเตอร์ไปกับ URL
        const url = `${STATUS_UPDATE_ENDPOINT}?action=updateStatus&plant=${encodeURIComponent(plantParam)}&material=${encodeURIComponent(materialParam)}&description=${encodeURIComponent(row.Description)}&status=${encodeURIComponent(newStatus)}&user=${encodeURIComponent(user)}`;

        await fetch(url, { method: "GET", mode: "no-cors" });

        // อัปเดตหน้าจอทันที (Optimistic update)
        row.Status = newStatus;

        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "success",
                title: "บันทึกสำเร็จ",
                text: `อัปเดตสถานะเป็น ${newStatus} แล้ว`,
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            alert("บันทึกสำเร็จ");
        }
        closeStatusModal();
        populateStatusFilter();
        applyFiltersAndRender(true); // รีเฟรชตาราง โดยไม่รีเซ็ตหน้า

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function sendExpressOrder() {
    if (selectedPlant !== "0326" || !currentRecRow) return;
    const input = document.getElementById("recActualInput");
    const qty = input ? Number(input.value || 0) : 0;
    setRecSpinner(true);
    const payload = {
        material: currentRecRow.Material || "",
        description: currentRecRow.Description || "",
        quantity: qty,
        contact: "000000000",
        employeeCode: (loggedUser && loggedUser.IDUser) ? loggedUser.IDUser : "",
        team: (loggedUser && (loggedUser.Department || loggedUser['หน่วยงาน'])) ? (loggedUser.Department || loggedUser['หน่วยงาน']) : "",
        employeeName: (loggedUser && loggedUser.Name) ? loggedUser.Name : "",
        callNumber: "Stock",
        callType: "I",
        remark: "Express",
        plant: selectedPlant
    };
    try {
        // ใช้ GET + no-cors เพื่อลดปัญหา CORS (ไม่สามารถอ่าน response แต่จะส่งคำขอออกไป)
        const params = new URLSearchParams();
        params.set("action", "insertRequest");
        params.set("payload", JSON.stringify(payload));
        const url = `${EXPRESS_ENDPOINT}?${params.toString()}`;
        await fetch(url, { method: "GET", mode: "no-cors" });
        lastExpressPending = { material: payload.material, qty };
        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "success",
                title: 'ส่งคำขอ "สั่งนอกรอบ" แล้ว',
                text: "ถ้ายังไม่เห็นผล ให้ตรวจสอบใน Google Sheet",
                confirmButtonText: "ตกลง",
                confirmButtonColor: "#2d7ff9"
            }).then(() => {
                closeRecModal();
                setTimeout(() => {
                    if (selectedPlant === "0326" && typeof refreshExpressDataFor0326 === "function") {
                        refreshExpressDataFor0326();
                    }
                }, 5000);
            });
        } else {
            alert('ส่งคำขอ "สั่งนอกรอบ" แล้ว (ถ้ายังไม่เห็นผล ให้ตรวจสอบใน Google Sheet)');
            closeRecModal();
            setTimeout(() => {
                if (selectedPlant === "0326" && typeof refreshExpressDataFor0326 === "function") {
                    refreshExpressDataFor0326();
                }
            }, 5000);
        }
    } catch (err) {
        console.error("express order error", err);
        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "error",
                title: "บันทึกไม่สำเร็จ",
                text: "โปรดลองอีกครั้ง",
                confirmButtonText: "ตกลง",
                confirmButtonColor: "#e74c3c"
            });
        } else {
            alert("บันทึกไม่สำเร็จ โปรดลองอีกครั้ง");
        }
    }
    setRecSpinner(false);
}

function renderTable() {
    const container = document.getElementById("dataList");
    container.innerHTML = "";
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);
    if (pageData.length === 0) {
        container.innerHTML = `<tr><td colspan="44" style="text-align:center;padding:50px;color:#95a5a6;font-size:16px;">ไม่มีข้อมูลตามเงื่อนไข</td></tr>`;
        return;
    }
    const fragment = document.createDocumentFragment();
    pageData.forEach(r => {
        const orderQty = r.RecommendedOrder || 0;
        const actual = r.ActualOrder || 0;
        const rebuiltDisplay = (() => {
            const txt = (r.Rebuilt ?? "").toString().trim();
            return (txt === "0") ? "" : txt;
        })();
        const fmtQty = (v) => {
            const n = Number(v) || 0;
            return (n % 1 === 0)
                ? formatNumber(n)
                : n.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        };
        const fmtUsage = (v) => {
            const n = Number(v || 0);
            if (n === 0) {
                return `<span class="nava-red">0</span>`;
            }
            return formatNumber(n);
        };
        const fmtQtyInput = (v) => {
            if (v === null || v === undefined || v === "") return "";
            const n = Number(v);
            if (Number.isNaN(n)) return "";
            return (n % 1 === 0) ? String(Math.round(n)) : n.toFixed(1);
        };
        let orderClass;
        if (actual < orderQty) {
            orderClass = "order-less";
        } else if (actual > orderQty) {
            orderClass = "order-more";
        } else {
            orderClass = "order-equal";
        }
        const isActualSuccess = Math.round(r.ActualOrder ?? 0) > 0;
        const isCancelled = r._actualOrderTouched && Math.round(r.ActualOrder ?? 0) === 0;
        // เงื่อนไข Wait: ไม่ใช่ Success, ไม่ใช่ยกเลิก และมีคำแนะนำสั่ง > 0
        const isWait = !isActualSuccess && !isCancelled && Math.round(r.RecommendedOrder || 0) > 0;

        let successText = "";
        let successClass = "";
        if (isActualSuccess) {
            successText = "Success";
            successClass = "success-badge";
        } else if (isCancelled) {
            successText = "ยกเลิก";
            successClass = "success-badge-red";
        } else if (isWait) {
            successText = "Wait";
            successClass = "success-badge-orange";
        }

        const successHtml = successText
            ? `<span class="${successClass}">${successText}</span>`
            : "";
        const statusClass = getStatusClass(r.Status);
        const displayStatus = r.Status && r.Status.trim() !== '' ? r.Status : "-";
        const ownerDisplay = r.OwnerName || (r.OwnerId || "-");
        const navClass = (Number(r.Navanakorn || 0) === 0) ? "nava-red" : "nava-orange";
        const navanakornHtml = `<span class="${navClass}">${formatNumber(r.Navanakorn || 0)}</span>`;
        let stockClass = "stock-green";
        if (Number(r.Unrestricted || 0) === 0) {
            stockClass = "nava-red";
        }
        const unrestrictedHtml = `
            <span class="${stockClass}">${formatNumber(r.Unrestricted)}</span>
        `;
        const subtotalVal = (r.SubtotalAllPlant != null) ? r.SubtotalAllPlant : null;
        let subtotalDisplay = "-";
        let subtotalClass = "subtotal-badge";
        if (subtotalVal != null) {
            subtotalDisplay = formatNumber(subtotalVal);
            if (subtotalVal === 0) {
                subtotalClass = "subtotal-badge subtotal-zero";
            } else {
                subtotalClass = "subtotal-badge subtotal-normal";
            }
        }
        const poOutstanding = Number((r.PoOutstandingDisplay ?? r.PoOutstanding) || 0);
        const poHtml = poOutstanding > 0
            ? `<span class="po-badge">${formatNumber(poOutstanding)}</span>`
            : formatNumber(poOutstanding);
        const rebuiltQty = Number(toNumber(r.RebuiltStock || 0));
        const rebuiltHtml = rebuiltQty > 0
            ? `<span class="rb-badge">${formatNumber(rebuiltQty)}</span>`
            : "";
        const thirtyDayVal = Number(r.ThirtyDay || 0);
        const thirtyDayHtml = thirtyDayVal > 0
            ? `<span class="nava-orange">${formatNumber(thirtyDayVal)}</span>`
            : `<span class="nava-red">0</span>`;
        const meanVal = Number(r.Mean || 0);
        const meanHtml = `<span class="mean-badge">${meanVal.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>`;
        const dosDisplay = r.DOS > 9999 ? 'มาก' : r.DOS.toFixed(1);
        const dosHtml = (r.DOS < 7) ? `<span class="nava-red">${dosDisplay}</span>` : dosDisplay;
        const row = document.createElement("tr");
        row.innerHTML = `
    <td>${r.Plant}</td>
    <td class="status-col-cell"><span class="${statusClass}">${displayStatus}</span></td>
    <td>${r.Material}</td>
    <td>${r.Description}</td>
    <td>${r.StorageBin}</td>
    <td class="rb-col">${rebuiltHtml}</td>
    <td class="nav-col">${navanakornHtml}</td>
    <td>${unrestrictedHtml}</td>
    <td class="subtotal-col"><span class="${subtotalClass}">${subtotalDisplay}</span></td>
    <td><span class="${Number(r.Value || 0) === 0 ? 'nava-red' : 'badge-value'}">${formatCurrency(r.Value)}</span></td>
    <td class="lt-col">${((selectedPlant === "0301" || selectedPlant === "0326") && r.LeadTimeDays) ? formatNumber(r.LeadTimeDays) : ''}</td>
    <td>${fmtUsage(r.Qty6Month)}</td>
    <td>${fmtUsage(r.Qty4Month)}</td>
    <td>${fmtUsage(r.Qty3Month)}</td>
    <td>${fmtUsage(r.Qty2Month)}</td>
    <td>${thirtyDayHtml}</td>
    <td class="sale-col">${Number(r.Sale || 0) > 0 ? `<span class="badge-sale">${formatNumber(r.Sale)}</span>` : ""}</td>
    <td>${r.AvgMonthly.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
    <td>${meanHtml}</td>
    <td>${Number(r.SafetyStock || 0).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
    <td>${Number(r.ROP || 0).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
   <td>${dosHtml}</td>
   <td class="pr-cell pr-col">${(r.PrOutstanding || 0) > 0 ? `<span class="badge-pr">${formatNumber(r.PrOutstanding)}</span>` : formatNumber(r.PrOutstanding || 0)}</td>
   <td class="po-cell po-col">${poHtml}</td>
   <td class="earliest-po-col date-cell">${r.EarliestPoDate || ""}</td>
   <td class="earliest-po-col">${r.EarliestPoNumber || ""}</td>
   <td class="earliest-po-col po-qty-cell">${r.EarliestPoQty != null ? formatNumber(r.EarliestPoQty) : ""}</td>
   <td class="rec-cell">
    <span class="order-span ${orderClass}">
        ${fmtQty(orderQty)}
    </span>
</td>
   <td>
   <input type="number"
           class="actual-order-input"
           min="0"
           value="${fmtQtyInput((r.ActualOrder ?? r.RecommendedOrder) ?? '')}"
           style="width:80px;padding:4px 6px;border-radius:6px;border:1px solid #ccd1ff;text-align:right;">
</td>
   <td class="express-col">${(Number(r.OutExpress || 0) > 0) ? `<span class="po-badge">${formatNumber(r.OutExpress || 0)}</span>` : ""}</td>
   <td class="success-col">${successHtml}</td>
   <td>${r.Unit}</td>
    <td>${r.Note}</td>
    <td>${formatNumber(r.MultiplyUnit)}</td>
    <td class="minorder-col">${(r.MinOrder || 0) > 1 ? `<span class="minorder-badge">${formatNumber(r.MinOrder)}</span>` : (r.MinOrder ? formatNumber(r.MinOrder) : '')}</td>
    <td class="lt-col">${r.SafetyDayUsed != null ? formatNumber(r.SafetyDayUsed) : ''}</td>
    <td class="lt-col">${r.CoverDayUsed != null ? formatNumber(r.CoverDayUsed) : ''}</td>
    <td>${r.Product}</td>
    <td>${r.PartType || ''}</td>
    <td>${rebuiltDisplay}</td>
    <td><strong>${r.ABCValue}</strong></td>
    <td><span class="${r.Moving === 'Non Moving' ? 'moving-dead' : 'moving-' + r.Moving.toLowerCase()}">${r.Moving}</span></td>
    <td><span class="return-qty">${formatNumber(r.ReturnQty)}</span></td>
    <td>${r.CumPercent.toFixed(1)}%</td>
    <td class="col-location">${r.Location || ''}</td>
    <td class="col-shelf">${r.Shelf || ''}</td>
    <td class="responsible-cell"><span class="responsible-user">${ownerDisplay}</span></td>
    <td>${r.PurchasingGroup || ''}</td>
    <td class="orderselect-col">${r.OrderSelect || ''}</td>
    <td class="comeon-col">${r.Comeon || ''}</td>
`;
        const actualInput = row.querySelector('input.actual-order-input');
        if (actualInput) {
            actualInput.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                const act = isNaN(v) ? 0 : v;
                r.ActualOrder = act;
                r._actualOrderTouched = true;
                if (typeof saveActualOrdersToLocalStorage === 'function') {
                    saveActualOrdersToLocalStorage();
                }
                const rec = r.RecommendedOrder || 0;
                const span = row.querySelector('.order-span');
                if (span) {
                    span.classList.remove('order-less', 'order-more', 'order-equal');
                    let cls;
                    if (act < rec) cls = 'order-less';
                    else if (act > rec) cls = 'order-more';
                    else cls = 'order-equal';
                    span.classList.add(cls);
                }
                const successCell = row.querySelector('.success-col');
                if (successCell) {
                    const diffMode = document.getElementById("orderDiffFilter")?.value || "";
                    const isUnsuccessMode = diffMode === "pending";
                    const showSuccess = Math.round(act) > 0;
                    const showCancel = Math.round(act) === 0;

                    if (showSuccess) {
                        successCell.innerHTML = `<span class="success-badge">Success</span>`;
                    } else if (showCancel) {
                        successCell.innerHTML = `<span class="success-badge-red">ยกเลิก</span>`;
                    } else if (isUnsuccessMode) {
                        successCell.innerHTML = `<span class="success-badge-orange">Wait</span>`;
                    } else {
                        successCell.innerHTML = "";
                    }
                }
                updateActualOrderSummary(allData);
            });
        }
        const poCell = row.querySelector('.po-cell');
        const prCell = row.querySelector('.pr-cell');
        const rbCell = row.querySelector('.rb-col');
        const recCell = row.querySelector('.rec-cell');
        if (poCell) {
            const hasPo = poOutstanding > 0 && Array.isArray(r.PoDetails) && r.PoDetails.length > 0;
            if (hasPo) {
                poCell.classList.add("po-clickable");
                poCell.title = "คลิกเพื่อดูรายละเอียด PO";
                poCell.addEventListener('click', () => openPoModal(r.Material, r.PoDetails || [], r.LeadTimeDays || 0));
            } else {
                poCell.title = "ไม่มีข้อมูล PO";
            }
        }
        if (prCell) {
            const hasPr = Number(r.PrOutstanding || 0) > 0 && Array.isArray(r.PrDetails) && r.PrDetails.length > 0;
            if (hasPr) {
                prCell.classList.add("po-clickable");
                prCell.title = "คลิกเพื่อดูรายละเอียด PR";
                prCell.addEventListener('click', () => openPrModal(r.Material, r.PrDetails || []));
            } else {
                prCell.title = "ไม่มีข้อมูล PR";
            }
        }
        if (rbCell) {
            const hasRb = rebuiltQty > 0 && r.Rebuilt;
            if (hasRb) {
                rbCell.classList.add("po-clickable");
                rbCell.title = `คลิกเพื่อดูข้อมูล Rebuilt (${r.Rebuilt})`;
                rbCell.addEventListener('click', () => openRebuiltModal(r));
            } else {
                rbCell.title = "ไม่มีข้อมูล Rebuilt";
            }
        }
        if (recCell) {
            if (selectedPlant === "0326") {
                recCell.classList.add("po-clickable");
                recCell.title = "คลิกเพื่อดูรายละเอียดแนะนำสั่ง (Plant 0326)";
                recCell.addEventListener('click', () => openRecModal(r));
            } else {
                recCell.title = "รายละเอียดแนะนำสั่ง (เฉพาะ Plant 0326)";
            }
        }

        // Logic สำหรับคลิกเปลี่ยนสถานะ (ยกเว้น 0301, 0326)
        if (selectedPlant !== "0301" && selectedPlant !== "0326") {
            const stCell = row.querySelector(".status-col-cell");
            if (stCell) {
                stCell.style.cursor = "pointer";
                stCell.title = "คลิกเพื่อแก้ไขสถานะ";
                stCell.addEventListener("click", () => openStatusModal(r));
            }
        }

        fragment.appendChild(row);
    });
    container.appendChild(fragment);
}

function renderPagination() {
    const p = document.getElementById("pagination");
    if (!p) return;

    const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    if (totalPages <= 1) {
        p.innerHTML = "";
        p.style.display = "none";
        return;
    }

    p.style.display = "flex";
    p.innerHTML = "";
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    const makeBtn = (label, page, disabled = false) => {
        const btn = document.createElement("button");
        btn.className = "page-btn";
        btn.textContent = label;
        btn.disabled = disabled;

        if (!disabled) {
            btn.onclick = () => {
                currentPage = Math.min(Math.max(1, page), totalPages);
                renderTable();
                renderPagination();
            };
        }
        return btn;
    };

    p.appendChild(makeBtn("<<", 1, currentPage === 1));
    p.appendChild(makeBtn("<", currentPage - 1, currentPage === 1));

    const cur = document.createElement("button");
    cur.className = "page-btn active";
    cur.textContent = String(currentPage);
    cur.disabled = true;
    p.appendChild(cur);

    p.appendChild(makeBtn(">", currentPage + 1, currentPage === totalPages));
    p.appendChild(makeBtn(">>", totalPages, currentPage === totalPages));
}


// ==========================================
// Cloud Persistence for Actual Orders
// ==========================================

// *** สำคัญ: เปลี่ยน URL นี้เป็น Web App URL ของคุณหลังจาก Deploy Script แล้ว ***
const ACTUAL_ORDER_API_URL = "https://script.google.com/macros/s/AKfycbw5WCbC2x36eUhkYCUsnM0sdGhAALF7aBOlurNIo5sg_czxuW_D0DubiffTV8Xk6fleEg/exec";

function getOrderStorageKey() {
    return 'abc_actual_orders_' + (selectedPlant || 'ALL');
}

function saveActualOrdersToLocalStorage() {
    // ฟังก์ชันนี้ถูกเรียกเมื่อมีการพิมพ์ค่า แต่เราจะไม่บันทึกลง Cloud ทันทีเพื่อลด Traffic
    // เราจะใช้ _actualOrderTouched = true ที่ตั้งไว้แล้ว เพื่อรอให้ผู้ใช้กดปุ่ม Save
}

function loadActualOrdersFromLocalStorage() {
    // เปลี่ยนไปโหลดจาก Cloud แทน
    loadActualOrdersFromCloud();
}

async function loadActualOrdersFromCloud() {
    if (!ACTUAL_ORDER_API_URL || ACTUAL_ORDER_API_URL.includes("URL_ของ")) {
        console.warn("ยังไม่ได้ใส่ URL ของ Actual Order API");
        return;
    }

    try {
        // ใช้ fetch (GET) ส่ง action=getOrders
        const url = `${ACTUAL_ORDER_API_URL}?action=getOrders`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.status === "success" && Array.isArray(json.data)) {
            const map = new Map();
            const selectedDate = document.getElementById("orderRoundDate")?.value;

            json.data.forEach(item => {
                // key = Plant-Material
                const rowDate = item.orderRound || "";

                if (selectedDate) {
                    // Check date match strictly by YYYY-MM-DD
                    const normRowDate = normalizeToYYYYMMDD(rowDate).trim();
                    const normSelected = normalizeToYYYYMMDD(selectedDate).trim();

                    if (normRowDate === normSelected) {
                        const p = String(item.plant).padStart(4, '0'); // Safe normalize 301 -> 0301
                        const m = String(item.material);
                        map.set(`${p}-${m}`, Number(item.actualOrder));
                    }
                } else {
                    // No date selected -> fallback
                    const p = String(item.plant).padStart(4, '0');
                    const m = String(item.material);
                    map.set(`${p}-${m}`, Number(item.actualOrder));
                }
            });

            // เคลียร์ค่า ActualOrder เดิมก่อน
            allData.forEach(r => {
                r.ActualOrder = null;
                r._actualOrderTouched = false;
            });

            // อัปเดตลง allData
            let matchCount = 0;
            allData.forEach(r => {
                const p = String(r.Plant).padStart(4, '0'); // Safe normalize
                const m = String(r.Material);
                const key = `${p}-${m}`;

                if (map.has(key)) {
                    r.ActualOrder = map.get(key);
                    matchCount++;
                }
            });
            console.log(`Matched ${matchCount} items for date ${selectedDate}`);

            // รีเฟรชตารางและ Filter
            if (typeof applyFiltersAndRender === 'function') {
                applyFiltersAndRender();
            } else if (typeof renderTable === 'function') {
                renderTable();
            }
            if (typeof updateActualOrderSummary === 'function') updateActualOrderSummary(allData);
        }
    } catch (err) {
        console.error("Error loading orders from cloud:", err);
    }
}

function normalizeToYYYYMMDD(val) {
    if (!val) return "";
    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

    // If standard Date object or string ISO
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    // If DD/MM/YYYY (Thai format common in sheets)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
        const parts = val.split('/');
        // Assuming DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    return val; // Fallback
}

// Global flag for sync status
let isSyncing = false;

window.addEventListener('beforeunload', function (e) {
    if (isSyncing) {
        // Cancel the event
        e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
        // Chrome requires returnValue to be set
        e.returnValue = '';
    }
});

async function saveOrdersToCloud() {
    // หาข้อมูลที่ _actualOrderTouched = true และมี ActualOrder
    const toSave = allData.filter(r => r._actualOrderTouched).map(r => ({
        plant: r.Plant,
        material: r.Material,
        description: r.Description,
        actualOrder: Number(r.ActualOrder || 0),
        user: (typeof loggedUser !== 'undefined' && loggedUser.Name) ? loggedUser.Name : "User",
        orderRound: document.getElementById("orderRoundDate")?.value || "", // ส่งวันที่ไปด้วย
        navanakorn: Number(r.Navanakorn || 0),
        unrestricted: Number(r.Unrestricted || 0)
    }));

    // เช็คว่าเลือกวันที่หรือยัง
    const dateVal = document.getElementById("orderRoundDate")?.value;
    if (!dateVal) {
        if (typeof Swal !== 'undefined') {
            Swal.fire("กรุณาเลือกรอบสั่ง", "ต้องระบุวันที่ (Order Round) ก่อนบันทึก", "warning");
        } else {
            alert("กรุณาเลือกรอบสั่ง (Order Round)");
        }
        return;
    }

    if (toSave.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire("ไม่มีข้อมูลใหม่", "คุณยังไม่ได้แก้ไขยอดสั่งจริง", "info");
        } else {
            alert("ไม่มีข้อมูลใหม่");
        }
        return;
    }

    // --- Background Sync UI Start ---
    const indicator = document.getElementById("syncIndicator");
    let remaining = toSave.length;

    isSyncing = true; // Set flag

    if (indicator) {
        indicator.textContent = remaining;
        indicator.style.setProperty("display", "inline-flex", "important");
        indicator.offsetHeight; // Force repaint
    }
    // --- End UI Start ---

    // Config Batch Size (จำนวนรายการต่อ 1 request)
    // เพิ่มเป็น 20 เพื่อให้เร็วขึ้น (ลดจำนวน Request)
    const BATCH_SIZE = 20;
    let successCount = 0;

    try {
        for (let i = 0; i < toSave.length; i += BATCH_SIZE) {
            const batch = toSave.slice(i, i + BATCH_SIZE);

            // ส่งแบบ POST โดยใช้ FormData
            const fd = new FormData();
            fd.append('action', 'saveOrders');
            fd.append('payload', JSON.stringify(batch));

            const res = await fetch(ACTUAL_ORDER_API_URL, {
                method: 'POST',
                body: fd
            });

            const json = await res.json();

            if (json.status === "success") {
                // อัปเดตตัวเลขถอยหลัง
                remaining -= batch.length;
                if (remaining < 0) remaining = 0;

                if (indicator) {
                    indicator.textContent = remaining;
                }
                successCount += (json.count || batch.length);
            } else {
                throw new Error(json.message || "Unknown error in batch");
            }
        }

        // เมื่อเสร็จทั้งหมด
        console.log("บันทึกสำเร็จทั้งหมด " + successCount + " รายการ");
        if (indicator) {
            indicator.style.display = "none";
        }
        isSyncing = false; // Reset flag

    } catch (err) {
        console.error("Save Error:", err);
        if (typeof Swal !== 'undefined') {
            Swal.fire("บันทึกไม่สำเร็จ", "เกิดข้อผิดพลาดในการส่งข้อมูล: " + err.message, "error");
        }
        if (indicator) {
            indicator.style.display = "none";
        }
        isSyncing = false; // Reset flag
    }
}

function setActualOrderFromRecommended() {
    if (!Array.isArray(filteredData) || filteredData.length === 0) {
        Swal.fire({
            icon: "warning",
            title: "ไม่มีรายการ",
            text: "ไม่มีข้อมูลในหน้านี้ให้ตั้งค่า",
        });
        return;
    }
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);
    if (pageData.length === 0) {
        Swal.fire({
            icon: "warning",
            title: "ไม่มีรายการ",
            text: "ไม่มีข้อมูลในหน้านี้ให้ตั้งค่า",
        });
        return;
    }
    Swal.fire({
        title: "ยืนยันการตั้งค่า?",
        text: `ต้องการตั้งค่า "สั่งจริง = แนะนำสั่ง" จำนวน ${pageData.length} รายการในหน้านี้หรือไม่?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "ยืนยัน",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#27ae60",
        cancelButtonColor: "#c0392b",
    }).then(result => {
        if (!result.isConfirmed) return;
        pageData.forEach(r => {
            r.ActualOrder = (r.RecommendedOrder != null) ? r.RecommendedOrder : 0;
            r._actualOrderTouched = true;
        });
        // ไม่ต้อง saveActualOrdersToLocalStorage ทันที รอ Save cloud ทีเดียว
        const pageBefore = currentPage;
        applyFiltersAndRender();
        currentPage = pageBefore;
        renderTable();
        renderPagination();
        Swal.fire({
            icon: "success",
            title: "สำเร็จ!",
            text: "ตั้งค่าตามแนะนำสั่งเรียบร้อยแล้ว (อย่าลืมกด Save Cloud)",
            timer: 2000,
            showConfirmButton: false
        });
    });
}

function clearActualOrdersForPlant() {
    Swal.fire({
        title: "ยืนยันการล้าง?",
        text: "การล้างจะลบค่าในหน้าจอเท่านั้น (ถ้ากด Save Cloud จะบันทึกยอดเป็น 0)",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ล้าง",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#e67e22",
        cancelButtonColor: "#7f8c8d",
    }).then(result => {
        if (!result.isConfirmed) return;
        allData.forEach(r => {
            if (r.Plant === selectedPlant) {
                r.ActualOrder = null;
                r._actualOrderTouched = false;
            }
        });
        applyFiltersAndRender();
        Swal.fire({
            icon: "success",
            title: "ล้างเรียบร้อย",
            text: "ล้างค่าหน้าจอแล้ว",
            timer: 1500,
            showConfirmButton: false
        });
    });
}

function exportToCSV() {
    const headers = [
        "Plant", "Material", "รายการอะไหล่", "Storage bin", "RBT",
        "หน่วย", "นวนคร", "คงเหลือ", "Etc", "มูลค่า", "ใช้ 6 เดือน", "ใช้ 4 เดือน", "ใช้ 3 เดือน", "ใช้ 2 เดือน",
        "เฉลี่ย/ด.", "30Day", "Sale", "Mean", "Safety", "ROP", "DOS", "PR", "PO",
        "กำหนดส่ง", "เลขที่ PO", "จำนวน (PO)", "แนะนำสั่งซื้อ",
        "สั่งจริง", "นอกรอบ", "Success",
        "หมายเหตุ", "คูณหน่วย", "MinOrder", "SafetyDay", "CoverDay", "Product", "Rebuilt", "ABC", "Moving",
        "ส่งคืนได้ (ชิ้น)", "% สะสม",
        "Location", "Shelf", "ผู้รับคืน", "L/T", "PRG", "Status", "OrderSelect"
    ];

    const rows = [];
    rows.push("\uFEFF" + headers.join(","));

    filteredData.forEach(r => {
        const safeStr = (v) => (v === null || v === undefined) ? "" : String(v).replace(/"/g, '""');

        const row = [
            safeStr(r.Plant),
            safeStr(r.Material),
            safeStr(r.Description),
            safeStr(r.StorageBin),
            toNumber(r.RebuiltStock || 0) > 0 ? toNumber(r.RebuiltStock || 0) : "",
            safeStr(r.Unit),
            r.Navanakorn || 0,
            r.Unrestricted, (r.SubtotalAllPlant != null ? r.SubtotalAllPlant : r.Unrestricted), r.Value, r.Qty6Month, r.Qty4Month, r.Qty3Month || 0, r.Qty2Month || 0,
            (Number(r.AvgDailyUse) || 0).toFixed(1), r.ThirtyDay, r.Sale || 0, (Number(r.Mean) || 0).toFixed(1), Math.round(r.SafetyStock || 0), Math.round(r.ROP || 0),
            r.DOS > 9999 ? "มาก" : r.DOS.toFixed(1),
            r.PrOutstanding || 0,
            (r.PoOutstandingDisplay ?? r.PoOutstanding) || 0,
            safeStr(r.EarliestPoDate),
            safeStr(r.EarliestPoNumber),
            r.EarliestPoQty != null ? r.EarliestPoQty : "",
            (r.RecommendedOrder % 1 === 0 ? Math.round(r.RecommendedOrder) : r.RecommendedOrder),
            (r.ActualOrder % 1 === 0 ? Math.round(r.ActualOrder) : r.ActualOrder) || 0,
            r.OutExpress || 0,
            Math.round(r.ActualOrder ?? 0) > 0 ? "Success" : "",
            safeStr(r.Note), r.MultiplyUnit, safeStr(r.MinOrder), safeStr(r.SafetyDayUsed), safeStr(r.CoverDayUsed), safeStr(r.Product), safeStr(r.Rebuilt), safeStr(r.ABCValue), safeStr(r.Moving),
            r.ReturnQty, r.CumPercent.toFixed(2),
            safeStr(r.Location), safeStr(r.Shelf), safeStr(r.OwnerName || r.OwnerId), safeStr(r.LeadTimeDays), safeStr(r.PurchasingGroup), safeStr(r.Status), safeStr(r.OrderSelect)
        ];
        rows.push(row.map(v => `"${v}"`).join(","));
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ABC_Analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
