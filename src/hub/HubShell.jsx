import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MENU_ITEMS, DEFAULT_HUB_ICON, USER_AVATAR_SVG } from './menuConfig';

const STORAGE_KEYS = {
  THEME: 'plant_hub_theme_v1',
};

export default function HubShell({
  user,
  activeMenu,
  onSelectMenu,
  onReturnHome,
  onLogout,
  toastMessage,
  showToast,
  children,
}) {
  const [hubTheme, setHubTheme] = useState(
    () => localStorage.getItem(STORAGE_KEYS.THEME) || 'dark'
  );

  const [isSidebarVisible, setIsSidebarVisible] = useState(() => !activeMenu);
  const [isSidebarMini, setIsSidebarMini] = useState(false);
  const [isCollapsingToOrb, setIsCollapsingToOrb] = useState(false);
  const [isMenuListExpanded, setIsMenuListExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [previewedMenu, setPreviewedMenu] = useState(
    () => MENU_ITEMS.find((m) => m.type === 'internal') || MENU_ITEMS[0]
  );
  const [isStageVisible, setIsStageVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [embedLoading, setEmbedLoading] = useState(false);

  const shellRef = useRef(null);
  const sidebarRef = useRef(null);
  const orbWrapRef = useRef(null);
  const stageCardRef = useRef(null);
  const searchInputRef = useRef(null);
  const stageHideTimerRef = useRef(null);
  const collapseTimerRef = useRef(null);

  const isInternalActive = activeMenu?.type === 'internal';
  const isEmbeddedActive = activeMenu?.type === 'embedded';
  const isAppActive = isInternalActive || isEmbeddedActive;

  // Apply adaptive accent CSS variables scoped to .hub-shell
  const applyAdaptiveTheme = useCallback((item) => {
    const node = shellRef.current;
    if (!node) return;
    if (!item) {
      node.style.setProperty('--accent-1', '#695cfe');
      node.style.setProperty('--accent-2', '#4f46e5');
      node.style.setProperty('--accent-glow', 'rgba(105, 92, 254, 0.34)');
      node.style.setProperty('--bg-tint', 'rgba(105, 92, 254, 0.12)');
      return;
    }
    node.style.setProperty('--accent-1', item.color1);
    node.style.setProperty('--accent-2', item.color2);
    node.style.setProperty('--accent-glow', item.glow);
    node.style.setProperty('--bg-tint', item.tint);
  }, []);

  useEffect(() => {
    applyAdaptiveTheme(activeMenu || previewedMenu || MENU_ITEMS[0]);
  }, [activeMenu, previewedMenu, applyAdaptiveTheme]);

  // Lock body scroll only when NOT viewing a scrollable internal module
  useEffect(() => {
    if (isInternalActive) {
      document.body.classList.remove('hub-viewport-locked');
    } else {
      document.body.classList.add('hub-viewport-locked');
    }
    return () => {
      document.body.classList.remove('hub-viewport-locked');
    };
  }, [isInternalActive]);

  // Sync sidebar mini body class
  useEffect(() => {
    document.body.classList.toggle('sidebar-mini', isSidebarMini);
    return () => document.body.classList.remove('sidebar-mini');
  }, [isSidebarMini]);

  const showStagePreview = useCallback(() => {
    if (isAppActive) return;
    clearTimeout(stageHideTimerRef.current);
    setIsStageVisible(true);
  }, [isAppActive]);

  const scheduleHideStagePreview = useCallback(() => {
    clearTimeout(stageHideTimerRef.current);
    stageHideTimerRef.current = setTimeout(() => {
      setIsStageVisible(false);
    }, 260);
  }, []);

  const collapseSidebarToOrb = useCallback(() => {
    if (!isSidebarVisible) return;
    clearTimeout(stageHideTimerRef.current);
    setIsStageVisible(false);
    setIsCollapsingToOrb(true);

    clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      setIsSidebarVisible(false);
      setIsCollapsingToOrb(false);
    }, 300);
  }, [isSidebarVisible]);

  const openSidebar = useCallback((mini = false) => {
    clearTimeout(collapseTimerRef.current);
    setIsCollapsingToOrb(false);
    setIsSidebarVisible(true);
    setIsSidebarMini(mini);
  }, []);

  // Collapse sidebar into circular orb whenever an app (internal or embedded) is activated
  useEffect(() => {
    if ((activeMenu?.type === 'internal' || activeMenu?.type === 'embedded') && isSidebarVisible) {
      collapseSidebarToOrb();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu?.id]);

  // Clicking outside sidebar collapses it to the floating orb
  useEffect(() => {
    if (!isSidebarVisible || settingsOpen) return;
    const handleDocClick = (e) => {
      if (
        sidebarRef.current?.contains(e.target) ||
        orbWrapRef.current?.contains(e.target) ||
        stageCardRef.current?.contains(e.target)
      ) {
        return;
      }
      collapseSidebarToOrb();
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleDocClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleDocClick);
    };
  }, [isSidebarVisible, settingsOpen, collapseSidebarToOrb]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else if (isSidebarVisible) {
          collapseSidebarToOrb();
        }
      } else if (
        e.key === '/' &&
        isSidebarVisible &&
        !isInternalActive &&
        document.activeElement !== searchInputRef.current
      ) {
        e.preventDefault();
        setIsSidebarMini(false);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, isSidebarVisible, isInternalActive, collapseSidebarToOrb]);

  const handleToggleTheme = () => {
    const next = hubTheme === 'light' ? 'dark' : 'light';
    setHubTheme(next);
    localStorage.setItem(STORAGE_KEYS.THEME, next);
  };

  const handleToggleGroup = (groupItem) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupItem.id]: !prev[groupItem.id],
    }));
    setPreviewedMenu(groupItem);
    applyAdaptiveTheme(groupItem);
  };

  const handleSelectItem = (item) => {
    if (item.type === 'group') {
      handleToggleGroup(item);
      return;
    }

    if (item.type === 'external' && item.externalUrl) {
      setPreviewedMenu(item);
      applyAdaptiveTheme(item);
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Only enabled apps (internal React modules or same-origin embedded apps) have an action
    if (item.type !== 'internal' && item.type !== 'embedded') {
      return;
    }

    if (item.type === 'embedded' && activeMenu?.id !== item.id) {
      setEmbedLoading(true);
    }

    setPreviewedMenu(item);
    applyAdaptiveTheme(item);
    onSelectMenu(item);
    collapseSidebarToOrb();
  };

  const handleReturnToHubHome = () => {
    onReturnHome();
    openSidebar(false);
    showToast('กลับสู่หน้าหลัก Plant Hub');
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredItems = MENU_ITEMS.filter((item) => {
    if (!q) return true;
    const parentMatches =
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q);
    if (parentMatches) return true;
    if (item.children?.length) {
      return item.children.some(
        (child) =>
          child.title.toLowerCase().includes(q) ||
          child.subtitle.toLowerCase().includes(q)
      );
    }
    return false;
  });

  const idRec = String(user?.IDRec ?? '').trim();
  const displayName = user?.Name || idRec || 'ผู้ใช้งาน';
  const plantLabel = [user?.Plant, user?.Team].filter(Boolean).join(' · ') || 'Operations Menu';
  const heroSub = [user?.['ตำแหน่ง'], user?.['หน่วยงาน'], user?.Plant].filter(Boolean).join(' · ') || plantLabel;
  const statusText = String(user?.Status ?? '').trim();
  const orbItem = activeMenu || previewedMenu;

  return (
    <>
      {/* Internal React Module Viewport (outside .hub-shell so Hub dark-mode CSS vars never leak) */}
      {isInternalActive && (
        <div className="hub-module-host">
          {children}
        </div>
      )}

      {/* Same-Origin Embedded App Viewport (ABC Analysis / Barcode) */}
      {isEmbeddedActive && (
        <main className="app-viewport" aria-label={activeMenu.title}>
          <div className={`iframe-loader${embedLoading ? ' visible' : ''}`}>
            <div className="loader-card">
              <div className="loader-ring"></div>
              <div className="loader-text">
                <span className="loader-title">กำลังเปิด {activeMenu.title}...</span>
                <span className="loader-url">{activeMenu.subtitle}</span>
              </div>
            </div>
          </div>
          <iframe
            key={activeMenu.id}
            src={activeMenu.embedUrl}
            title={activeMenu.title}
            allow="camera; microphone; clipboard-read; clipboard-write; geolocation; fullscreen"
            onLoad={() => setEmbedLoading(false)}
          />
        </main>
      )}

      <div ref={shellRef} className="hub-shell" data-hub-theme={hubTheme}>
        {/* Dynamic Adaptive Ambient Background (always visible behind Hub & all apps) */}
        <div className="ambient-bg" aria-hidden="true">
          <div className="ambient-orb orb-1"></div>
          <div className="ambient-orb orb-2"></div>
          <div className="ambient-orb orb-3"></div>
          <div className="ambient-grid"></div>
          <div className="ambient-vignette"></div>
        </div>

        {/* Floating Circular Menu Orb (Top-Left when sidebar collapses) */}
        {!isSidebarVisible && (
          <div ref={orbWrapRef} className="floating-orb-wrap">
            <button
              type="button"
              className="floating-orb"
              aria-label="เปิดแถบเมนูด้านซ้าย"
              title="คลิกเพื่อเปิดแถบเมนูเลือกหน้าอื่น"
              onClick={(e) => {
                e.stopPropagation();
                openSidebar(false);
              }}
            >
              <span className="orb-ring"></span>
              <span
                className="orb-icon"
                dangerouslySetInnerHTML={{ __html: orbItem ? orbItem.icon : DEFAULT_HUB_ICON }}
              />
              <span className="orb-pulse"></span>
            </button>

            <div className="orb-quick-pill">
              <div className="orb-pill-info">
                <span className="orb-pill-label">กำลังใช้งาน</span>
                <strong className="orb-pill-name">{orbItem ? orbItem.title : 'Plant Hub'}</strong>
              </div>
              <div className="orb-pill-actions">
                {activeMenu && (
                  <button
                    type="button"
                    className="pill-mini-btn"
                    title="กลับหน้าหลัก Plant Hub"
                    onClick={handleReturnToHubHome}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Backdrop when overlaying an active module */}
        {isSidebarVisible && isAppActive && (
          <div
            className="sidebar-backdrop visible"
            onClick={collapseSidebarToOrb}
          />
        )}

        {/* Left Vertical Glass Sidebar */}
        {isSidebarVisible && (
          <aside
            ref={sidebarRef}
            className={`sidebar glass-panel${isSidebarMini ? ' is-mini' : ''}${isCollapsingToOrb ? ' is-collapsing-to-orb' : ''}`}
            aria-label="แถบเมนูหลักด้านซ้าย"
            onMouseEnter={showStagePreview}
            onMouseLeave={scheduleHideStagePreview}
          >
            <button
              type="button"
              className="sidebar-edge-toggle"
              aria-label="ย่อหรือขยายแถบเมนู"
              title="ย่อ / ขยายแถบเมนู"
              onClick={() => setIsSidebarMini((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="sidebar-top">
              <div
                className="sidebar-brand"
                title="กลับหน้าหลัก Plant Operations Hub"
                onClick={activeMenu ? handleReturnToHubHome : undefined}
              >
                <div className="brand-logo-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                  </svg>
                </div>
                <div className="brand-text-wrap">
                  <span className="brand-title">Plant Hub</span>
                  <span className="brand-sub">{plantLabel}</span>
                </div>
              </div>

              {activeMenu && (
                <button
                  type="button"
                  className="sidebar-orb-min-btn"
                  title="หุบเมนูเป็นวงกลมมุมซ้ายบน"
                  aria-label="หุบเมนูเป็นวงกลมมุมซ้ายบน"
                  onClick={collapseSidebarToOrb}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12h8" />
                  </svg>
                </button>
              )}
            </div>

            <div
              className="sidebar-search"
              onClick={() => {
                if (isSidebarMini) {
                  setIsSidebarMini(false);
                  setTimeout(() => searchInputRef.current?.focus(), 120);
                }
              }}
            >
              <span className="sidebar-search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ค้นหาเมนู..."
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isMenuListExpanded) setIsMenuListExpanded(true);
                }}
              />
            </div>

            <div className="sidebar-section-head">
              <span className="section-label">MENU</span>
              <button
                type="button"
                className={`toggle-all-btn${!isMenuListExpanded ? ' is-collapsed' : ''}`}
                title="แสดง/ซ่อนเมนูทั้งหมด"
                onClick={() => setIsMenuListExpanded((prev) => !prev)}
              >
                <span>{isMenuListExpanded ? 'ซ่อนเมนู' : 'แสดงทั้งหมด'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>

            <nav
              className={`sidebar-nav${!isMenuListExpanded ? ' is-hidden-list' : ''}`}
              aria-label="รายการเมนูระบบงาน"
            >
              {filteredItems.map((item) => {
                const isGroup = item.type === 'group' && item.children?.length > 0;
                const hasActiveChild = isGroup && item.children.some((c) => activeMenu?.id === c.id);
                const isActive = activeMenu?.id === item.id || hasActiveChild;
                const isGroupOpen = isGroup && (Boolean(expandedGroups[item.id]) || Boolean(q) || hasActiveChild);
                const hasAction =
                  isGroup ||
                  item.type === 'internal' ||
                  item.type === 'embedded' ||
                  Boolean(item.type === 'external' && item.externalUrl);

                const visibleChildren = isGroup
                  ? item.children.filter((child) => {
                      if (!q) return true;
                      const parentMatches =
                        item.title.toLowerCase().includes(q) ||
                        item.subtitle.toLowerCase().includes(q);
                      if (parentMatches) return true;
                      return (
                        child.title.toLowerCase().includes(q) ||
                        child.subtitle.toLowerCase().includes(q)
                      );
                    })
                  : [];

                return (
                  <div key={item.id} className={`nav-group${isGroupOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className={`nav-item${isActive ? ' is-active' : ''}${!hasAction ? ' is-no-action' : ''}`}
                      title={`${item.title} — ${item.subtitle}`}
                      style={{
                        '--item-c1': item.color1,
                        '--item-c2': item.color2,
                        '--item-glow': item.glow,
                      }}
                      onPointerMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
                      }}
                      onMouseEnter={() => {
                        applyAdaptiveTheme(item);
                        if (!activeMenu) setPreviewedMenu(item);
                        showStagePreview();
                      }}
                      onClick={() => handleSelectItem(item)}
                    >
                      <span
                        className="nav-item-icon"
                        dangerouslySetInnerHTML={{ __html: item.icon }}
                      />
                      <span className="nav-item-text">
                        <span className="nav-item-title">{item.title}</span>
                        <span className="nav-item-sub">{item.subtitle}</span>
                      </span>
                      {isGroup ? (
                        <span className={`nav-chevron${isGroupOpen ? ' is-open' : ''}`} aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                      ) : (
                        <>
                          {isActive && <span className="nav-active-dot" title="กำลังเปิดใช้งาน"></span>}
                        </>
                      )}
                    </button>

                    {isGroup && isGroupOpen && (
                      <div className="nav-submenu" role="group" aria-label={item.title}>
                        {visibleChildren.map((child) => {
                          const childActive = activeMenu?.id === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              className={`nav-subitem${childActive ? ' is-active' : ''}`}
                              title={`${child.title} — ${child.subtitle}`}
                              style={{
                                '--item-c1': child.color1,
                                '--item-c2': child.color2,
                                '--item-glow': child.glow,
                              }}
                              onMouseEnter={() => {
                                applyAdaptiveTheme(child);
                                if (!activeMenu) setPreviewedMenu(child);
                                showStagePreview();
                              }}
                              onClick={() => handleSelectItem(child)}
                            >
                              <span
                                className="nav-subitem-icon"
                                dangerouslySetInnerHTML={{ __html: child.icon }}
                              />
                              <span className="nav-subitem-text">
                                <span className="nav-subitem-title">{child.title}</span>
                                <span className="nav-subitem-sub">{child.subtitle}</span>
                              </span>
                              {childActive && <span className="nav-active-dot" title="กำลังเปิดใช้งาน"></span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {filteredItems.length === 0 && (
              <div className="sidebar-empty">ไม่พบเมนูที่ค้นหา</div>
            )}

            <div className="sidebar-bottom">
              <div className="sidebar-divider"></div>

              <button
                type="button"
                className="sidebar-footer-item"
                data-tooltip="Setting"
                onClick={() => setSettingsOpen(true)}
              >
                <span className="footer-item-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <span className="footer-item-label">Setting</span>
              </button>

              <button
                type="button"
                className="sidebar-footer-item theme-row"
                data-tooltip="Dark / Light Mode"
                onClick={handleToggleTheme}
              >
                <span className="footer-item-icon">
                  {hubTheme === 'light' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2" /><path d="M12 20v2" />
                      <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
                      <path d="M2 12h2" /><path d="M20 12h2" />
                      <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                    </svg>
                  )}
                </span>
                <span className="footer-item-label">
                  {hubTheme === 'light' ? 'Light Mode' : 'Dark Mode'}
                </span>
                <span className="mode-switch" aria-hidden="true">
                  <span className="mode-switch-knob"></span>
                </span>
              </button>

              <div className="sidebar-user-card">
                <div
                  className="user-avatar"
                  aria-label="User Avatar"
                  dangerouslySetInnerHTML={{ __html: USER_AVATAR_SVG }}
                />
                <div className="user-meta">
                  <strong>{displayName}</strong>
                </div>
                <button
                  type="button"
                  className="logout-icon-btn"
                  title="ออกจากระบบ"
                  aria-label="ออกจากระบบ"
                  onClick={onLogout}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" x2="9" y1="12" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Welcome / Interactive Stage Preview (only when no active module) */}
        {!isAppActive && (
          <section
            className={`welcome-stage${isStageVisible ? ' is-stage-visible' : ''}`}
            aria-label="หน้าจอพรีวิวเมนู"
          >
            <div
              ref={stageCardRef}
              className="stage-card glass-panel"
              onMouseEnter={showStagePreview}
              onMouseLeave={scheduleHideStagePreview}
            >
              <div className="stage-badge">
                <span className="stage-badge-dot"></span>
                <span>{plantLabel}</span>
              </div>
              <button
                type="button"
                className="stage-hero-icon"
                title={
                  previewedMenu?.type === 'internal' ||
                  previewedMenu?.type === 'embedded' ||
                  previewedMenu?.type === 'external'
                    ? `คลิกเพื่อเปิด ${previewedMenu.title}`
                    : previewedMenu?.title || 'เลือกเมนูจากแถบด้านซ้าย'
                }
                aria-label="คลิกที่โลโก้เพื่อเปิดระบบนี้"
                style={{
                  cursor:
                    previewedMenu?.type === 'internal' ||
                    previewedMenu?.type === 'embedded' ||
                    previewedMenu?.type === 'external'
                      ? 'pointer'
                      : 'default',
                }}
                onClick={() => previewedMenu && handleSelectItem(previewedMenu)}
                dangerouslySetInnerHTML={{ __html: previewedMenu ? previewedMenu.icon : DEFAULT_HUB_ICON }}
              />
              <h2>{previewedMenu ? previewedMenu.title : 'เลือกเมนูจากแถบด้านซ้าย'}</h2>
              {previewedMenu?.type === 'group' && previewedMenu.children?.length > 0 && (
                <div className="stage-subgrid">
                  {previewedMenu.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className="stage-subbtn"
                      style={{
                        '--item-c1': child.color1,
                        '--item-c2': child.color2,
                        '--item-glow': child.glow,
                      }}
                      onClick={() => handleSelectItem(child)}
                    >
                      <span
                        className="stage-subbtn-icon"
                        dangerouslySetInnerHTML={{ __html: child.icon }}
                      />
                      <span className="stage-subbtn-label">{child.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Settings Popover Modal */}
        {settingsOpen && (
          <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
            <div className="settings-backdrop" onClick={() => setSettingsOpen(false)} />
            <div className="settings-dialog glass-panel">
              <div className="settings-head">
                <div className="settings-head-title">
                  <span className="settings-head-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <div>
                    <h3 id="settingsTitle">การตั้งค่าระบบ & ข้อมูลผู้ใช้งาน</h3>
                    <p className="settings-subtitle">รายละเอียดบัญชีจากฐานข้อมูล EmployeeWeb</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  aria-label="ปิดหน้าต่างตั้งค่า"
                  onClick={() => setSettingsOpen(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              <div className="settings-body">
                <div className="settings-user-hero">
                  <div
                    className="settings-avatar-lg"
                    dangerouslySetInnerHTML={{ __html: USER_AVATAR_SVG }}
                  />
                  <div className="settings-hero-info">
                    <div className="settings-hero-name-row">
                      <strong>{displayName}</strong>
                      {statusText && <span className="settings-role-pill">{statusText}</span>}
                    </div>
                    <span className="settings-hero-plant">{heroSub}</span>
                  </div>
                </div>

                <div className="user-info-grid">
                  <div className="user-info-cell">
                    <span className="info-cell-label">รหัสพนักงาน (IDRec)</span>
                    <strong className="info-cell-value">{idRec || '-'}</strong>
                  </div>
                  <div className="user-info-cell">
                    <span className="info-cell-label">ชื่อ (Name)</span>
                    <strong className="info-cell-value">{user?.Name || '-'}</strong>
                  </div>
                  <div className="user-info-cell">
                    <span className="info-cell-label">ตำแหน่ง</span>
                    <strong className="info-cell-value">{user?.['ตำแหน่ง'] || '-'}</strong>
                  </div>
                  <div className="user-info-cell">
                    <span className="info-cell-label">หน่วยงาน</span>
                    <strong className="info-cell-value">{user?.['หน่วยงาน'] || '-'}</strong>
                  </div>
                  <div className="user-info-cell">
                    <span className="info-cell-label">ทีม (Team)</span>
                    <strong className="info-cell-value">{user?.Team || '-'}</strong>
                  </div>
                  <div className="user-info-cell">
                    <span className="info-cell-label">โรงงาน (Plant)</span>
                    <strong className="info-cell-value">{user?.Plant || '-'}</strong>
                  </div>
                </div>
              </div>

              <div className="settings-foot">
                <button
                  type="button"
                  className="danger-outline-btn"
                  onClick={() => {
                    setSettingsOpen(false);
                    onLogout();
                  }}
                >
                  ออกจากระบบ
                </button>
                <button
                  type="button"
                  className="primary-small-btn"
                  onClick={() => setSettingsOpen(false)}
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="toast show" role="status" aria-live="polite">
            {toastMessage}
          </div>
        )}
      </div>
    </>
  );
}
