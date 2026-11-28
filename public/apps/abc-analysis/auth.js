// Authentication & user loading
async function loadUsers() {
    try {
        const res = await fetch(userUrl);
        users = await res.json();
    } catch (e) {
        console.error(e);
        alert("ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    }
}

async function loadEmployees() {
    try {
        const res = await fetch(employeeUrl);
        employees = await res.json();
    } catch (e) {
        console.error(e);
    }
}

function getHubSessionUser() {
    try {
        const raw = safeLocalStorage.getItem('plant_hub_user_session_v2')
            || safeSessionStorage.getItem('plant_hub_user_session_v2');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const u = parsed && parsed.user ? parsed.user : null;
        if (!u) return null;
        return {
            IDUser: String(u.IDRec || u.IDUser || '').trim(),
            Name: u.Name || 'ไม่ระบุ',
            Position: u['ตำแหน่ง'] || u.Position || '',
            Department: u['หน่วยงาน'] || u.Department || '',
            Unit: u.Unit || u.Team || '',
            Status: u.Status || '',
            Plant: u.Plant || ''
        };
    } catch {
        return null;
    }
}

function checkLogin() {
    const hubUser = getHubSessionUser();
    if (hubUser && hubUser.IDUser) {
        loggedUser = hubUser;
        hideLogin();
        showUserMenu();
        showPlantSelectionIfReady();
        return true;
    }
    const remembered = safeLocalStorage.getItem('rememberedUser');
    if (remembered) {
        loggedUser = JSON.parse(remembered);
        showUserMenu();
        showPlantSelectionIfReady();
        return true;
    }
    const sessionUser = safeSessionStorage.getItem('loggedUser');
    if (sessionUser) {
        loggedUser = JSON.parse(sessionUser);
        showUserMenu();
        showPlantSelectionIfReady();
        return true;
    }
    return false;
}

function showLogin() { document.getElementById('loginModal').style.display = 'flex'; }
function hideLogin() { document.getElementById('loginModal').style.display = 'none'; }

function login() {
    const idUser = document.getElementById('idUserInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    const remember = document.getElementById('rememberMe').checked;
    const normalizeId = (u) => (u || '').toString().trim();
    const user = users.find(u => {
        const idCandidates = [
            u.IDUser, u.IdUser, u.idUser, u.iduser,
            u.ID, u.Id, u.id,
            u.EmpID, u.empid,
            u.IDRec, u.IdRec, u.idRec, u.idrec
        ].map(normalizeId);
        return idCandidates.includes(idUser);
    });
    const userIdValue = user ? normalizeId(
        user.IDUser || user.IdUser || user.idUser || user.iduser ||
        user.ID || user.Id || user.id ||
        user.EmpID || user.empid ||
        user.IDRec || user.IdRec || user.idRec || user.idrec
    ) : "";
    const sheetPassword = user ? normalizeId(user.Password || user.password || user.Pwd || user.pwd || user.Pass || user.pass) : "";
    const validPassword = sheetPassword ? (password === sheetPassword) : (password === idUser.slice(-4));
    if (user && validPassword) {
        loggedUser = {
            IDUser: userIdValue || idUser,
            Name: user.Name || 'ไม่ระบุ',
            Position: user['ตำแหน่ง'] || user.Position || '',
            Department: user['หน่วยงาน'] || user.Department || '',
            Plant: user.Plant || ''
        };
        if (remember) safeLocalStorage.setItem('rememberedUser', JSON.stringify(loggedUser));
        else safeSessionStorage.setItem('loggedUser', JSON.stringify(loggedUser));
        hideLogin(); showUserMenu();
        showPlantSelectionIfReady();
    } else {
        document.getElementById('loginError').textContent = 'IDUser หรือ Password ไม่ถูกต้อง';
    }
}

function logout() {
    safeLocalStorage.removeItem('rememberedUser');
    safeSessionStorage.removeItem('loggedUser');
    loggedUser = null;
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('menuBtn').style.display = 'none';
    document.getElementById("mainCardsSection").style.display = "none";
    document.getElementById("summarySection").style.display = "none";
    document.getElementById("controlsSection").style.display = "none";
    document.getElementById("tableSection").style.display = "none";
    document.getElementById("pagination").style.display = "none";
    document.getElementById('plantSelection').style.display = "none";
    document.getElementById('backBtn').style.display = "none";
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'hub:logout' }, window.location.origin);
        return;
    }
    showLogin();
}

function showUserMenu() {
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) menuBtn.style.display = 'flex';

    const cleanName = String(loggedUser.Name || 'ไม่ระบุ').trim();
    const initialSource = cleanName.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/, '').trim();
    const initial = initialSource ? initialSource.charAt(0).toUpperCase() : 'U';

    const avatarEl = document.getElementById('userAvatarInitial');
    if (avatarEl) avatarEl.textContent = initial;

    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = cleanName;

    const idEl = document.getElementById('userID');
    if (idEl) idEl.innerHTML = `<i class="fas fa-id-badge"></i> ${loggedUser.IDUser || '-'}`;

    const statusBadge = document.getElementById('userStatusBadge');
    if (statusBadge) {
        if (loggedUser.Status && loggedUser.Status !== 'None') {
            statusBadge.innerHTML = `<i class="fas fa-user-shield"></i> ${loggedUser.Status}`;
            statusBadge.style.display = 'inline-flex';
        } else {
            statusBadge.style.display = 'none';
        }
    }

    const extraInfo = [];
    if (loggedUser.Position) extraInfo.push(loggedUser.Position);
    if (loggedUser.Department) extraInfo.push(`หน่วยงาน: ${loggedUser.Department}`);
    if (loggedUser.Plant) extraInfo.push(`Plant ${loggedUser.Plant}`);
    const extraEl = document.getElementById('userExtra');
    if (extraEl) extraEl.textContent = extraInfo.join(' • ');
}
