export const STORAGE_KEYS = {
  SESSION: 'plant_hub_user_session_v2',
  THEME: 'plant_hub_theme_v1',
  AUTO_ORB: 'plant_hub_auto_orb_v1',
  OPEN_NEW_TAB: 'plant_hub_open_new_tab_v1',
};

const APP_REQUEST_HEADERS = {
  'X-Requested-With': 'CallSparePartApp',
};

export async function loginHubUser(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...APP_REQUEST_HEADERS,
    },
    body: JSON.stringify({
      username: String(username ?? '').trim(),
      password: String(password ?? '').trim(),
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data?.error || `เข้าสู่ระบบไม่สำเร็จ (HTTP ${res.status})`);
  }

  return data;
}

export async function logoutHubUser() {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: APP_REQUEST_HEADERS,
    });
  } catch (err) {
    console.warn('[Hub Auth] Logout request failed:', err);
  }
}

export function saveHubSession(user, remember) {
  const userWithTime = { ...user, loginTime: Date.now() };
  const payload = JSON.stringify({
    user: userWithTime,
    remember: Boolean(remember),
    savedAt: Date.now(),
  });

  if (remember) {
    localStorage.setItem(STORAGE_KEYS.SESSION, payload);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  } else {
    sessionStorage.setItem(STORAGE_KEYS.SESSION, payload);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  // Keep Call Sparepart localStorage key in sync for sub-pages (?page=spare-summary)
  localStorage.setItem('user', JSON.stringify(userWithTime));
}

export function loadHubSession() {
  const raw =
    localStorage.getItem(STORAGE_KEYS.SESSION) ||
    sessionStorage.getItem(STORAGE_KEYS.SESSION);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const user = parsed?.user;
    if (!user) return null;
    const savedAt = parsed.savedAt || user.loginTime || 0;
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (savedAt && Date.now() - savedAt > twentyFourHours) {
      clearHubSession();
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function clearHubSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  localStorage.removeItem('user');
}
