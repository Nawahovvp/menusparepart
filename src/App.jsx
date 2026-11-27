import React, { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import './hub/hub.css';
import HubLogin from './hub/HubLogin';
import HubShell from './hub/HubShell';
import { MENU_ITEMS } from './hub/menuConfig';

const CallSparepartApp = lazy(() => import('./modules/call-sparepart/App.jsx'));

const SESSION_KEY = 'plant_hub_user_session_v2';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function loadSavedSession() {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.user) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

function saveSession(user, remember) {
  const userWithTime = { ...user, loginTime: Date.now() };
  const payload = JSON.stringify({
    user: userWithTime,
    remember: Boolean(remember),
    savedAt: Date.now(),
  });
  if (remember) {
    localStorage.setItem(SESSION_KEY, payload);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, payload);
    localStorage.removeItem(SESSION_KEY);
  }
  localStorage.setItem('user', JSON.stringify(userWithTime));
  // Sync for ABC Analysis embedded app
  localStorage.setItem(
    'rememberedUser',
    JSON.stringify({
      IDUser: String(user.IDRec || user.IDUser || '').trim(),
      Name: user.Name || 'ไม่ระบุ',
      Position: user['ตำแหน่ง'] || user.Position || '',
      Department: user['หน่วยงาน'] || user.Department || '',
      Plant: user.Plant || '',
    })
  );
  return userWithTime;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('user');
  localStorage.removeItem('rememberedUser');
  sessionStorage.removeItem('loggedUser');
  localStorage.removeItem('barcode-login');
  localStorage.removeItem('tankRechargeUser');
}

function getInitialMenu() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');
  if (page === 'spare-summary' || page === 'gm-summary') {
    return MENU_ITEMS.find((m) => m.id === 'call-sparepart') || null;
  }
  return null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => loadSavedSession());
  const [activeMenu, setActiveMenu] = useState(() => getInitialMenu());
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2600);
  }, []);

  const handleLoginSuccess = useCallback(
    (user, remember) => {
      const saved = saveSession(user, remember);
      setCurrentUser(saved);
      showToast(`ยินดีต้อนรับ ${saved.Name || saved.IDRec}`);
    },
    [showToast]
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'CallSparePartApp' },
      });
    } catch {
      // ignore network error on logout
    }
    clearSession();
    setCurrentUser(null);
    setActiveMenu(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  }, [showToast]);

  // Listen for 401 unauthorized events from internal modules & logout messages from embedded apps
  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setCurrentUser(null);
      setActiveMenu(null);
      showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    };
    const onWindowMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'hub:logout') {
        handleLogout();
      }
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    window.addEventListener('message', onWindowMessage);
    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized);
      window.removeEventListener('message', onWindowMessage);
    };
  }, [showToast, handleLogout]);

  // Lock viewport on Login screen
  useEffect(() => {
    if (!currentUser) {
      document.body.classList.add('hub-viewport-locked');
    }
  }, [currentUser]);

  if (!currentUser) {
    const savedTheme = localStorage.getItem('plant_hub_theme_v1') || 'dark';
    return (
      <div className="hub-shell" data-hub-theme={savedTheme}>
        <div className="ambient-bg" aria-hidden="true">
          <div className="ambient-orb orb-1"></div>
          <div className="ambient-orb orb-2"></div>
          <div className="ambient-orb orb-3"></div>
          <div className="ambient-grid"></div>
          <div className="ambient-vignette"></div>
        </div>
        <HubLogin onLoginSuccess={handleLoginSuccess} />
        {toastMessage && (
          <div className="toast show" role="status" aria-live="polite">
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  // Standalone sub-pages opened in new tab from Call Sparepart (?page=spare-summary / ?page=gm-summary)
  const params = new URLSearchParams(window.location.search);
  const subPage = params.get('page');
  if (subPage === 'spare-summary' || subPage === 'gm-summary') {
    const savedTheme = localStorage.getItem('plant_hub_theme_v1') || 'dark';
    return (
      <>
        <div className="hub-shell" data-hub-theme={savedTheme}>
          <div className="ambient-bg" aria-hidden="true">
            <div className="ambient-orb orb-1"></div>
            <div className="ambient-orb orb-2"></div>
            <div className="ambient-orb orb-3"></div>
            <div className="ambient-grid"></div>
            <div className="ambient-vignette"></div>
          </div>
        </div>
        <div className="hub-module-host">
          <Suspense
            fallback={
              <div className="hub-module-loading">
                <div className="loader-ring"></div>
                <span>กำลังโหลดหน้าสรุปข้อมูล...</span>
              </div>
            }
          >
            <CallSparepartApp externalUser={currentUser} onExternalLogout={handleLogout} />
          </Suspense>
        </div>
      </>
    );
  }

  return (
    <HubShell
      user={currentUser}
      activeMenu={activeMenu}
      onSelectMenu={setActiveMenu}
      onReturnHome={() => setActiveMenu(null)}
      onLogout={handleLogout}
      toastMessage={toastMessage}
      showToast={showToast}
    >
      {activeMenu?.id === 'call-sparepart' && (
        <Suspense
          fallback={
            <div className="hub-module-loading">
              <div className="loader-ring"></div>
              <span>กำลังเปิดระบบ Call Sparepart...</span>
            </div>
          }
        >
          <CallSparepartApp externalUser={currentUser} onExternalLogout={handleLogout} />
        </Suspense>
      )}
    </HubShell>
  );
}
