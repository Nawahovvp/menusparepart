// Fixed version - use correct field names from Google Sheets

// Populate province dropdown
function populateProvinceSelect() {
    const select = document.getElementById('newProvince');
    if (!select) return;

    select.innerHTML = '<option value="">-- เลือกจังหวัด --</option>';
    provinceDB.forEach(prov => {
        const provinceName = prov.ProvinceThai || prov.Province || prov.PROVINCE || '';
        if (provinceName) {
            const option = document.createElement('option');
            option.value = provinceName;
            option.textContent = provinceName;
            select.appendChild(option);
        }
    });
    console.log(`Populated ${select.options.length - 1} provinces`);
}

// Populate district dropdown based on selected province
function populateDistrictSelect(provinceName) {
    const select = document.getElementById('newDistrict');
    if (!select) return;

    select.innerHTML = '<option value="">-- เลือกอำเภอ --</option>';
    document.getElementById('newSubdistrict').innerHTML = '<option value="">-- เลือกตำบล --</option>';
    document.getElementById('newPostalCode').value = '';

    if (!provinceName) return;

    // Tambonbase uses different field names - check actual structure
    const districts = [...new Set(tambonDB
        .filter(row => {
            const prov = row.ProvinceThai || row.Province || row.PROVINCE || '';
            return prov === provinceName;
        })
        .map(row => row.DistrictThai || row.District || row.DISTRICT || '')
        .filter(d => d))];

    districts.sort().forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        select.appendChild(option);
    });
    console.log(`Populated ${districts.length} districts for ${provinceName}`);
}

// Populate subdistrict dropdown based on selected district
function populateSubdistrictSelect(districtName) {
    const select = document.getElementById('newSubdistrict');
    if (!select) return;

    select.innerHTML = '<option value="">-- เลือกตำบล --</option>';
    document.getElementById('newPostalCode').value = '';

    if (!districtName) return;

    const provinceName = document.getElementById('newProvince').value;
    const subdistricts = tambonDB.filter(row => {
        const prov = row.ProvinceThai || row.Province || row.PROVINCE || '';
        const dist = row.DistrictThai || row.District || row.DISTRICT || '';
        return prov === provinceName && dist === districtName;
    });

    subdistricts.forEach(row => {
        const subdistrictName = row.SubdistrictThai || row.Subdistrict || row.SUBDISTRICT || row.Tambon || row.TAMBON || '';
        if (subdistrictName) {
            const option = document.createElement('option');
            option.value = subdistrictName;
            option.textContent = subdistrictName;
            option.dataset.postalCode = row.PostalCode || row.POSTALCODE || row['Postal Code'] || row.Zipcode || '';
            select.appendChild(option);
        }
    });
    console.log(`Populated ${subdistricts.length} subdistricts for ${districtName}`);
}
