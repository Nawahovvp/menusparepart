// Data fetching & hydration

// Helper for Update Toast
function updateToast(show, message = "กำลังอัปเดตข้อมูล...") {
    let toast = document.querySelector('.update-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'update-toast';
        toast.innerHTML = `
            <div class="update-toast-spinner"></div>
            <span class="update-toast-message"></span>
        `;
        document.body.appendChild(toast);
        // Force reflow
        void toast.offsetWidth;
    }
    toast.querySelector('.update-toast-message').textContent = message;
    if (show) toast.classList.add('show');
    else toast.classList.remove('show');
}

async function loadData(forceRefresh, options = {}) {
    const loader = document.getElementById("loader");
    const summarySection = document.getElementById("summarySection");
    const controlsSection = document.getElementById("controlsSection");
    const tableSection = document.getElementById("tableSection");
    const preserveFilters = !!options.preserveFilters;
    const softRefresh = !!options.softRefresh;

    // Progress bar logic
    let completedSteps = 0;
    const totalSteps = 14; // Eight shared datasets plus six plant-specific datasets
    updateProgress(0, "Initializing...");

    // Helper to toggle UI
    const toggleUI = (showLoader) => {
        if (loader) loader.style.display = showLoader ? "block" : "none";
        if (!softRefresh) {
            const contentDisplay = showLoader ? "none" : "flex"; // Flex for summary/controls
            const tableDisplay = showLoader ? "none" : "block";
            if (summarySection) summarySection.style.display = contentDisplay;
            if (controlsSection) controlsSection.style.display = contentDisplay;
            if (tableSection) tableSection.style.display = tableDisplay;
            const mainCards = document.getElementById("mainCardsSection");
            if (mainCards) mainCards.style.display = contentDisplay;
            const pagination = document.getElementById("pagination");
            if (pagination) pagination.style.display = tableDisplay;
        }
    };

    const captureFilterState = () => ({
        mode,
        abcFilter,
        movingFilter,
        sortKey,
        sortDir,
        currentPage,
        search: document.getElementById("searchInput")?.value ?? "",
        status: document.getElementById("statusFilter")?.value ?? "",
        responsible: document.getElementById("responsibleFilter")?.value ?? "",
        prg: document.getElementById("prgFilter")?.value ?? "",
        orderSelect: document.getElementById("orderSelectFilter")?.value ?? "",
        comeon: document.getElementById("comeonFilter")?.value ?? "",
        product: document.getElementById("productFilter")?.value ?? "",
        orderDiff: document.getElementById("orderDiffFilter")?.value ?? "",
        leadTime: document.getElementById("leadTimeDays")?.value ?? "",
        safety: document.getElementById("safetyDays")?.value ?? "",
        cover: document.getElementById("coverDays")?.value ?? ""
    });

    const filterSnapshot = preserveFilters ? captureFilterState() : null;

    // --- IndexedDB Cache Helpers ---
    const DB_NAME = "ABCSmartOrderingDB";
    const DB_VERSION = 1;
    const STORE_NAME = "cache";
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Default: 24 hours
    const AVG_VAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // AvgVal changes less often
    const CACHE_PREFIX = "abc_cache_v2_";

    const openDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    };

    const getCacheEntry = async (key) => {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, "readonly");
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const val = request.result;
                    if (!val || typeof val !== "object") resolve(null);
                    else resolve(val);
                };
            });
        } catch (e) {
            console.warn("IDB get failed", e);
            return null;
        }
    };

    const setCacheEntry = async (key, data) => {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, "readwrite");
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({ ts: Date.now(), data }, key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        } catch (e) {
            console.warn("IDB set failed", e);
        }
    };

    // Cleanup old localStorage cache if exists
    try {
        if (typeof safeLocalStorage !== "undefined") {
            Object.keys(safeLocalStorage).forEach(key => {
                if (key.startsWith("abc_cache_")) {
                    safeLocalStorage.removeItem(key);
                }
            });
        }
    } catch (e) {}

    const cacheBust = (url) => {
        if (!url) return url;
        if (/^https?:\/\/opensheet\.elk\.sh\//i.test(url)) return url;
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}t=${Date.now()}`;
    };

    // --- API Health Monitoring ---
    const apiHealth = {};
    window.apiHealth = apiHealth; // Expose globally

    const updateApiHealth = (label, status, details) => {
        apiHealth[label] = {
            status,
            details,
            timestamp: Date.now()
        };
        // Trigger UI update if function exists
        if (typeof window.updateHealthUI === 'function') {
            window.updateHealthUI();
        }
    };

    const fetchJsonWithCache = async (url, cacheKey, forceNetwork = false, transformForCache = null, label = null, ttlMs = CACHE_TTL_MS) => {
        if (!url) return [];
        // If no label provided, derive from cacheKey
        const apiLabel = label || cacheKey.replace(CACHE_PREFIX, "").toUpperCase();

        const entry = await getCacheEntry(cacheKey);
        const now = Date.now();

        // Return cached if valid and not forced
        if (!forceNetwork && entry && entry.ts && (now - entry.ts) < ttlMs) {
            updateApiHealth(apiLabel, 'ok', `From Cache (${entry.data.length} items)`);
            return entry.data;
        }

        // Network Fetch
        // Keep a failed source from holding the whole dashboard for several minutes.
        const MAX_RETRIES = 2;
        let attempt = 0;
        while (attempt < MAX_RETRIES) {
            try {
                const fetchUrl = forceNetwork ? cacheBust(url) : url;
                const fetchOptions = forceNetwork ? { cache: "no-store" } : undefined;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000);
                let res;
                try {
                    res = await fetch(fetchUrl, { ...fetchOptions, signal: controller.signal });
                } finally {
                    clearTimeout(timeoutId);
                }

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                const count = Array.isArray(data) ? data.length : 0;
                if (count === 0) {
                    updateApiHealth(apiLabel, 'warning', 'No data found (Empty)');
                } else {
                    updateApiHealth(apiLabel, 'ok', `Fetced ${count} items`);
                }

                const dataToCache = transformForCache ? transformForCache(data) : data;
                try {
                    await setCacheEntry(cacheKey, dataToCache); // Update cache with potentially filtered data
                } catch (e) {
                    console.error(`Failed to update cache for ${cacheKey}`, e);
                }

                return data; // Return full data (or valid data for this session)
            } catch (err) {
                attempt++;
                if (attempt >= MAX_RETRIES) console.warn(`Fetch failed for ${apiLabel}; using cached data when available:`, err.message);
                updateApiHealth(apiLabel, 'error', `Attempt ${attempt}: ${err.message}`);

                if (attempt >= MAX_RETRIES) {
                    if (entry && entry.data != null) {
                        updateApiHealth(apiLabel, 'warning', `Failed. Using Stale Cache (${entry.data.length} items)`);
                        return entry.data; // Fallback to stale
                    }
                    updateApiHealth(apiLabel, 'error', `Failed after ${MAX_RETRIES} attempts`);
                    return [];
                }
                await new Promise(resolve => setTimeout(resolve, 300 * attempt));
            }
        }
        return [];
    };

    const progressFetcher = async (url, cacheKey, forceNetwork, transformForCache, label, ttlMs) => {
        const data = await fetchJsonWithCache(url, cacheKey, forceNetwork, transformForCache, label, ttlMs);
        completedSteps++;
        const percentage = (completedSteps / totalSteps) * 100;
        updateProgress(percentage, `Loading ${label}...`);
        return data;
    };

    const ensureArray = (data) => Array.isArray(data) ? data : [];
    const safeFetchJson = (url, cacheKey, force) => progressFetcher(url, cacheKey, force, null, cacheKey.replace(CACHE_PREFIX, "").toUpperCase());
    const normalizePlant = (val) => {
        const raw = (val || "").toString().trim();
        if (!raw) return "";
        const numeric = parseFloat(raw.toString().replace(/,/g, ""));
        if (Number.isFinite(numeric)) return Math.round(numeric).toString().padStart(4, "0");
        const digits = raw.replace(/\D/g, "");
        if (!digits) return raw;
        return digits.padStart(4, "0");
    };

    // --- 1. Try Instant Load from Cache ---
    let cachedDataUsed = false;
    const is0301 = normalizePlant(selectedPlant) === "0301";
    const is0326 = normalizePlant(selectedPlant) === "0326";
    const selectedPlantNormalized = normalizePlant(selectedPlant);

    if (!forceRefresh) {
        // Try getting entries directly from cacheStore for "Instant" feel
        // We ignore TTL here for the "Stale" part of SWR
        const [cInv, cUsage, cMainsap, cAvg, cStatus, cLoc, cShelf, cNote, cPo, cComeon, cPr, cExpress, cPoSupplier, cStatusRead] = await Promise.all([
            getCacheEntry(`${CACHE_PREFIX}inv_${selectedPlant}`),
            getCacheEntry(`${CACHE_PREFIX}usage_${selectedPlant}`),
            getCacheEntry(`${CACHE_PREFIX}mainsap`),
            getCacheEntry(`${CACHE_PREFIX}avgval_compact_v1`),
            getCacheEntry(`${CACHE_PREFIX}status`),
            getCacheEntry(`${CACHE_PREFIX}location`),
            getCacheEntry(`${CACHE_PREFIX}shelf`),
            is0301 ? getCacheEntry(`${CACHE_PREFIX}note_all`) : Promise.resolve(null),
            is0301 ? getCacheEntry(`${CACHE_PREFIX}po_0301`) : (is0326 ? getCacheEntry(`${CACHE_PREFIX}po_0326`) : Promise.resolve(null)),
            is0301 ? getCacheEntry(`${CACHE_PREFIX}comeon_0301`) : Promise.resolve(null),
            is0301 ? getCacheEntry(`${CACHE_PREFIX}pr_0301`) : (is0326 ? getCacheEntry(`${CACHE_PREFIX}pr_0326`) : Promise.resolve(null)),
            is0326 ? getCacheEntry(`${CACHE_PREFIX}express_0326`) : Promise.resolve(null),
            is0326 ? getCacheEntry(`${CACHE_PREFIX}po_supplier`) : Promise.resolve(null),
            (!is0301 && !is0326) ? getCacheEntry(`${CACHE_PREFIX}status_read`) : Promise.resolve(null)
        ]);

        // Critical data must be present
        if (cInv && cUsage && cMainsap) {
            const dataAvg = cAvg ? cAvg.data : [];
            const dataStatus = cStatus ? cStatus.data : [];
            const dataLoc = cLoc ? cLoc.data : [];
            const dataShelf = cShelf ? cShelf.data : [];
            const dataNote = cNote ? cNote.data : [];
            const dataStatusGas = cStatusRead ? cStatusRead.data : [];
            const dataPo = cPo ? cPo.data : [];
            const dataComeon = cComeon ? cComeon.data : [];
            const dataPr = cPr ? cPr.data : [];
            const dataExpress = cExpress ? cExpress.data : [];
            const dataPoSupplier = cPoSupplier ? cPoSupplier.data : [];

            // Render with cached data
            try {
                console.log("Rendering from cache...");
                processLoadedData(
                    cInv.data, cUsage.data, cMainsap.data, dataAvg, dataStatus, dataLoc, dataShelf, dataStatusGas,
                    dataPo, dataComeon, dataNote, dataPr, dataExpress, dataPoSupplier,
                    { ...options, filterSnapshot, isCache: true }
                );

                cachedDataUsed = true;
                toggleUI(false); // Show UI
                updateToast(true, "กำลังตรวจสอบข้อมูลล่าสุด...");
            } catch (err) {
                console.warn("Error rendering cache:", err);
                toggleUI(true); // Fallback to loader
            }
        } else {
            console.log("Cache missing or incomplete");
            toggleUI(true);
        }
    } else {
        toggleUI(true);
    }

    // --- 2. Network Fetch (Background or Foreground) ---
    try {
        const forceNetwork = true; // Always fetch fresh in background

        // Define transform to filter usage by plant
        const filterUsageByPlant = (data) => {
            if (!Array.isArray(data)) return [];
            return data.filter(r => normalizePlant(r.Plant || r.plant) === selectedPlantNormalized);
        };

        const [
            invRaw, usageRaw, mainsapRaw, avgValRaw, statusRaw,
            locationRaw, shelfRaw, statusGasRaw
        ] = await Promise.all([
            progressFetcher(inventoryUrl, `${CACHE_PREFIX}inv_${selectedPlant}`, forceNetwork, null, "Inventory"),
            progressFetcher(usageUrl, `${CACHE_PREFIX}usage_${selectedPlant}`, forceNetwork, filterUsageByPlant, "Usage"),
            progressFetcher(mainsapUrl, `${CACHE_PREFIX}mainsap`, forceNetwork, null, "Main SAP"),
            progressFetcher(avgValUrl, `${CACHE_PREFIX}avgval_compact_v1`, forceRefresh, (rows) => {
                if (!Array.isArray(rows)) return [];
                return rows.map(row => {
                    const materialKey = Object.keys(row).find(key => key.toLowerCase() === "material");
                    const avgKey = Object.keys(row).find(key => ["avgval", "avg_val"].includes(key.toLowerCase()));
                    const qtyKey = Object.keys(row).find(key => key.toLowerCase().includes("qty"));
                    const compact = {
                        Material: materialKey ? String(row[materialKey] ?? "").trim() : "",
                        AvgVal: avgKey ? row[avgKey] : 0
                    };
                    // Qty is also used to calculate subtotalMap for Plant 0301.
                    if (qtyKey) compact.Qty = row[qtyKey];
                    return compact;
                }).filter(row => row.Material);
            }, "Avg Value", AVG_VAL_CACHE_TTL_MS),
            progressFetcher(statusUrl, `${CACHE_PREFIX}status`, forceNetwork, null, "Status"),
            progressFetcher(locationUrl, `${CACHE_PREFIX}location`, forceNetwork, null, "Location"),
            progressFetcher(shelfUrl, `${CACHE_PREFIX}shelf`, forceNetwork, null, "Shelf"),
            (!is0301 && !is0326) ? safeFetchJson(statusReadUrl, `${CACHE_PREFIX}status_read`, forceNetwork) : Promise.resolve([])
        ]);

        const [poDataRaw, comeonDataRaw, noteDataRaw, prDataRaw, express0326Raw, poSupplierRaw] = await Promise.all([
            is0301 ? safeFetchJson(po0301Url, `${CACHE_PREFIX}po_0301`, forceNetwork) : (is0326 ? safeFetchJson(po0326Url, `${CACHE_PREFIX}po_0326`, forceNetwork) : Promise.resolve([])),
            is0301 ? safeFetchJson(comeon0301Url, `${CACHE_PREFIX}comeon_0301`, forceNetwork) : Promise.resolve([]),
            is0301 ? safeFetchJson(note0301Url, `${CACHE_PREFIX}note_all`, forceNetwork) : Promise.resolve([]),
            is0301 ? safeFetchJson(pr0301Url, `${CACHE_PREFIX}pr_0301`, forceNetwork, null, "Purchase Requisitions") : (is0326 ? safeFetchJson(pr0326Url, `${CACHE_PREFIX}pr_0326`, forceNetwork, null, "Purchase Requisitions") : Promise.resolve([])),
            is0326 ? safeFetchJson(express0326Url, `${CACHE_PREFIX}express_0326`, forceNetwork, null, "Express Orders") : Promise.resolve([]),
            is0326 ? safeFetchJson(poSupplierDataUrl, `${CACHE_PREFIX}po_supplier`, forceNetwork, null, "PO Supplier") : Promise.resolve([])
        ]);

        updateProgress(95, "โหลดข้อมูลครบแล้ว กำลังประมวลผล...");

        // Render with fresh data
        processLoadedData(
            invRaw, usageRaw, mainsapRaw, avgValRaw, statusRaw, locationRaw, shelfRaw, statusGasRaw,
            poDataRaw, comeonDataRaw, noteDataRaw, prDataRaw, express0326Raw, poSupplierRaw,
            { ...options, filterSnapshot, isCache: false }
        );

        updateProgress(100, "Done!");

        updateToast(true, "ข้อมูลเป็นปัจจุบันแล้ว");
        const toast = document.querySelector('.update-toast');
        if (toast) toast.classList.add('success');

        setTimeout(() => {
            updateToast(false);
            if (toast) toast.classList.remove('success');
        }, 3000);

        if (!cachedDataUsed) toggleUI(false);

    } catch (e) {
        updateToast(false);
        if (!cachedDataUsed) {
            toggleUI(false); // Hide loader so error alert is visible
            console.error("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรช", e);
            alert("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรช: " + (e.message || e));
        } else {
            console.warn("Background fetch failed, keeping cached data", e);
            updateToast(true, "ไม่สามารถอัปเดตข้อมูลล่าสุดได้");
            setTimeout(() => updateToast(false), 3000); // Hide error toast after 3s
        }
    }
}

function processLoadedData(invRaw, usageRaw, mainsapRaw, avgValRaw, statusRaw, locationRaw, shelfRaw, statusGasRaw, poDataRaw, comeonDataRaw, noteDataRaw, prDataRaw, express0326Raw, poSupplierRaw, options) {
    const loader = document.getElementById("loader");
    const ensureArray = (data) => Array.isArray(data) ? data : [];
    const inv = ensureArray(invRaw);
    const usage = ensureArray(usageRaw);
    const mainsap = ensureArray(mainsapRaw);
    const avgValData = ensureArray(avgValRaw);
    const statusData = ensureArray(statusRaw);
    const locationData = ensureArray(locationRaw);
    const shelfData = ensureArray(shelfRaw);
    const filterSnapshot = options.filterSnapshot;

    // Helpers extracted from original loadData
    const toNumber = (v) => {
        if (v == null || v === '') return 0;
        const n = parseFloat(String(v).replace(/,/g, ''));
        return isNaN(n) ? 0 : n;
    };
    const normalizeKey = (k) => (k || "").toString().toLowerCase().replace(/[\s._-]+/g, ' ').trim();
    const findKey = (keys, predicate) => keys.find(k => predicate(normalizeKey(k)));
    const normalizePlant = (val) => {
        const raw = (val || "").toString().trim();
        if (!raw) return "";
        const numeric = parseFloat(raw.toString().replace(/,/g, ""));
        if (Number.isFinite(numeric)) return Math.round(numeric).toString().padStart(4, "0");
        const digits = raw.replace(/\D/g, "");
        if (!digits) return raw;
        return digits.padStart(4, "0");
    };
    const normalizeMatStatus = (val) => {
        let s = (val || "").toString().trim();
        if (s.startsWith("'")) s = s.substring(1);
        return s.replace(/^0+/, "") || s;
    };
    const extractPlannedDelivTime = (row) => toNumber(
        row["Planned Deliv. Time"] ||
        row["Planned Deliv Time"] ||
        row["PlannedDelivTime"] ||
        row["Planned Delivery Time"] ||
        row["PlannedDeliveryTime"] ||
        row["PlannedDeliv"] ||
        0
    );

    const is0301 = normalizePlant(selectedPlant) === "0301";
    const is0326 = normalizePlant(selectedPlant) === "0326";

    // --- Processing Logic ---

    const statusGasMap = new Map();
    if (Array.isArray(statusGasRaw)) {
        statusGasRaw.forEach(r => {
            const p = normalizePlant(r.Plant || r.plant);
            const m = normalizeMatStatus(r.Material || r.material);
            const s = (r.Status || r.status || "").toString().trim();
            if (p && m) statusGasMap.set(`${p}-${m}`, s);
        });
    }

    const poData = ensureArray(poDataRaw);
    window.poRawData = poData;
    const comeonData = ensureArray(comeonDataRaw);
    const noteData = ensureArray(noteDataRaw);
    const prData = ensureArray(prDataRaw);
    const navanakornMap = new Map();

    locationData.forEach(r => {
        const mat = (r.Material || '').toString().trim();
        const navQty = toNumber(r.Unrestricted || r["Unrestricted"] || 0);
        if (mat) {
            navanakornMap.set(mat, navQty);
        }
    });

    const lt0301Map = new Map();
    locationData.forEach(r => {
        const mat = (r.Material || '').toString().trim();
        if (!mat) return;
        const lt = extractPlannedDelivTime(r);
        if (lt) lt0301Map.set(mat, lt);
    });

    const plantStockMap = new Map();
    inv.forEach(r => {
        const plant = (r.Plant || '').toString().trim();
        const material = (r.Material || '').toString().trim();
        if (plant !== selectedPlant || !material) return;
        const unrestricted = toNumber(r.Unrestricted || r["Unrestricted stock"] || 0);
        plantStockMap.set(material, unrestricted);
    });

    const statusMap = new Map();
    statusData.forEach(r => {
        const plant = (r.Plant || '').toString().trim();
        const material = (r.Material || '').toString().trim();
        let status = '';
        const keys = Object.keys(r);
        const statusKeys = keys.filter(k =>
            k.toLowerCase().includes('statusmaterial') ||
            k.toLowerCase().includes('status material') ||
            k.toLowerCase().includes('\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E27\u0E31\u0E2A\u0E14\u0E38')
        );
        if (statusKeys.length > 0) status = (r[statusKeys[0]] || '').toString().trim();
        else {
            const alt = keys.filter(k => k.toLowerCase().includes('status'));
            if (alt.length > 0) status = (r[alt[0]] || '').toString().trim();
        }
        if (plant && material) {
            const key = `${plant}-${material}`;
            if (status) statusMap.set(key, status);
        }
    });

    const avgValMap = new Map();
    avgValData.forEach(r => {
        const material = (r.Material || '').toString().trim();
        const avgVal = toNumber(r.AvgVal || r.AvgVAL || r.avgval || 0);
        if (material) avgValMap.set(material, avgVal);
    });

    const usageMap = new Map();
    usage.forEach(r => {
        const plant = (r.Plant || '').toString().trim();
        const material = (r.Material || '').toString().trim();
        if (!plant || !material) return;
        const key = `${plant}-${material}`;
        let qty2m = 0, qty3m = 0, qty4m = 0, qty6m = 0, thirtyDay = 0, sale = 0;
        const keys = Object.keys(r);
        const k2 = keys.filter(k => {
            const lower = k.toLowerCase();
            return lower.includes('2m') || lower.includes('2 month') || lower.includes('2mount');
        });
        if (k2.length > 0) qty2m = toNumber(r[k2[0]] || 0);
        const k3 = keys.filter(k => {
            const lower = k.toLowerCase();
            return lower.includes('3m') || lower.includes('3 month') || lower.includes('3mount');
        });
        if (k3.length > 0) qty3m = toNumber(r[k3[0]] || 0);
        const k4 = keys.filter(k => k.toLowerCase().includes('4m') || k.toLowerCase().includes('4 month') || k.toLowerCase().includes('qtyissu'));
        if (k4.length > 0) qty4m = toNumber(r[k4[0]] || 0);
        const k6 = keys.filter(k => k.toLowerCase().includes('6m') || k.toLowerCase().includes('6 month'));
        if (k6.length > 0) qty6m = toNumber(r[k6[0]] || 0);
        const k30 = keys.filter(k => k.toLowerCase().includes('30day') || k.toLowerCase().includes('30 day') || k.toLowerCase().includes('30'));
        if (k30.length > 0) thirtyDay = toNumber(r[k30[0]] || 0);
        const kSale = keys.filter(k => k.toLowerCase().includes('sale'));
        if (kSale.length > 0) sale = toNumber(r[kSale[0]] || 0);
        usageMap.set(key, {
            Qty2Month: qty2m,
            Qty3Month: qty3m,
            Qty4Month: qty4m,
            Qty6Month: qty6m || Math.round(qty4m * 1.5),
            ThirtyDay: thirtyDay,
            Sale: sale
        });
    });

    const mainsapMap = new Map();
    mainsap.forEach(r => {
        const mat = (r.Material || '').toString().trim();
        if (!mat) return;
        mainsapMap.set(mat, {
            Note: r['\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38'] || '',
            MultiplyUnit: r['\u0E04\u0E39\u0E13\u0E2B\u0E19\u0E48\u0E27\u0E22'] ? toNumber(r['\u0E04\u0E39\u0E13\u0E2B\u0E19\u0E48\u0E27\u0E22']) : 1,
            Product: r.Product || '',
            PartType: r['ประเภทอะไหล่'] || '',
            Rebuilt: (r['Rebuilt'] || r['rebuilt'] || '').toString().trim(),
            UnitPo: toNumber(
                r.UnitPo ||
                r["UnitPo"] ||
                r["Unit PO"] ||
                r["UnitPO"] ||
                r["Unit Po"] ||
                1
            ) || 1
        });
    });

    locationMap = new Map();
    locationData.forEach(r => {
        const material = (r.Material || '').toString().trim();
        if (!material) return;
        const keys = Object.keys(r);
        const storageKey =
            keys.find(k => k.toLowerCase().includes('storage') && k.toLowerCase().includes('bin')) ||
            keys.find(k => k.toLowerCase().includes('storagebin')) ||
            keys.find(k => k.toLowerCase().includes('bin'));
        if (!storageKey) return;
        const loc = (r[storageKey] || '').toString().trim();
        if (loc) locationMap.set(material, loc);
    });

    shelfOwnerMap = new Map();
    shelfData.forEach(r => {
        const shelf = (r.Shelf || '').toString().trim();
        const userId = (r.UserID || r.UserId || r.userid || '').toString().trim();
        if (shelf && userId) shelfOwnerMap.set(shelf, userId);
    });

    const poMap = new Map();
    const poDetailMap = new Map();
    const normalizeMaterialKey = (val) => {
        const raw = (val || "").toString().trim();
        if (!raw) return "";
        if (!is0326) return raw;
        if (/^\d+(\.0+)?$/.test(raw)) {
            const numeric = parseFloat(raw);
            if (Number.isFinite(numeric)) return String(Math.round(numeric));
        }
        if (/^\d+$/.test(raw)) {
            const stripped = raw.replace(/^0+/, "");
            return stripped === "" ? "0" : stripped;
        }
        const digitsOnly = raw.replace(/\D/g, "");
        if (digitsOnly) {
            const stripped = digitsOnly.replace(/^0+/, "");
            return stripped === "" ? "0" : stripped;
        }
        return raw;
    };

    const getMaterialFromRow = (row) => {
        if (!row || typeof row !== "object") return "";
        const keys = Object.keys(row);
        const materialKey = findKey(keys, (lower) => {
            if (lower === "material") return true;
            if (lower.includes("material code")) return true;
            if (lower.includes("material number")) return true;
            if (lower.includes("material no")) return true;
            if (lower.includes("material")) return true;
            return false;
        });
        if (materialKey) return row[materialKey];
        return row.Material || row["Material Code"] || row["Material number"] || row["Material Number"] || "";
    };

    const comeonMap = new Map();
    if (is0301 && Array.isArray(comeonData)) {
        comeonData.forEach(r => {
            const material = getMaterialFromRow(r).toString().trim();
            if (!material) return;
            const callVal = (r.Call || "").toString().trim();
            comeonMap.set(normalizeMaterialKey(material), callVal);
        });
    }

    const selectedPlantNormalized = normalizePlant(selectedPlant);

    // Build set of timestamped PO numbers from PoSupplier
    const timestampedPoSet = new Set();
    if (is0326 && Array.isArray(poSupplierRaw)) {
        poSupplierRaw.forEach(r => {
            const po = (r.PO || r.Po || r.po || "").toString().trim();
            if (po) timestampedPoSet.add(po);
        });
    }

    const populatePoMaps = (filterPlant) => {
        if (!(is0301 || is0326) || !Array.isArray(poData)) return;
        poData.forEach(r => {
            const plantVal = normalizePlant(r.Plant || r.plant || "");
            if (filterPlant) {
                if (plantVal && plantVal !== selectedPlantNormalized) return;
            }
            const keys = Object.keys(r);
            // Add Storage Location filter for Plant 0326
            if (is0326 && plantVal === "0326") {
                const slocKey = keys.find(k => {
                    const low = k.toLowerCase();
                    return low.includes('storage') && low.includes('location') || low === 'sloc' || low === 'lgort';
                });
                if (slocKey) {
                    const sloc = (r[slocKey] || "").toString().trim();
                    if (sloc !== "M001") return;
                }
            }
            const material = getMaterialFromRow(r).toString().trim();
            if (!material) return;
            const materialKey = normalizeMaterialKey(material);
            const stillKey = findKey(keys, (lower) => {
                if (lower.includes('still') && lower.includes('deliver')) return true;
                if (lower.includes('open') && (lower.includes('qty') || lower.includes('quantity'))) return true;
                if (lower.includes('qty') && lower.includes('open')) return true;
                if (lower.includes('\u0E04\u0E49\u0E32\u0E07\u0E2A\u0E48\u0E07') || lower.includes('\u0E04\u0E07\u0E04\u0E49\u0E32\u0E07') || lower.includes('\u0E22\u0E2D\u0E14\u0E04\u0E49\u0E32\u0E07')) return true;
                if ((lower.includes('\u0E08\u0E33\u0E19\u0E27\u0E19') || lower.includes('\u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13')) && (lower.includes('\u0E04\u0E49\u0E32\u0E07') || lower.includes('\u0E2A\u0E48\u0E07\u0E04\u0E49\u0E32\u0E07'))) return true;
                return false;
            });
            const reqKey = findKey(keys, (lower) => {
                if ((lower.includes('quantity') || lower.includes('qty')) && (lower.includes('requested') || lower.includes('request') || lower.includes('req'))) return true;
                if (lower.includes('qtyreq') || lower.includes('qty req')) return true;
                if (lower.includes('\u0E08\u0E33\u0E19\u0E27\u0E19') && (lower.includes('\u0E02\u0E2D') || lower.includes('\u0E23\u0E49\u0E2D\u0E07\u0E02\u0E2D') || lower.includes('\u0E02\u0E2D\u0E2A\u0E31\u0E48\u0E07'))) return true;
                return false;
            });
            const stillQty = toNumber(
                stillKey ? r[stillKey] : 0
            );
            if (stillQty > 0) {
                const list = poDetailMap.get(materialKey) || [];
                const dateKey = keys.find(k => {
                    const lower = k.toLowerCase();
                    const hasDateWord = lower.includes('date') || lower.includes('\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E2A\u0E48\u0E07') || lower.includes('due');
                    const hasType = lower.includes('doc') || lower.includes('deliv') || lower.includes('\u0E01\u0E33\u0E2B\u0E19\u0E14') || lower.includes('due');
                    return hasDateWord && hasType;
                });
                const poNumber = (r["Purchase order"] || r["Purchase Order"] || r["PO"] || r["Purchasing Document"] || r["PurchasingDocument"] || "").toString().trim();
                const isTimestamped = is0326 && timestampedPoSet.has(poNumber);
                const shortText = (r["Short Text"] || r["ShortText"] || r["Short text"] || r["Description"] || "").toString().trim();
                list.push({
                    PurchasingDocument: poNumber,
                    Qty: stillQty,
                    Material: material,
                    ShortText: shortText,
                    isTimestamped: isTimestamped,
                    DocumentDate: dateKey
                        ? (r[dateKey] || '').toString().trim()
                        : (r["Purchase Order Date"] || r["Document Date"] || r["Doc Date"] || r["DocumentDate"] || "").toString().trim()
                });
                poDetailMap.set(materialKey, list);
            }
            // Only add to poMap if NOT timestamped
            const isTimestampedPo = is0326 && timestampedPoSet.has(
                (r["Purchase order"] || r["Purchase Order"] || r["PO"] || r["Purchasing Document"] || r["PurchasingDocument"] || "").toString().trim()
            );
            if (!isTimestampedPo) {
                const current = poMap.get(materialKey) || 0;
                poMap.set(materialKey, current + stillQty);
            }
        });
    };
    populatePoMaps(true);
    if (is0326 && poMap.size === 0) {
        poMap.clear();
        poDetailMap.clear();
        populatePoMaps(false);
    }

    const noteMap = new Map();
    if (Array.isArray(noteData)) {
        noteData.forEach(r => {
            const material = (r.Material || r["Material code"] || r["Material Code"] || "").toString().trim();
            if (!material) return;
            noteMap.set(material, {
                note: (r["\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38"] || r["Note"] || "").toString().trim(),
                activeFlag: (r["Acitive"] || r["Active"] || "").toString().trim(),
                orderSelect: (r["OrderSelect"] || "").toString().trim(),
                minOrder: toNumber(r["MinOrder"] || 0),
                rebuilt: (r["Rebuilt"] || "").toString().trim()
            });
        });
    }

    const prMap = new Map();
    const prDetailMap = new Map();
    const populatePrMaps = (filterPlant) => {
        if (!(is0301 || is0326) || !Array.isArray(prData)) return;
        prData.forEach(r => {
            const plantVal = normalizePlant(r.Plant || r.plant || "");
            if (filterPlant) {
                if (plantVal && plantVal !== selectedPlantNormalized) return;
            }
            const keys = Object.keys(r);
            // Add Storage Location filter for Plant 0326
            if (is0326 && plantVal === "0326") {
                const slocKey = keys.find(k => {
                    const low = k.toLowerCase();
                    return low.includes('storage') && low.includes('location') || low === 'sloc' || low === 'lgort';
                });
                if (slocKey) {
                    const sloc = (r[slocKey] || "").toString().trim();
                    if (sloc !== "M001") return;
                }
            }
            const material = getMaterialFromRow(r).toString().trim();
            if (!material) return;
            const materialKey = normalizeMaterialKey(material);
            const reqKey = findKey(keys, (lower) => {
                if ((lower.includes('quantity') || lower.includes('qty')) && (lower.includes('requested') || lower.includes('request') || lower.includes('req'))) return true;
                if (lower.includes('qtyreq') || lower.includes('qty req')) return true;
                if (lower.includes('\u0E08\u0E33\u0E19\u0E27\u0E19') && (lower.includes('\u0E02\u0E2D') || lower.includes('\u0E23\u0E49\u0E2D\u0E07\u0E02\u0E2D') || lower.includes('\u0E02\u0E2D\u0E2A\u0E31\u0E48\u0E07'))) return true;
                return false;
            });
            const ordKey = findKey(keys, (lower) => {
                if ((lower.includes('quantity') || lower.includes('qty')) && (lower.includes('ordered') || lower.includes('order'))) return true;
                if (lower.includes('qtyord') || lower.includes('qty ord')) return true;
                if (lower.includes('\u0E08\u0E33\u0E19\u0E27\u0E19') && (lower.includes('\u0E2A\u0E31\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27') || lower.includes('\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D'))) return true;
                return false;
            });
            const prKey = findKey(keys, (lower) => {
                if (lower.includes('purchase requisition')) return true;
                if (lower == 'pr' || lower.includes('pr no') || lower.includes('pr number')) return true;
                if (lower.includes('\u0E40\u0E25\u0E02\u0E17\u0E35\u0E48\u0020\u0070\u0072') || lower.includes('\u0E43\u0E1A\u0E02\u0E2D\u0E0B\u0E37\u0E49\u0E2D')) return true;
                return false;
            });
            const delivKey = findKey(keys, (lower) => {
                if (lower.includes('delivery date') || lower.includes('deliv date') || lower.includes('due date')) return true;
                if (lower.includes('\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E2A\u0E48\u0E07')) return true;
                return false;
            });
            const requested = toNumber(reqKey ? r[reqKey] : 0);
            const ordered = toNumber(ordKey ? r[ordKey] : 0);
            const diff = requested - ordered;
            const current = prMap.get(materialKey) || 0;
            prMap.set(materialKey, current + diff);
            if (diff !== 0) {
                const list = prDetailMap.get(materialKey) || [];
                list.push({
                    PrNumber: (prKey ? r[prKey] : (r["Purchase Requisition"] || r["PR"] || "")).toString().trim(),
                    Qty: diff,
                    DeliveryDate: delivKey ? (r[delivKey] || '').toString().trim() : (r["Delivery Date"] || '').toString().trim()
                });
                prDetailMap.set(materialKey, list);
            }
        });
    };
    populatePrMaps(true);
    if (is0326 && prMap.size === 0) {
        prMap.clear();
        prDetailMap.clear();
        populatePrMaps(false);
    }

    const subtotalMap = new Map();
    if (selectedPlant === "0301" && Array.isArray(avgValData)) {
        avgValData.forEach(r => {
            const material = (r.Material || '').toString().trim();
            if (!material) return;
            const keys = Object.keys(r);
            const qtyKey = findKey(keys, (lower) => lower === "qty" || lower.includes("qty"));
            const qty = toNumber(qtyKey ? r[qtyKey] : 0);
            if (!Number.isFinite(qty)) return;
            subtotalMap.set(material, (subtotalMap.get(material) || 0) + qty);
        });
    }

    const expressMap = new Map();
    if (selectedPlant === "0326" && Array.isArray(express0326Raw)) {
        express0326Raw.forEach(r => {
            const plantVal = (r.Plant || r.plant || "").toString().trim();
            if (plantVal && plantVal !== "0326") return;
            const material = (r.material || r.Material || "").toString().trim();
            if (!material) return;
            const statusVal = (r.status || r.Status || "").toString().trim();
            if (statusVal && statusVal !== "รอเบิก") return;
            const qty = toNumber(r.quantity || r.Qty || r.Quantity || 0);
            if (!Number.isFinite(qty)) return;
            expressMap.set(material, (expressMap.get(material) || 0) + qty);
        });
    }

    // Reset and populate allData
    allData = [];
    const useNoteOverride0301 = selectedPlant === "0301";
    inv.forEach(r => {
        const plant = (r.Plant || '').toString().trim();
        const material = (r.Material || '').toString().trim();
        if (plant !== selectedPlant || !material) return;
        const key = `${plant}-${material}`;
        const usageInfo = usageMap.get(key) || { Qty2Month: 0, Qty3Month: 0, Qty4Month: 0, Qty6Month: 0, ThirtyDay: 0, Sale: 0 };
        const main = mainsapMap.get(material) || { Note: '', MultiplyUnit: 1, Product: '', PartType: '', UnitPo: 1, Rebuilt: '' };
        let status = statusMap.get(key) || '';
        if (!is0301 && !is0326) {
            const matKey = normalizeMatStatus(material);
            const gasStatus = statusGasMap.get(`${normalizePlant(plant)}-${matKey}`);
            if (gasStatus) status = gasStatus;
            if (!status) status = "Active";
        }
        const avgVal = avgValMap.get(material) || 0;
        const noteOverride = noteMap.get(material) || null;
        if (useNoteOverride0301 && noteOverride && noteOverride.activeFlag) {
            status = noteOverride.activeFlag.toUpperCase() === "Y" ? "Active" : "Inactive";
        }
        const qty2m = usageInfo.Qty2Month || 0;
        const qty3m = usageInfo.Qty3Month || 0;
        const qty4m = usageInfo.Qty4Month;
        const qty6m = usageInfo.Qty6Month;
        const thirtyDay = usageInfo.ThirtyDay;
        const sale = usageInfo.Sale || 0;
        const unrestricted = toNumber(r.Unrestricted || r["Unrestricted stock"] || 0);
        const originalValue = toNumber(r["Value Unrestricted"] || r["Value unrestricted"] || 0);
        const description = r["Material description"] || '';
        const keys = Object.keys(r);
        let plannedDelivTime = extractPlannedDelivTime(r);
        if (is0326 && (!plannedDelivTime || plannedDelivTime === 0)) {
            const lt0301 = lt0301Map.get(material);
            if (lt0301) plannedDelivTime = lt0301;
        }
        const purchasingGroup = (r["Purchasing Group"] || r["PurchasingGroup"] || r["PurchasingGrp"] || '').toString().trim();
        let storageBin = '';
        const sk =
            keys.find(k => k.toLowerCase().includes('storage') && k.toLowerCase().includes('bin')) ||
            keys.find(k => k.toLowerCase().includes('storagebin')) ||
            keys.find(k => k.toLowerCase().includes('bin'));
        if (sk) storageBin = (r[sk] || '').toString().trim();
        let unit = r["Base Unit of Measure"] || '';
        if (!unit) {
            const uk = keys.find(k => k.toLowerCase().includes('unit') || k.toLowerCase().includes('uom'));
            if (uk) unit = (r[uk] || '').toString().trim();
        }
        const navanakornQty = navanakornMap.get(material) || 0;
        const subtotalRaw = subtotalMap.size ? (subtotalMap.get(material) ?? 0) : null;
        const subtotalMinus0301 = subtotalRaw != null ? (subtotalRaw - unrestricted) : null;
        let value = avgVal > 0 ? unrestricted * avgVal : originalValue;
        const location = locationMap.get(material) || storageBin || '';
        const shelf = location ? location.substring(0, 3) : '';
        const ownerId = shelfOwnerMap.get(shelf) || '';
        const ownerName = getOwnerName(ownerId);
        const rebuiltCode = (main.Rebuilt || (noteOverride ? noteOverride.rebuilt : '') || '').toString().trim();
        const rebuiltStock = rebuiltCode ? (plantStockMap.get(rebuiltCode) || 0) : 0;
        const expressQty = selectedPlant === "0326" ? (expressMap.get(material) || 0) : 0;
        const materialKey = normalizeMaterialKey(material);
        const poOutstanding0326 = poMap.get(materialKey) || 0;
        const poDetails0326 = poDetailMap.get(materialKey) || [];
        const poOutstandingDisplay = poOutstanding0326 * (Number(main.UnitPo || 1) || 1);

        let earliestPoDate = "";
        let earliestPoNumber = "";
        let earliestPoQty = null;

        if (poDetails0326.length > 0) {
            const getCalculatedDate = (dStr, lt) => {
                if (!dStr) return null;
                try {
                    let parsed = null;
                    const raw = dStr.toString().trim();
                    const dmy = raw.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
                    if (dmy) parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
                    if (!parsed || isNaN(parsed.getTime())) {
                        const ymd = raw.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
                        if (ymd) parsed = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
                    }
                    if (!parsed || isNaN(parsed.getTime())) parsed = new Date(raw);
                    if (parsed && !isNaN(parsed.getTime())) {
                        parsed.setDate(parsed.getDate() + (lt || 0));
                        return parsed;
                    }
                } catch (e) { }
                return null;
            };

            const enrichedPo = poDetails0326.map(p => {
                const computedDate = getCalculatedDate(p.DocumentDate, plannedDelivTime);
                let display = p.DocumentDate || "-";
                if (computedDate) {
                    const dd = String(computedDate.getDate()).padStart(2, '0');
                    const mm = String(computedDate.getMonth() + 1).padStart(2, '0');
                    const yyyy = computedDate.getFullYear();
                    display = `${dd}/${mm}/${yyyy}`;
                }
                return {
                    ...p,
                    parsedMs: computedDate ? computedDate.getTime() : Infinity,
                    displayDate: display
                };
            });

            const sortedPo = enrichedPo.sort((a, b) => a.parsedMs - b.parsedMs);
            const earliest = sortedPo[0];
            earliestPoDate = earliest.displayDate;
            earliestPoNumber = earliest.PurchasingDocument || "";
            earliestPoQty = earliest.Qty;
        }

        allData.push({
            Plant: plant,
            Material: material,
            Description: description,
            StorageBin: storageBin,
            RebuiltStock: rebuiltStock,
            Unit: unit,
            Navanakorn: navanakornQty,
            Unrestricted: unrestricted,
            SubtotalAllPlant: subtotalMinus0301,
            Value: value,
            Qty6Month: qty6m,
            Qty2Month: qty2m,
            Qty3Month: qty3m,
            Qty4Month: qty4m,
            ThirtyDay: thirtyDay,
            Sale: sale,
            AvgDailyUse: qty4m / 120 || 0,
            AvgMonthly: qty4m / 4,
            SafetyStock: 0, ROP: 0, DOS: 0, RecommendedOrder: 0, Mean: 0,
            ABCValue: "", CumPercent: 0, Moving: "",
            ReturnQty: 0, ReturnValue: 0,
            Note: (useNoteOverride0301 && noteOverride && noteOverride.note) ? noteOverride.note : main.Note,
            MultiplyUnit: main.MultiplyUnit,
            MinOrder: useNoteOverride0301 && noteOverride ? noteOverride.minOrder : 0,
            Rebuilt: main.Rebuilt || (noteOverride ? noteOverride.rebuilt : ''),
            Product: main.Product,
            PartType: main.PartType,
            AvgVal: avgVal,
            OriginalValue: originalValue,
            Status: status,
            PrOutstanding: prMap.get(materialKey) || 0,
            PrDetails: prDetailMap.get(materialKey) || [],
            OrderSelect: useNoteOverride0301 && noteOverride ? noteOverride.orderSelect : '',
            Comeon: useNoteOverride0301 ? (comeonMap.get(materialKey) || '') : '',
            Location: location,
            Shelf: shelf,
            OwnerId: ownerId,
            OwnerName: ownerName,
            LeadTimeDays: plannedDelivTime,
            PurchasingGroup: purchasingGroup,
            PoOutstanding: poOutstanding0326,
            PoOutstandingDisplay: poOutstandingDisplay,
            EarliestPoDate: earliestPoDate,
            EarliestPoNumber: earliestPoNumber,
            EarliestPoQty: earliestPoQty,
            PoDetails: poDetails0326,
            TimestampedPoList: Array.from(timestampedPoSet),
            ActualOrder: null,
            _actualOrderTouched: false,
            OutExpress: expressQty
        });
    });

    try {
        if (typeof loadActualOrdersFromCloud === 'function') {
            loadActualOrdersFromCloud();
        } else {
            console.warn("loadActualOrdersFromCloud is not defined");
        }
    } catch (err) {
        console.error("Error in loadActualOrdersFromCloud:", err);
    }

    try {
        if (typeof calcABCValue === 'function') {
            calcABCValue();
        }
    } catch (err) {
        console.error("Error in calcABCValue:", err);
    }

    try {
        if (typeof populatePrgFilter === 'function') {
            populatePrgFilter();
        }
    } catch (err) {
        console.error("Error in populatePrgFilter:", err);
    }

    // UI Updates
    const plantFilter = document.getElementById("plantFilter");
    plantFilter.innerHTML = '';
    const name = plantNames[selectedPlant] || selectedPlant;
    plantFilter.add(new Option(`${selectedPlant} - ${name}`, selectedPlant));
    plantFilter.disabled = true;

    const plantGroup = plantFilter.closest('.plant-group');
    if (plantGroup) plantGroup.style.display = 'none';

    // Update header title dynamically
    const headerH1 = document.querySelector('h1');
    const plantLabel = name.startsWith('คลัง') ? name : `คลัง${name}`;
    if (headerH1) {
        const suffix = movementHtml ? `<br><span style="font-size:0.7em; font-weight:normal;">${movementHtml}</span>` : "";
        headerH1.innerHTML = `ABC Analysis & Smart Ordering System ${plantLabel}${suffix}`;
    }
    document.title = `ABC Analysis & Smart Ordering System ${plantLabel}`;

    const dataTable = document.getElementById("dataTable");
    if (dataTable) {
        dataTable.classList.toggle("hide-lt", !(is0301 || is0326));
        dataTable.classList.toggle("hide-nav", is0301);
        dataTable.classList.toggle("hide-0301-only", !is0301);
        dataTable.classList.toggle("hide-po-pr", !(is0301 || is0326));
        dataTable.classList.toggle("hide-subtotal", !is0301);
        dataTable.classList.toggle("hide-express", !is0326);
        dataTable.classList.toggle("hide-sale", !is0326);
    }
    document.querySelectorAll(".lt-filter").forEach(el => {
        el.style.display = is0301 ? "none" : "";
    });
    document.querySelectorAll(".orderselect-filter").forEach(el => {
        el.style.display = is0301 ? "" : "none";
    });
    document.querySelectorAll(".comeon-filter").forEach(el => {
        el.style.display = is0301 ? "" : "none";
    });
    document.querySelectorAll(".product-filter").forEach(el => {
        el.style.display = is0301 ? "" : "none";
    });

    const updateBtn = document.getElementById("updateBtn");
    if (sheetIds[selectedPlant]) {
        updateBtn.style.display = "inline-flex";
        updateBtn.onclick = () => {
            const sheetId = sheetIds[selectedPlant];
            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
            window.open(url, '_blank');
        };
    } else {
        updateBtn.style.display = "none";
    }

    // Last Update Time (only run if not cache to avoid stale time display, or we can run it anyway)
    // Actually we should perform this check in background too.
    const lastLabel = document.getElementById("lastUpdateLabel");
    const currentApiUrl = lastUpdateApiByPlant[selectedPlant] ||
        (sheetIds[selectedPlant] ? `${lastUpdateApiBase}?id=${sheetIds[selectedPlant]}` : null);
    const navApiUrl = lastUpdateApiByPlant["0301"] ||
        (sheetIds["0301"] ? `${lastUpdateApiBase}?id=${sheetIds["0301"]}` : null);

    const formatThTime = (rawTime) => {
        if (!rawTime) return "";
        const dt = new Date(rawTime);
        return dt.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    const fetchUpdateTime = (url) => {
        if (!url) return Promise.resolve("");
        return fetch(url)
            .then(res => res.json())
            .then(data => formatThTime(
                data.modifiedTime || data.modified_time || data.lastModifiedTime || data.lastModified
            ))
            .catch(err => {
                console.error('Error fetch modifiedTime', err);
                return "";
            });
    };

    if (currentApiUrl || navApiUrl) {
        lastLabel.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E40\u0E27\u0E25\u0E32\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15...";
        Promise.all([
            fetchUpdateTime(currentApiUrl),
            selectedPlant === "0301" ? Promise.resolve("") : fetchUpdateTime(navApiUrl)
        ]).then(([currentTime, navTime]) => {
            const currentLabel = currentTime
                ? `\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14 (${selectedPlant}): ${currentTime}`
                : `\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E25\u0E32\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15 (${selectedPlant})`;
            if (selectedPlant === "0301") {
                lastLabel.textContent = currentLabel;
                return;
            }
            const navLabel = navTime
                ? `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2D\u0E31\u0E1E\u0E40\u0E14\u0E15\u0E04\u0E25\u0E31\u0E07\u0E19\u0E27\u0E19\u0E04\u0E23: ${navTime}`
                : "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E25\u0E32\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E04\u0E25\u0E31\u0E07\u0E19\u0E27\u0E19\u0E04\u0E23";
            lastLabel.textContent = `${currentLabel} | ${navLabel}`;
        });
    } else {
        lastLabel.textContent = "\u0E44\u0E21\u0E48\u0E1E\u0E1A API \u0E40\u0E27\u0E25\u0E32\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15";
    }

    if (options.preserveFilters && filterSnapshot) {
        mode = filterSnapshot.mode;
        abcFilter = filterSnapshot.abcFilter;
        movingFilter = filterSnapshot.movingFilter;
        sortKey = filterSnapshot.sortKey;
        sortDir = filterSnapshot.sortDir;
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el != null) el.value = value;
        };
        setValue("searchInput", filterSnapshot.search);
        setValue("statusFilter", filterSnapshot.status);
        setValue("responsibleFilter", filterSnapshot.responsible);
        setValue("prgFilter", filterSnapshot.prg);
        setValue("orderSelectFilter", filterSnapshot.orderSelect);
        setValue("comeonFilter", filterSnapshot.comeon);
        setValue("productFilter", filterSnapshot.product);
        setValue("orderDiffFilter", filterSnapshot.orderDiff);
        setValue("leadTimeDays", filterSnapshot.leadTime);
        setValue("safetyDays", filterSnapshot.safety);
        setValue("coverDays", filterSnapshot.cover);
        const params = {
            leadTime: parseInt(document.getElementById("leadTimeDays")?.value) || 5,
            safety: parseInt(document.getElementById("safetyDays")?.value) || 3,
            cover: parseInt(document.getElementById("coverDays")?.value) || 40
        };
        calcABCValue();
        recalculateStockFields(allData, params);
        applyFiltersAndRender();
        const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
        currentPage = Math.min(Math.max(1, filterSnapshot.currentPage), totalPages);
        renderTable();
        renderPagination();
    } else {
        setDefaultAndCalculate();
    }
}
