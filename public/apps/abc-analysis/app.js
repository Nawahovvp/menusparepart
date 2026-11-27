(function () {
    function bindHelpModal() {
        const helpBtn = document.getElementById('helpBtn');
        const helpCloseBtn = document.getElementById('helpCloseBtn');
        const helpModal = document.getElementById('helpModal');
        if (helpBtn) helpBtn.addEventListener('click', openHelp);
        if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelp);
        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) closeHelp();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeHelp();
        });
    }

    function renderMenuPlantSelect() {
        const menu = document.getElementById('userMenu');
        if (!menu) return;

        // Inject custom styles for a better looking menu
        if (!document.getElementById('menu-custom-style')) {
            const style = document.createElement('style');
            style.id = 'menu-custom-style';
            style.textContent = `
                #userMenu {
                    background-color: #ffffff !important;
                    color: #333 !important;
                    border-radius: 12px !important;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
                    padding: 24px !important;
                    width: 320px !important;
                    border: 1px solid #f0f0f0 !important;
                    font-family: 'Sarabun', sans-serif !important;
                    top: 60px !important;
                    right: 10px !important;
                    z-index: 10000 !important;
                }
                #userMenu #userID {
                    font-size: 1.1em;
                    font-weight: 700;
                    color: #2c3e50;
                    margin-bottom: 4px;
                }
                #userMenu #userName {
                    font-size: 1em;
                    color: #34495e;
                    margin-bottom: 8px;
                }
                #userMenu #userExtra {
                    font-size: 0.85em;
                    color: #7f8c8d;
                    margin-bottom: 16px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #eee;
                }
                .menu-plant-label {
                    font-size: 0.9em;
                    font-weight: 600;
                    color: #555;
                    margin-bottom: 8px;
                    display: block;
                }
                #menuPlantSelect {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    background-color: #f8f9fa;
                    font-size: 0.95em;
                    color: #333;
                    outline: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                #menuPlantSelect:hover {
                    border-color: #aaa;
                    background-color: #fff;
                }
                #menuPlantSelect:focus {
                    border-color: #3498db;
                    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
                }
                #logoutBtn {
                    margin-top: 20px;
                    width: 100%;
                    padding: 10px;
                    background-color: #ff4757;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                #logoutBtn:hover {
                    background-color: #ff6b81;
                }
            `;
            document.head.appendChild(style);
        }

        if (document.getElementById('menuPlantSelect')) return;

        const container = document.createElement('div');
        container.style.marginTop = '10px';

        const label = document.createElement('label');
        label.textContent = 'เลือก Plant / สาขา';
        label.className = 'menu-plant-label';

        const select = document.createElement('select');
        select.id = 'menuPlantSelect';

        Object.keys(inventoryUrls).sort().forEach(p => {
            const name = plantNames[p] || p;
            select.add(new Option(`${p} - ${name}`, p));
        });

        select.addEventListener('change', () => {
            selectedPlant = select.value;
            inventoryUrl = inventoryUrls[selectedPlant];
            loadData(true);
        });

        container.appendChild(label);
        container.appendChild(select);

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn && menu.contains(logoutBtn)) {
            menu.insertBefore(container, logoutBtn);
        } else {
            menu.appendChild(container);
        }
    }

    function bindMenu() {
        const menuBtn = document.getElementById('menuBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = document.getElementById('userMenu');
                if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            });
        }
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('userMenu');
            if (menu && menu.style.display === 'block' && !menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        });

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', function (e) {
                e.preventDefault();
                login();
                if (loggedUser) {
                    renderMenuPlantSelect();
                    const select = document.getElementById('menuPlantSelect');
                    if (select && loggedUser.Plant) {
                        if (Array.from(select.options).some(o => o.value === loggedUser.Plant)) {
                            select.value = loggedUser.Plant;
                            selectedPlant = loggedUser.Plant;
                            inventoryUrl = inventoryUrls[selectedPlant];
                        }
                    }
                    if (selectedPlant) loadData(true);
                }
            });
        }
    }

    function bindTableSorting() {
        const header = document.getElementById("tableHeader");
        if (!header) return;
        header.addEventListener("click", e => {
            const col = e.target.closest("th[data-sort]");
            if (!col) return;
            const key = col.getAttribute("data-sort");
            if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
            else { sortKey = key; sortDir = "desc"; }
            applyFiltersAndRender();
        });
    }

    function bindFilters() {
        document.getElementById("cardTotalStock").onclick = () => { mode = "all"; abcFilter = ""; movingFilter = ""; applyFiltersAndRender(); };
        document.getElementById("cardOrderItems").onclick = () => { mode = "onlyOrder"; abcFilter = ""; movingFilter = ""; applyFiltersAndRender(); };
        document.getElementById("cardReturnValue").onclick = () => { mode = "returnable"; abcFilter = ""; movingFilter = ""; applyFiltersAndRender(); };
        document.getElementById("cardOutOfStock").onclick = () => { mode = OUT_OF_STOCK_MODE; abcFilter = ""; movingFilter = ""; applyFiltersAndRender(); };
        document.getElementById("cardOutOfStockWait").onclick = () => { mode = OUT_OF_STOCK_WAIT_MODE; abcFilter = ""; movingFilter = ""; applyFiltersAndRender(); };
        document.getElementById("abcA").onclick = () => { abcFilter = "A"; applyFiltersAndRender(); };
        document.getElementById("abcB").onclick = () => { abcFilter = "B"; applyFiltersAndRender(); };
        document.getElementById("abcC").onclick = () => { abcFilter = "C"; applyFiltersAndRender(); };
        document.getElementById("cardFast").onclick = () => { movingFilter = "Fast"; applyFiltersAndRender(); };
        document.getElementById("cardMedium").onclick = () => { movingFilter = "Medium"; applyFiltersAndRender(); };
        document.getElementById("cardSlow").onclick = () => { movingFilter = "Slow"; applyFiltersAndRender(); };
        document.getElementById("cardSlowly").onclick = () => { movingFilter = "Slowly"; applyFiltersAndRender(); };
        document.getElementById("cardDead").onclick = () => { movingFilter = "Non Moving"; applyFiltersAndRender(); };

        document.getElementById("plantFilter").addEventListener("change", applyFiltersAndRender);
        document.getElementById("statusFilter").addEventListener("change", applyFiltersAndRender);
        document.getElementById("responsibleFilter").addEventListener("change", applyFiltersAndRender);
        document.getElementById("prgFilter").addEventListener("change", applyFiltersAndRender);
        const orderSelectFilter = document.getElementById("orderSelectFilter");
        if (orderSelectFilter) orderSelectFilter.addEventListener("change", applyFiltersAndRender);
        const comeonFilter = document.getElementById("comeonFilter");
        if (comeonFilter) comeonFilter.addEventListener("change", applyFiltersAndRender);
        const productFilter = document.getElementById("productFilter");
        if (productFilter) productFilter.addEventListener("input", applyFiltersAndRender);
        ["leadTimeDays", "safetyDays", "coverDays", "searchInput"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("input", applyFiltersAndRender);
        });
        document.getElementById("orderDiffFilter").addEventListener("change", applyFiltersAndRender);
        const navFilter = document.getElementById("navanakornFilter");
        if (navFilter) navFilter.addEventListener("change", applyFiltersAndRender);
        document.getElementById("setActualBtn").addEventListener("click", setActualOrderFromRecommended);
        const clearActualBtn = document.getElementById("clearActualBtn");
        if (clearActualBtn) clearActualBtn.addEventListener("click", clearActualOrdersForPlant);
        document.getElementById("exportBtn").onclick = exportToCSV;
        const refreshBtn = document.getElementById("refreshBtn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                if (!selectedPlant) {
                    const select = document.getElementById("plantSelect");
                    selectedPlant = select ? select.value : "";
                }
                if (selectedPlant) {
                    inventoryUrl = inventoryUrls[selectedPlant];
                }
                if (!selectedPlant || !inventoryUrl) {
                    alert("กรุณาเลือก Plant");
                    return;
                }
                loadData(true, { preserveFilters: true, softRefresh: true });
            });
        }
    }

    function bindNavigation() {
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                document.getElementById('mainCardsSection').style.display = 'none';
                document.getElementById('summarySection').style.display = 'none';
                document.getElementById('controlsSection').style.display = 'none';
                document.getElementById('tableSection').style.display = 'none';
                document.getElementById('pagination').style.display = 'none';
                document.getElementById('backBtn').style.display = 'none';
                allData = []; filteredData = []; mode = "all"; abcFilter = ""; movingFilter = ""; currentPage = 1;
                document.getElementById("searchInput").value = "";
                document.getElementById("statusFilter").value = "";
                document.getElementById("responsibleFilter").value = "";
                document.getElementById("plantFilter").disabled = false;
            });
        }
    }

    async function init() {
        // These sheets are independent; waiting for them one after another delays startup.
        await Promise.all([loadUsers(), loadEmployees()]);
        if (!checkLogin()) {
            showLogin();
        } else {
            renderMenuPlantSelect();
            const select = document.getElementById('menuPlantSelect');
            if (select && loggedUser && loggedUser.Plant) {
                if (Array.from(select.options).some(o => o.value === loggedUser.Plant)) {
                    select.value = loggedUser.Plant;
                    selectedPlant = loggedUser.Plant;
                    inventoryUrl = inventoryUrls[selectedPlant];
                }
            }
            // Let loadData paint the last saved snapshot immediately, then refresh in background.
            if (selectedPlant) loadData(false);
        }
        loadMovementInfo();
        bindHelpModal();
        bindMenu();
        bindTableSorting();
        bindFilters();
        bindNavigation();
    }

    init();
})();

function showPlantSelectionIfReady() {
    const plantSelection = document.getElementById("plantSelection");
    if (!plantSelection) return;
    // Hide the old plant selection screen entirely as it is moved to the menu
    plantSelection.style.display = "none";
}

function applyDefaultParamsForPlant(plant) {
    if (plant === "0301") return;
    const lt = document.getElementById("leadTimeDays");
    const safety = document.getElementById("safetyDays");
    const cover = document.getElementById("coverDays");
    if (lt) lt.value = 5;
    if (safety) safety.value = 15;
    if (cover) cover.value = 45;
}

function loadMovementInfo() {
    const infoEl = document.getElementById("movementInfo");
    const spinner = document.getElementById("movementSpinner");
    movementInfoReady = false;
    if (!infoEl || !usageUrl) {
        movementInfoReady = true;
        showPlantSelectionIfReady();
        return;
    }
    infoEl.style.display = "none";
    if (spinner) spinner.style.display = (!!loggedUser && !movementInfoReady) ? "flex" : spinner.style.display;
    showPlantSelectionIfReady();
    const finalize = (html) => {
        movementHtml = html;
        if (infoEl) infoEl.style.display = "none";

        const h1 = document.querySelector('h1');
        if (h1 && selectedPlant) {
            const name = plantNames[selectedPlant] || selectedPlant;
            const plantLabel = name.startsWith('คลัง') ? name : `คลัง${name}`;
            const suffix = html ? `<br><span style="font-size:0.7em; font-weight:normal;">${html}</span>` : "";
            h1.innerHTML = `ABC Analysis & Smart Ordering System ${plantLabel}${suffix}`;
        }
        movementInfoReady = true;
        showPlantSelectionIfReady();
    };
    const fallbackText = "ข้อมูลเคลือนไหวคลังสินค้า<br>วันที่: 15/07/2025 ถึง 11/01/2026 (6เดือน 180 วัน)";
    const parseDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return value;
        const txt = value.toString().trim();
        const m = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!m) return null;
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const year = parseInt(m[3], 10);
        const dt = new Date(year, month, day);
        return isNaN(dt.getTime()) ? null : dt;
    };
    const formatDate = (dt) => {
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yyyy = dt.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };
    fetch(usageUrl)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(rows => {
            let targetDate = null;
            if (Array.isArray(rows) && rows.length > 0) {
                // 1. หา Column ที่ชื่อมีคำว่า STDEVP
                const headers = Object.keys(rows[0]);
                let dateKey = headers.find(h => /stdevp/i.test(h));

                // 2. ถ้าไม่เจอ ให้ลองใช้ Column แรก (มักจะเป็นวันที่รายการ)
                if (!dateKey) dateKey = headers[0];

                if (dateKey) {
                    rows.forEach(r => {
                        const dt = parseDate(r[dateKey]);
                        if (dt && (!targetDate || dt > targetDate)) targetDate = dt;
                    });
                }

                // 3. ถ้ายังไม่เจอ ให้ลองสแกนทุกคอลัมน์ในแถวแรกเพื่อหาค่าที่เป็นวันที่
                if (!targetDate) {
                    Object.values(rows[0]).forEach(v => {
                        const dt = parseDate(v);
                        if (dt && (!targetDate || dt > targetDate)) targetDate = dt;
                    });
                }
            }
            if (targetDate) {
                const firstDate = targetDate;
                const fromDate = new Date(firstDate);
                fromDate.setDate(fromDate.getDate() - 180);
                return finalize(`ข้อมูลเคลือนไหวคลังสินค้า<br>วันที่: ${formatDate(fromDate)} ถึง ${formatDate(firstDate)} (6เดือน 180 วัน)`);
            }
            finalize(fallbackText);
        })
        .catch(() => {
            finalize(fallbackText);
        });
}
