/**
 * AUTH.JS
 * Authentication and session management logic (Sheet: EmployeeWeb + Hub Auto-SSO).
 */

const EMPLOYEE_SHEET_URL = 'https://opensheet.elk.sh/1eqVoLsZxGguEbRCC5rdI4iMVtQ7CK4T3uXRdx8zE3uw/EmployeeWeb';

let currentUser = null;

function normalizeEmployeeUser(raw) {
  if (!raw) return null;
  const idRec = String(raw.IDRec || raw.IDUser || '').trim();
  const plant = String(raw.Plant || raw.PlantCode || '').trim();
  const status = String(raw.Status || raw.Auth || '').trim();
  return {
    IDRec: idRec,
    IDUser: idRec,
    Name: String(raw.Name || '').trim(),
    Plant: plant,
    PlantCode: plant,
    Status: status,
    Auth: status,
    Team: String(raw.Team || '').trim(),
    'ตำแหน่ง': String(raw['ตำแหน่ง'] || '').trim(),
    'หน่วยงาน': String(raw['หน่วยงาน'] || '').trim(),
  };
}

function getHubSessionUser() {
  try {
    const raw =
      localStorage.getItem('plant_hub_user_session_v2') ||
      sessionStorage.getItem('plant_hub_user_session_v2');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.user) return null;
    const mapped = normalizeEmployeeUser(parsed.user);
    return mapped && mapped.IDRec ? mapped : null;
  } catch {
    return null;
  }
}

function initAuth() {
  const hubUser = getHubSessionUser();
  if (hubUser) {
    currentUser = hubUser;
    localStorage.setItem('tankRechargeUser', JSON.stringify(currentUser));
    updateAuthUI();
    return;
  }

  const saved = localStorage.getItem('tankRechargeUser');
  if (saved) {
    try {
      currentUser = normalizeEmployeeUser(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to parse user', e);
      currentUser = null;
    }
  } else {
    currentUser = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  const infoSpan = document.getElementById('headerUserInfo');
  const appWrap = document.getElementById('appWrapper');
  const loginOverlay = document.getElementById('loginOverlay');

  if (currentUser) {
    if (infoSpan) infoSpan.style.display = 'none';
    if (appWrap) appWrap.style.display = 'block';
    if (loginOverlay) loginOverlay.classList.remove('open');
  } else {
    if (infoSpan) infoSpan.style.display = 'none';
    if (appWrap) appWrap.style.display = 'none';
    if (loginOverlay) loginOverlay.classList.add('open');
  }
  if (typeof updateAddButtonVisibility === 'function') updateAddButtonVisibility();
  if (currentUser && typeof allDataset !== 'undefined' && allDataset && typeof processLocalData === 'function') {
    processLocalData();
  }
}

async function submitLogin() {
  const user = document.getElementById('loginUsername').value.trim();
  const pass = document.getElementById('loginPassword').value.trim();
  if (!user || !pass) {
    showToast('กรุณากรอกผู้ใช้และรหัสผ่าน', 'error');
    return;
  }

  showLoading('กำลังเข้าสู่ระบบ...');
  try {
    const res = await fetch(EMPLOYEE_SHEET_URL);
    if (!res.ok) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูล EmployeeWeb ได้');
    const usersData = await res.json();

    let foundUser = null;
    for (const row of usersData) {
      if (String(row.IDRec || row.IDUser || '').trim().toLowerCase() === user.toLowerCase()) {
        foundUser = row;
        break;
      }
    }

    if (foundUser) {
      const idStr = String(foundUser.IDRec || foundUser.IDUser || '').trim();
      const last4 = idStr.slice(-4);
      const last2 = idStr.slice(-2);
      const d1 = parseInt(last2[0], 10);
      const d2 = parseInt(last2[1], 10);
      const pass6 = !Number.isNaN(d1) && !Number.isNaN(d2)
        ? `${last4}${String(d1 + d2).padStart(2, '0')}`
        : '';

      if (pass === last4 || (pass6 && pass === pass6)) {
        currentUser = normalizeEmployeeUser(foundUser);
        localStorage.setItem('tankRechargeUser', JSON.stringify(currentUser));
        updateAuthUI();
        closeLoginModal();
        showToast('เข้าสู่ระบบสำเร็จ', 'success');
      } else {
        showToast('รหัสผ่านไม่ถูกต้อง', 'error');
      }
    } else {
      showToast('ไม่พบรหัสผู้ใช้งาน (IDRec) นี้ในระบบ EmployeeWeb', 'error');
    }
  } catch (err) {
    onError(err);
  } finally {
    hideLoading();
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('tankRechargeUser');
  if (typeof showHiddenHistory !== 'undefined') showHiddenHistory = false;
  closeSettingModal();
  if (typeof closeOverReportModal === 'function') closeOverReportModal();
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'hub:logout' }, window.location.origin);
    return;
  }
  updateAuthUI();
  showToast('ออกจากระบบแล้ว', 'info');
}

function openLoginSetting() {
  if (currentUser) {
    const idVal = currentUser.IDRec || currentUser.IDUser || '—';
    const plantVal = currentUser.Plant || '—';
    const statusVal = currentUser.Status || currentUser.Auth || '—';

    const elId = document.getElementById('infoIDUser');
    const elName = document.getElementById('infoName');
    const elPlant = document.getElementById('infoPlant');
    const elPlantCode = document.getElementById('infoPlantCode');
    const elAuth = document.getElementById('infoAuth');

    if (elId) elId.textContent = idVal;
    if (elName) elName.textContent = currentUser.Name || '—';
    if (elPlant) elPlant.textContent = plantVal;
    if (elPlantCode) elPlantCode.textContent = currentUser.Team || plantVal;
    if (elAuth) elAuth.textContent = statusVal;

    // Profile header
    const name = currentUser.Name || '?';
    const initials = name.split(' ').map(w => w.charAt(0)).join('').slice(0, 2);
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('profileName').textContent = name;

    const roleEl = document.getElementById('profileRole');
    const isAdmin = String(statusVal || '').trim().toLowerCase() === 'admin';
    roleEl.textContent = isAdmin ? '🛡️ Admin' : `👤 ${statusVal !== '—' ? statusVal : 'User'}`;
    roleEl.style.background = isAdmin
      ? 'rgba(99,179,237,0.2)'
      : 'rgba(104,211,145,0.15)';
    roleEl.style.color = isAdmin ? 'var(--accent1)' : 'var(--success)';
    roleEl.style.border = isAdmin
      ? '1px solid rgba(99,179,237,0.3)'
      : '1px solid rgba(104,211,145,0.3)';

    const overReportBtn = document.getElementById('btnOverReportMenu');
    if (overReportBtn) overReportBtn.style.display = isAdmin ? 'inline-flex' : 'none';

    const historyToggleCard = document.getElementById('adminHistoryToggleCard');
    if (historyToggleCard) historyToggleCard.style.display = isAdmin ? 'flex' : 'none';
    const historyToggleInput = document.getElementById('showHiddenHistoryToggle');
    if (historyToggleInput) historyToggleInput.checked = Boolean(isAdmin && typeof showHiddenHistory !== 'undefined' && showHiddenHistory);

    document.getElementById('settingOverlay').classList.add('open');
  } else {
    document.getElementById('loginOverlay').classList.add('open');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
  }
}

function closeLoginModal() {
  document.getElementById('loginOverlay').classList.remove('open');
}

function closeSettingModal() {
  document.getElementById('settingOverlay').classList.remove('open');
}

function openHelpModal() {
  document.getElementById('helpOverlay').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('helpOverlay').classList.remove('open');
}
