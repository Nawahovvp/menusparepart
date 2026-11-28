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

        // Remove legacy white-card injected style if present
        const legacyStyle = document.getElementById('menu-custom-style');
        if (legacyStyle) legacyStyle.remove();

        if (document.getElementById('menuPlantSelect')) return;

        const container = document.createElement('div');
        container.className = 'abc-up-plant-box';

        const label = document.createElement('label');
        label.htmlFor = 'menuPlantSelect';
        label.innerHTML = '<i class="fas fa-warehouse"></i> เลือก Plant / สาขา';
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
            menu.style.display = 'none';
            loadData(true);
        });

        container.appendChild(label);
        container.appendChild(select);

        const slot = document.getElementById('userMenuPlantSlot');
        if (slot) {
            slot.innerHTML = '';
            slot.appendChild(container);
        } else {
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn && menu.contains(logoutBtn)) {
                menu.insertBefore(container, logoutBtn);
            } else {
                menu.appendChild(container);
            }
        }
    }

    function bindMenu() {
        const menuBtn = document.getElementById('menuBtn');
        const closeBtn = document.getElementById('userMenuCloseBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = document.getElementById('userMenu');
                if (menu) {
                    const isOpening = menu.style.display !== 'block';
                    menu.style.display = isOpening ? 'block' : 'none';
                    menuBtn.classList.toggle('active', isOpening);
                }
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = document.getElementById('userMenu');
                if (menu) menu.style.display = 'none';
                if (menuBtn) menuBtn.classList.remove('active');
            });
        }
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('userMenu');
            if (menu && menu.style.display === 'block' && !menu.contains(e.target)) {
                menu.style.display = 'none';
                if (menuBtn) menuBtn.classList.remove('active');
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
        const startupLoader = document.getElementById('loader');
        if (startupLoader) startupLoader.style.display = 'block';
        if (typeof updateProgress === 'function') {
            updateProgress(8, 'กำลังตรวจสอบสิทธิ์และรายชื่อสาขา...');
        }
        // These sheets are independent; waiting for them one after another delays startup.
        await Promise.all([loadUsers(), loadEmployees()]);
        if (!checkLogin()) {
            if (startupLoader) startupLoader.style.display = 'none';
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
            if (!selectedPlant && select && select.options.length > 0) {
                selectedPlant = select.options[0].value;
                select.value = selectedPlant;
                inventoryUrl = inventoryUrls[selectedPlant];
            }
            if (typeof updateProgress === 'function') {
                updateProgress(18, 'กำลังดึงข้อมูลสต็อกและการเคลื่อนไหว...');
            }
            // Yield a frame so the smooth loader paints before heavy cache/DOM work
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 40)));
            // Let loadData paint the last saved snapshot immediately, then refresh in background.
            if (selectedPlant) loadData(false);
            else if (startupLoader) startupLoader.style.display = 'none';
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
            if (typeof renderAbcHeader === 'function') {
                renderAbcHeader(plantLabel, html);
            } else {
                const suffix = html ? `<br><span style="font-size:0.7em; font-weight:normal;">${html}</span>` : "";
                h1.innerHTML = `ABC Analysis & Smart Ordering System ${plantLabel}${suffix}`;
            }
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
