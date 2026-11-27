// ========= Address Tab Functions =========
// Data URLs
const TAMBON_URL = 'https://opensheet.elk.sh/1nFPg1H7cormRa8HbbzzVH5IzX61yiS6ilrUtcuthSXY/Tambonbase';
const PROVINCE_URL = 'https://opensheet.elk.sh/1nFPg1H7cormRa8HbbzzVH5IzX61yiS6ilrUtcuthSXY/ProvinceDatabase';
// ใส่ URL ของ Web App ที่ได้จากการ Deploy Code.gs ตรงนี้
const ADDRESS_SAVE_URL = 'https://script.google.com/macros/s/AKfycbxd4gx3XehYabf-hzfUcFbGLHNKDnMPONY009WS5evAuHoAmHmLAqExQj0rt0ZtKaeP/exec';
const NAME_REC_SAVE_URL = 'https://script.google.com/macros/s/AKfycbyK0J1Tma75o-uZBYz7RtI7Dw3OWoKVygEdoHb0uGEsnlD6UbdDkJWgqaEIbXmtm42k/exec';
let tambonDB = [];
let provinceDB = [];
let editingAddressId = null;
let currentStationData = null; // เก็บข้อมูล Station ปัจจุบันที่กำลังดูรายละเอียด

function formatPhoneNumber(phone) {
    if (!phone) return '';
    const str = String(phone).trim();
    let cleaned = str.replace(/\D/g, '');
    if (cleaned.length === 9 && !cleaned.startsWith('0')) {
        cleaned = '0' + cleaned;
    }
    if (cleaned.length === 10) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (cleaned.length === 9) {
        return cleaned.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return str;
}

async function loadAddressData() {
    try {
        const res = await fetch(ADDRESS_URL);
        const data = await res.json();
        addressDB = data;

        // Load NameRec Data
        try {
            const resName = await fetch(NAME_REC_URL);
            nameRecDB = await resName.json();
            console.log(`[ADDRESS] Loaded ${nameRecDB.length} name records`);
        } catch (errName) {
            console.error('[ADDRESS] NameRec Load error:', errName);
            nameRecDB = [];
        }

        console.log(`[ADDRESS] Loaded ${addressDB.length} address records`);

        // Log all unique plants in database
        const uniquePlants = [...new Set(addressDB.map(r => String(r.Plantname || r.PLANTNAME || '').trim()))];
        console.log(`[ADDRESS] Available plants:`, uniquePlants);

        // Log all records for debugging
        console.log(`[ADDRESS] Sample records:`, addressDB.slice(0, 5));

        populateAddressPlantSelect();
        const addressStatusEl = document.getElementById('addressStatus');
        if (addressStatusEl) {
            addressStatusEl.textContent = `โหลดข้อมูล Address สำเร็จ (${addressDB.length} รายการ)`;
        }
    } catch (err) {
        console.error('[ADDRESS] Load error:', err);
        const addressStatusEl = document.getElementById('addressStatus');
        if (addressStatusEl) {
            addressStatusEl.textContent = 'โหลดข้อมูล Address ไม่สำเร็จ';
        }
    }
}

function populateAddressPlantSelect() {
    const senderSelect = document.getElementById('senderPlantSelect');

    const dbPlants = new Set(addressDB.map(row => String(row.Plantname || row.PLANTNAME || '').trim()).filter(p => p));

    // Add plants from global PLANT_NAMES if available
    // if (typeof PLANT_NAMES !== 'undefined') {
    //     Object.values(PLANT_NAMES).forEach(name => dbPlants.add(name));
    // }

    const plants = [...dbPlants].sort();

    const optionsHTML = '<option value="">-- เลือก Plant --</option>' +
        plants.map(plant => `<option value="${plant}">${plant}</option>`).join('');

    if (senderSelect) {
        senderSelect.innerHTML = optionsHTML;
    }

    // Initialize Recipient Filters (Plant, Station, Name)
    initRecipientFilters();

    // Initialize Sender Filters
    initSenderFilters();
}

function populateAddressStationSelect(plant, type) {
    if (type === 'recipient' || type === 'sender') return; // Handled by updateRecipientFilters/updateSenderFilters
    const prefix = type === 'sender' ? 'sender' : 'recipient';
    const stationSelect = document.getElementById(`${prefix}StationSelect`);
    if (!stationSelect) return;

    // Filter rows for this plant - improve string matching
    const plantNormalized = plant.trim();
    const rows = addressDB.filter(row => {
        const rowPlant = String(row.Plantname || row.PLANTNAME || '').trim();
        return rowPlant === plantNormalized;
    });

    console.log(`[DEBUG] Plant: "${plant}", Found rows: ${rows.length}`);
    if (rows.length === 0) {
        console.log(`[DEBUG] Available plants in DB:`, [...new Set(addressDB.map(r => String(r.Plantname || r.PLANTNAME || '').trim()))]);
    }

    // Get unique stations and filter out empty strings
    const stations = [...new Set(rows.map(row => String(row.Station || row.STATION || '').trim()).filter(s => s))].sort();

    stationSelect.innerHTML = '<option value="">-- เลือก ป้ายสถานที่ --</option>';
    // If no stations found (e.g. new plant), add a default '-' option
    if (stations.length === 0) {
        const option = document.createElement('option');
        option.value = '-';
        option.textContent = '-';
        stationSelect.appendChild(option);
        stationSelect.value = '-';
    } else {
        stations.forEach(st => {
            const option = document.createElement('option');
            option.value = st;
            option.textContent = st || '(ไม่ระบุ)';
            stationSelect.appendChild(option);
        });

        // If only 1 station (or 1 empty station), select it automatically
        if (stations.length === 1) {
            stationSelect.value = stations[0];
        }
    }

    // Trigger fill info
    fillAddressInfo(plant, stationSelect.value, type);
}

function fillAddressInfo(plant, station, type) {
    if (type === 'recipient' || type === 'sender') return; // Handled by fillRecipientInfo/fillSenderInfo
    const plantNormalized = String(plant || '').trim();
    const stationNormalized = String(station || '').trim();

    const addressData = addressDB.find(row => {
        const p = String(row.Plantname || row.PLANTNAME || '').trim() === plantNormalized;
        const s = String(row.Station || row.STATION || '').trim() === stationNormalized;
        return p && s;
    });

    console.log(`[FILL] Searching: Plant="${plantNormalized}", Station="${stationNormalized}"`);
    console.log(`[FILL] Found:`, addressData ? 'Yes' : 'No');

    // type: 'sender' or 'recipient'
    const prefix = type === 'sender' ? 'sender' : 'recipient';
    const nameInput = document.getElementById(`${prefix}NameInput`);
    const mobileInput = document.getElementById(`${prefix}MobileInput`);
    const addressInput = document.getElementById(`${prefix}AddressInput`);

    if (!addressData) {
        if (nameInput) nameInput.value = '';
        if (mobileInput) mobileInput.value = '';
        if (addressInput) addressInput.value = '';
        if (type === 'recipient') {
            const editBtn = document.getElementById('editRecipientBtn');
            if (editBtn) editBtn.style.display = 'none';
        }
        return;
    }

    // Find Name Data from NameRec using IDRec
    const nameData = nameRecDB.find(n => String(n.IDRec || n.idrec || '').trim() === String(addressData.IDRec || addressData.idrec || '').trim());

    if (nameInput) nameInput.value = nameData ? (nameData.NameX || nameData.namex || '') : '';
    if (mobileInput) {
        const rawMobile = nameData ? (nameData.Mobile || nameData.mobile || '') : '';
        mobileInput.value = formatPhoneNumber(rawMobile);
    }

    const home = addressData.Address3 || addressData.ADDRESS3 || '';
    const tumbol = addressData.Tambon || addressData.TAMBON || '';
    const district = addressData.District || addressData.DISTRICT || '';
    const province = addressData.Province || addressData.PROVINCE || '';
    const post = addressData.Post || addressData.POST || '';

    const addressParts = [home, tumbol, district, province, post].filter(p => p);
    if (addressInput) addressInput.value = addressParts.join(' ');
}

// ========= New Recipient Filter Logic =========

function initRecipientFilters() {
    const plantSelect = document.getElementById('recipientPlantSelect');
    if (!plantSelect) return;

    // Populate Plant Select
    const dbPlants = new Set(addressDB.map(row => String(row.Plantname || row.PLANTNAME || '').trim()).filter(p => p));
    const plants = [...dbPlants].sort();

    plantSelect.innerHTML = '<option value="">-- เลือก Plant --</option>' +
        plants.map(plant => `<option value="${plant}">${plant}</option>`).join('');

    // Trigger update to populate Station/Name
    updateRecipientFilters('init');
}

function updateRecipientFilters(trigger) {
    const plantSelect = document.getElementById('recipientPlantSelect');
    const stationSelect = document.getElementById('recipientStationSelect');
    const nameSelect = document.getElementById('recipientNameSelect');

    if (!plantSelect || !stationSelect || !nameSelect) return;

    let pVal = plantSelect.value;
    let sVal = stationSelect.value;
    let nVal = nameSelect.value;

    // 1. Handle Trigger Logic (Auto-fill upstream)
    if (trigger === 'name' && nVal) {
        // Name selected -> Set Plant & Station
        const nameRow = nameRecDB.find(r => String(r.NameX || r.namex || '').trim() === nVal);
        if (nameRow) {
            const addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '').trim() === String(nameRow.IDRec || nameRow.idrec || '').trim());
            if (addrRow) {
                pVal = String(addrRow.Plantname || addrRow.PLANTNAME || '').trim();
                sVal = String(addrRow.Station || addrRow.STATION || '').trim();
                plantSelect.value = pVal;
                // Station value set later after options update
            }
        }
    } else if (trigger === 'station' && sVal && sVal !== '-') {
        // Station selected -> Set Plant
        const rows = addressDB.filter(r => String(r.Station || r.STATION || '').trim() === sVal);
        const plants = [...new Set(rows.map(r => String(r.Plantname || r.PLANTNAME || '').trim()).filter(p => p))];
        if (plants.length === 1) {
            pVal = plants[0];
            plantSelect.value = pVal;
        } else if (plants.length > 1 && !plants.includes(pVal)) {
            // If current plant is not valid for this station, pick the first one
            pVal = plants[0];
            plantSelect.value = pVal;
        }
        // If Name is selected, check if it matches new Station
        if (nVal) {
            const nameRow = nameRecDB.find(r => String(r.NameX || r.namex || '').trim() === nVal);
            if (nameRow) {
                const addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '').trim() === String(nameRow.IDRec || nameRow.idrec || '').trim());
                if (addrRow && String(addrRow.Station || addrRow.STATION || '').trim() !== sVal) {
                    nVal = ''; // Name invalid for this station
                }
            }
        }
    } else if (trigger === 'plant') {
        // Plant selected -> Check Station & Name validity
        if (sVal) {
            const rows = addressDB.filter(r =>
                String(r.Plantname || r.PLANTNAME || '').trim() === pVal &&
                String(r.Station || r.STATION || '').trim() === sVal
            );
            if (rows.length === 0) sVal = '';
        }
        if (nVal) {
            const nameRow = nameRecDB.find(r => String(r.NameX || r.namex || '').trim() === nVal);
            if (nameRow) {
                const addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '').trim() === String(nameRow.IDRec || nameRow.idrec || '').trim());
                if (addrRow && String(addrRow.Plantname || addrRow.PLANTNAME || '').trim() !== pVal) {
                    nVal = '';
                }
            }
        }
    }

    // 2. Update Options (Downstream)

    // Station Options: Filter by Plant (if set)
    let validStations = [];
    if (pVal) {
        const rows = addressDB.filter(r => String(r.Plantname || r.PLANTNAME || '').trim() === pVal);
        validStations = [...new Set(rows.map(r => String(r.Station || r.STATION || '').trim()).filter(s => s))].sort();
    } else {
        validStations = [...new Set(addressDB.map(r => String(r.Station || r.STATION || '').trim()).filter(s => s))].sort();
    }
    renderSelectOptions(stationSelect, validStations, sVal, '-- เลือก ป้ายสถานที่ --');
    sVal = stationSelect.value; // Update sVal based on render result

    // Name Options: Filter by Plant AND Station
    let validIDRecs = new Set();
    let filterRows = addressDB;

    if (pVal) {
        filterRows = filterRows.filter(r => String(r.Plantname || r.PLANTNAME || '').trim() === pVal);
    }
    if (sVal && sVal !== '-') {
        filterRows = filterRows.filter(r => String(r.Station || r.STATION || '').trim() === sVal);
    }

    filterRows.forEach(r => validIDRecs.add(String(r.IDRec || r.idrec || '').trim()));

    const validNames = [...new Set(nameRecDB
        .filter(n => validIDRecs.has(String(n.IDRec || n.idrec || '').trim()))
        .map(n => String(n.NameX || n.namex || '').trim())
        .filter(n => n)
    )].sort();

    renderSelectOptions(nameSelect, validNames, nVal, '-- เลือกชื่อผู้รับ --');
    nVal = nameSelect.value;

    // 3. Fill Details
    fillRecipientInfo(nVal);
}

function renderSelectOptions(selectEl, items, selectedValue, defaultText) {
    selectEl.innerHTML = `<option value="">${defaultText}</option>`;
    if (items.length === 0 && (defaultText.includes('Station') || defaultText.includes('ป้ายสถานที่'))) {
        const opt = document.createElement('option');
        opt.value = '-';
        opt.textContent = '-';
        selectEl.appendChild(opt);
    } else {
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            selectEl.appendChild(opt);
        });
    }

    if (items.length === 1) {
        selectEl.value = items[0];
    } else if (selectedValue && (items.includes(selectedValue) || (items.length === 0 && selectedValue === '-'))) {
        selectEl.value = selectedValue;
    } else {
        selectEl.value = '';
    }
}

function fillRecipientInfo(name) {
    const mobileInput = document.getElementById('recipientMobileInput');
    const addressInput = document.getElementById('recipientAddressInput');
    const recipientSelect = document.getElementById('recipientPlantSelect');
    const stationSelect = document.getElementById('recipientStationSelect');
    // const editBtn = document.getElementById('editRecipientBtn');

    const plant = recipientSelect ? recipientSelect.value : '';
    const station = stationSelect ? stationSelect.value : '';

    if (!name && !station) {
        if (mobileInput) mobileInput.value = '';
        if (addressInput) addressInput.value = '';
        if (recipientSelect) recipientSelect.dataset.idrec = '';
        // if (editBtn) editBtn.style.display = 'none';
        return;
    }

    // 1. Find Address Data based on Station (Priority)
    let addrRow = null;
    if (plant && station && station !== '-') {
        addrRow = addressDB.find(r =>
            String(r.Plantname || r.PLANTNAME || '').trim() === plant &&
            String(r.Station || r.STATION || '').trim() === station
        );
    }

    // Find Name Data
    let nameRow = null;
    if (name) {
        nameRow = nameRecDB.find(r => String(r.NameX || r.namex || '').trim() === name);
    }

    if (nameRow) {
        if (mobileInput) mobileInput.value = formatPhoneNumber(nameRow.Mobile || nameRow.mobile || '');

        // Fallback: Find Address Data using IDRec if not found by Station
        if (!addrRow) {
            addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '').trim() === String(nameRow.IDRec || nameRow.idrec || '').trim());
        }
    } else {
        if (mobileInput) mobileInput.value = '';
    }

    if (addrRow) {
        const home = addrRow.Address3 || addrRow.ADDRESS3 || '';
        const tumbol = addrRow.Tambon || addrRow.TAMBON || '';
        const district = addrRow.District || addrRow.DISTRICT || '';
        const province = addrRow.Province || addrRow.PROVINCE || '';
        const post = addrRow.Post || addrRow.POST || '';
        const addressParts = [home, tumbol, district, province, post].filter(p => p);

        if (addressInput) addressInput.value = addressParts.join(' ');
        if (recipientSelect) recipientSelect.dataset.idrec = addrRow.IDRec || '';
    } else {
        if (addressInput) addressInput.value = '';
        if (recipientSelect) recipientSelect.dataset.idrec = '';
    }

    /*
    if (nameRow || addrRow) {
        if (editBtn) editBtn.style.display = 'inline-block';
    } else {
        if (editBtn) editBtn.style.display = 'none';
    }
    */
}

// ========= New Sender Filter Logic (Same as Recipient) =========

function initSenderFilters() {
    const plantSelect = document.getElementById('senderPlantSelect');
    if (!plantSelect) return;

    // 1. Default Selection based on User's Login Plant
    const plantSelectElement = document.getElementById('plantSelect');
    const userPlantCode = plantSelectElement ? plantSelectElement.value : '';

    let defaultPlantName = '';

    if (userPlantCode) {
        // Find Plantname for this IDPlant
        // Handle ID mismatch (e.g., '0326' vs '326') by removing leading zeros
        const normalizeId = (id) => String(id).replace(/^0+/, '').trim();
        const targetId = normalizeId(userPlantCode);

        const plantRow = addressDB.find(r =>
            normalizeId(r.IDPlant || r.idplant || r.IDPLANT || '') === targetId
        );
        if (plantRow) {
            defaultPlantName = String(plantRow.Plantname || plantRow.PLANTNAME || '').trim();
        }
    }

    if (defaultPlantName) {
        plantSelect.value = defaultPlantName;
    } else {
        // Fallback: Default to 'คลังสินค้า Sparepart' if available
        for (let i = 0; i < plantSelect.options.length; i++) {
            if (plantSelect.options[i].value === 'คลังสินค้า Sparepart') {
                plantSelect.value = 'คลังสินค้า Sparepart';
                break;
            }
        }
    }

    updateSenderFilters('init');

    // 2. Default Station Logic
    const stationSelect = document.getElementById('senderStationSelect');
    if (stationSelect && plantSelect.value) {
        const currentPlant = plantSelect.value;
        const potentialStations = [...stationSelect.options].map(o => o.value).filter(v => v);

        let targetStation = null;

        // Priority 1: Starts with "บริษัท"
        targetStation = potentialStations.find(s => s.trim().startsWith('บริษัท'));

        // Priority 2: Matches Plant Name (if Priority 1 not found)
        if (!targetStation) {
            targetStation = potentialStations.find(s => s.trim() === currentPlant.trim());
        }

        if (targetStation) {
            stationSelect.value = targetStation;
            updateSenderFilters('station'); // Trigger downstream updates
        }
    }
}

function updateSenderFilters(trigger) {
    const plantSelect = document.getElementById('senderPlantSelect');
    const stationSelect = document.getElementById('senderStationSelect');
    const nameSelect = document.getElementById('senderNameSelect');

    if (!plantSelect || !stationSelect || !nameSelect) return;

    let pVal = plantSelect.value;
    let sVal = stationSelect.value;
    let nVal = nameSelect.value;

    // 1. Handle Trigger Logic (Auto-fill upstream)
    if (trigger === 'name' && nVal) {
        const nameRow = nameRecDB.find(r => String(r.NameX || r.namex || '').trim() === nVal);
        if (nameRow) {
            const addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '').trim() === String(nameRow.IDRec || nameRow.idrec || '').trim());
            if (addrRow) {
                pVal = String(addrRow.Plantname || addrRow.PLANTNAME || '').trim();
                sVal = String(addrRow.Station || addrRow.STATION || '').trim();
                plantSelect.value = pVal;
            }
        }
    } else if (trigger === 'station' && sVal && sVal !== '-') {
        const rows = addressDB.filter(r => String(r.Station || r.STATION || '').trim() === sVal);
        const plants = [...new Set(rows.map(r => String(r.Plantname || r.PLANTNAME || '').trim()).filter(p => p))];
        if (plants.length === 1) {
            pVal = plants[0];
            plantSelect.value = pVal;
        } else if (plants.length > 1 && !plants.includes(pVal)) {
            pVal = plants[0];
            plantSelect.value = pVal;
        }
        if (nVal) {
            const nameRow = nameRecDB.find(r => String(r.NameX || r.namex || '').trim() === nVal);
            if (nameRow) {
                const addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '').trim() === String(nameRow.IDRec || nameRow.idrec || '').trim());
                if (addrRow && String(addrRow.Station || addrRow.STATION || '').trim() !== sVal) {
                    nVal = '';
                }
            }
        }
    } else if (trigger === 'plant') {
        if (sVal) {
            const rows = addressDB.filter(r =>
                String(r.Plantname || r.PLANTNAME || '').trim() === pVal &&
                String(r.Station || r.STATION || '').trim() === sVal
            );
            if (rows.length === 0) sVal = '';
        }
        if (nVal) {
            const nameRow = nameRecDB.find(r => String(r.NameX || r.namex || '').trim() === nVal);
            if (nameRow) {
                const addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '').trim() === String(nameRow.IDRec || nameRow.idrec || '').trim());
                if (addrRow && String(addrRow.Plantname || addrRow.PLANTNAME || '').trim() !== pVal) {
                    nVal = '';
                }
            }
        }
    }

    // 2. Update Options
    let validStations = [];
    if (pVal) {
        const rows = addressDB.filter(r => String(r.Plantname || r.PLANTNAME || '').trim() === pVal);
        validStations = [...new Set(rows.map(r => String(r.Station || r.STATION || '').trim()).filter(s => s))].sort();
    } else {
        validStations = [...new Set(addressDB.map(r => String(r.Station || r.STATION || '').trim()).filter(s => s))].sort();
    }
    renderSelectOptions(stationSelect, validStations, sVal, '-- เลือก ป้ายสถานที่ --');
    sVal = stationSelect.value;

    let validIDRecs = new Set();
    let filterRows = addressDB;
    if (pVal) filterRows = filterRows.filter(r => String(r.Plantname || r.PLANTNAME || '').trim() === pVal);
    if (sVal && sVal !== '-') filterRows = filterRows.filter(r => String(r.Station || r.STATION || '').trim() === sVal);

    filterRows.forEach(r => validIDRecs.add(String(r.IDRec || r.idrec || '').trim()));

    const validNames = [...new Set(nameRecDB
        .filter(n => validIDRecs.has(String(n.IDRec || n.idrec || '').trim()))
        .map(n => String(n.NameX || n.namex || '').trim())
        .filter(n => n)
    )].sort();

    renderSelectOptions(nameSelect, validNames, nVal, '-- เลือกชื่อผู้ส่ง --');

    // Default: Select the first available name if none is selected
    if (!nameSelect.value && validNames.length > 0) {
        nameSelect.value = validNames[0];
    }

    nVal = nameSelect.value;

    // 3. Fill Details
    fillSenderInfo(nVal);
}

function fillSenderInfo(name) {
    const mobileInput = document.getElementById('senderMobileInput');
    const addressInput = document.getElementById('senderAddressInput');
    const senderSelect = document.getElementById('senderPlantSelect');
    const stationSelect = document.getElementById('senderStationSelect');
    // const editBtn = document.getElementById('editSenderBtn');

    const plant = senderSelect ? senderSelect.value : '';
    const station = stationSelect ? stationSelect.value : '';

    if (!name && !station) {
        if (mobileInput) mobileInput.value = '';
        if (addressInput) addressInput.value = '';
        if (senderSelect) senderSelect.dataset.idrec = '';
        // if (editBtn) editBtn.style.display = 'none';
        return;
    }

    let addrRow = null;
    if (plant && station && station !== '-') {
        addrRow = addressDB.find(r =>
            String(r.Plantname || r.PLANTNAME || '').trim() === plant &&
            String(r.Station || r.STATION || '').trim() === station
        );
    }

    let nameRow = null;
    if (name) {
        nameRow = nameRecDB.find(r => String(r.NameX || r.namex || '').trim() === name);
    }

    if (nameRow) {
        if (mobileInput) mobileInput.value = formatPhoneNumber(nameRow.Mobile || nameRow.mobile || '');
        if (!addrRow) {
            addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '').trim() === String(nameRow.IDRec || nameRow.idrec || '').trim());
        }
    } else {
        if (mobileInput) mobileInput.value = '';
    }

    if (addrRow) {
        const home = addrRow.Address3 || addrRow.ADDRESS3 || '';
        const tumbol = addrRow.Tambon || addrRow.TAMBON || '';
        const district = addrRow.District || addrRow.DISTRICT || '';
        const province = addrRow.Province || addrRow.PROVINCE || '';
        const post = addrRow.Post || addrRow.POST || '';
        const addressParts = [home, tumbol, district, province, post].filter(p => p);

        if (addressInput) addressInput.value = addressParts.join(' ');
        if (senderSelect) senderSelect.dataset.idrec = addrRow.IDRec || '';
        // if (editBtn) editBtn.style.display = 'inline-block';
    } else {
        if (addressInput) addressInput.value = '';
        if (senderSelect) senderSelect.dataset.idrec = '';
        // if (editBtn) editBtn.style.display = 'none';
    }
}

// ==============================================

function addAddressRow() {
    // ใช้ข้อมูลจาก Recipient เป็นหลักสำหรับการเพิ่มลงตาราง (ถ้ามีการใช้งาน)
    const recipientPlantSelect = document.getElementById('recipientPlantSelect');
    const addressQtyInput = document.getElementById('addressQtyInput');
    const recipientNameSelect = document.getElementById('recipientNameSelect');
    const recipientMobileInput = document.getElementById('recipientMobileInput');
    const recipientAddressInput = document.getElementById('recipientAddressInput');
    const addressTableStatusEl = document.getElementById('addressTableStatus');
    const recipientPlantSelectEl = document.getElementById('recipientPlantSelect');

    const plant = recipientPlantSelect ? recipientPlantSelect.value : '';
    const qty = addressQtyInput ? addressQtyInput.value || 1 : 1;
    const name = recipientNameSelect ? recipientNameSelect.value : '';
    const mobile = recipientMobileInput ? recipientMobileInput.value : '';
    const address = recipientAddressInput ? recipientAddressInput.value : '';
    const idRec = recipientPlantSelectEl ? recipientPlantSelectEl.dataset.idrec : '';

    if (!plant) {
        if (addressTableStatusEl) addressTableStatusEl.textContent = 'กรุณาเลือกผู้รับ (Recipient)';
        return;
    }

    const tbody = document.querySelector('#addressTable tbody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    if (idRec) {
        tr.dataset.idrec = idRec;
    }

    const tdDelete = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'delete-row-btn';
    delBtn.textContent = 'ลบ';
    delBtn.addEventListener('click', () => {
        tr.remove();
        updateAddressIndices();
    });

    if (idRec) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-row-btn';
        editBtn.textContent = 'แก้ไข';
        editBtn.addEventListener('click', () => {
            openAddressModal(idRec);
        });
        tdDelete.appendChild(editBtn);
    }
    tdDelete.appendChild(delBtn);
    tr.appendChild(tdDelete);

    const tdIndex = document.createElement('td');
    tdIndex.className = 'index-cell';
    tdIndex.textContent = addressNextIndex++;
    tr.appendChild(tdIndex);

    const tdPlant = document.createElement('td');
    tdPlant.textContent = plant;
    tr.appendChild(tdPlant);

    const tdQty = document.createElement('td');
    tdQty.textContent = qty;
    tr.appendChild(tdQty);

    const tdName = document.createElement('td');
    tdName.textContent = name;
    tr.appendChild(tdName);

    const tdMobile = document.createElement('td');
    tdMobile.textContent = mobile;
    tr.appendChild(tdMobile);

    const tdAddress = document.createElement('td');
    tdAddress.textContent = address;
    tr.appendChild(tdAddress);

    tbody.appendChild(tr);
    updateAddressIndices();

    if (recipientPlantSelect) recipientPlantSelect.value = '';
    if (addressQtyInput) addressQtyInput.value = 1;
    if (recipientNameSelect) recipientNameSelect.value = '';
    if (recipientMobileInput) recipientMobileInput.value = '';
    if (recipientAddressInput) recipientAddressInput.value = '';
    if (recipientPlantSelect) recipientPlantSelect.focus();
    if (addressTableStatusEl) addressTableStatusEl.textContent = '';
}

function updateAddressIndices() {
    const rows = document.querySelectorAll('#addressTable tbody tr');
    rows.forEach((tr, idx) => {
        const indexCell = tr.querySelector('.index-cell');
        if (indexCell) {
            indexCell.textContent = idx + 1;
        }
    });
    addressNextIndex = rows.length + 1;
}

// Address tab event listeners
const senderPlantSelect = document.getElementById('senderPlantSelect');
const recipientPlantSelect = document.getElementById('recipientPlantSelect');
const senderStationSelect = document.getElementById('senderStationSelect');
const senderNameSelect = document.getElementById('senderNameSelect');
const recipientStationSelect = document.getElementById('recipientStationSelect');
const recipientNameSelect = document.getElementById('recipientNameSelect');
const addressQtyInput = document.getElementById('addressQtyInput');
const addressBookingNoInput = document.getElementById('addressBookingNoInput');
const addressRemarksInput = document.getElementById('addressRemarksInput');
const printAddressBtn = document.getElementById('printAddressBtn');

if (senderPlantSelect) {
    senderPlantSelect.addEventListener('change', (e) => {
        updateSenderFilters('plant');
    });
}

if (senderStationSelect) {
    senderStationSelect.addEventListener('change', (e) => {
        updateSenderFilters('station');
    });
}

if (senderNameSelect) {
    senderNameSelect.addEventListener('change', (e) => {
        updateSenderFilters('name');
    });
}

if (recipientPlantSelect) {
    recipientPlantSelect.addEventListener('change', (e) => {
        updateRecipientFilters('plant');
    });
}

if (recipientStationSelect) {
    recipientStationSelect.addEventListener('change', (e) => {
        updateRecipientFilters('station');
    });
}

if (recipientNameSelect) {
    recipientNameSelect.addEventListener('change', (e) => {
        updateRecipientFilters('name');
    });

    recipientPlantSelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // อาจจะ focus ไปที่ปุ่ม Print หรือทำอย่างอื่น
            if (printAddressBtn) printAddressBtn.focus();
        }
    });
}

if (addressQtyInput) {
    addressQtyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            printAddress();
        }
    });
}

if (addressBookingNoInput) {
    addressBookingNoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            printAddress();
        }
    });
}

if (addressRemarksInput) {
    addressRemarksInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            printAddress();
        }
    });
}

if (printAddressBtn) {
    printAddressBtn.addEventListener('click', printAddress);
}

const printBigLabelBtn = document.getElementById('printBigLabelBtn');
if (printBigLabelBtn) {
    printBigLabelBtn.addEventListener('click', printAddressBig);
}

// Print Address function
function printAddress() {
    const senderPlantSelect = document.getElementById('senderPlantSelect');
    const recipientPlantSelect = document.getElementById('recipientPlantSelect');
    const addressQtyInput = document.getElementById('addressQtyInput');
    const addressBookingNoInput = document.getElementById('addressBookingNoInput');

    // Sender Info
    const senderName = document.getElementById('senderNameSelect') ? document.getElementById('senderNameSelect').value : '';
    const senderMobile = document.getElementById('senderMobileInput') ? document.getElementById('senderMobileInput').value : '';
    const senderAddress = document.getElementById('senderAddressInput') ? document.getElementById('senderAddressInput').value : '';
    const senderStation = document.getElementById('senderStationSelect') ? document.getElementById('senderStationSelect').value : '';

    // Recipient Info
    const recipientName = document.getElementById('recipientNameSelect') ? document.getElementById('recipientNameSelect').value : '';
    const recipientMobile = document.getElementById('recipientMobileInput') ? document.getElementById('recipientMobileInput').value : '';
    const recipientAddress = document.getElementById('recipientAddressInput') ? document.getElementById('recipientAddressInput').value : '';

    const addressStatusEl = document.getElementById('addressStatus');

    const senderPlant = senderPlantSelect ? senderPlantSelect.value : '';
    const recipientPlant = recipientPlantSelect ? recipientPlantSelect.value : '';
    const recipientStation = document.getElementById('recipientStationSelect') ? document.getElementById('recipientStationSelect').value : '';
    const qty = addressQtyInput ? addressQtyInput.value || 1 : 1;
    const bookingNo = addressBookingNoInput ? addressBookingNoInput.value : '';
    const remarks = document.getElementById('addressRemarksInput') ? document.getElementById('addressRemarksInput').value : '';

    // Logic: Show Station instead of Plant if Station doesn't contain "บริษัท"
    let displayRecipientPlant = recipientPlant;
    if (recipientStation && recipientStation !== '-' && !recipientStation.includes('บริษัท')) {
        displayRecipientPlant = recipientStation;
    }

    if (!senderPlant) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือก Plant ผู้ส่ง';
        return;
    }

    if (!senderStation) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือก Station ผู้ส่ง';
        return;
    }

    if (!senderName) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือกชื่อผู้ส่ง';
        return;
    }

    if (!recipientPlant) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือก Plant ผู้รับ';
        return;
    }

    if (!recipientStation) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือก Station ผู้รับ';
        return;
    }

    if (!recipientName) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือกชื่อผู้รับ';
        return;
    }

    // 1. Generate Content HTML
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const totalQty = parseInt(qty) || 1;

    let contentHtml = '';

    for (let i = 1; i <= totalQty; i++) {
        contentHtml += `
            <div class="address-label">
                <div class="addr-header">
                    <div class="addr-title">ใบปะหน้ากล่อง (Shipping Label)</div>
                    <div class="addr-date">${dateStr}</div>
                </div>
                
                <div class="addr-sender-box">
                    <div style="display: flex; justify-content: space-between;">
                        <div><strong>ผู้ส่ง (Sender):</strong> ${senderName} (${senderPlant})</div>
                        <div>${senderStation || ''}</div>
                    </div>
                    ${senderAddress}<br>
                    โทร: ${senderMobile}
                </div>

                <div class="addr-recipient-box">
                    <div class="addr-to-label" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>กรุณาส่ง (To):</span>
                        <span style="font-weight: bold; color: #000; font-size: 24px;">${bookingNo || '-'}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex-grow: 1;">
                            <div class="addr-recipient-name">${recipientName}</div>
                            ${recipientStation ? `<div class="addr-recipient-station-badge">${recipientStation}</div>` : ''}
                        </div>
                        <div class="addr-recipient-plant">${displayRecipientPlant}</div>
                    </div>

                    <div class="addr-recipient-detail">
                        ${recipientAddress}<br>
                        <strong>โทร: ${recipientMobile}</strong>
                        ${remarks ? `<div style="text-align: right; margin-top: 10px; font-size: 40px; font-weight: bold;">${remarks}</div>` : ''}
                    </div>
                </div>

                <div class="addr-footer">
                    <div></div>
                    <div class="addr-info-item">
                        <span class="addr-info-label">จำนวน:</span>
                        ${i} / ${totalQty}
                    </div>
                </div>
            </div>
        `;
    }

    // 2. Open Preview Window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
    }

    const styles = `
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
        body {
            font-family: 'Sarabun', sans-serif;
            background-color: #f0f0f0;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .address-label {
            width: 210mm;
            height: 148mm; /* Half A4 */
            background: white;
            padding: 10mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            border: 1px solid #ddd;
            margin-bottom: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            position: relative;
            color: #000;
        }
        @page {
            size: A4 portrait;
            margin: 0;
        }
        @media print {
            body {
                background: none;
                padding: 0;
                display: block;
            }
            .address-label {
                box-shadow: none;
                border: none;
                margin: 0;
                page-break-after: always;
            }
            .no-print {
                display: none;
            }
        }
        .addr-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
        .addr-title { font-size: 20px; font-weight: bold; }
        .addr-date { font-size: 14px; }
        .addr-sender-box { font-size: 14px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
        .addr-recipient-box { flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start; padding-top: 10px; }
        .addr-to-label { font-size: 16px; color: #555; margin-bottom: 5px; }
        .addr-recipient-name { font-size: 40px; font-weight: bold; line-height: 1.1; margin-bottom: 5px; margin-right: 10px; }
        .addr-recipient-station-badge { 
            display: inline-block; 
            font-size: 26px; 
            font-weight: bold; 
            margin-bottom: 10px; 
        }
        .addr-recipient-plant { font-size: 24px; font-weight: bold; white-space: nowrap; }
        .addr-recipient-detail { font-size: 18px; line-height: 1.4; }
        .addr-footer { margin-top: 15px; border-top: 2px solid #000; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
        .addr-info-item { font-size: 16px; font-weight: bold; }
        .addr-info-label { font-weight: normal; font-size: 14px; margin-right: 5px; }
    `;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Preview - Address Label</title>
            <style>${styles}</style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 20px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;">สั่งพิมพ์ (Print)</button>
                <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px; margin-left: 10px;">ปิด (Close)</button>
            </div>
            ${contentHtml}
        </body>
        </html>
    `);
    printWindow.document.close();

    if (addressStatusEl) {
        addressStatusEl.textContent = `เปิดหน้า Preview สำหรับ: ส่งถึง ${recipientName} (${recipientPlant}) จำนวน ${qty} ใบ`;
    }
}

function printAddressBig() {
    const senderPlantSelect = document.getElementById('senderPlantSelect');
    const recipientPlantSelect = document.getElementById('recipientPlantSelect');
    const addressQtyInput = document.getElementById('addressQtyInput');
    const addressBookingNoInput = document.getElementById('addressBookingNoInput');

    // Sender Info
    const senderName = document.getElementById('senderNameSelect') ? document.getElementById('senderNameSelect').value : '';
    const senderMobile = document.getElementById('senderMobileInput') ? document.getElementById('senderMobileInput').value : '';
    const senderAddress = document.getElementById('senderAddressInput') ? document.getElementById('senderAddressInput').value : '';
    const senderStation = document.getElementById('senderStationSelect') ? document.getElementById('senderStationSelect').value : '';

    // Recipient Info
    const recipientName = document.getElementById('recipientNameSelect') ? document.getElementById('recipientNameSelect').value : '';
    const recipientMobile = document.getElementById('recipientMobileInput') ? document.getElementById('recipientMobileInput').value : '';
    const recipientAddress = document.getElementById('recipientAddressInput') ? document.getElementById('recipientAddressInput').value : '';

    const addressStatusEl = document.getElementById('addressStatus');

    const senderPlant = senderPlantSelect ? senderPlantSelect.value : '';
    const recipientPlant = recipientPlantSelect ? recipientPlantSelect.value : '';
    const recipientStation = document.getElementById('recipientStationSelect') ? document.getElementById('recipientStationSelect').value : '';
    const qty = addressQtyInput ? addressQtyInput.value || 1 : 1;
    const bookingNo = addressBookingNoInput ? addressBookingNoInput.value : '';
    const remarks = document.getElementById('addressRemarksInput') ? document.getElementById('addressRemarksInput').value : '';

    // Logic: Show Station instead of Plant if Station doesn't contain "บริษัท"
    let displayRecipientPlant = recipientPlant;
    if (recipientStation && recipientStation !== '-' && !recipientStation.includes('บริษัท')) {
        displayRecipientPlant = recipientStation;
    }

    if (!senderPlant) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือก Plant ผู้ส่ง';
        return;
    }

    if (!senderStation) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือก Station ผู้ส่ง';
        return;
    }

    if (!senderName) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือกชื่อผู้ส่ง';
        return;
    }

    if (!recipientPlant) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือก Plant ผู้รับ';
        return;
    }

    if (!recipientStation) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือก Station ผู้รับ';
        return;
    }

    if (!recipientName) {
        if (addressStatusEl) addressStatusEl.textContent = 'กรุณาเลือกชื่อผู้รับ';
        return;
    }

    // 1. Generate Content HTML
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    const totalQty = parseInt(qty) || 1;

    let contentHtml = '';

    for (let i = 1; i <= totalQty; i++) {
        contentHtml += `
            <div class="address-label">

                
                <div class="addr-sender-box">
                    <div style="display: flex; justify-content: space-between;">
                        <div><strong>ผู้ส่ง (Sender):</strong> ${senderName} (${senderPlant})</div>
                        <div>${senderStation && senderStation !== '-' ? senderStation : ''}</div>
                    </div>
                    ${senderAddress}<br>
                    <div style="display: flex; justify-content: space-between;">
                        <div>โทร: ${senderMobile}</div>
                        <div class="addr-recipient-plant">${displayRecipientPlant}</div>
                    </div>
                </div>

                <div class="addr-recipient-box">
                    <div class="addr-to-label" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>กรุณาส่ง (To):</span>
                        <span style="font-weight: bold; color: #000; font-size: 18px;">${bookingNo || '-'}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-direction: column;">
                         <div class="addr-recipient-name">${recipientName}</div>
                         ${recipientStation && recipientStation !== '-' ? `<div class="addr-recipient-station-badge">${recipientStation}</div>` : ''}
                    </div>

                    <div class="addr-recipient-detail">
                        ${recipientAddress}<br>
                        <strong>โทร: ${recipientMobile}</strong>
                        ${remarks ? `<div style="text-align: right; margin-top: 10px; font-size: 24px; font-weight: bold;">${remarks}</div>` : ''}
                    </div>
                </div>

                <div style="margin-top: auto; text-align: center; font-size: 12px;">${dateStr} (${i}/${totalQty})</div>

            </div>
        `;
    }

    // 2. Open Preview Window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
    }

    const styles = `
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
        body {
            font-family: 'Sarabun', sans-serif;
            background-color: #f0f0f0;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .address-label {
            width: 80mm;
            height: 100mm;
            background: white;
            padding: 2mm; /* Minimal padding */
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            border: 1px solid #ddd;
            margin-bottom: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            position: relative;
            color: #000;
            overflow: hidden;
        }
        @page {
            size: 80mm 100mm;
            margin: 0;
        }
        @media print {
            body {
                background: none;
                padding: 0;
                display: block;
            }
            .address-label {
                box-shadow: none;
                border: none;
                margin: 0;
                page-break-after: always;
            }
            .no-print {
                display: none;
            }
        }
        .addr-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; }
        .addr-title { font-size: 14px; font-weight: bold; }
        .addr-date { font-size: 10px; }
        .addr-sender-box { font-size: 11px; margin-bottom: 5px; padding: 5px; border: 1px solid #000; border-radius: 5px; }
        .addr-recipient-box { flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start; padding-top: 5px; }
        .addr-to-label { font-size: 14px; color: #555; margin-bottom: 2px; }
        .addr-recipient-name { font-size: 18px; font-weight: bold; line-height: 1.1; margin-bottom: 2px; width: 100%; word-wrap: break-word; }
        .addr-recipient-station-badge { 
            display: inline-block; 
            font-size: 18px; 
            font-weight: bold; 
            margin-bottom: 5px; 
        }
        .addr-recipient-plant { font-size: 26px; font-weight: bold; white-space: normal; word-wrap: break-word; margin-bottom: 5px; line-height: 1.1; text-align: right; }
        .addr-recipient-detail { font-size: 18px; line-height: 1.3; width: 100%; word-wrap: break-word; }
        .addr-footer { margin-top: 10px; border-top: 2px solid #000; padding-top: 5px; display: flex; justify-content: space-between; align-items: center; }
        .addr-info-item { font-size: 12px; font-weight: bold; }
        .addr-info-label { font-weight: normal; font-size: 10px; margin-right: 2px; }
    `;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Preview - Label 80x100</title>
            <style>${styles}</style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 20px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;">สั่งพิมพ์ (Print)</button>
                <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px; margin-left: 10px;">ปิด (Close)</button>
            </div>
            ${contentHtml}
        </body>
        </html>
    `);
    printWindow.document.close();

    if (addressStatusEl) {
        addressStatusEl.textContent = `เปิดหน้า Preview (ดวงใหญ่ 80x100) สำหรับ: ส่งถึง ${recipientName} (${recipientPlant}) จำนวน ${qty} ใบ`;
    }
}


// เพิ่ม address tab ใน tabPanels
const addressTabPanel = document.getElementById('tab-address');
if (addressTabPanel && typeof tabPanels !== 'undefined') {
    tabPanels.address = addressTabPanel;
}
// ========= Address Form Modal Functions =========

// Load Tambon data
async function loadTambonData() {
    try {
        const res = await fetch(TAMBON_URL);
        const data = await res.json();
        tambonDB = data;
        console.log(`Loaded ${tambonDB.length} tambon records`);
    } catch (err) {
        console.error('Error loading tambon data:', err);
    }
}

// Load Province data
async function loadProvinceData() {
    try {
        const res = await fetch(PROVINCE_URL);
        const data = await res.json();
        provinceDB = data;
        populateProvinceSelect();
        console.log(`Loaded ${provinceDB.length} province records`);
    } catch (err) {
        console.error('Error loading province data:', err);
    }
}

// Populate province dropdown
function populateProvinceSelect() {
    const datalist = document.getElementById('provinceList');
    if (!datalist) return;

    datalist.innerHTML = '';
    provinceDB.forEach(prov => {
        const provinceName = prov.ProvinceThai || prov.Province || '';
        if (provinceName) {
            const option = document.createElement('option');
            option.value = provinceName;
            datalist.appendChild(option);
        }
    });
}

// Populate district dropdown based on selected province
function populateDistrictSelect(provinceName) {
    const select = document.getElementById('newDistrict');
    if (!select) return;

    select.innerHTML = '<option value="">-- เลือกอำเภอ --</option>';
    document.getElementById('newSubdistrict').innerHTML = '<option value="">-- เลือกตำบล --</option>';
    document.getElementById('newPostalCode').value = '';

    if (!provinceName) return;

    const districts = [...new Set(tambonDB
        .filter(row => (row.ProvinceThai || row.Province || '') === provinceName)
        .map(row => row.DistrictThai || row.District || '')
        .filter(d => d))];

    districts.sort().forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        select.appendChild(option);
    });
}

// Populate subdistrict dropdown based on selected district
function populateSubdistrictSelect(districtName) {
    const select = document.getElementById('newSubdistrict');
    if (!select) return;

    select.innerHTML = '<option value="">-- เลือกตำบล --</option>';
    document.getElementById('newPostalCode').value = '';

    if (!districtName) return;

    const provinceName = document.getElementById('newProvince').value;
    const subdistricts = tambonDB.filter(row =>
        (row.ProvinceThai || row.Province || '') === provinceName &&
        (row.DistrictThai || row.District || '') === districtName
    );

    subdistricts.forEach(row => {
        const subdistrictName = row.TambonThai || row.Tambon || row.Subdistrict || '';
        if (subdistrictName) {
            const option = document.createElement('option');
            option.value = subdistrictName;
            option.textContent = subdistrictName;
            option.dataset.postalCode = row.PostCodeMain || row.PostalCode || '';
            select.appendChild(option);
        }
    });
}

// Auto-fill postal code when subdistrict is selected
function autoFillPostalCode() {
    const select = document.getElementById('newSubdistrict');
    const postalCodeInput = document.getElementById('newPostalCode');
    if (!select || !postalCodeInput) return;

    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.dataset.postalCode) {
        postalCodeInput.value = selectedOption.dataset.postalCode;
    }
}

// Helper to clear validation errors
function clearAddressFormErrors() {
    const ids = ['newPlaceName', 'newPlaceNameCustom', 'newRecipient', 'newMobile', 'newProvince', 'newDistrict', 'newSubdistrict', 'newHouseNo'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('input-error');
            // Try to find label with for attribute
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) {
                const star = label.querySelector('.required-star');
                if (star) star.remove();
            } else {
                // Fallback: check next sibling
                const next = el.nextElementSibling;
                if (next && next.classList.contains('required-star')) {
                    next.remove();
                }
            }
        }
    });
}

// Open address form modal
async function openAddressModal(editId = null) {
    const modal = document.getElementById('addressFormModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
        modal.style.zIndex = '3200';

        // Clear any previous validation errors
        clearAddressFormErrors();

        // Load data if not loaded yet
        if (provinceDB.length === 0) {
            await loadProvinceData();
        }
        if (tambonDB.length === 0) {
            await loadTambonData();
        }

        // Populate Responsibility Center (Plantname) Select
        const placeSelect = document.getElementById('newPlaceName');
        const placeCustomInput = document.getElementById('newPlaceNameCustom');
        if (placeSelect) {
            const plants = [...new Set(addressDB.map(r => String(r.Plantname || r.PLANTNAME || '').trim()).filter(p => p))].sort();
            placeSelect.innerHTML = '<option value="">-- เลือกศูนย์รับผิดชอบ --</option>';
            plants.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                placeSelect.appendChild(opt);
            });

            // Add New Option
            const newOpt = document.createElement('option');
            newOpt.value = 'NEW';
            newOpt.textContent = '+ เพิ่มใหม่ (New)';
            newOpt.style.fontWeight = 'bold';
            newOpt.style.color = '#2563eb';
            placeSelect.appendChild(newOpt);
        }
        if (placeCustomInput) {
            placeCustomInput.style.display = 'none';
            placeCustomInput.value = '';
        }

        const titleEl = document.getElementById('addressFormTitle');
        const saveBtn = document.getElementById('saveAddressBtn');

        // Ensure Cancel button exists
        if (saveBtn && saveBtn.parentNode) {
            let hasCancel = false;
            const siblings = saveBtn.parentNode.querySelectorAll('button');
            siblings.forEach(btn => {
                if (btn.id === 'cancelAddressBtn' || btn.textContent.trim() === 'ยกเลิก') {
                    hasCancel = true;
                }
            });

            if (!hasCancel) {
                const cancelBtn = document.createElement('button');
                cancelBtn.id = 'cancelAddressBtn';
                cancelBtn.type = 'button';
                cancelBtn.textContent = 'ยกเลิก';
                cancelBtn.style.marginLeft = '10px';
                cancelBtn.style.padding = '8px 16px';
                cancelBtn.style.borderRadius = '12px';
                cancelBtn.style.border = '1px solid #d1d5db';
                cancelBtn.style.background = '#ffffff';
                cancelBtn.style.color = '#374151';
                cancelBtn.style.fontSize = '0.9rem';
                cancelBtn.style.fontWeight = '600';
                cancelBtn.style.cursor = 'pointer';
                cancelBtn.addEventListener('click', closeAddressModal);
                saveBtn.parentNode.insertBefore(cancelBtn, saveBtn.nextSibling);
            }

            // Ensure Delete button exists
            let deleteBtn = document.getElementById('deleteAddressBtn');
            if (!deleteBtn) {
                deleteBtn = document.createElement('button');
                deleteBtn.id = 'deleteAddressBtn';
                deleteBtn.type = 'button';
                deleteBtn.textContent = 'ลบ';
                deleteBtn.style.marginRight = 'auto'; // Push to left
                deleteBtn.style.padding = '8px 16px';
                deleteBtn.style.borderRadius = '12px';
                deleteBtn.style.border = '1px solid #ef4444';
                deleteBtn.style.background = '#fee2e2';
                deleteBtn.style.color = '#b91c1c';
                deleteBtn.style.fontSize = '0.9rem';
                deleteBtn.style.fontWeight = '600';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.display = 'none';
                deleteBtn.addEventListener('click', deleteAddress);
                saveBtn.parentNode.insertBefore(deleteBtn, saveBtn);
            }
        }

        // Check if editId is a string (ID) or event object
        const deleteBtn = document.getElementById('deleteAddressBtn');

        if (editId && typeof editId === 'string') {
            // Edit Mode
            editingAddressId = editId;
            if (titleEl) titleEl.textContent = 'แก้ไขที่อยู่';
            if (saveBtn) saveBtn.textContent = 'บันทึกการแก้ไข';
            if (deleteBtn) deleteBtn.style.display = 'inline-block';

            const data = addressDB.find(r => String(r.IDRec) === String(editId));
            if (data) {
                document.getElementById('newPlaceName').value = String(data.Plantname || data.PLANTNAME || '').trim();
                if (placeCustomInput) placeCustomInput.style.display = 'none';

                document.getElementById('newStation').value = String(data.Station || data.STATION || '').trim();
                document.getElementById('newRecipient').value = data.Recname || data.RECNAME || '';
                document.getElementById('newMobile').value = data.Mobile || data.MOBILE || '';
                document.getElementById('newHouseNo').value = data.Address3 || data.ADDRESS3 || '';

                const idPlantInput = document.getElementById('newIDPlant');
                if (idPlantInput) {
                    idPlantInput.value = data.IDPlant || data.IDPLANT || '';
                }

                const provSelect = document.getElementById('newProvince');
                provSelect.value = data.Province || data.PROVINCE || '';

                populateDistrictSelect(provSelect.value);
                const distSelect = document.getElementById('newDistrict');
                distSelect.value = data.District || data.DISTRICT || '';

                populateSubdistrictSelect(distSelect.value);
                const subSelect = document.getElementById('newSubdistrict');
                subSelect.value = data.Tambon || data.TAMBON || '';

                // Restore postal code after dependent dropdowns cleared it
                document.getElementById('newPostalCode').value = data.Post || data.POST || '';
            }
        } else {
            // Add Mode
            editingAddressId = null;
            if (titleEl) titleEl.textContent = 'เพิ่มที่อยู่ใหม่';
            if (saveBtn) saveBtn.textContent = 'บันทึก';
            if (deleteBtn) deleteBtn.style.display = 'none';

            document.getElementById('newPlaceName').value = '';
            document.getElementById('newStation').value = '';
            document.getElementById('newRecipient').value = '';
            document.getElementById('newMobile').value = '';
            document.getElementById('newProvince').value = '';
            document.getElementById('newDistrict').innerHTML = '<option value="">-- เลือกอำเภอ --</option>';
            document.getElementById('newSubdistrict').innerHTML = '<option value="">-- เลือกตำบล --</option>';
            document.getElementById('newPostalCode').value = '';
            document.getElementById('newHouseNo').value = '';

            const idPlantInput = document.getElementById('newIDPlant');
            if (idPlantInput) idPlantInput.value = '';
        }
        document.getElementById('addressFormStatus').textContent = '';
    }
}

// Close address form modal
function closeAddressModal() {
    const modal = document.getElementById('addressFormModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = 'none';
        editingAddressId = null;
    }
}

// Save new address
function saveNewAddress() {
    const placeSelect = document.getElementById('newPlaceName');
    const placeCustomInput = document.getElementById('newPlaceNameCustom');
    let placeName = placeSelect.value.trim();
    const station = document.getElementById('newStation').value.trim();
    const recipient = document.getElementById('newRecipient').value.trim();
    const mobile = document.getElementById('newMobile').value.trim();
    const province = document.getElementById('newProvince').value;
    const district = document.getElementById('newDistrict').value;
    const subdistrict = document.getElementById('newSubdistrict').value;
    const houseNo = document.getElementById('newHouseNo').value.trim();
    const postalCode = document.getElementById('newPostalCode').value.trim();
    const statusEl = document.getElementById('addressFormStatus');
    const idPlantInput = document.getElementById('newIDPlant');
    const idPlant = idPlantInput ? idPlantInput.value.trim() : '';

    let placeIdForValidation = 'newPlaceName';
    if (placeName === 'NEW') {
        placeName = placeCustomInput ? placeCustomInput.value.trim() : '';
        placeIdForValidation = 'newPlaceNameCustom';
    }

    // Validation
    const requiredFields = [
        { id: placeIdForValidation, val: placeName },
        { id: 'newRecipient', val: recipient },
        { id: 'newMobile', val: mobile },
        { id: 'newProvince', val: province },
        { id: 'newDistrict', val: district },
        { id: 'newSubdistrict', val: subdistrict },
        { id: 'newHouseNo', val: houseNo }
    ];

    let hasError = false;

    requiredFields.forEach(field => {
        const el = document.getElementById(field.id);
        if (!el) return;

        // Reset style first
        el.classList.remove('input-error');
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) {
            const star = label.querySelector('.required-star');
            if (star) star.remove();
        } else {
            const next = el.nextElementSibling;
            if (next && next.classList.contains('required-star')) next.remove();
        }

        if (!field.val) {
            hasError = true;
            el.classList.add('input-error');

            const star = document.createElement('span');
            star.className = 'required-star';
            star.textContent = '*';

            if (label) {
                label.appendChild(star);
            } else {
                el.parentNode.insertBefore(star, el.nextSibling);
            }
        }
    });

    if (hasError) {
        if (statusEl) statusEl.textContent = 'กรุณากรอกข้อมูลช่องที่มีเครื่องหมาย * สีแดง';
        return;
    }

    let addressObj = {};

    if (editingAddressId) {
        // Edit Mode
        const idx = addressDB.findIndex(r => String(r.IDRec) === String(editingAddressId));
        if (idx !== -1) {
            addressObj = {
                ...addressDB[idx], // Keep existing fields
                IDPlant: idPlant || addressDB[idx].IDPlant,
                Recname: recipient,
                Plantname: placeName,
                Station: station,
                Address3: houseNo,
                Province: province,
                District: district,
                Tambon: subdistrict,
                Mobile: mobile,
                Post: postalCode,
                User: (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.name || currentUser.id) : (addressDB[idx].User || ''),
                action: 'edit'
            };
            addressDB[idx] = addressObj;
        }
    } else {
        // Add Mode
        addressObj = {
            IDRec: 'REC-' + Date.now(),
            Recname: recipient,
            IDPlant: idPlant,
            Plantname: placeName,
            Station: station,
            Address3: houseNo,
            Province: province,
            District: district,
            Tambon: subdistrict,
            Mobile: mobile,
            Post: postalCode,
            User: (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.name || currentUser.id) : '',
            Gmail: '',
            action: 'add'
        };
        addressDB.push(addressObj);
    }

    // Save to Google Sheet
    if (ADDRESS_SAVE_URL) {
        fetch(ADDRESS_SAVE_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(addressObj)
        }).catch(err => console.error('Error saving address:', err));
    }

    // NEW: Save to NameRec as well (Sync Recipient Data) - Only for new address
    if (!editingAddressId && NAME_REC_SAVE_URL) {
        const nameRecPayload = {
            IDname: 'NAM-' + Date.now(),
            name: 'NAM-' + Date.now(),
            IDRec: addressObj.IDRec,
            Plant: addressObj.Plantname,
            Station: addressObj.Station,
            mobile: addressObj.Mobile,
            NameX: addressObj.Recname,
            action: 'addName'
        };

        fetch(NAME_REC_SAVE_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nameRecPayload)
        })
            .then(() => {
                console.log('Saved to NameRec');
                nameRecDB.push(nameRecPayload);
            })
            .catch(err => console.error('Error saving NameRec:', err));
    }

    // Refresh plant select dropdown
    populateAddressPlantSelect();

    // Refresh Address Database Table if open
    const searchInput = document.getElementById('addressDbSearch');
    if (typeof renderAddressDbTable === 'function') {
        renderAddressDbTable(searchInput ? searchInput.value : '');
    }

    // Close modal
    closeAddressModal();

    // Show success message
    const addressStatusEl = document.getElementById('addressStatus');
    if (addressStatusEl) {
        addressStatusEl.textContent = `����������� "${placeName}" �����`;
        setTimeout(() => {
            addressStatusEl.textContent = `��Ŵ������ Address ����� (${addressDB.length} ��¡��)`;
        }, 3000);
    }

    // Auto-select the new address
    const recipientSelect = document.getElementById('recipientPlantSelect');
    if (recipientSelect) {
        recipientSelect.value = placeName;
        populateAddressStationSelect(placeName, 'recipient');
        // Note: populateAddressStationSelect will handle selecting the station if it's the only one, 
        // but since we just added it, we might need to manually select it if there are multiple.
        // For simplicity, we let the user select the station if there are multiple.
    }
}

function deleteAddress() {
    if (!editingAddressId) return;

    if (!confirm('ต้องการลบที่อยู่นี้ใช่หรือไม่?')) return;

    const statusEl = document.getElementById('addressFormStatus');
    if (statusEl) statusEl.textContent = 'กำลังลบ...';

    const saveBtn = document.getElementById('saveAddressBtn');
    const deleteBtn = document.getElementById('deleteAddressBtn');
    if (saveBtn) saveBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;

    const payload = {
        IDRec: editingAddressId,
        action: 'delete'
    };

    if (ADDRESS_SAVE_URL) {
        fetch(ADDRESS_SAVE_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(() => {
                const idx = addressDB.findIndex(r => String(r.IDRec) === String(editingAddressId));
                if (idx !== -1) {
                    addressDB.splice(idx, 1);
                }

                populateAddressPlantSelect();

                const dbModal = document.getElementById('addressDatabaseModal');
                if (dbModal && dbModal.classList.contains('open')) {
                    const search = document.getElementById('addressDbSearch');
                    renderAddressDbTable(search ? search.value : '');
                }

                closeAddressModal();
                alert('ลบข้อมูลเรียบร้อยแล้ว');
            })
            .catch(err => {
                console.error('Error deleting address:', err);
                if (statusEl) statusEl.textContent = 'ลบไม่สำเร็จ';
                if (saveBtn) saveBtn.disabled = false;
                if (deleteBtn) deleteBtn.disabled = false;
            });
    }
}

// Event listeners for address form modal
const openAddressFormBtn = document.getElementById('openAddressFormBtn');
const closeAddressFormBtn = document.getElementById('closeAddressFormBtn');
const saveAddressBtn = document.getElementById('saveAddressBtn');
const newProvinceSelect = document.getElementById('newProvince');
const newDistrictSelect = document.getElementById('newDistrict');
const newSubdistrictSelect = document.getElementById('newSubdistrict');

if (openAddressFormBtn) {
    openAddressFormBtn.addEventListener('click', openAddressModal);
}

if (closeAddressFormBtn) {
    closeAddressFormBtn.addEventListener('click', closeAddressModal);
}

if (saveAddressBtn) {
    saveAddressBtn.addEventListener('click', saveNewAddress);
}

if (newProvinceSelect) {
    newProvinceSelect.addEventListener('change', (e) => {
        populateDistrictSelect(e.target.value);
    });
}

if (newDistrictSelect) {
    newDistrictSelect.addEventListener('change', (e) => {
        populateSubdistrictSelect(e.target.value);
    });
}

if (newSubdistrictSelect) {
    newSubdistrictSelect.addEventListener('change', autoFillPostalCode);
}

const newPlaceNameSelect = document.getElementById('newPlaceName');
if (newPlaceNameSelect) {
    newPlaceNameSelect.addEventListener('change', (e) => {
        const customInput = document.getElementById('newPlaceNameCustom');
        if (customInput) {
            if (e.target.value === 'NEW') {
                customInput.style.display = 'block';
                customInput.focus();
            } else {
                customInput.style.display = 'none';
            }
        }
    });
}

// Close modal when clicking outside
// Close modal when clicking outside - DISABLED per user request
// const addressFormModal = document.getElementById('addressFormModal');
// if (addressFormModal) {
//     addressFormModal.addEventListener('click', (e) => {
//         if (e.target === addressFormModal) {
//             closeAddressModal();
//         }
//     });
// }

// Preload Tambon and Province data when Address tab is shown
function preloadLocationData() {
    if (provinceDB.length === 0) {
        loadProvinceData();
    }
    if (tambonDB.length === 0) {
        loadTambonData();
    }
}

// Call preload when tab becomes visible
const addressTabBtn = document.querySelector('[data-tab="address"]');
if (addressTabBtn) {
    addressTabBtn.addEventListener('click', () => {
        setTimeout(preloadLocationData, 100);
    });
}

// const editRecipientBtn = document.getElementById('editRecipientBtn');
// if (editRecipientBtn) {
//     editRecipientBtn.addEventListener('click', () => {
//         const recipientSelect = document.getElementById('recipientPlantSelect');
//         const id = recipientSelect ? recipientSelect.dataset.idrec : null;
//         if (id) {
//             openAddressModal(id);
//         }
//     });
// }

// const editSenderBtn = document.getElementById('editSenderBtn');
// if (editSenderBtn) {
//     editSenderBtn.addEventListener('click', () => {
//         const senderSelect = document.getElementById('senderPlantSelect');
//         const id = senderSelect ? senderSelect.dataset.idrec : null;
//         if (id) {
//             openAddressModal(id);
//         }
//     });
// }

// ========= Address Database View Functions =========

function createAddressDatabaseModal() {
    if (document.getElementById('addressDatabaseModal')) return;

    const modalHtml = `
    <div id="addressDatabaseModal" class="modal" aria-hidden="true" style="z-index: 3100;">
        <div class="modal-card" style="width: 90%; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 class="modal-title" style="margin:0;">ฐานข้อมูลที่อยู่ (Address Database)</h3>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button type="button" id="openAddressFormBtn" class="btn-add-address" style="font-size: 0.85rem; padding: 6px 12px;">+ เพิ่มที่อยู่</button>
                    <button type="button" id="closeAddressDbBtn" style="background:none; border:none; font-size: 1.8rem; cursor:pointer; line-height:1;">&times;</button>
                </div>
            </div>
            
            <div style="margin-bottom: 12px; display: flex; gap: 10px;">
                <select id="addressDbPlantFilter" class="address-select" style="width: 200px;">
                    <option value="">-- ทุกศูนย์รับผิดชอบ --</option>
                </select>
                <input type="text" id="addressDbSearch" placeholder="ค้นหาชื่อ, ป้ายสถานที่ หรือจังหวัด..." class="address-input" style="flex: 1;">
            </div>

            <div style="flex: 1; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;">
                <table id="addressDbTable" style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; z-index: 10; background: #f1f5f9;">
                        <tr>
                            <th style="padding: 10px;">ศูนย์รับผิดชอบ</th>
                            <th style="padding: 10px;">ป้ายสถานที่</th>
                            <th style="padding: 10px;">จังหวัด</th>
                            <th style="padding: 10px; width: 80px; text-align: center;">แก้ไข</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Rows will be populated here -->
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.85rem; color: #666;">* กดปุ่ม "แก้ไข" เพื่อแก้ไขข้อมูล</div>
                <div id="addressDbCount" style="font-weight: bold; color: #2563eb;">จำนวนทั้งหมด 0 รายการ</div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Event Listeners
    document.getElementById('closeAddressDbBtn').addEventListener('click', () => {
        document.getElementById('addressDatabaseModal').classList.remove('open');
    });

    document.getElementById('openAddressFormBtn').addEventListener('click', () => {
        openAddressModal();
    });

    document.getElementById('addressDbSearch').addEventListener('input', (e) => {
        renderAddressDbTable(e.target.value);
    });

    document.getElementById('addressDbPlantFilter').addEventListener('change', () => {
        const search = document.getElementById('addressDbSearch');
        renderAddressDbTable(search ? search.value : '');
    });

    // Close on backdrop click
    document.getElementById('addressDatabaseModal').addEventListener('click', (e) => {
        if (e.target.id === 'addressDatabaseModal') {
            e.target.classList.remove('open');
        }
    });
}

function renderAddressDbTable(filter = '') {
    const tbody = document.querySelector('#addressDbTable tbody');
    const countEl = document.getElementById('addressDbCount');
    const plantFilter = document.getElementById('addressDbPlantFilter');
    if (!tbody) return;

    tbody.innerHTML = '';
    const term = filter.toLowerCase().trim();
    const selectedPlant = plantFilter ? plantFilter.value : '';

    const filtered = addressDB.filter(row => {
        const rowPlant = String(row.Plantname || row.PLANTNAME || '').trim();
        if (selectedPlant && rowPlant !== selectedPlant) return false;

        if (!term) return true;
        const text = `${row.Recname || ''} ${rowPlant} ${row.Station || ''} ${row.Province || ''} ${row.Address3 || ''}`.toLowerCase();
        return text.includes(term);
    });

    filtered.sort((a, b) => {
        const plantA = String(a.Plantname || a.PLANTNAME || '').trim();
        const plantB = String(b.Plantname || b.PLANTNAME || '').trim();
        const cmpPlant = plantA.localeCompare(plantB, 'th');
        if (cmpPlant !== 0) return cmpPlant;

        const stationA = String(a.Station || a.STATION || '').trim();
        const stationB = String(b.Station || b.STATION || '').trim();
        return stationA.localeCompare(stationB, 'th');
    });

    filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';

        const recName = row.Recname || row.RECNAME || '-';
        const plant = row.Plantname || row.PLANTNAME || '-';
        const station = row.Station || row.STATION || '-';
        const addr = row.Address3 || row.ADDRESS3 || '-';
        const prov = row.Province || row.PROVINCE || '-';
        const mobile = row.Mobile || row.MOBILE || '-';

        tr.innerHTML = `
            <td style="padding: 8px;">${plant}</td>
            <td style="padding: 8px; color: #2563eb; cursor: pointer; text-decoration: underline;" onclick="openStationDetail('${row.IDRec || ''}')">${station}</td>
            <td style="padding: 8px;">${prov}</td>
            <td style="padding: 8px; text-align: center;"></td>
        `;

        const tdAction = tr.lastElementChild;
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-row-btn';
        editBtn.textContent = 'แก้ไข';
        editBtn.onclick = () => {
            openAddressModal(row.IDRec);
        };
        tdAction.appendChild(editBtn);

        tbody.appendChild(tr);
    });

    if (countEl) countEl.textContent = `จำนวนทั้งหมด ${filtered.length} รายการ`;
}

function createStationDetailModal() {
    if (document.getElementById('stationDetailModal')) return;

    const modalHtml = `
    <div id="stationDetailModal" class="modal" aria-hidden="true" style="z-index: 3200;">
        <div class="modal-card" style="width: 90%; max-width: 800px; max-height: 80vh; display: flex; flex-direction: column; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 class="modal-title" style="margin:0;">รายละเอียดป้ายสถานที่</h3>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button type="button" id="openAddRecipientBtn" class="btn-add-address" style="font-size: 0.85rem; padding: 6px 12px;">+ เพิ่มผู้รับ</button>
                    <button type="button" id="closeStationDetailBtn" style="background:none; border:none; font-size: 1.8rem; cursor:pointer; line-height:1;">&times;</button>
                </div>
            </div>
            <div style="flex: 1; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;">
                <table id="stationDetailTable" style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; z-index: 10; background: #f1f5f9;">
                        <tr>
                            <th style="padding: 10px;">Plant</th>
                            <th style="padding: 10px;">ป้ายที่อยู่ ป้ายสถานที่</th>
                            <th style="padding: 10px;">ชื่อผู้รับ</th>
                            <th style="padding: 10px;">เบอร์ติดต่อ</th>
                            <th style="padding: 10px; width: 80px; text-align: center;">แก้ไข</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('closeStationDetailBtn').addEventListener('click', () => {
        document.getElementById('stationDetailModal').classList.remove('open');
    });

    document.getElementById('stationDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'stationDetailModal') {
            e.target.classList.remove('open');
        }
    });

    document.getElementById('openAddRecipientBtn').addEventListener('click', () => {
        openAddRecipientModal();
    });
}

window.openStationDetail = function (idRec) {
    createStationDetailModal();
    const modal = document.getElementById('stationDetailModal');
    const tbody = document.querySelector('#stationDetailTable tbody');
    tbody.innerHTML = '';

    const addrRow = addressDB.find(r => String(r.IDRec || r.idrec || '') === String(idRec));
    currentStationData = addrRow; // เก็บข้อมูล Station ปัจจุบันไว้ใช้ตอนเพิ่มผู้รับ
    const plant = addrRow ? (addrRow.Plantname || addrRow.PLANTNAME || '-') : '-';
    const station = addrRow ? (addrRow.Station || addrRow.STATION || '-') : '-';

    const nameRows = nameRecDB.filter(n => String(n.IDRec || n.idrec || '') === String(idRec));

    if (nameRows.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="padding: 8px;">${plant}</td><td style="padding: 8px;">${station}</td><td style="padding: 8px;">-</td><td style="padding: 8px;">-</td><td style="padding: 8px;"></td>`;
        tbody.appendChild(tr);
    } else {
        nameRows.forEach(n => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 8px;">${plant}</td>
                <td style="padding: 8px;">${station}</td>
                <td style="padding: 8px;">${n.NameX || n.namex || '-'}</td>
                <td style="padding: 8px;">${n.Mobile || n.mobile || '-'}</td>
                <td style="padding: 8px; text-align: center;"></td>
            `;

            const tdAction = tr.lastElementChild;
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-row-btn';
            editBtn.textContent = 'แก้ไข';
            editBtn.onclick = () => openEditRecipientModal(n);
            tdAction.appendChild(editBtn);

            tbody.appendChild(tr);
        });
    }

    modal.classList.add('open');
};

function createAddRecipientModal() {
    if (document.getElementById('addRecipientModal')) return;

    const modalHtml = `
    <div id="addRecipientModal" class="modal" aria-hidden="true" style="z-index: 3300;">
        <div class="modal-card" style="width: 90%; max-width: 400px; padding: 20px;">
            <div class="modal-title" style="margin-bottom: 15px;">เพิ่มผู้รับใหม่</div>
            
            <div class="address-modal-form">
                <div class="address-form-row">
                    <div class="address-field">
                        <span class="address-label">Plant</span>
                        <input id="newRecipientPlant" type="text" class="address-input" readonly style="background: #f3f4f6;">
                    </div>
                    <div class="address-field">
                        <span class="address-label">Station</span>
                        <input id="newRecipientStation" type="text" class="address-input" placeholder="ระบุ Station">
                    </div>
                </div>
                <div class="address-form-row">
                    <div class="address-field address-full">
                        <span class="address-label">ชื่อผู้รับ (NameX) *</span>
                        <input id="newRecipientNameX" type="text" class="address-input" placeholder="ระบุชื่อผู้รับ">
                    </div>
                </div>
                <div class="address-form-row">
                    <div class="address-field address-full">
                        <span class="address-label">เบอร์โทร (Mobile)</span>
                        <input id="newRecipientMobile" type="tel" class="address-input" placeholder="ระบุเบอร์โทร">
                    </div>
                </div>
            </div>

            <div class="modal-actions" style="margin-top: 20px;">
                <button id="saveRecipientBtn" class="btn-serial-primary" type="button">บันทึก</button>
                <button id="closeRecipientBtn" class="btn-serial-outline" type="button">ยกเลิก</button>
            </div>
            <div class="status" id="recipientFormStatus"></div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('closeRecipientBtn').addEventListener('click', () => {
        document.getElementById('addRecipientModal').classList.remove('open');
    });

    document.getElementById('saveRecipientBtn').addEventListener('click', saveNewRecipient);

    document.getElementById('addRecipientModal').addEventListener('click', (e) => {
        if (e.target.id === 'addRecipientModal') {
            e.target.classList.remove('open');
        }
    });
}

function openAddRecipientModal() {
    createAddRecipientModal();
    if (!currentStationData) {
        alert('ไม่พบข้อมูล Station');
        return;
    }

    document.getElementById('newRecipientPlant').value = currentStationData.Plantname || currentStationData.PLANTNAME || '';
    document.getElementById('newRecipientStation').value = currentStationData.Station || currentStationData.STATION || '';
    document.getElementById('newRecipientNameX').value = '';
    document.getElementById('newRecipientMobile').value = '';
    document.getElementById('recipientFormStatus').textContent = '';

    document.getElementById('addRecipientModal').classList.add('open');
}

function saveNewRecipient() {
    const nameX = document.getElementById('newRecipientNameX').value.trim();
    const mobile = document.getElementById('newRecipientMobile').value.trim();
    const station = document.getElementById('newRecipientStation').value.trim();
    const statusEl = document.getElementById('recipientFormStatus');

    if (!nameX) {
        statusEl.textContent = 'กรุณาระบุชื่อผู้รับ';
        return;
    }

    statusEl.textContent = 'กำลังบันทึก...';
    document.getElementById('saveRecipientBtn').disabled = true;

    const uniqueId = 'NAM-' + Date.now();

    const payload = {
        IDname: uniqueId,
        name: uniqueId,
        IDRec: currentStationData.IDRec || currentStationData.idrec || '',
        Plant: currentStationData.Plantname || currentStationData.PLANTNAME || '',
        Station: station,
        mobile: mobile,
        NameX: nameX,
        action: 'addName' // Tag สำหรับแยกการทำงานใน GAS (ถ้าจำเป็น)
    };

    fetch(NAME_REC_SAVE_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(() => {
            statusEl.textContent = 'บันทึกสำเร็จ!';

            // เพิ่มข้อมูลลงในตัวแปร local เพื่อให้แสดงผลทันทีโดยไม่ต้องโหลดใหม่
            nameRecDB.push(payload);

            // รีเฟรชตารางรายละเอียด
            if (window.openStationDetail && currentStationData.IDRec) {
                window.openStationDetail(currentStationData.IDRec);
            }

            setTimeout(() => {
                document.getElementById('addRecipientModal').classList.remove('open');
                document.getElementById('saveRecipientBtn').disabled = false;
            }, 1000);
        })
        .catch(err => {
            console.error(err);
            statusEl.textContent = 'บันทึกไม่สำเร็จ';
            document.getElementById('saveRecipientBtn').disabled = false;
        });
}

function populateAddressDbPlantFilter() {
    const select = document.getElementById('addressDbPlantFilter');
    if (!select) return;

    const currentVal = select.value;
    const plants = [...new Set(addressDB.map(r => String(r.Plantname || r.PLANTNAME || '').trim()).filter(p => p))].sort();

    select.innerHTML = '<option value="">-- ทุกศูนย์รับผิดชอบ --</option>';
    plants.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });

    if (currentVal && plants.includes(currentVal)) {
        select.value = currentVal;
    }
}

function openAddressDatabase() {
    createAddressDatabaseModal();
    const modal = document.getElementById('addressDatabaseModal');
    modal.classList.add('open');

    populateAddressDbPlantFilter();

    renderAddressDbTable();

    // Focus search
    setTimeout(() => {
        const search = document.getElementById('addressDbSearch');
        if (search) search.focus();
    }, 100);
}

const openAddressDbBtn = document.getElementById('openAddressDbBtn');
if (openAddressDbBtn) {
    openAddressDbBtn.addEventListener('click', openAddressDatabase);
}

// ========= Edit Recipient Modal Functions =========

function createEditRecipientModal() {
    if (document.getElementById('editRecipientModal')) return;

    const modalHtml = `
    <div id="editRecipientModal" class="modal" aria-hidden="true" style="z-index: 3400;">
        <div class="modal-card" style="width: 90%; max-width: 400px; padding: 20px;">
            <div class="modal-title" style="margin-bottom: 15px;">แก้ไขผู้รับ</div>
            
            <input type="hidden" id="editRecipientIDname">
            <input type="hidden" id="editRecipientIDRec">
            
            <div class="address-modal-form">
                <div class="address-form-row">
                    <div class="address-field">
                        <span class="address-label">Plant</span>
                        <input id="editRecipientPlant" type="text" class="address-input" readonly style="background: #f3f4f6;">
                    </div>
                    <div class="address-field">
                        <span class="address-label">Station</span>
                        <input id="editRecipientStation" type="text" class="address-input" placeholder="ระบุ Station">
                    </div>
                </div>
                <div class="address-form-row">
                    <div class="address-field address-full">
                        <span class="address-label">ชื่อผู้รับ (NameX) *</span>
                        <input id="editRecipientNameX" type="text" class="address-input" placeholder="ระบุชื่อผู้รับ">
                    </div>
                </div>
                <div class="address-form-row">
                    <div class="address-field address-full">
                        <span class="address-label">เบอร์โทร (Mobile)</span>
                        <input id="editRecipientMobile" type="tel" class="address-input" placeholder="ระบุเบอร์โทร">
                    </div>
                </div>
            </div>

            <div class="modal-actions" style="margin-top: 20px; justify-content: space-between;">
                <button id="deleteRecipientBtn" class="delete-btn" type="button" style="padding: 8px 16px; border-radius: 999px;">ลบ</button>
                <div style="display: flex; gap: 10px;">
                    <button id="updateRecipientBtn" class="btn-serial-primary" type="button">บันทึก</button>
                    <button id="closeEditRecipientBtn" class="btn-serial-outline" type="button">ยกเลิก</button>
                </div>
            </div>
            <div class="status" id="editRecipientFormStatus"></div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('closeEditRecipientBtn').addEventListener('click', () => {
        document.getElementById('editRecipientModal').classList.remove('open');
    });

    document.getElementById('updateRecipientBtn').addEventListener('click', saveEditRecipient);
    document.getElementById('deleteRecipientBtn').addEventListener('click', deleteRecipient);

    document.getElementById('editRecipientModal').addEventListener('click', (e) => {
        if (e.target.id === 'editRecipientModal') {
            e.target.classList.remove('open');
        }
    });
}

function openEditRecipientModal(data) {
    createEditRecipientModal();

    document.getElementById('editRecipientIDname').value = data.IDname || data.name || '';
    document.getElementById('editRecipientIDRec').value = data.IDRec || data.idrec || '';
    document.getElementById('editRecipientPlant').value = data.Plant || data.PLANT || '';
    document.getElementById('editRecipientStation').value = data.Station || data.STATION || '';
    document.getElementById('editRecipientNameX').value = data.NameX || data.namex || '';
    document.getElementById('editRecipientMobile').value = data.Mobile || data.mobile || '';
    document.getElementById('editRecipientFormStatus').textContent = '';

    document.getElementById('editRecipientModal').classList.add('open');
}

function saveEditRecipient() {
    const idName = document.getElementById('editRecipientIDname').value;
    const idRec = document.getElementById('editRecipientIDRec').value;
    const plant = document.getElementById('editRecipientPlant').value.trim();
    const station = document.getElementById('editRecipientStation').value.trim();
    const nameX = document.getElementById('editRecipientNameX').value.trim();
    const mobile = document.getElementById('editRecipientMobile').value.trim();
    const statusEl = document.getElementById('editRecipientFormStatus');

    if (!nameX) {
        statusEl.textContent = 'กรุณาระบุชื่อผู้รับ';
        return;
    }

    statusEl.textContent = 'กำลังบันทึกการแก้ไข...';
    document.getElementById('updateRecipientBtn').disabled = true;
    document.getElementById('deleteRecipientBtn').disabled = true;

    const payload = {
        IDname: idName,
        name: idName,
        IDRec: idRec,
        Plant: plant,
        Station: station,
        mobile: mobile,
        NameX: nameX,
        action: 'editName'
    };

    fetch(NAME_REC_SAVE_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(() => {
            statusEl.textContent = 'บันทึกสำเร็จ!';

            const idx = nameRecDB.findIndex(r => (r.IDname === idName || r.name === idName));
            if (idx !== -1) {
                nameRecDB[idx] = { ...nameRecDB[idx], ...payload };
            }

            if (window.openStationDetail && idRec) {
                window.openStationDetail(idRec);
            }

            setTimeout(() => {
                document.getElementById('editRecipientModal').classList.remove('open');
                document.getElementById('updateRecipientBtn').disabled = false;
                document.getElementById('deleteRecipientBtn').disabled = false;
            }, 1000);
        })
        .catch(err => {
            console.error(err);
            statusEl.textContent = 'บันทึกไม่สำเร็จ';
            document.getElementById('updateRecipientBtn').disabled = false;
            document.getElementById('deleteRecipientBtn').disabled = false;
        });
}

function deleteRecipient() {
    if (!confirm('ต้องการลบผู้รับรายนี้ใช่หรือไม่?')) return;

    const idName = document.getElementById('editRecipientIDname').value;
    const idRec = document.getElementById('editRecipientIDRec').value;
    const statusEl = document.getElementById('editRecipientFormStatus');

    statusEl.textContent = 'กำลังลบ...';
    document.getElementById('updateRecipientBtn').disabled = true;
    document.getElementById('deleteRecipientBtn').disabled = true;

    const payload = {
        IDname: idName,
        name: idName,
        action: 'deleteName'
    };

    fetch(NAME_REC_SAVE_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(() => {
            statusEl.textContent = 'ลบสำเร็จ!';

            const idx = nameRecDB.findIndex(r => (r.IDname === idName || r.name === idName));
            if (idx !== -1) {
                nameRecDB.splice(idx, 1);
            }

            if (window.openStationDetail && idRec) {
                window.openStationDetail(idRec);
            }

            setTimeout(() => {
                document.getElementById('editRecipientModal').classList.remove('open');
                document.getElementById('updateRecipientBtn').disabled = false;
                document.getElementById('deleteRecipientBtn').disabled = false;
            }, 1000);
        })
        .catch(err => {
            console.error(err);
            statusEl.textContent = 'ลบไม่สำเร็จ';
            document.getElementById('updateRecipientBtn').disabled = false;
            document.getElementById('deleteRecipientBtn').disabled = false;
        });
}

// Expose internal function to allow re-initialization from other scripts (e.g. barcode.js)
window.refreshAddressDefaults = initSenderFilters;
