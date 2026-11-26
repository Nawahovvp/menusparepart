/**
 * Plant Operations Hub — Settigation-Style Vertical Left Sidebar + Orb Morph
 * - Opensheet API Login (Sheet: UserPlantCode)
 *   Username = IDUser
 *   Password = last 4 digits of IDUser + 2-digit zero-padded sum of last 2 digits
 * - Remember Me persistence
 * - Long vertical left sidebar with toggle button, search, show/hide all menus,
 *   bottom Settings & Dark/Light switch
 * - Selecting a menu loads the webpage on the background & collapses the sidebar
 *   into a floating circular orb at top-left
 */

(() => {
  'use strict';

  const SHEET_ID = '1eqVoLsZxGguEbRCC5rdI4iMVtQ7CK4T3uXRdx8zE3uw';
  const SHEET_NAME = 'UserPlantCode';
  const OPENSHEET_URL = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(SHEET_NAME)}`;
  const GVIZ_FALLBACK_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  const STORAGE_KEYS = {
    SESSION: 'plant_hub_user_session_v1',
    THEME: 'plant_hub_theme_v1',
    AUTO_ORB: 'plant_hub_auto_orb_v1',
    OPEN_NEW_TAB: 'plant_hub_open_new_tab_v1',
  };

  const MENU_ITEMS = [
    {
      id: 'spareparts-request',
      title: 'ค้นหาอะไหล่',
      subtitle: 'Spare Parts Search & Request',
      url: 'https://spareparts-request.nawahovvps.workers.dev/',
      color1: '#f59e0b',
      color2: '#ea580c',
      glow: 'rgba(245, 158, 11, 0.42)',
      tint: 'rgba(245, 158, 11, 0.16)',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    },
    {
      id: 'abc-analysis',
      title: 'ABC Analasis',
      subtitle: 'Inventory Classification & Analytics',
      url: 'https://abc-analysis-new-plant-all.vercel.app/',
      color1: '#8b5cf6',
      color2: '#6366f1',
      glow: 'rgba(139, 92, 246, 0.42)',
      tint: 'rgba(139, 92, 246, 0.16)',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
    },
    {
      id: 'call-sparepart',
      title: 'Call',
      subtitle: 'แจ้งเรียกอะไหล่ / Call Sparepart',
      url: 'https://callsparepart-cloudflare.vercel.app/',
      color1: '#10b981',
      color2: '#059669',
      glow: 'rgba(16, 185, 129, 0.42)',
      tint: 'rgba(16, 185, 129, 0.16)',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    },
    {
      id: 'dashboard-tsc',
      title: 'TSC Bluetap Summi Adapter Wif Dyno',
      subtitle: 'TSC Hardware & Dyno Dashboard',
      url: 'https://dashboard-tsc.vercel.app/',
      color1: '#06b6d4',
      color2: '#2563eb',
      glow: 'rgba(6, 182, 212, 0.42)',
      tint: 'rgba(6, 182, 212, 0.16)',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`,
    },
    {
      id: 'barcode-nawanakorn',
      title: 'Barcode',
      subtitle: 'สแกนและจัดการบาร์โค้ด',
      url: 'https://barcode-nawanakorn-web.vercel.app/',
      color1: '#ec4899',
      color2: '#a855f7',
      glow: 'rgba(236, 72, 153, 0.42)',
      tint: 'rgba(236, 72, 153, 0.16)',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 7v10"/><path d="M12 7v10"/><path d="M16 7v10"/></svg>`,
    },
    {
      id: 'stockday',
      title: 'StockDay',
      subtitle: 'ติดตามวันคงเหลือสต็อกสินค้า',
      url: 'https://stockday-vite-auth.vercel.app/',
      color1: '#3b82f6',
      color2: '#1d4ed8',
      glow: 'rgba(59, 130, 246, 0.42)',
      tint: 'rgba(59, 130, 246, 0.16)',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    },
    {
      id: 'tank-recharge',
      title: 'รับส่งถังบรรจุก๊าซ',
      subtitle: 'Gas Cylinder Recharge & Logistics',
      url: 'https://tank-recharge.vercel.app/',
      color1: '#f43f5e',
      color2: '#e11d48',
      glow: 'rgba(244, 63, 94, 0.42)',
      tint: 'rgba(244, 63, 94, 0.16)',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    },
  ];

  // State
  let currentUser = null;
  let activeMenu = null;
  let previewedMenu = null;
  let isSidebarVisible = false;
  let isSidebarMini = false;
  let isMenuListExpanded = true;
  let autoCollapseToOrb = true;
  let openInNewTab = true;
  let isLaunchingTab = false;
  let stageHideTimer = null;
  let toastTimer = null;

  const el = {
    loginScreen: document.getElementById('loginScreen'),
    loginForm: document.getElementById('loginForm'),
    usernameInput: document.getElementById('usernameInput'),
    passwordInput: document.getElementById('passwordInput'),
    togglePwBtn: document.getElementById('togglePwBtn'),
    rememberMeCheckbox: document.getElementById('rememberMeCheckbox'),
    loginError: document.getElementById('loginError'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    loginSpinner: document.getElementById('loginSpinner'),

    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    sidebarEdgeToggle: document.getElementById('sidebarEdgeToggle'),
    sidebarSearchBox: document.getElementById('sidebarSearchBox'),
    menuSearchInput: document.getElementById('menuSearchInput'),
    toggleAllMenusBtn: document.getElementById('toggleAllMenusBtn'),
    toggleAllLabel: document.getElementById('toggleAllLabel'),
    sidebarNav: document.getElementById('sidebarNav'),
    emptySearch: document.getElementById('emptySearch'),
    collapseToOrbBtn: document.getElementById('collapseToOrbBtn'),
    brandPlantSub: document.getElementById('brandPlantSub'),

    settingsBtn: document.getElementById('settingsBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeModeLabel: document.getElementById('themeModeLabel'),
    userAvatar: document.getElementById('userAvatar'),
    userDisplayName: document.getElementById('userDisplayName'),
    userSubInfo: document.getElementById('userSubInfo'),
    logoutBtn: document.getElementById('logoutBtn'),

    welcomeStage: document.getElementById('welcomeStage'),
    stageCard: document.querySelector('#welcomeStage .stage-card'),
    stagePlantBadge: document.getElementById('stagePlantBadge'),
    stageHeroIcon: document.getElementById('stageHeroIcon'),
    stageHeroTitle: document.getElementById('stageHeroTitle'),

    appViewport: document.getElementById('appViewport'),
    contentFrame: document.getElementById('contentFrame'),
    iframeLoader: document.getElementById('iframeLoader'),
    loaderTitle: document.getElementById('loaderTitle'),
    loaderUrl: document.getElementById('loaderUrl'),

    floatingOrbWrap: document.getElementById('floatingOrbWrap'),
    floatingOrbBtn: document.getElementById('floatingOrbBtn'),
    floatingOrbIcon: document.getElementById('floatingOrbIcon'),
    orbActiveName: document.getElementById('orbActiveName'),
    orbReloadBtn: document.getElementById('orbReloadBtn'),
    orbExternalLink: document.getElementById('orbExternalLink'),

    settingsModal: document.getElementById('settingsModal'),
    settingsBackdrop: document.getElementById('settingsBackdrop'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    settingsDoneBtn: document.getElementById('settingsDoneBtn'),
    settingsLogoutBtn: document.getElementById('settingsLogoutBtn'),
    openNewTabCheckbox: document.getElementById('openNewTabCheckbox'),
    autoOrbCheckbox: document.getElementById('autoOrbCheckbox'),
    settingsAvatarLg: document.getElementById('settingsAvatarLg'),
    settingsHeroName: document.getElementById('settingsHeroName'),
    settingsHeroPlant: document.getElementById('settingsHeroPlant'),
    infoName: document.getElementById('infoName'),
    infoNicname: document.getElementById('infoNicname'),
    infoPlant: document.getElementById('infoPlant'),
    infoPlantCode: document.getElementById('infoPlantCode'),

    toast: document.getElementById('toast'),
  };

  /* ------------------------------------------------------------------------
     Password Formula:
     4 last digits of IDUser + 2-digit zero-padded sum of last 2 digits
     Example: 1001234 -> 1234 + (3+4=07) -> 123407
     ------------------------------------------------------------------------ */
  function computeExpectedPassword(idUser) {
    const raw = String(idUser ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    const source = digits.length >= 4 ? digits : raw;
    if (source.length < 2) return null;

    const last4 = source.slice(-4);
    const last2 = source.slice(-2);
    const d1 = parseInt(last2[0], 10);
    const d2 = parseInt(last2[1], 10);
    if (Number.isNaN(d1) || Number.isNaN(d2)) return null;

    const sumPadded = String(d1 + d2).padStart(2, '0');
    return `${last4}${sumPadded}`;
  }

  /* ------------------------------------------------------------------------
     Opensheet API + Google Visualization Fallback
     ------------------------------------------------------------------------ */
  async function fetchUsersFromSheet() {
    try {
      const res = await fetch(OPENSHEET_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Opensheet HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      throw new Error('Empty Opensheet response');
    } catch (primaryErr) {
      const res = await fetch(GVIZ_FALLBACK_URL, { cache: 'no-store' });
      if (!res.ok) throw primaryErr;
      const text = await res.text();
      const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (!jsonMatch) throw primaryErr;
      const parsed = JSON.parse(jsonMatch[1]);
      const cols = parsed.table.cols.map((c) => (c.label || '').trim());
      return parsed.table.rows.map((r) => {
        const rowObj = {};
        cols.forEach((colName, idx) => {
          const cell = r.c[idx];
          rowObj[colName] = cell && cell.v != null ? String(cell.v) : '';
        });
        return rowObj;
      });
    }
  }

  /* ------------------------------------------------------------------------
     Session & Preferences
     ------------------------------------------------------------------------ */
  function saveSession(user, remember) {
    const payload = JSON.stringify({ user, remember: Boolean(remember), savedAt: Date.now() });
    if (remember) {
      localStorage.setItem(STORAGE_KEYS.SESSION, payload);
      sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.SESSION, payload);
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  }

  function loadSavedSession() {
    const raw =
      localStorage.getItem(STORAGE_KEYS.SESSION) ||
      sessionStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && parsed.user ? parsed.user : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  /* ------------------------------------------------------------------------
     Adaptive Background & Color Mode
     ------------------------------------------------------------------------ */
  function applyAdaptiveTheme(item) {
    const root = document.documentElement;
    if (!item) {
      root.style.setProperty('--accent-1', '#695cfe');
      root.style.setProperty('--accent-2', '#4f46e5');
      root.style.setProperty('--accent-glow', 'rgba(105, 92, 254, 0.34)');
      root.style.setProperty('--bg-tint', 'rgba(105, 92, 254, 0.12)');
      return;
    }
    root.style.setProperty('--accent-1', item.color1);
    root.style.setProperty('--accent-2', item.color2);
    root.style.setProperty('--accent-glow', item.glow);
    root.style.setProperty('--bg-tint', item.tint);
  }

  function setColorMode(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEYS.THEME, mode);
    const sun = el.themeToggleBtn.querySelector('.icon-sun');
    const moon = el.themeToggleBtn.querySelector('.icon-moon');
    if (mode === 'light') {
      sun.classList.remove('hidden');
      moon.classList.add('hidden');
      el.themeModeLabel.textContent = 'Light Mode';
    } else {
      sun.classList.add('hidden');
      moon.classList.remove('hidden');
      el.themeModeLabel.textContent = 'Dark Mode';
    }
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    requestAnimationFrame(() => el.toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('show');
      setTimeout(() => el.toast.classList.add('hidden'), 280);
    }, 2500);
  }

  /* ------------------------------------------------------------------------
     User Profile & Stage Preview
     ------------------------------------------------------------------------ */
  const USER_AVATAR_SVG = `
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="avatarSkin" x1="20" y1="12" x2="46" y2="40" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFE0C2"/>
          <stop offset="1" stop-color="#F3B890"/>
        </linearGradient>
        <linearGradient id="avatarShirt" x1="12" y1="42" x2="52" y2="64" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFFFFF" stop-opacity="0.95"/>
          <stop offset="1" stop-color="#DBEAFE" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <path d="M12 64C13.5 49.5 21 43 32 43C43 43 50.5 49.5 52 64H12Z" fill="url(#avatarShirt)"/>
      <path d="M26 43.5L32 50L38 43.5" fill="#93C5FD" fill-opacity="0.55"/>
      <rect x="27.5" y="34" width="9" height="11" rx="4.5" fill="#E8A87C"/>
      <circle cx="32" cy="25.5" r="11.5" fill="url(#avatarSkin)"/>
      <path d="M20.5 24.5C20.5 16.5 25.5 11.5 32.5 11.5C39.2 11.5 43.8 15.8 43.8 23.2C41.2 19.6 37.4 18.2 32 18.2C27 18.2 23.2 20.4 20.5 24.5Z" fill="#1E293B"/>
      <circle cx="28" cy="26" r="1.4" fill="#1E293B"/>
      <circle cx="36" cy="26" r="1.4" fill="#1E293B"/>
      <path d="M28.8 30.8C30.4 32.2 33.6 32.2 35.2 30.8" stroke="#9A5B3A" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `;

  function renderUserProfile(user) {
    const displayName = user.Nicname
      ? `${user.Name || user.IDUser} (${user.Nicname})`
      : user.Name || user.IDUser;
    const plantLabel = [user.Plant, user.PlantCode].filter(Boolean).join(' · ') || 'Operations Menu';

    el.userAvatar.innerHTML = USER_AVATAR_SVG;
    el.userDisplayName.textContent = displayName;
    if (el.userSubInfo) el.userSubInfo.textContent = `ID: ${user.IDUser}`;
    el.brandPlantSub.textContent = plantLabel;
    el.stagePlantBadge.textContent = plantLabel;

    // Populate User-Focused Settings Modal
    el.settingsAvatarLg.innerHTML = USER_AVATAR_SVG;
    el.settingsHeroName.textContent = displayName;
    el.settingsHeroPlant.textContent = plantLabel;

    el.infoName.textContent = user.Name || '-';
    el.infoNicname.textContent = user.Nicname || '-';
    el.infoPlant.textContent = user.Plant || '-';
    el.infoPlantCode.textContent = user.PlantCode || '-';
  }

  function showStagePreview() {
    clearTimeout(stageHideTimer);
    el.welcomeStage.classList.add('is-stage-visible');
  }

  function scheduleHideStagePreview() {
    if (isLaunchingTab) return;
    clearTimeout(stageHideTimer);
    stageHideTimer = setTimeout(() => {
      if (!isLaunchingTab) {
        el.welcomeStage.classList.remove('is-stage-visible');
      }
    }, 260);
  }

  function updateWelcomeStage(item) {
    previewedMenu = item;
    if (!item) {
      el.stageHeroIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>`;
      el.stageHeroIcon.title = 'เลือกเมนูจากแถบด้านซ้าย';
      el.stageHeroTitle.textContent = 'เลือกเมนูจากแถบด้านซ้าย';
      return;
    }
    el.stageHeroIcon.innerHTML = item.icon;
    el.stageHeroIcon.title = `คลิกโลโก้เพื่อเปิด ${item.title} ในแท็บใหม่`;
    el.stageHeroTitle.textContent = item.title;
  }

  /* ------------------------------------------------------------------------
     Render Vertical Sidebar Menu Items
     ------------------------------------------------------------------------ */
  function renderSidebarMenu(filterText = '') {
    const query = filterText.trim().toLowerCase();
    const filtered = MENU_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query)
    );

    el.sidebarNav.innerHTML = '';
    if (filtered.length === 0) {
      el.emptySearch.classList.remove('hidden');
      return;
    }
    el.emptySearch.classList.add('hidden');

    filtered.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `nav-item${activeMenu && activeMenu.id === item.id ? ' is-active' : ''}`;
      btn.title = `${item.title} — ${item.subtitle}`;
      btn.style.setProperty('--item-c1', item.color1);
      btn.style.setProperty('--item-c2', item.color2);
      btn.style.setProperty('--item-glow', item.glow);

      btn.innerHTML = `
        <span class="nav-item-icon">${item.icon}</span>
        <span class="nav-item-text">
          <span class="nav-item-title">${escapeHtml(item.title)}</span>
          <span class="nav-item-sub">${escapeHtml(item.subtitle)}</span>
        </span>
        ${activeMenu && activeMenu.id === item.id ? '<span class="nav-active-dot" title="กำลังเปิดใช้งาน"></span>' : ''}
      `;

      btn.addEventListener('pointermove', (e) => {
        const rect = btn.getBoundingClientRect();
        btn.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        btn.style.setProperty('--my', `${e.clientY - rect.top}px`);
      });

      btn.addEventListener('mouseenter', () => {
        applyAdaptiveTheme(item);
        if (!activeMenu || openInNewTab) updateWelcomeStage(item);
        showStagePreview();
      });

      btn.addEventListener('click', () => {
        selectMenuItem(item);
      });

      el.sidebarNav.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------------
     Sidebar States: Expanded / Mini Rail / Collapsed Top-Left Circle Orb
     ------------------------------------------------------------------------ */
  function setSidebarMini(mini) {
    isSidebarMini = mini;
    el.sidebar.classList.toggle('is-mini', mini);
    document.body.classList.toggle('sidebar-mini', mini);
  }

  function openSidebar(mini = false) {
    isSidebarVisible = true;
    el.floatingOrbWrap.classList.add('hidden');
    el.sidebar.classList.remove('hidden', 'is-collapsing-to-orb');
    setSidebarMini(mini);

    if (activeMenu && !openInNewTab) {
      el.sidebarBackdrop.classList.remove('hidden');
      requestAnimationFrame(() => el.sidebarBackdrop.classList.add('visible'));
      applyAdaptiveTheme(activeMenu);
    } else {
      el.sidebarBackdrop.classList.add('hidden');
      el.sidebarBackdrop.classList.remove('visible');
    }
  }

  const DEFAULT_HUB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>`;

  function collapseSidebarToOrb() {
    if (!currentUser || !isSidebarVisible) return;
    isSidebarVisible = false;
    clearTimeout(stageHideTimer);
    el.welcomeStage.classList.remove('is-stage-visible');

    // Sync orb icon & pill info
    const orbItem = activeMenu || previewedMenu;
    el.floatingOrbIcon.innerHTML = orbItem ? orbItem.icon : DEFAULT_HUB_ICON;
    el.orbActiveName.textContent = orbItem ? orbItem.title : 'Plant Hub';
    el.orbReloadBtn.classList.toggle('hidden', openInNewTab || !activeMenu);
    if (orbItem) {
      el.orbExternalLink.href = orbItem.url;
      el.orbExternalLink.classList.remove('hidden');
    } else {
      el.orbExternalLink.classList.add('hidden');
    }

    el.sidebar.classList.add('is-collapsing-to-orb');
    el.sidebarBackdrop.classList.remove('visible');

    setTimeout(() => {
      if (!isSidebarVisible) {
        el.sidebar.classList.add('hidden');
        el.sidebar.classList.remove('is-collapsing-to-orb');
        el.sidebarBackdrop.classList.add('hidden');
        el.floatingOrbWrap.classList.remove('hidden');
      }
    }, 320);
  }

  function launchMenuInNewTab(item) {
    if (isLaunchingTab) return;
    isLaunchingTab = true;

    activeMenu = item;
    applyAdaptiveTheme(item);
    updateWelcomeStage(item);

    // Ensure iframe viewport & orb stay hidden in new-tab mode
    el.contentFrame.src = 'about:blank';
    el.appViewport.classList.add('hidden');
    el.floatingOrbWrap.classList.add('hidden');
    el.collapseToOrbBtn.classList.add('hidden');
    el.sidebarBackdrop.classList.add('hidden');
    el.sidebarBackdrop.classList.remove('visible');
    el.welcomeStage.classList.remove('hidden');

    renderSidebarMenu(el.menuSearchInput.value);

    // Trigger 3D screen-rotate portal launch animation
    showStagePreview();
    if (el.stageCard) {
      el.stageCard.classList.remove('is-returning', 'is-launching');
      el.welcomeStage.classList.remove('is-launching');
      void el.stageCard.offsetWidth; // force reflow for repeated clicks
      el.welcomeStage.classList.add('is-launching');
      el.stageCard.classList.add('is-launching');
    }

    setTimeout(() => {
      const opened = window.open(item.url, '_blank', 'noopener,noreferrer');
      showToast(
        opened
          ? `เปิด ${item.title} ในแท็บใหม่แล้ว`
          : 'เบราว์เซอร์บล็อกป๊อปอัป กรุณากดที่โลโก้กลางจอเพื่อเปิดในแท็บใหม่'
      );
    }, 380);

    setTimeout(() => {
      clearTimeout(stageHideTimer);
      el.welcomeStage.classList.remove('is-launching', 'is-stage-visible');
      if (el.stageCard) {
        el.stageCard.classList.remove('is-launching', 'is-returning');
      }
      isLaunchingTab = false;
    }, 540);
  }

  function selectMenuItem(item) {
    if (openInNewTab) {
      launchMenuInNewTab(item);
      return;
    }

    const isSame = activeMenu && activeMenu.id === item.id;
    activeMenu = item;
    applyAdaptiveTheme(item);

    // Update top-left floating orb
    el.floatingOrbIcon.innerHTML = item.icon;
    el.orbActiveName.textContent = item.title;
    el.orbExternalLink.href = item.url;
    el.collapseToOrbBtn.classList.remove('hidden');

    // Switch from welcome stage to background webpage viewport
    el.welcomeStage.classList.add('hidden');
    el.appViewport.classList.remove('hidden');

    if (!isSame || el.contentFrame.src !== item.url) {
      el.loaderTitle.textContent = `กำลังเปิด ${item.title}...`;
      el.loaderUrl.textContent = item.url;
      el.iframeLoader.classList.add('visible');
      el.contentFrame.src = item.url;
    }

    renderSidebarMenu(el.menuSearchInput.value);

    if (autoCollapseToOrb) {
      collapseSidebarToOrb();
    } else {
      setSidebarMini(true);
      el.sidebarBackdrop.classList.add('hidden');
      el.sidebarBackdrop.classList.remove('visible');
    }
  }

  /* ------------------------------------------------------------------------
     Settings Modal
     ------------------------------------------------------------------------ */
  function openSettingsModal() {
    el.openNewTabCheckbox.checked = openInNewTab;
    el.autoOrbCheckbox.checked = autoCollapseToOrb;
    el.settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    el.settingsModal.classList.add('hidden');
  }

  /* ------------------------------------------------------------------------
     Login & Logout
     ------------------------------------------------------------------------ */
  async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = el.usernameInput.value.trim();
    const password = el.passwordInput.value.trim();
    const remember = el.rememberMeCheckbox.checked;

    hideLoginError();
    if (!username || !password) {
      showLoginError('กรุณากรอก Username (IDUser) และ Password ให้ครบถ้วน');
      return;
    }

    setLoginLoading(true);
    try {
      const users = await fetchUsersFromSheet();
      const matchedUser = users.find(
        (row) => String(row.IDUser ?? '').trim().toLowerCase() === username.toLowerCase()
      );

      if (!matchedUser) {
        showLoginError('ไม่พบชื่อผู้ใช้งาน (IDUser) นี้ในระบบ UserPlantCode');
        setLoginLoading(false);
        return;
      }

      const expectedPassword = computeExpectedPassword(matchedUser.IDUser);
      if (!expectedPassword || password !== expectedPassword) {
        showLoginError('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        setLoginLoading(false);
        return;
      }

      currentUser = matchedUser;
      saveSession(matchedUser, remember);
      enterApp(matchedUser);
      showToast(`ยินดีต้อนรับ ${matchedUser.Nicname || matchedUser.Name || matchedUser.IDUser}`);
    } catch (err) {
      console.error('Login error:', err);
      showLoginError('ไม่สามารถเชื่อมต่อฐานข้อมูล UserPlantCode ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoginLoading(false);
    }
  }

  function setLoginLoading(loading) {
    el.loginSubmitBtn.disabled = loading;
    el.loginSubmitBtn.querySelector('.btn-label').textContent = loading
      ? 'กำลังตรวจสอบข้อมูล...'
      : 'เข้าสู่ระบบ';
    el.loginSpinner.classList.toggle('hidden', !loading);
  }

  function showLoginError(msg) {
    el.loginError.textContent = msg;
    el.loginError.classList.remove('hidden');
  }

  function hideLoginError() {
    el.loginError.classList.add('hidden');
    el.loginError.textContent = '';
  }

  function enterApp(user) {
    currentUser = user;
    renderUserProfile(user);
    renderSidebarMenu();
    updateWelcomeStage(MENU_ITEMS[0]);
    applyAdaptiveTheme(MENU_ITEMS[0]);

    el.loginScreen.classList.add('hidden');
    el.welcomeStage.classList.remove('hidden');
    openSidebar(true);
  }

  function logout() {
    clearSession();
    closeSettingsModal();
    currentUser = null;
    activeMenu = null;
    previewedMenu = null;
    isSidebarVisible = false;

    el.contentFrame.src = 'about:blank';
    el.appViewport.classList.add('hidden');
    el.welcomeStage.classList.add('hidden');
    el.sidebar.classList.add('hidden');
    el.sidebarBackdrop.classList.add('hidden');
    el.floatingOrbWrap.classList.add('hidden');
    el.collapseToOrbBtn.classList.add('hidden');

    el.loginForm.reset();
    el.rememberMeCheckbox.checked = true;
    hideLoginError();
    applyAdaptiveTheme(null);
    el.loginScreen.classList.remove('hidden');
    el.usernameInput.focus();
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------------
     Event Bindings & Init
     ------------------------------------------------------------------------ */
  function bindEvents() {
    el.loginForm.addEventListener('submit', handleLoginSubmit);

    el.togglePwBtn.addEventListener('click', () => {
      const isPassword = el.passwordInput.type === 'password';
      el.passwordInput.type = isPassword ? 'text' : 'password';
      el.togglePwBtn.querySelector('.eye-open').classList.toggle('hidden', isPassword);
      el.togglePwBtn.querySelector('.eye-closed').classList.toggle('hidden', !isPassword);
    });

    // Edge toggle button (Expand <-> Mini Icon Rail)
    el.sidebarEdgeToggle.addEventListener('click', () => {
      setSidebarMini(!isSidebarMini);
    });

    // Clicking search in mini rail expands sidebar & focuses search
    el.sidebarSearchBox.addEventListener('click', () => {
      if (isSidebarMini) {
        setSidebarMini(false);
        setTimeout(() => el.menuSearchInput.focus(), 120);
      }
    });

    el.menuSearchInput.addEventListener('input', (e) => {
      if (!isMenuListExpanded) {
        isMenuListExpanded = true;
        el.sidebarNav.classList.remove('is-hidden-list');
        el.toggleAllMenusBtn.classList.remove('is-collapsed');
        el.toggleAllLabel.textContent = 'ซ่อนเมนู';
      }
      renderSidebarMenu(e.target.value);
    });

    // Toggle Show / Hide All Menus button
    el.toggleAllMenusBtn.addEventListener('click', () => {
      isMenuListExpanded = !isMenuListExpanded;
      el.sidebarNav.classList.toggle('is-hidden-list', !isMenuListExpanded);
      el.toggleAllMenusBtn.classList.toggle('is-collapsed', !isMenuListExpanded);
      el.toggleAllLabel.textContent = isMenuListExpanded ? 'ซ่อนเมนู' : 'แสดงทั้งหมด';
    });

    // Floating Top-Left Circle Orb -> Re-open Left Sidebar in Mini Mode
    el.floatingOrbBtn.addEventListener('click', () => openSidebar(true));
    el.collapseToOrbBtn.addEventListener('click', collapseSidebarToOrb);
    el.sidebarBackdrop.addEventListener('click', () => {
      if (activeMenu) collapseSidebarToOrb();
    });

    el.orbReloadBtn.addEventListener('click', () => {
      if (!activeMenu) return;
      el.loaderTitle.textContent = `กำลังรีเฟรช ${activeMenu.title}...`;
      el.loaderUrl.textContent = activeMenu.url;
      el.iframeLoader.classList.add('visible');
      el.contentFrame.src = activeMenu.url;
    });

    el.contentFrame.addEventListener('load', () => {
      el.iframeLoader.classList.remove('visible');
    });

    // Show center stage card only while hovering the sidebar (or the card itself)
    el.sidebar.addEventListener('mouseenter', showStagePreview);
    el.sidebar.addEventListener('mouseleave', scheduleHideStagePreview);
    if (el.stageCard) {
      el.stageCard.addEventListener('mouseenter', showStagePreview);
      el.stageCard.addEventListener('mouseleave', scheduleHideStagePreview);
    }

    // Hide center stage card cleanly whenever returning to this tab
    const hideStageOnReturn = () => {
      if (isLaunchingTab) return;
      clearTimeout(stageHideTimer);
      el.welcomeStage.classList.remove('is-stage-visible', 'is-launching');
      if (el.stageCard) {
        el.stageCard.classList.remove('is-launching', 'is-returning');
      }
    };
    window.addEventListener('focus', hideStageOnReturn);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) hideStageOnReturn();
    });

    // Clicking on the empty background collapses the sidebar into the top-left circle orb
    document.addEventListener('click', (e) => {
      if (!currentUser || !isSidebarVisible) return;
      if (!el.settingsModal.classList.contains('hidden')) return;
      if (
        el.sidebar.contains(e.target) ||
        el.floatingOrbWrap.contains(e.target) ||
        (el.stageCard && el.stageCard.contains(e.target))
      ) {
        return;
      }
      collapseSidebarToOrb();
    });

    // Clicking the center stage logo launches the previewed menu
    el.stageHeroIcon.addEventListener('click', () => {
      if (previewedMenu) selectMenuItem(previewedMenu);
    });

    // Bottom Settings & Theme Switch
    el.settingsBtn.addEventListener('click', openSettingsModal);
    el.closeSettingsBtn.addEventListener('click', closeSettingsModal);
    el.settingsDoneBtn.addEventListener('click', closeSettingsModal);
    el.settingsBackdrop.addEventListener('click', closeSettingsModal);
    el.settingsLogoutBtn.addEventListener('click', logout);

    el.openNewTabCheckbox.addEventListener('change', (e) => {
      openInNewTab = e.target.checked;
      localStorage.setItem(STORAGE_KEYS.OPEN_NEW_TAB, openInNewTab ? '1' : '0');
      renderSidebarMenu(el.menuSearchInput.value);

      if (openInNewTab && !el.appViewport.classList.contains('hidden')) {
        el.contentFrame.src = 'about:blank';
        el.appViewport.classList.add('hidden');
        el.floatingOrbWrap.classList.add('hidden');
        el.collapseToOrbBtn.classList.add('hidden');
        el.sidebarBackdrop.classList.add('hidden');
        el.sidebarBackdrop.classList.remove('visible');
        el.welcomeStage.classList.remove('hidden');
        if (activeMenu) updateWelcomeStage(activeMenu);
        openSidebar();
      }

      showToast(
        openInNewTab
          ? 'เปิดโหมดเปิดเมนูในแท็บใหม่ทั้งหมดแล้ว'
          : 'เปลี่ยนเป็นโหมดเปิดเมนูในหน้าต่างเดิม (iframe)'
      );
    });

    el.autoOrbCheckbox.addEventListener('change', (e) => {
      autoCollapseToOrb = e.target.checked;
      localStorage.setItem(STORAGE_KEYS.AUTO_ORB, autoCollapseToOrb ? '1' : '0');
      showToast(
        autoCollapseToOrb
          ? 'เปิดโหมดหุบเมนูเป็นวงกลมมุมซ้ายบนอัตโนมัติ'
          : 'เปลี่ยนเป็นโหมดแถบไอคอนย่อด้านซ้าย'
      );
    });

    el.themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      setColorMode(current === 'light' ? 'dark' : 'light');
    });

    el.logoutBtn.addEventListener('click', logout);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!currentUser) return;
      if (e.key === 'Escape') {
        if (!el.settingsModal.classList.contains('hidden')) {
          closeSettingsModal();
        } else if (isSidebarVisible) {
          collapseSidebarToOrb();
        }
      } else if (e.key === '/' && isSidebarVisible && document.activeElement !== el.menuSearchInput) {
        e.preventDefault();
        if (isSidebarMini) setSidebarMini(false);
        el.menuSearchInput.focus();
      }
    });
  }

  function init() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    setColorMode(savedTheme);

    const savedAutoOrb = localStorage.getItem(STORAGE_KEYS.AUTO_ORB);
    autoCollapseToOrb = savedAutoOrb === null ? true : savedAutoOrb === '1';

    const savedOpenNewTab = localStorage.getItem(STORAGE_KEYS.OPEN_NEW_TAB);
    openInNewTab = savedOpenNewTab === null ? true : savedOpenNewTab === '1';

    // Set initial toggle label
    el.toggleAllLabel.textContent = 'ซ่อนเมนู';

    bindEvents();

    const savedUser = loadSavedSession();
    if (savedUser) {
      enterApp(savedUser);
    } else {
      el.loginScreen.classList.remove('hidden');
      el.usernameInput.focus();
    }
  }

  init();
})();
