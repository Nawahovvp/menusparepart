// Web Worker for data processing
// This worker handles heavy data processing in the background to keep UI responsive

// Helper functions (copied from main thread for worker isolation)
const toNumber = (v) => {
    if (v == null || v === '') return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
};

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

const normalizeKey = (k) => (k || "").toString().toLowerCase().replace(/[\s._-]+/g, ' ').trim();
const findKey = (keys, predicate) => keys.find(k => predicate(normalizeKey(k)));

const normalizeMaterialKey = (val, is0326) => {
    const raw = (val || "").toString().trim();
    if (!raw) return "";
    if (!is0326) return raw;
    if (/^\d+(\\.0+)?$/.test(raw)) {
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

const getOwnerName = (userId) => {
    // Simplified version - in real implementation this would use employees data
    return userId || '';
};

// Main worker message handler
self.onmessage = function (e) {
    const {
        invRaw, usageRaw, mainsapRaw, avgValRaw, statusRaw,
        locationRaw, shelfRaw, statusGasRaw,
        poDataRaw, noteDataRaw, prDataRaw, express0326Raw,
        selectedPlant, selectedPlantNormalized, is0301, is0326
    } = e.data;

    try {
        // Send progress updates
        self.postMessage({ type: 'progress', message: 'Building data maps...' });

        const ensureArray = (data) => Array.isArray(data) ? data : [];
        const inv = ensureArray(invRaw);
        const usage = ensureArray(usageRaw);
        const mainsap = ensureArray(mainsapRaw);
        const avgValData = ensureArray(avgValRaw);
        const statusData = ensureArray(statusRaw);
        const locationData = ensureArray(locationRaw);
        const shelfData = ensureArray(shelfRaw);
        const poData = ensureArray(poDataRaw);
        const noteData = ensureArray(noteDataRaw);
        const prData = ensureArray(prDataRaw);

        // Build statusGasMap
        const statusGasMap = new Map();
        if (Array.isArray(statusGasRaw)) {
            statusGasRaw.forEach(r => {
                const p = normalizePlant(r.Plant || r.plant);
                const m = normalizeMatStatus(r.Material || r.material);
                const s = (r.Status || r.status || "").toString().trim();
                if (p && m) statusGasMap.set(`${p}-${m}`, s);
            });
        }

        // Consolidated locationData processing (optimized single pass)
        const navanakornMap = new Map();
        const lt0301Map = new Map();
        const locationMap = new Map();

        // Helper to process location/0301 data
        const processLocationRow = (r) => {
            const mat = (r.Material || '').toString().trim();
            if (!mat) return;

            // Build navanakornMap
            const navQty = toNumber(r.Unrestricted || r["Unrestricted"] || 0);
            navanakornMap.set(mat, navQty);

            // Build lt0301Map
            const lt = extractPlannedDelivTime(r);
            if (lt) lt0301Map.set(mat, lt);

            // Build locationMap
            const keys = Object.keys(r);
            const storageKey =
                keys.find(k => k.toLowerCase().includes('storage') && k.toLowerCase().includes('bin')) ||
                keys.find(k => k.toLowerCase().includes('storagebin')) ||
                keys.find(k => k.toLowerCase().includes('bin'));
            if (storageKey) {
                const loc = (r[storageKey] || '').toString().trim();
                if (loc) locationMap.set(mat, loc);
            }
        };

        // ถ้าเป็น 0301 และไม่ได้โหลด locationData มา (เพราะ Optimization) ให้ใช้ inv แทน
        if (is0301 && locationData.length === 0) {
            inv.forEach(processLocationRow);
        } else {
            locationData.forEach(processLocationRow);
        }

        // Build plantStockMap
        const plantStockMap = new Map();
        inv.forEach(r => {
            const plant = (r.Plant || '').toString().trim();
            const material = (r.Material || '').toString().trim();
            if (plant !== selectedPlant || !material) return;
            const unrestricted = toNumber(r.Unrestricted || r["Unrestricted stock"] || 0);
            plantStockMap.set(material, unrestricted);
        });

        self.postMessage({ type: 'progress', message: 'Processing status and usage data...' });

        // Build statusMap
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

        // Build avgValMap
        const avgValMap = new Map();
        avgValData.forEach(r => {
            const material = (r.Material || '').toString().trim();
            const avgVal = toNumber(r.AvgVal || r.AvgVAL || r.avgval || 0);
            if (material) avgValMap.set(material, avgVal);
        });

        // Build usageMap
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

        self.postMessage({ type: 'progress', message: 'Building product and order maps...' });

        // Build mainsapMap
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

        // Build shelfOwnerMap
        const shelfOwnerMap = new Map();
        shelfData.forEach(r => {
            const shelf = (r.Shelf || '').toString().trim();
            const userId = (r.UserID || r.UserId || r.userid || '').toString().trim();
            if (shelf && userId) shelfOwnerMap.set(shelf, userId);
        });

        // Build PO maps
        const poMap = new Map();
        const poDetailMap = new Map();
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
                const materialKey = normalizeMaterialKey(material, is0326);
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
                    stillKey ? r[stillKey] : (is0326 && reqKey ? r[reqKey] : 0)
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
                    list.push({
                        PurchasingDocument: poNumber,
                        Qty: stillQty,
                        DocumentDate: dateKey
                            ? (r[dateKey] || '').toString().trim()
                            : (r["Purchase Order Date"] || r["Document Date"] || r["Doc Date"] || r["DocumentDate"] || "").toString().trim()
                    });
                    poDetailMap.set(materialKey, list);
                }
                const current = poMap.get(materialKey) || 0;
                poMap.set(materialKey, current + stillQty);
            });
        };
        populatePoMaps(true);
        if (is0326 && poMap.size === 0) {
            poMap.clear();
            poDetailMap.clear();
            populatePoMaps(false);
        }

        // Build noteMap
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

        self.postMessage({ type: 'progress', message: 'Processing PR and express data...' });

        // Build PR maps
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
                const materialKey = normalizeMaterialKey(material, is0326);
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

        // Build subtotalMap
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

        // Build expressMap
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

        self.postMessage({ type: 'progress', message: 'Building final data array...' });

        // Build allData array
        const allData = [];
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
            const materialKey = normalizeMaterialKey(material, is0326);
            const poOutstanding0326 = poMap.get(materialKey) || 0;
            const poDetails0326 = poDetailMap.get(materialKey) || [];
            const poOutstandingDisplay = poOutstanding0326 * (Number(main.UnitPo || 1) || 1);

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
                Location: location,
                Shelf: shelf,
                OwnerId: ownerId,
                OwnerName: ownerName,
                LeadTimeDays: plannedDelivTime,
                PurchasingGroup: purchasingGroup,
                PoOutstanding: poOutstanding0326,
                PoOutstandingDisplay: poOutstandingDisplay,
                PoDetails: poDetails0326,
                ActualOrder: null,
                _actualOrderTouched: false,
                OutExpress: expressQty
            });
        });

        // Send completed data back to main thread
        self.postMessage({
            type: 'complete',
            allData: allData,
            locationMap: Array.from(locationMap.entries()),
            shelfOwnerMap: Array.from(shelfOwnerMap.entries())
        });

    } catch (error) {
        self.postMessage({
            type: 'error',
            message: error.message,
            stack: error.stack
        });
    }
};
