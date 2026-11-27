const Auth = {
    // Helper: Map EmployeeWeb user from Plant Hub session
    getHubProfile() {
        try {
            const raw =
                localStorage.getItem('plant_hub_user_session_v2') ||
                sessionStorage.getItem('plant_hub_user_session_v2');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const u = parsed && parsed.user ? parsed.user : null;
            if (!u) return null;
            const id = String(u.IDRec || u.IDUser || '').trim();
            if (!id) return null;
            return {
                id,
                name: String(u.Name || id).trim(),
                position: String(u['ตำแหน่ง'] || u.Position || '-').trim(),
                dept: String(u['หน่วยงาน'] || u.Department || '-').trim(),
                team: String(u.Team || '-').trim(),
                plant: String(u.Plant || '-').trim(),
                status: String(u.Status || 'User').trim(),
            };
        } catch {
            return null;
        }
    },

    // Check if user is logged in
    checkLogin() {
        const hubProfile = this.getHubProfile();
        if (hubProfile) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userProfile', JSON.stringify(hubProfile));
            this.showDashboard(hubProfile);
            TscApi.logActivity("App Opened", "Hub SSO (EmployeeWeb)");
            return;
        }

        const isLoggedInLocal = localStorage.getItem('isLoggedIn') === 'true';
        const isLoggedInSession = sessionStorage.getItem('isLoggedIn') === 'true';

        if (isLoggedInLocal || isLoggedInSession) {
            const profileStr = isLoggedInLocal ? localStorage.getItem('userProfile') : sessionStorage.getItem('userProfile');
            let profile = null;
            try {
                profile = profileStr ? JSON.parse(profileStr) : null;
            } catch (e) {
                console.error("Error parsing profile:", e);
            }
            this.showDashboard(profile);
            TscApi.logActivity("App Opened", "Resumed from persistent session");
        } else {
            this.showLogin();
        }
    },

    // Login function
    async login(username, password, rememberMe) {
        try {
            // Show loading state if button exists
            const loginBtn = document.getElementById('loginButton');
            const originalBtnContent = loginBtn ? loginBtn.innerHTML : '';
            if (loginBtn) loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังตรวจสอบ...';

            const response = await TscApi.login(username, password);
            
            // Reset button
            if (loginBtn) loginBtn.innerHTML = originalBtnContent;

            if (!response.ok) {
                let errMsg = 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง';
                try {
                    const errData = await response.json();
                    if (errData && errData.error) errMsg = errData.error;
                } catch (e) {}
                this.showAuthAlert(errMsg);
                return false;
            }

            const data = await response.json();
            const rawUser = data.profile || data;
            const id = String(rawUser.id || rawUser.IDRec || rawUser.IDUser || '').trim();

            if (id) {
                const profile = {
                    id,
                    name: String(rawUser.name || rawUser.Name || id).trim(),
                    position: String(rawUser.position || rawUser['ตำแหน่ง'] || '-').trim(),
                    dept: String(rawUser.dept || rawUser['หน่วยงาน'] || '-').trim(),
                    team: String(rawUser.team || rawUser.Team || '-').trim(),
                    plant: String(rawUser.plant || rawUser.Plant || '-').trim(),
                    status: String(rawUser.status || rawUser.Status || 'User').trim(),
                };

                if (rememberMe) {
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('userProfile', JSON.stringify(profile));
                } else {
                    sessionStorage.setItem('isLoggedIn', 'true');
                    sessionStorage.setItem('userProfile', JSON.stringify(profile));
                }

                this.showDashboard(profile);
                TscApi.logActivity("Login Successful", `User ID: ${profile.id}`);
                return true;
            } else {
                this.showAuthAlert('รูปแบบการตอบกลับของระบบไม่ถูกต้อง');
                return false;
            }
        } catch (error) {
            console.error("Login Error:", error);
            
            // Reset button on connection error
            const loginBtn = document.getElementById('loginButton');
            if (loginBtn) loginBtn.innerHTML = 'เข้าสู่ระบบ <i class="fas fa-sign-in-alt"></i>';
            
            this.showAuthAlert('เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูลพนักงาน');
            return false;
        }
    },

    // Helper: Show Custom Auth Alert
    showAuthAlert(message) {
        const alertEl = document.getElementById('authAlert');
        const messageEl = document.getElementById('authAlertMessage');
        
        if (!alertEl || !messageEl) {
            alert(message); // Fallback
            return;
        }

        messageEl.textContent = message;
        alertEl.classList.add('active');

        // Auto hide after 4 seconds
        setTimeout(() => {
            alertEl.classList.remove('active');
        }, 4000);
    },

    // Logout function
    logout() {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userProfile');
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userProfile');
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'hub:logout' }, window.location.origin);
            return;
        }
        this.showLogin();
    },

    // UI Helper: Show Dashboard
    showDashboard(profile) {
        document.getElementById('loginSection').style.display = 'none';

        // Always keep landingPage closed (Hub submenu opens specific report directly)
        const landingPageEl = document.getElementById('landingPage');
        if (landingPageEl) landingPageEl.style.display = 'none';

        // Show User Menu
        document.getElementById('userMenu').style.display = 'block';

        // Update User Profile UI
        if (profile) {
            const displayName = profile.name || profile.id || "User";
            const userStatus = profile.status || "-";
            if (document.getElementById('displayUserName')) {
                document.getElementById('displayUserName').textContent = `${displayName} (${userStatus})`;
            }
            if (document.getElementById('dropdownName')) {
                document.getElementById('dropdownName').textContent = displayName;
            }
            if (document.getElementById('dropdownPosition')) {
                document.getElementById('dropdownPosition').textContent = profile.position || '-';
            }
            if (document.getElementById('dropdownDept')) {
                document.getElementById('dropdownDept').textContent = profile.dept || '-';
            }
            if (document.getElementById('dropdownTeam')) {
                document.getElementById('dropdownTeam').textContent = profile.team || '-';
            }
            if (document.getElementById('dropdownPlant')) {
                document.getElementById('dropdownPlant').textContent = profile.plant || '-';
            }
        }

        // Determine target view from ?view=... (default to 'tsc')
        const params = new URLSearchParams(window.location.search);
        const requestedView = (params.get('view') || 'tsc').toLowerCase();

        // Open requested view immediately (hides landingPage)
        if (typeof window.openDashboardView === 'function') {
            window.openDashboardView(requestedView);
        }

        // Initialize Data (Lazy Load)
        if (requestedView === 'tsc-store') {
            if (typeof window.tscStore_loadData === 'function') {
                window.tscStore_loadData();
            }
        } else {
            if (typeof window.initProductData === 'function') {
                window.initProductData();
            }
        }
    },

    // UI Helper: Show Login
    showLogin() {
        document.getElementById('loginSection').style.display = 'flex';

        // Hide all app sections
        document.getElementById('landingPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('tscStoreApp').style.display = 'none';

        // Hide User Menu
        const userMenu = document.getElementById('userMenu');
        if (userMenu) userMenu.style.display = 'none';

        // Reset Login Button if it was stuck in loading state
        const loginBtn = document.getElementById('loginButton');
        if (loginBtn) {
            loginBtn.innerHTML = 'เข้าสู่ระบบ <i class="fas fa-sign-in-alt"></i>';
        }

        // Reset Inputs
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('rememberMe').checked = false;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Check initial state
    Auth.checkLogin();

    // Event Listeners
    const loginBtn = document.getElementById('loginButton');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;
            const rem = document.getElementById('rememberMe').checked;
            Auth.login(user, pass, rem);
        });
    }

    // User Menu Toggle
    const userProfileBtn = document.getElementById('userProfileBtn');
    const userMenuContainer = document.querySelector('.user-menu-container');

    if (userProfileBtn) {
        userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuContainer.classList.toggle('active');
        });
    }

    // Logout Item Click
    const logoutItem = document.getElementById('logoutItem');
    if (logoutItem) {
        logoutItem.addEventListener('click', () => {
            Auth.logout();
            userMenuContainer.classList.remove('active');
        });
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (userMenuContainer && !userMenuContainer.contains(e.target)) {
            userMenuContainer.classList.remove('active');
        }
    });

    // Input Enter Key Support
    const passInput = document.getElementById('password');
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loginButton').click();
            }
        });
    }
});
