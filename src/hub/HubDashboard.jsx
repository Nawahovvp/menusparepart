import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import {
  PLANT_NAMES,
  ABC_INVENTORY_URLS,
  resolveUserPlantInfo,
  fetchStockDayDashboard,
  fetchTankRechargeDashboard,
  fetchCallDashboardForPlant,
  fetchAbcDashboardForPlant,
  getCachedAbcDashboardSnapshot,
  exportAbcListToCsv,
  computeWarehouseHealthScore,
  fetchCustomerReturnDashboard,
} from './hubDashboardService';
import { MENU_ITEMS } from './menuConfig';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* ==========================================================================
   Formatting Helpers
   ========================================================================== */

function formatCompactMoney(num) {
  const n = Number(num);
  if (!Number.isFinite(n) || n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatFullMoney(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('th-TH');
}

function formatNumber(num, decimals = 0) {
  const n = Number(num);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatThaiDate(ymd) {
  if (!ymd) return '—';
  const parts = String(ymd).split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function HubDashboard({
  user,
  hubTheme = 'dark',
  onOpenMenuById,
  showToast,
}) {
  const [selectedPlantOverride, setSelectedPlantOverride] = useState('');
  const plantInfo = useMemo(
    () => resolveUserPlantInfo(user, selectedPlantOverride),
    [user, selectedPlantOverride]
  );

  // Data States
  const [stockDayState, setStockDayState] = useState({ loading: true, error: null, data: null });
  const [tankState, setTankState] = useState({ loading: true, error: null, data: null });
  const [callState, setCallState] = useState({ loading: true, error: null, data: null });
  const [abcState, setAbcState] = useState({ loading: true, error: null, data: null });
  const [custReturnState, setCustReturnState] = useState({ loading: true, error: null, data: null });
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // UI Control States
  const [stockDayRange, setStockDayRange] = useState('1y'); // '1y' | 'all'
  const [custReturnScope, setCustReturnScope] = useState('plant'); // 'plant' | 'nationwide'
  const [activeCustReturnTab, setActiveCustReturnTab] = useState('tsc'); // 'tsc' | 'tsc-store' | 'bluetap' | 'bluetap-claim' | 'adapter-claim' | 'truewifi'
  const [custReturnSearch, setCustReturnSearch] = useState('');
  const [activeAbcTab, setActiveAbcTab] = useState('installOrder'); // 'installOrder' | 'installCallOrder' | 'callOrder' | 'shortageFastMed' | 'unupdatedLocation' | 'overstockReturn' | 'allOrder'
  const [abcQuickFilter, setAbcQuickFilter] = useState('all'); // 'all' | 'abcA' | 'fast' | 'nawaReady'
  const [abcSearch, setAbcSearch] = useState('');
  const [abcSort, setAbcSort] = useState({ key: 'OrderValue', dir: 'desc' });
  const [abcPage, setAbcPage] = useState(1);
  const abcRowsPerPage = 10;

  const abcTableRef = useRef(null);
  const custReturnTableRef = useRef(null);

  // Sync selected plant to localStorage so opening ABC Analysis opens this plant immediately
  useEffect(() => {
    if (!plantInfo?.plantCode) return;
    try {
      const raw = localStorage.getItem('rememberedUser');
      const parsed = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        'rememberedUser',
        JSON.stringify({
          ...parsed,
          IDUser: String(user?.IDRec || user?.IDUser || parsed.IDUser || '').trim(),
          Name: user?.Name || parsed.Name || 'ผู้ใช้งาน',
          Position: user?.['ตำแหน่ง'] || user?.Position || parsed.Position || '',
          Department: user?.['หน่วยงาน'] || user?.Department || parsed.Department || '',
          Plant: plantInfo.plantCode,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [plantInfo?.plantCode, user]);

  const fetchAndApplyDashboardData = useCallback(
    async (forceRefresh = false) => {
      // Instant snapshot hydration for ABC (<50ms) when not forcing a full refresh
      if (!forceRefresh) {
        getCachedAbcDashboardSnapshot(plantInfo.plantCode).then((snap) => {
          if (snap?.hasData) {
            setAbcState((prev) => (prev.data?.plantCode === plantInfo.plantCode ? prev : { loading: false, error: null, data: snap }));
          }
        });
      }

      const p1 = fetchStockDayDashboard(plantInfo)
        .then((data) => setStockDayState({ loading: false, error: null, data }))
        .catch((err) =>
          setStockDayState((prev) => ({
            loading: false,
            error: err?.message || 'โหลดข้อมูล StockDay ไม่สำเร็จ',
            data: prev.data,
          }))
        );

      const p2 = fetchTankRechargeDashboard()
        .then((data) => setTankState({ loading: false, error: null, data }))
        .catch((err) =>
          setTankState((prev) => ({
            loading: false,
            error: err?.message || 'โหลดข้อมูลถังก๊าซไม่สำเร็จ',
            data: prev.data,
          }))
        );

      const p3 = fetchCallDashboardForPlant(plantInfo, forceRefresh)
        .then((data) => setCallState({ loading: false, error: null, data }))
        .catch((err) =>
          setCallState((prev) => ({
            loading: false,
            error: err?.message || 'โหลดข้อมูล Call ไม่สำเร็จ',
            data: prev.data,
          }))
        );

      const p4 = fetchAbcDashboardForPlant(plantInfo, forceRefresh)
        .then((data) => {
          setAbcState({ loading: false, error: null, data });
          if (data?.lists) {
            if (data.lists.installOrder?.length > 0) setActiveAbcTab('installOrder');
            else if (data.lists.installCallOrder?.length > 0) setActiveAbcTab('installCallOrder');
            else if (data.lists.callOrder?.length > 0) setActiveAbcTab('callOrder');
            else if (data.lists.shortageFastMed?.length > 0) setActiveAbcTab('shortageFastMed');
            else if (data.lists.unupdatedLocation?.length > 0) setActiveAbcTab('unupdatedLocation');
            else if (data.lists.overstockReturn?.length > 0) setActiveAbcTab('overstockReturn');
            else setActiveAbcTab('allOrder');
          }
        })
        .catch((err) =>
          setAbcState((prev) => ({
            loading: false,
            error: err?.message || 'โหลดข้อมูล ABC ไม่สำเร็จ',
            data: prev.data,
          }))
        );

      const p5 = fetchCustomerReturnDashboard(plantInfo, forceRefresh)
        .then((data) => {
          setCustReturnState({ loading: false, error: null, data });
          // Auto-switch to nationwide if user's plant has 0 items across all product submenus
          if (data?.plantScope?.masterOverview?.totalQty === 0 && data?.nationwideScope?.masterOverview?.totalQty > 0) {
            setCustReturnScope('nationwide');
          }
        })
        .catch((err) =>
          setCustReturnState((prev) => ({
            loading: false,
            error: err?.message || 'โหลดข้อมูล Customer Return ไม่สำเร็จ',
            data: prev.data,
          }))
        );

      await Promise.allSettled([p1, p2, p3, p4, p5]);
      setLastSyncedAt(new Date());
      setIsRefreshingAll(false);
      if (forceRefresh && showToast) {
        showToast(`อัปเดตข้อมูล Dashboard คลัง ${plantInfo.plantName} เรียบร้อยแล้ว`);
      }
    },
    [plantInfo, showToast]
  );

  const handleManualRefresh = useCallback(() => {
    setIsRefreshingAll(true);
    setStockDayState((prev) => ({ ...prev, loading: true, error: null }));
    setTankState((prev) => ({ ...prev, loading: true, error: null }));
    setCallState((prev) => ({ ...prev, loading: true, error: null }));
    setAbcState((prev) => ({ ...prev, loading: true, error: null }));
    setCustReturnState((prev) => ({ ...prev, loading: true, error: null }));
    void fetchAndApplyDashboardData(true);
  }, [fetchAndApplyDashboardData]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void fetchAndApplyDashboardData(false);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchAndApplyDashboardData]);

  const handleOpenApp = useCallback(
    (menuId) => {
      let target = MENU_ITEMS.find((m) => m.id === menuId);
      if (!target) {
        for (const group of MENU_ITEMS) {
          if (Array.isArray(group.children)) {
            const child = group.children.find((c) => c.id === menuId);
            if (child) {
              target = child;
              break;
            }
          }
        }
      }
      if (target && onOpenMenuById) {
        onOpenMenuById(target);
      }
    },
    [onOpenMenuById]
  );

  const handleOpenCustReturnWithPreset = useCallback(
    (viewKey, presetOptions = {}) => {
      const viewToMenuId = {
        tsc: 'dashboard-tsc-dummy',
        'tsc-store': 'dashboard-tsc-store',
        bluetap: 'dashboard-tsc-sunmi',
        'bluetap-claim': 'dashboard-tsc-bluetap-claim',
        'adapter-claim': 'dashboard-tsc-adapter-claim',
        truewifi: 'dashboard-tsc-truewifi',
      };
      const menuId = viewToMenuId[viewKey] || 'dashboard-tsc-dummy';
      try {
        sessionStorage.setItem(
          'hub_tsc_preset_filter',
          JSON.stringify({
            view: viewKey,
            plantCall:
              custReturnScope === 'plant' && viewKey !== 'tsc-store'
                ? custReturnState.data?.matchedPlantCall || ''
                : '',
            status: presetOptions.status || '',
            search: presetOptions.search || '',
            notReturnOnly: Boolean(presetOptions.notReturnOnly),
            errorOnly: Boolean(presetOptions.errorOnly),
            descFilter: presetOptions.descFilter || '',
            ts: Date.now(),
          })
        );
      } catch {
        // ignore storage errors
      }
      handleOpenApp(menuId);
    },
    [custReturnScope, custReturnState.data, handleOpenApp]
  );

  const handleSelectCustReturnCard = (tabKey) => {
    setActiveCustReturnTab(tabKey);
    setCustReturnSearch('');
    setTimeout(() => {
      custReturnTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleOpenCallWithPreset = useCallback(
    (dashboardFilterVal = null, ticketSearch = '') => {
      try {
        sessionStorage.setItem(
          'hub_call_preset_filter',
          JSON.stringify({
            pendingUnit: callState.data?.matchedUnit || plantInfo.callPendingUnit,
            dashboardFilter: dashboardFilterVal,
            searchTerm: ticketSearch || '',
            ts: Date.now(),
          })
        );
      } catch {
        // ignore storage errors
      }
      handleOpenApp('call-sparepart');
    },
    [callState.data, plantInfo.callPendingUnit, handleOpenApp]
  );

  const handleOpenAbcWithPreset = useCallback(
    (tabOverride = '', materialSearch = '') => {
      const tab = tabOverride || activeAbcTab;
      try {
        sessionStorage.setItem(
          'hub_abc_preset_filter',
          JSON.stringify({
            plantCode: plantInfo.plantCode,
            tab,
            search: materialSearch || '',
            ts: Date.now(),
          })
        );
      } catch {
        // ignore storage errors
      }
      handleOpenApp('abc-analysis');
    },
    [activeAbcTab, plantInfo.plantCode, handleOpenApp]
  );

  const handleSelectAbcCard = (tabKey, defaultSortKey = 'OrderValue') => {
    setActiveAbcTab(tabKey);
    setAbcQuickFilter('all');
    setAbcPage(1);
    setAbcSort({ key: defaultSortKey, dir: 'desc' });
    setTimeout(() => {
      abcTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  /* ------------------------------------------------------------------------
     Warehouse Health Score & Action Alerts
     ------------------------------------------------------------------------ */
  const healthInfo = useMemo(
    () =>
      computeWarehouseHealthScore({
        stockDayData: stockDayState.data,
        callData: callState.data,
        abcData: abcState.data,
      }),
    [stockDayState.data, callState.data, abcState.data]
  );

  /* ------------------------------------------------------------------------
     1. StockDay Chart Configuration
     ------------------------------------------------------------------------ */
  const stockDayChartHistory = useMemo(() => {
    const hist = stockDayState.data?.history || [];
    return stockDayRange === '1y' ? hist.slice(-12) : hist;
  }, [stockDayState.data, stockDayRange]);

  const stockDayChartData = useMemo(() => {
    const labels = stockDayChartHistory.map((r) => r.Mountyear);
    return {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Stock Day (วัน)',
          data: stockDayChartHistory.map((r) => r.stockDay),
          yAxisID: 'y1',
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.18)',
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 1.5,
          tension: 0.32,
          order: 1,
        },
        {
          type: 'line',
          label: 'เป้าหมาย 180 วัน',
          data: stockDayChartHistory.map(() => 180),
          yAxisID: 'y1',
          borderColor: 'rgba(244, 63, 94, 0.85)',
          borderWidth: 2,
          borderDash: [6, 5],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          order: 0,
        },
        {
          type: 'line',
          label: 'ต้นทุนขาย (บาท)',
          data: stockDayChartHistory.map((r) => r.cost),
          yAxisID: 'y',
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.14)',
          borderWidth: 2.4,
          pointRadius: 3.5,
          pointBackgroundColor: '#f59e0b',
          tension: 0.3,
          order: 2,
        },
        {
          type: 'bar',
          label: 'มูลค่าคลัง (บาท)',
          data: stockDayChartHistory.map((r) => r.stockEnd),
          yAxisID: 'y',
          backgroundColor: 'rgba(59, 130, 246, 0.78)',
          hoverBackgroundColor: 'rgba(59, 130, 246, 0.95)',
          borderRadius: 4,
          stack: 'valueStack',
          barPercentage: 0.58,
          order: 3,
        },
        {
          type: 'bar',
          label: 'มูลค่าวิศวกรรม (บาท)',
          data: stockDayChartHistory.map((r) => r.engEnd),
          yAxisID: 'y',
          backgroundColor: 'rgba(139, 92, 246, 0.82)',
          hoverBackgroundColor: 'rgba(139, 92, 246, 0.96)',
          borderRadius: 4,
          stack: 'valueStack',
          barPercentage: 0.58,
          order: 4,
        },
      ],
    };
  }, [stockDayChartHistory]);

  const stockDayChartOptions = useMemo(() => {
    const isLight = hubTheme === 'light';
    const textColor = isLight ? '#334155' : '#cbd5e1';
    const gridColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.07)';
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: textColor,
            usePointStyle: true,
            pointStyleWidth: 10,
            boxHeight: 8,
            padding: 12,
            font: {
              family: "'Plus Jakarta Sans', 'Noto Sans Thai', sans-serif",
              size: 11,
              weight: '600',
            },
          },
        },
        tooltip: {
          backgroundColor: isLight ? 'rgba(15, 23, 42, 0.94)' : 'rgba(9, 13, 24, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(99, 102, 241, 0.45)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => {
              const label = ctx.dataset.label || '';
              const val = ctx.parsed.y;
              if (ctx.dataset.yAxisID === 'y1') {
                return ` ${label}: ${formatNumber(val)} วัน`;
              }
              return ` ${label}: ${formatCompactMoney(val)} บาท (${formatFullMoney(val)} ฿)`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: textColor,
            maxRotation: 35,
            font: { size: 11, weight: '600' },
          },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          stacked: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (val) => formatCompactMoney(val),
          },
          title: {
            display: true,
            text: 'มูลค่า (บาท)',
            color: textColor,
            font: { size: 11, weight: '600' },
          },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#10b981',
            font: { size: 11, weight: '700' },
            callback: (val) => `${val} วัน`,
          },
          title: {
            display: true,
            text: 'Stock Day (วัน)',
            color: '#10b981',
            font: { size: 11, weight: '700' },
          },
        },
      },
    };
  }, [hubTheme]);

  const latestStockDay = stockDayState.data?.latest;
  const prevStockDay = stockDayState.data?.prev;
  const stockValueDeltaPct = useMemo(() => {
    if (!latestStockDay || !prevStockDay || !prevStockDay.endTotal) return null;
    return (((latestStockDay.endTotal - prevStockDay.endTotal) / prevStockDay.endTotal) * 100).toFixed(1);
  }, [latestStockDay, prevStockDay]);

  const stockDayDeltaDays = useMemo(() => {
    if (!latestStockDay || !prevStockDay) return null;
    return latestStockDay.stockDay - prevStockDay.stockDay;
  }, [latestStockDay, prevStockDay]);

  /* ------------------------------------------------------------------------
     3. Call Sparepart Status Cards List
     ------------------------------------------------------------------------ */
  const callSummary = callState.data?.summary || {};
  const callStatusCards = useMemo(() => {
    const s = callState.data?.summary || {};
    return [
      { key: 'exceedLeadtime', label: 'เกิน Leadtime', count: s.exceedLeadtime || 0, pct: s.exceedLeadtimePercent || '0%', tone: 'rose', icon: 'fa-clock' },
      { key: 'request', label: 'ขอซื้อขอซ่อม', count: s.request || 0, pct: s.requestPercent || '0%', tone: 'amber', icon: 'fa-file-signature' },
      { key: 'pending', label: 'รอของเข้า', count: s.pending || 0, pct: s.pendingPercent || '0%', tone: 'indigo', icon: 'fa-hourglass-half' },
      { key: 'nawaVipa', label: 'เบิกศูนย์อะไหล่', count: s.nawaVipa || 0, pct: s.nawaVipaPercent || '0%', tone: 'cyan', icon: 'fa-warehouse' },
      { key: 'otherPlant', label: 'ดึงจากคลังอื่น', count: s.otherPlant || 0, pct: s.otherPlantPercent || '0%', tone: 'violet', icon: 'fa-right-left' },
      { key: 'engInTeam', label: 'มีอะไหล่ในทีม', count: s.engInTeam || 0, pct: s.engInTeamPercent || '0%', tone: 'teal', icon: 'fa-users-gear' },
      { key: 'rebuiltStock', label: 'เบิกทดแทน', count: s.rebuiltStock || 0, pct: s.rebuiltStockPercent || '0%', tone: 'emerald', icon: 'fa-arrows-rotate' },
      { key: 'success', label: 'ระหว่างขนส่ง', count: s.success || 0, pct: s.successPercent || '0%', tone: 'sky', icon: 'fa-truck-fast' },
      { key: 'newPart', label: 'เปิดรหัสใหม่', count: s.newPart || 0, pct: s.newPartPercent || '0%', tone: 'pink', icon: 'fa-plus-circle' },
      { key: 'spacial', label: 'SPACIAL', count: s.spacial || 0, pct: s.spacialPercent || '0%', tone: 'slate', icon: 'fa-star' },
    ];
  }, [callState.data]);

  /* ------------------------------------------------------------------------
     4. ABC Interactive Action Table Filtering, Sorting & Pagination
     ------------------------------------------------------------------------ */
  const abcMetrics = abcState.data?.metrics;
  const abcLists = abcState.data?.lists;

  const activeAbcList = useMemo(() => {
    if (!abcLists) return [];
    let base = abcLists[activeAbcTab] || [];

    if (abcQuickFilter === 'abcA') {
      base = base.filter((r) => r.ABCValue === 'A');
    } else if (abcQuickFilter === 'fast') {
      base = base.filter((r) => r.Moving === 'Fast');
    } else if (abcQuickFilter === 'nawaReady') {
      base = base.filter((r) => Number(r.Navanakorn || 0) > 0);
    }

    const q = abcSearch.trim().toLowerCase();
    const searched = q
      ? base.filter(
          (r) =>
            String(r.Material || '').toLowerCase().includes(q) ||
            String(r.Description || '').toLowerCase().includes(q) ||
            String(r.StorageBin || '').toLowerCase().includes(q) ||
            String(r.Status || '').toLowerCase().includes(q)
        )
      : [...base];

    if (abcSort?.key) {
      searched.sort((a, b) => {
        const av = a[abcSort.key];
        const bv = b[abcSort.key];
        if (typeof av === 'number' || typeof bv === 'number') {
          const na = Number(av) || 0;
          const nb = Number(bv) || 0;
          return abcSort.dir === 'asc' ? na - nb : nb - na;
        }
        const sa = String(av || '').toLowerCase();
        const sb = String(bv || '').toLowerCase();
        return abcSort.dir === 'asc' ? sa.localeCompare(sb, 'th') : sb.localeCompare(sa, 'th');
      });
    }
    return searched;
  }, [abcLists, activeAbcTab, abcQuickFilter, abcSearch, abcSort]);

  const abcTotalPages = Math.max(1, Math.ceil(activeAbcList.length / abcRowsPerPage));
  const paginatedAbcRows = useMemo(() => {
    const safePage = Math.min(Math.max(1, abcPage), abcTotalPages);
    const start = (safePage - 1) * abcRowsPerPage;
    return activeAbcList.slice(start, start + abcRowsPerPage);
  }, [activeAbcList, abcPage, abcTotalPages]);

  const handleSortAbcCol = (key) => {
    setAbcSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  /* ------------------------------------------------------------------------
     5. Customer Return & Claim (6 Submenus) Derived State
     ------------------------------------------------------------------------ */
  const activeCustScopeData = useMemo(() => {
    if (!custReturnState.data) return null;
    return custReturnScope === 'plant'
      ? custReturnState.data.plantScope
      : custReturnState.data.nationwideScope;
  }, [custReturnState.data, custReturnScope]);

  const custSubmenus = activeCustScopeData?.submenus || null;
  const custMaster = activeCustScopeData?.masterOverview || null;

  const activeCustPreviewRows = useMemo(() => {
    if (!custSubmenus || !custSubmenus[activeCustReturnTab]) return [];
    const base = custSubmenus[activeCustReturnTab].previewRows || [];
    const q = custReturnSearch.trim().toLowerCase();
    if (!q) return base.slice(0, 12);
    return base
      .filter((r) =>
        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [custSubmenus, activeCustReturnTab, custReturnSearch]);

  const healthColor =
    healthInfo.score >= 80 ? '#10b981' : healthInfo.score >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <section className="hub-dashboard-stage" aria-label="Pro Operations Command Center">
      <div className="pro-dashboard-container">
        {/* ====================================================================
            ZONE 0: TOP COMMAND HEADER BAR
            ==================================================================== */}
        <header className="pro-command-bar pro-bento-panel">
          <div className="pro-cmd-left">
            <div className="pro-cmd-emblem">
              <i className="fas fa-satellite-dish"></i>
            </div>
            <div className="pro-cmd-title-group">
              <div className="pro-cmd-eyebrow">
                <span className="pro-live-dot"></span>
                <span>WAREHOUSE OPERATIONS COMMAND CENTER</span>
              </div>
              <div className="pro-cmd-headline">
                <h1>
                  คลัง{plantInfo.plantName}{' '}
                  <span className="pro-plant-code-tag">Plant {plantInfo.plantCode}</span>
                </h1>
                <div className="pro-plant-switcher-wrap" title="สลับคลังเพื่อดูข้อมูลเปรียบเทียบ">
                  <i className="fas fa-warehouse"></i>
                  <select
                    aria-label="เลือกคลังสินค้า"
                    value={plantInfo.plantCode}
                    onChange={(e) => {
                      setSelectedPlantOverride(e.target.value);
                      setAbcPage(1);
                    }}
                  >
                    {Object.entries(PLANT_NAMES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} — {name} {ABC_INVENTORY_URLS[code] ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pro-cmd-user-meta">
                <span>
                  <i className="fas fa-user-astronaut"></i> {user?.Name || user?.IDRec || 'ผู้ใช้งาน'}
                </span>
                {user?.['ตำแหน่ง'] && <span>• {user['ตำแหน่ง']}</span>}
                {user?.['หน่วยงาน'] && <span>• หน่วยงาน: {user['หน่วยงาน']}</span>}
              </div>
            </div>
          </div>

          <div className="pro-cmd-center">
            <div
              className="pro-health-ring-box"
              style={{ '--health-color': healthColor }}
              title="ดัชนีสุขภาพคลังสินค้า (คำนวณจาก StockDay, Call รอตอบ, ของขาด Fast/Medium และความครบถ้วนของ Location)"
            >
              <div className="pro-health-score-circle">
                <strong>{healthInfo.score}</strong>
                <span>SCORE</span>
              </div>
              <div className="pro-health-details">
                <span className="pro-health-title">Warehouse Health Index</span>
                <div className="pro-health-pills">
                  {healthInfo.factors.map((f, idx) => (
                    <span key={idx} className={`pro-factor-pill is-${f.status}`}>
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pro-cmd-right">
            <div className="pro-sync-meta">
              <span className="pro-sync-label">อัปเดตข้อมูลล่าสุด</span>
              <strong className="pro-sync-time">
                {lastSyncedAt
                  ? lastSyncedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'กำลังซิงค์...'}
              </strong>
            </div>
            <button
              type="button"
              className={`pro-refresh-btn${isRefreshingAll ? ' is-spinning' : ''}`}
              onClick={handleManualRefresh}
              disabled={isRefreshingAll}
              title="ดึงข้อมูลสดจากเซิร์ฟเวอร์ทั้งหมด"
            >
              <i className="fas fa-arrows-rotate"></i>
              <span>{isRefreshingAll ? 'กำลังซิงค์...' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {/* ====================================================================
            ZONE 1: 1. กราฟ StockDay ของคลัง User (8 cols) + 2. ถังส่งอัดก๊าซคงค้าง (4 cols)
            ==================================================================== */}
        <div className="pro-bento-row pro-row-8-4">
          {/* 1. กราฟ Stockday ของคลังที่ User อยู่ */}
          <article className="pro-bento-panel pro-panel-indigo">
            <div className="pro-panel-header">
              <div className="pro-panel-title-wrap">
                <span className="pro-panel-icon is-indigo">
                  <i className="fas fa-chart-column"></i>
                </span>
                <div>
                  <div className="pro-panel-title-row">
                    <h2>1. กราฟ StockDay และมูลค่าคลัง ({stockDayState.data?.warehouseName || plantInfo.plantName})</h2>
                    {latestStockDay?.Mountyear && (
                      <span className="pro-period-badge">เดือนล่าสุด {latestStockDay.Mountyear}</span>
                    )}
                  </div>
                  <p className="pro-panel-sub">
                    แนวโน้มมูลค่าคลังอะไหล่ + วิศวกรรม เทียบต้นทุนขาย และจำนวนวัน Stock Day (เป้าหมาย ≤ 180 วัน)
                  </p>
                </div>
              </div>

              <div className="pro-panel-actions">
                <div className="pro-segmented-ctrl">
                  <button
                    type="button"
                    className={stockDayRange === '1y' ? 'active' : ''}
                    onClick={() => setStockDayRange('1y')}
                  >
                    1 ปี (12 ด.)
                  </button>
                  <button
                    type="button"
                    className={stockDayRange === 'all' ? 'active' : ''}
                    onClick={() => setStockDayRange('all')}
                  >
                    ทั้งหมด ({stockDayState.data?.history?.length || 0} ด.)
                  </button>
                </div>
                <button
                  type="button"
                  className="pro-open-app-btn is-indigo"
                  onClick={() => handleOpenApp('stockday')}
                >
                  <span>เปิด StockDay</span>
                  <i className="fas fa-arrow-up-right-from-square"></i>
                </button>
              </div>
            </div>

            {/* 5 Summary Mini KPI Strip */}
            <div className="pro-stockday-kpi-strip" onClick={() => handleOpenApp('stockday')}>
              <div className="pro-mini-kpi is-blue">
                <span className="pro-mini-label">มูลค่ารวมทั้งหมด</span>
                <div className="pro-mini-val-row">
                  <strong>{formatCompactMoney(latestStockDay?.endTotal || 0)} ฿</strong>
                  {stockValueDeltaPct !== null && (
                    <span className={`pro-delta-tag ${Number(stockValueDeltaPct) <= 0 ? 'is-good' : 'is-up'}`}>
                      {Number(stockValueDeltaPct) > 0 ? `+${stockValueDeltaPct}%` : `${stockValueDeltaPct}%`} MoM
                    </span>
                  )}
                </div>
                <span className="pro-mini-sub">{formatFullMoney(latestStockDay?.endTotal || 0)} บาท</span>
              </div>

              <div className="pro-mini-kpi is-indigo">
                <span className="pro-mini-label">มูลค่าคลังรวม</span>
                <div className="pro-mini-val-row">
                  <strong>{formatCompactMoney(latestStockDay?.stockEnd || 0)} ฿</strong>
                  {latestStockDay?.endTotal > 0 && (
                    <span className="pro-share-tag">
                      {Math.round((latestStockDay.stockEnd / latestStockDay.endTotal) * 100)}%
                    </span>
                  )}
                </div>
                <span className="pro-mini-sub">{formatFullMoney(latestStockDay?.stockEnd || 0)} บาท</span>
              </div>

              <div className="pro-mini-kpi is-violet">
                <span className="pro-mini-label">มูลค่าวิศวกรรม</span>
                <div className="pro-mini-val-row">
                  <strong>{formatCompactMoney(latestStockDay?.engEnd || 0)} ฿</strong>
                  {latestStockDay?.endTotal > 0 && (
                    <span className="pro-share-tag">
                      {Math.round((latestStockDay.engEnd / latestStockDay.endTotal) * 100)}%
                    </span>
                  )}
                </div>
                <span className="pro-mini-sub">{formatFullMoney(latestStockDay?.engEnd || 0)} บาท</span>
              </div>

              <div className="pro-mini-kpi is-amber">
                <span className="pro-mini-label">ต้นทุนขาย</span>
                <div className="pro-mini-val-row">
                  <strong>{formatCompactMoney(latestStockDay?.cost || 0)} ฿</strong>
                </div>
                <span className="pro-mini-sub">{formatFullMoney(latestStockDay?.cost || 0)} บาท/เดือน</span>
              </div>

              <div
                className={`pro-mini-kpi ${
                  (latestStockDay?.stockDay || 0) > 180 ? 'is-rose' : 'is-emerald'
                }`}
              >
                <span className="pro-mini-label">Stock Day (เป้า 180 วัน)</span>
                <div className="pro-mini-val-row">
                  <strong>{latestStockDay?.stockDay || 0} วัน</strong>
                  {stockDayDeltaDays !== null && (
                    <span className={`pro-delta-tag ${stockDayDeltaDays <= 0 ? 'is-good' : 'is-warn'}`}>
                      {stockDayDeltaDays > 0 ? `+${stockDayDeltaDays}` : stockDayDeltaDays} วัน
                    </span>
                  )}
                </div>
                <span className="pro-mini-sub">
                  {(latestStockDay?.stockDay || 0) <= 180 ? '✓ อยู่ในเป้าหมาย' : '⚠ เกินเป้าหมาย 180 วัน'}
                </span>
              </div>
            </div>

            {/* Chart Viewport */}
            <div className="pro-chart-box">
              {stockDayState.loading && !stockDayState.data ? (
                <div className="pro-panel-skeleton">
                  <div className="loader-ring"></div>
                  <span>กำลังโหลดกราฟ StockDay...</span>
                </div>
              ) : stockDayChartHistory.length === 0 ? (
                <div className="pro-panel-empty">ไม่พบข้อมูลประวัติ StockDay สำหรับคลังนี้</div>
              ) : (
                <Chart type="bar" data={stockDayChartData} options={stockDayChartOptions} />
              )}
            </div>
          </article>

          {/* 2. กรอบข้อมูล ถังส่งอัดก๊าซ รายการถังส่งอัดก๊าซคงค้างปัจจุบัน */}
          <article className="pro-bento-panel pro-panel-rose">
            <div className="pro-panel-header">
              <div className="pro-panel-title-wrap">
                <span className="pro-panel-icon is-rose">
                  <i className="fas fa-fire-flame-Simple fa-fire"></i>
                </span>
                <div>
                  <div className="pro-panel-title-row">
                    <h2>2. ถังส่งอัดก๊าซคงค้างปัจจุบัน</h2>
                    <span className="pro-badge-pill is-rose">
                      ค้างรวม {formatNumber(tankState.data?.totalPending || 0)} ถัง
                    </span>
                  </div>
                  <p className="pro-panel-sub">
                    ส่งอัดล่าสุด: {formatThaiDate(tankState.data?.latestTankDate)} • รับคืนล่าสุด:{' '}
                    {formatThaiDate(tankState.data?.latestRecDate)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="pro-open-app-btn is-rose"
                onClick={() => handleOpenApp('tank-recharge')}
              >
                <span>ระบบถังก๊าซ</span>
                <i className="fas fa-arrow-up-right-from-square"></i>
              </button>
            </div>

            <div className="pro-tank-cards-stack">
              {(tankState.data?.items || []).map((item) => {
                const stockVal = item.stock;
                const remainVal = item.remain;
                const availPct =
                  stockVal && stockVal > 0
                    ? Math.max(0, Math.min(100, Math.round((Math.max(0, remainVal) / stockVal) * 100)))
                    : 0;
                return (
                  <div
                    key={item.key}
                    className="pro-tank-card"
                    style={{ '--tank-accent': item.color }}
                    onClick={() => handleOpenApp('tank-recharge')}
                    title={`คลิกเพื่อเปิดระบบรับส่งถังบรรจุก๊าซ (${item.fullName})`}
                  >
                    <div className="pro-tank-card-top">
                      <div className="pro-tank-name-group">
                        <span className="pro-tank-dot" style={{ background: item.color }}></span>
                        <div>
                          <strong>{item.label}</strong>
                          <span className="pro-tank-fullname">
                            {item.fullName} (Mat: {item.material})
                          </span>
                        </div>
                      </div>
                      <div className="pro-tank-pending-hero">
                        <span className="pro-tank-pending-lbl">ค้างส่ง</span>
                        <strong className="pro-tank-pending-val" style={{ color: item.color }}>
                          {formatNumber(item.pending)}
                        </strong>
                        <span className="pro-tank-unit">ถัง</span>
                      </div>
                    </div>

                    <div className="pro-tank-metrics-row">
                      <div className="pro-tank-stat-pill">
                        <span>รวมในคลัง (SAP)</span>
                        <strong>{stockVal !== null ? `${formatNumber(stockVal)} ถัง` : '—'}</strong>
                      </div>
                      <div className="pro-tank-stat-pill">
                        <span>คงเหลือพร้อมใช้</span>
                        <strong className={remainVal !== null && remainVal < 0 ? 'is-danger' : 'is-success'}>
                          {remainVal !== null ? `${formatNumber(remainVal)} ถัง` : '—'}
                        </strong>
                      </div>
                    </div>

                    {stockVal !== null && stockVal > 0 && (
                      <div className="pro-tank-progress-wrap">
                        <div className="pro-tank-progress-labels">
                          <span>อัตราถังพร้อมใช้ในคลัง</span>
                          <strong>{availPct}% พร้อมใช้</strong>
                        </div>
                        <div className="pro-tank-progress-track">
                          <div
                            className="pro-tank-progress-fill"
                            style={{ width: `${availPct}%`, background: item.color }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        {/* ====================================================================
            ZONE 2: 3. Dashboard จำนวน Call ค้าง ที่คลัง User อยู่
            ==================================================================== */}
        <article className="pro-bento-panel pro-panel-emerald">
          <div className="pro-panel-header">
            <div className="pro-panel-title-wrap">
              <span className="pro-panel-icon is-emerald">
                <i className="fas fa-phone-volume"></i>
              </span>
              <div>
                <div className="pro-panel-title-row">
                  <h2>3. Dashboard จำนวน Call ค้าง ที่คลัง User อยู่</h2>
                  <span className="pro-badge-pill is-emerald">
                    ค้างหน่วยงาน: {callState.data?.matchedUnit || plantInfo.callPendingUnit}
                  </span>
                </div>
                <p className="pro-panel-sub">
                  ติดตามสถานะงานแจ้งซ่อม/เรียกอะไหล่ที่ค้างอยู่ในความรับผิดชอบของคลัง {plantInfo.plantName}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="pro-open-app-btn is-emerald"
              onClick={() => handleOpenCallWithPreset(null, '')}
            >
              <span>เปิดระบบ Call Sparepart</span>
              <i className="fas fa-arrow-up-right-from-square"></i>
            </button>
          </div>

          <div className="pro-call-layout">
            {/* Left: Primary Hero Call KPIs + Status Breakdown Cards */}
            <div className="pro-call-main-col">
              <div className="pro-call-hero-grid">
                <div
                  className="pro-kpi-card is-emerald"
                  onClick={() => handleOpenCallWithPreset(null, '')}
                >
                  <div className="pro-kpi-head">
                    <span>Call ค้างทั้งหมด (คลังนี้)</span>
                    <i className="fas fa-layer-group"></i>
                  </div>
                  <div className="pro-kpi-value">{formatNumber(callSummary.total || 0)}</div>
                  <div className="pro-kpi-foot">
                    <span className="pro-kpi-tag is-emerald">100% ของงานค้างในคลัง</span>
                  </div>
                </div>

                <div
                  className="pro-kpi-card is-amber"
                  onClick={() => handleOpenCallWithPreset('waitingResponse', '')}
                >
                  <div className="pro-kpi-head">
                    <span>Call (รอตรวจสอบ / รอคลังตอบ)</span>
                    <i className="fas fa-bell"></i>
                  </div>
                  <div className="pro-kpi-value">{formatNumber(callSummary.waitingResponse || 0)}</div>
                  <div className="pro-kpi-progress">
                    <div
                      className="pro-kpi-progress-bar is-amber"
                      style={{ width: callSummary.waitingResponsePercent || '0%' }}
                    />
                  </div>
                  <div className="pro-kpi-foot">
                    <span>สัดส่วนรอตอบ: {callSummary.waitingResponsePercent || '0%'}</span>
                  </div>
                </div>

                <div
                  className="pro-kpi-card is-rose"
                  onClick={() => handleOpenCallWithPreset('over7', '')}
                >
                  <div className="pro-kpi-head">
                    <span>Call ค้างเกิน 7 วัน</span>
                    <i className="fas fa-triangle-exclamation"></i>
                  </div>
                  <div className="pro-kpi-value">{formatNumber(callSummary.over7 || 0)}</div>
                  <div className="pro-kpi-progress">
                    <div
                      className="pro-kpi-progress-bar is-rose"
                      style={{ width: callSummary.over7Percent || '0%' }}
                    />
                  </div>
                  <div className="pro-kpi-foot">
                    <span>สัดส่วนเกิน 7 วัน: {callSummary.over7Percent || '0%'}</span>
                  </div>
                </div>

                <div
                  className="pro-kpi-card is-cyan"
                  onClick={() => handleOpenCallWithPreset(null, '')}
                >
                  <div className="pro-kpi-head">
                    <span>ระยะเวลาค้างเฉลี่ย / สูงสุด</span>
                    <i className="fas fa-stopwatch"></i>
                  </div>
                  <div className="pro-kpi-value">
                    {callState.data?.avgPendingDays || 0} <small>วัน</small>
                  </div>
                  <div className="pro-kpi-foot">
                    <span>ค้างสูงสุด: {callState.data?.maxPendingDays || 0} วัน</span>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Sub-cards */}
              <div className="pro-call-status-grid">
                {callStatusCards.map((st) => (
                  <div
                    key={st.key}
                    className={`pro-call-status-tile is-${st.tone}${st.count === 0 ? ' is-zero' : ''}`}
                    onClick={() => handleOpenCallWithPreset(st.key, '')}
                    title={`คลิกเพื่อเปิดระบบ Call พร้อมกรอง ${st.label}`}
                  >
                    <div className="pro-cst-top">
                      <span className="pro-cst-label">
                        <i className={`fas ${st.icon}`}></i> {st.label}
                      </span>
                      <span className="pro-cst-pct">{st.pct}</span>
                    </div>
                    <div className="pro-cst-val">{formatNumber(st.count)}</div>
                    <div className="pro-cst-bar">
                      <div className="pro-cst-fill" style={{ width: st.pct }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Top Aging Calls Preview at User's Warehouse */}
            <div className="pro-call-aging-col">
              <div className="pro-aging-head">
                <span>
                  <i className="fas fa-fire-burner"></i> Top Call ค้างนานสุดของคลัง ({callState.data?.topAgingCalls?.length || 0})
                </span>
                <button
                  type="button"
                  className="pro-text-link"
                  onClick={() => handleOpenCallWithPreset(null, '')}
                >
                  ดูทั้งหมด →
                </button>
              </div>
              <div className="pro-aging-list">
                {callState.loading && !callState.data ? (
                  <div className="pro-panel-empty">กำลังโหลดรายการ Call...</div>
                ) : (callState.data?.topAgingCalls || []).length === 0 ? (
                  <div className="pro-panel-empty">
                    <i className="fas fa-circle-check"></i> ไม่พบรายการ Call ค้างในคลังนี้
                  </div>
                ) : (
                  callState.data.topAgingCalls.map((item) => (
                    <div
                      key={item.ticket}
                      className="pro-aging-item"
                      onClick={() => handleOpenCallWithPreset(null, item.ticket)}
                      title={`คลิกเพื่อเปิด Ticket ${item.ticket} ในระบบ Call`}
                    >
                      <div className="pro-aging-item-top">
                        <strong className="pro-aging-ticket">{item.ticket}</strong>
                        <span className={`pro-aging-days ${Math.round(item.dayRepair) > 7 ? 'is-danger' : 'is-warn'}`}>
                          {Math.round(item.dayRepair)} วัน
                        </span>
                      </div>
                      <div className="pro-aging-desc" title={item.description}>
                        {item.material !== '-' ? `[${item.material}] ` : ''}
                        {item.description}
                      </div>
                      <div className="pro-aging-meta">
                        <span>{item.company} • {item.storeName}</span>
                        <span className="pro-aging-status-pill">{item.statusGroup}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </article>

        {/* ====================================================================
            ZONE 3: 4. ข้อมูล ABC ในส่วนที่คลังสังกัดอยู่ (4.1 - 4.7) + ตารางข้อมูลเชิงลึก
            ==================================================================== */}
        <article className="pro-bento-panel pro-panel-violet">
          <div className="pro-panel-header">
            <div className="pro-panel-title-wrap">
              <span className="pro-panel-icon is-violet">
                <i className="fas fa-cubes-stacked"></i>
              </span>
              <div>
                <div className="pro-panel-title-row">
                  <h2>
                    4. ข้อมูล ABC Analysis & Smart Ordering (คลัง{plantInfo.plantName} — {plantInfo.plantCode})
                  </h2>
                  {abcMetrics && (
                    <span className="pro-badge-pill is-violet">
                      {formatNumber(abcMetrics.totalItems)} รายการเคลื่อนไหว/มีสต็อก
                    </span>
                  )}
                </div>
                <p className="pro-panel-sub">
                  สรุปยอดแนะนำสั่งตามสถานะ (ติดตั้ง / ติดตั้งเรียกเข้า / เรียกเข้า), มูลค่าคลัง, Stockday, ของขาด Fast/Medium และรายการที่ยังไม่อัปเดต Location
                </p>
              </div>
            </div>

            <button
              type="button"
              className="pro-open-app-btn is-violet"
              onClick={() => handleOpenAbcWithPreset(activeAbcTab, '')}
            >
              <span>เปิดระบบ ABC Analysis</span>
              <i className="fas fa-arrow-up-right-from-square"></i>
            </button>
          </div>

          {!abcState.data?.hasData && !abcState.loading ? (
            <div className="pro-panel-empty">
              คลัง {plantInfo.plantCode} ({plantInfo.plantName}) ไม่มีชีตข้อมูล ABC Analysis เฉพาะคลัง กรุณาเลือกคลังที่มีเครื่องหมาย ★ ด้านบน
            </div>
          ) : (
            <>
              {/* Row A: 3 Smart Ordering Cards (4.1, 4.2, 4.3) */}
              <div className="pro-abc-section-label">
                <span>
                  <i className="fas fa-cart-shopping"></i> หมวดรายการแนะนำสั่งซื้อ (Recommended Order &gt; 0) — คลิกที่การ์ดเพื่อกรองตารางด้านล่าง
                </span>
              </div>
              <div className="pro-abc-order-grid">
                {/* 4.1 แนะนำสั่งอะไหล่ติดตั้ง */}
                <div
                  className={`pro-kpi-card is-emerald is-Interactive${
                    activeAbcTab === 'installOrder' ? ' is-selected-card' : ''
                  }`}
                  onClick={() => handleSelectAbcCard('installOrder', 'OrderValue')}
                >
                  <div className="pro-kpi-head">
                    <span>แนะนำสั่งอะไหล่ติดตั้ง</span>
                    <span className="pro-status-chip is-emerald">ติดตั้ง</span>
                  </div>
                  <div className="pro-kpi-dual-row">
                    <div className="pro-kpi-value">
                      {abcState.loading && !abcMetrics ? '...' : formatNumber(abcMetrics?.installOrderCount || 0)}
                      <small> รายการ</small>
                    </div>
                    <div className="pro-kpi-money-box">
                      <span className="pro-money-lbl">มูลค่าสั่งรวม</span>
                      <strong className="pro-money-val">
                        {formatCompactMoney(abcMetrics?.installOrderValue || 0)} ฿
                      </strong>
                    </div>
                  </div>
                  <div className="pro-kpi-foot">
                    <span>{formatFullMoney(abcMetrics?.installOrderValue || 0)} บาท</span>
                    <span className="pro-click-hint">คลิกดูตารางรายการ ↓</span>
                  </div>
                </div>

                {/* 4.2 แนะนำสั่งอะไหล่ติดตั้งเรียกเข้า */}
                <div
                  className={`pro-kpi-card is-violet is-Interactive${
                    activeAbcTab === 'installCallOrder' ? ' is-selected-card' : ''
                  }`}
                  onClick={() => handleSelectAbcCard('installCallOrder', 'OrderValue')}
                >
                  <div className="pro-kpi-head">
                    <span>แนะนำสั่งอะไหล่ติดตั้งเรียกเข้า</span>
                    <span className="pro-status-chip is-violet">ติดตั้งเรียกเข้า</span>
                  </div>
                  <div className="pro-kpi-dual-row">
                    <div className="pro-kpi-value">
                      {abcState.loading && !abcMetrics ? '...' : formatNumber(abcMetrics?.installCallOrderCount || 0)}
                      <small> รายการ</small>
                    </div>
                    <div className="pro-kpi-money-box">
                      <span className="pro-money-lbl">มูลค่าสั่งรวม</span>
                      <strong className="pro-money-val">
                        {formatCompactMoney(abcMetrics?.installCallOrderValue || 0)} ฿
                      </strong>
                    </div>
                  </div>
                  <div className="pro-kpi-foot">
                    <span>{formatFullMoney(abcMetrics?.installCallOrderValue || 0)} บาท</span>
                    <span className="pro-click-hint">คลิกดูตารางรายการ ↓</span>
                  </div>
                </div>

                {/* 4.3 แนะนำสั่ง > 0 ที่ Filter Status = เรียกเข้า */}
                <div
                  className={`pro-kpi-card is-sky is-Interactive${
                    activeAbcTab === 'callOrder' ? ' is-selected-card' : ''
                  }`}
                  onClick={() => handleSelectAbcCard('callOrder', 'OrderValue')}
                >
                  <div className="pro-kpi-head">
                    <span>แนะนำสั่ง &gt; 0 (Status = เรียกเข้า)</span>
                    <span className="pro-status-chip is-sky">เรียกเข้า</span>
                  </div>
                  <div className="pro-kpi-dual-row">
                    <div className="pro-kpi-value">
                      {abcState.loading && !abcMetrics ? '...' : formatNumber(abcMetrics?.callOrderCount || 0)}
                      <small> รายการ</small>
                    </div>
                    <div className="pro-kpi-money-box">
                      <span className="pro-money-lbl">มูลค่าสั่งรวม</span>
                      <strong className="pro-money-val">
                        {formatCompactMoney(abcMetrics?.callOrderValue || 0)} ฿
                      </strong>
                    </div>
                  </div>
                  <div className="pro-kpi-foot">
                    <span>{formatFullMoney(abcMetrics?.callOrderValue || 0)} บาท</span>
                    <span className="pro-click-hint">คลิกดูตารางรายการ ↓</span>
                  </div>
                </div>
              </div>

              {/* Row B: 4 Warehouse Inventory Health & Alert Cards (4.4, 4.5, 4.6, 4.7) */}
              <div className="pro-abc-section-label">
                <span>
                  <i className="fas fa-shield-heart"></i> หมวดมูลค่าคลังปัจจุบัน, Stockday, ของขาด Fast/Medium และการจัดการ Location
                </span>
              </div>
              <div className="pro-abc-health-grid">
                {/* 4.4 มูลค่าคลัง ณ ปัจจุบัน */}
                <div
                  className="pro-kpi-card is-indigo"
                  onClick={() => handleOpenApp('abc-analysis')}
                  title="คลิกเพื่อเปิดหน้า ABC Analysis"
                >
                  <div className="pro-kpi-head">
                    <span>4.4 มูลค่าคลัง ณ ปัจจุบัน</span>
                    <i className="fas fa-sack-dollar"></i>
                  </div>
                  <div className="pro-kpi-value">
                    {abcState.loading && !abcMetrics
                      ? '...'
                      : `${formatCompactMoney(abcMetrics?.totalStockValue || 0)} ฿`}
                  </div>
                  <div className="pro-kpi-sub-pills">
                    <span>{formatFullMoney(abcMetrics?.totalStockValue || 0)} บาท</span>
                    <span>เบิก/เดือน: {formatCompactMoney(abcMetrics?.monthlyWithdrawalValue || 0)} ฿</span>
                  </div>
                  <div className="pro-kpi-foot">
                    <span>รวมทั้งหมด {formatNumber(abcMetrics?.totalItems || 0)} รายการ</span>
                  </div>
                </div>

                {/* 4.5 Stockday ณ ปัจจุบัน (คลิกเพื่อดูตารางรายการ OverStock ส่งคืนได้) */}
                <div
                  className={`pro-kpi-card is-cyan is-Interactive${
                    activeAbcTab === 'overstockReturn' ? ' is-selected-card' : ''
                  }`}
                  onClick={() => handleSelectAbcCard('overstockReturn', 'ReturnValue')}
                  title="คลิกเพื่อดูตารางรายการอะไหล่ OverStock ที่ส่งคืนได้เพื่อลด Stockday"
                >
                  <div className="pro-kpi-head">
                    <span>4.5 Stockday ณ ปัจจุบัน</span>
                    <i className="fas fa-calendar-day"></i>
                  </div>
                  <div className="pro-kpi-value">
                    {abcState.loading && !abcMetrics ? '...' : formatNumber(abcMetrics?.stockDays || 0)}
                    <small> วัน</small>
                  </div>
                  <div className="pro-kpi-sub-pills">
                    <span>หลังคืน OverStock: {formatNumber(abcMetrics?.afterStockDays || 0)} วัน</span>
                  </div>
                  <div className="pro-kpi-foot">
                    <span>
                      OverStock: {formatCompactMoney(abcMetrics?.totalReturnValue || 0)} ฿ ({formatNumber(abcMetrics?.returnCount || 0)})
                    </span>
                    <span className="pro-click-hint">คลิกดู OverStock ↓</span>
                  </div>
                </div>

                {/* 4.6 อะไหล่ขาด Fast-Medium */}
                <div
                  className={`pro-kpi-card is-rose is-Interactive${
                    activeAbcTab === 'shortageFastMed' ? ' is-selected-card' : ''
                  }`}
                  onClick={() => handleSelectAbcCard('shortageFastMed', 'AvgMonthly')}
                >
                  <div className="pro-kpi-head">
                    <span>อะไหล่ขาด Fast-Medium</span>
                    <i className="fas fa-box-open"></i>
                  </div>
                  <div className="pro-kpi-value">
                    {abcState.loading && !abcMetrics ? '...' : formatNumber(abcMetrics?.shortageFastMedCount || 0)}
                    <small> รายการ</small>
                  </div>
                  <div className="pro-kpi-sub-pills">
                    <span className="is-good-pill">
                      นวนครมีของ: {formatNumber(abcMetrics?.shortageWithNawaStock || 0)}
                    </span>
                    <span className="is-alert-pill">
                      นวนครหมด: {formatNumber(abcMetrics?.shortageWaitNawa || 0)}
                    </span>
                  </div>
                  <div className="pro-kpi-foot">
                    <span>คงเหลือ = 0 • Status = นวนคร</span>
                    <span className="pro-click-hint">คลิกดูตาราง ↓</span>
                  </div>
                </div>

                {/* 4.7 Storage bin Wait */}
                <div
                  className={`pro-kpi-card is-amber is-Interactive${
                    activeAbcTab === 'unupdatedLocation' ? ' is-selected-card' : ''
                  }`}
                  onClick={() => handleSelectAbcCard('unupdatedLocation', 'Value')}
                >
                  <div className="pro-kpi-head">
                    <span>Storage bin Wait</span>
                    <i className="fas fa-location-dot"></i>
                  </div>
                  <div className="pro-kpi-value">
                    {abcState.loading && !abcMetrics ? '...' : formatNumber(abcMetrics?.unupdatedLocationCount || 0)}
                    <small> รายการ</small>
                  </div>
                  <div className="pro-kpi-sub-pills">
                    <span>มูลค่ารวม: {formatCompactMoney(abcMetrics?.unupdatedLocationValue || 0)} ฿</span>
                  </div>
                  <div className="pro-kpi-foot">
                    <span>คงเหลือ &gt; 0 • Bin ว่าง หรือ A00-0-0</span>
                    <span className="pro-click-hint">คลิกดูตาราง ↓</span>
                  </div>
                </div>
              </div>

              {/* Pro ABC & Moving Distribution Strip */}
              {abcMetrics && (
                <div className="pro-distribution-strip">
                  <div className="pro-dist-card">
                    <div className="pro-dist-title">สัดส่วนกลุ่ม ABC (จำนวนรายการ / มูลค่า)</div>
                    <div className="pro-dist-pills">
                      <span className="pro-dist-pill is-a">
                        <strong>A</strong> {formatNumber(abcMetrics.abcCounts.A)} รายการ ({formatCompactMoney(abcMetrics.abcValues.A)} ฿)
                      </span>
                      <span className="pro-dist-pill is-b">
                        <strong>B</strong> {formatNumber(abcMetrics.abcCounts.B)} รายการ ({formatCompactMoney(abcMetrics.abcValues.B)} ฿)
                      </span>
                      <span className="pro-dist-pill is-c">
                        <strong>C</strong> {formatNumber(abcMetrics.abcCounts.C)} รายการ ({formatCompactMoney(abcMetrics.abcValues.C)} ฿)
                      </span>
                    </div>
                  </div>

                  <div className="pro-dist-card">
                    <div className="pro-dist-title">สัดส่วนการเคลื่อนไหว (Moving Classification)</div>
                    <div className="pro-dist-pills">
                      <span className="pro-dist-pill is-fast">
                        Fast: <strong>{formatNumber(abcMetrics.movingCounts.Fast)}</strong>
                      </span>
                      <span className="pro-dist-pill is-med">
                        Medium: <strong>{formatNumber(abcMetrics.movingCounts.Medium)}</strong>
                      </span>
                      <span className="pro-dist-pill is-slow">
                        Slow: <strong>{formatNumber(abcMetrics.movingCounts.Slow)}</strong>
                      </span>
                      <span className="pro-dist-pill is-slowly">
                        Slowly: <strong>{formatNumber(abcMetrics.movingCounts.Slowly)}</strong>
                      </span>
                      <span className="pro-dist-pill is-dead">
                        Non Moving: <strong>{formatNumber(abcMetrics.movingCounts['Non Moving'])}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================
                  INTERACTIVE ABC ACTION TABLE
                  ================================================================ */}
              <div ref={abcTableRef} className="pro-abc-table-panel">
                <div className="pro-abc-table-toolbar">
                  <div className="pro-abc-tabs" role="tablist">
                    <button
                      type="button"
                      className={`pro-abc-tab is-emerald${activeAbcTab === 'installOrder' ? ' active' : ''}`}
                      onClick={() => {
                        setActiveAbcTab('installOrder');
                        setAbcPage(1);
                      }}
                    >
                      <span>แนะนำสั่งอะไหล่ติดตั้ง</span>
                      <strong>{formatNumber(abcMetrics?.installOrderCount || 0)}</strong>
                    </button>
                    <button
                      type="button"
                      className={`pro-abc-tab is-violet${activeAbcTab === 'installCallOrder' ? ' active' : ''}`}
                      onClick={() => {
                        setActiveAbcTab('installCallOrder');
                        setAbcPage(1);
                      }}
                    >
                      <span>แนะนำสั่งอะไหล่ติดตั้งเรียกเข้า</span>
                      <strong>{formatNumber(abcMetrics?.installCallOrderCount || 0)}</strong>
                    </button>
                    <button
                      type="button"
                      className={`pro-abc-tab is-sky${activeAbcTab === 'callOrder' ? ' active' : ''}`}
                      onClick={() => {
                        setActiveAbcTab('callOrder');
                        setAbcPage(1);
                      }}
                    >
                      <span>แนะนำสั่ง: เรียกเข้า</span>
                      <strong>{formatNumber(abcMetrics?.callOrderCount || 0)}</strong>
                    </button>
                    <button
                      type="button"
                      className={`pro-abc-tab is-rose${activeAbcTab === 'shortageFastMed' ? ' active' : ''}`}
                      onClick={() => {
                        setActiveAbcTab('shortageFastMed');
                        setAbcPage(1);
                      }}
                    >
                      <span>อะไหล่ขาด Fast-Medium</span>
                      <strong>{formatNumber(abcMetrics?.shortageFastMedCount || 0)}</strong>
                    </button>
                    <button
                      type="button"
                      className={`pro-abc-tab is-amber${activeAbcTab === 'unupdatedLocation' ? ' active' : ''}`}
                      onClick={() => {
                        setActiveAbcTab('unupdatedLocation');
                        setAbcPage(1);
                      }}
                    >
                      <span>Storage bin Wait</span>
                      <strong>{formatNumber(abcMetrics?.unupdatedLocationCount || 0)}</strong>
                    </button>
                    <button
                      type="button"
                      className={`pro-abc-tab is-cyan${activeAbcTab === 'overstockReturn' ? ' active' : ''}`}
                      onClick={() => {
                        setActiveAbcTab('overstockReturn');
                        setAbcSort({ key: 'ReturnValue', dir: 'desc' });
                        setAbcPage(1);
                      }}
                    >
                      <span>OverStock ส่งคืนได้</span>
                      <strong>{formatNumber(abcMetrics?.returnCount || 0)}</strong>
                    </button>
                    <button
                      type="button"
                      className={`pro-abc-tab is-indigo${activeAbcTab === 'allOrder' ? ' active' : ''}`}
                      onClick={() => {
                        setActiveAbcTab('allOrder');
                        setAbcPage(1);
                      }}
                    >
                      <span>แนะนำสั่งทั้งหมด</span>
                      <strong>{formatNumber(abcMetrics?.allOrderCount || 0)}</strong>
                    </button>
                  </div>

                  <div className="pro-abc-toolbar-right">
                    <div className="pro-abc-quick-chips">
                      <button
                        type="button"
                        className={`pro-qchip${abcQuickFilter === 'all' ? ' active' : ''}`}
                        onClick={() => {
                          setAbcQuickFilter('all');
                          setAbcPage(1);
                        }}
                      >
                        ทั้งหมด
                      </button>
                      <button
                        type="button"
                        className={`pro-qchip${abcQuickFilter === 'abcA' ? ' active' : ''}`}
                        onClick={() => {
                          setAbcQuickFilter('abcA');
                          setAbcPage(1);
                        }}
                      >
                        เฉพาะเกรด A
                      </button>
                      <button
                        type="button"
                        className={`pro-qchip${abcQuickFilter === 'fast' ? ' active' : ''}`}
                        onClick={() => {
                          setAbcQuickFilter('fast');
                          setAbcPage(1);
                        }}
                      >
                        เฉพาะ Fast
                      </button>
                      <button
                        type="button"
                        className={`pro-qchip${abcQuickFilter === 'nawaReady' ? ' active' : ''}`}
                        onClick={() => {
                          setAbcQuickFilter('nawaReady');
                          setAbcPage(1);
                        }}
                      >
                        นวนครมีของ
                      </button>
                    </div>

                    <div className="pro-abc-search-box">
                      <i className="fas fa-magnifying-glass"></i>
                      <input
                        type="text"
                        placeholder="ค้นหา Material, Description, Storage bin..."
                        value={abcSearch}
                        onChange={(e) => {
                          setAbcSearch(e.target.value);
                          setAbcPage(1);
                        }}
                      />
                      {abcSearch && (
                        <button
                          type="button"
                          className="pro-clear-search"
                          onClick={() => setAbcSearch('')}
                          aria-label="ล้างคำค้นหา"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="pro-export-csv-btn"
                      onClick={() => {
                        const ok = exportAbcListToCsv(activeAbcList, activeAbcTab, plantInfo);
                        if (showToast) {
                          showToast(ok ? `ดาวน์โหลด CSV (${activeAbcList.length} รายการ) แล้ว` : 'ไม่มีรายการสำหรับ Export');
                        }
                      }}
                      title="ส่งออกรายการในตารางปัจจุบันเป็นไฟล์ CSV (Excel)"
                    >
                      <i className="fas fa-file-csv"></i>
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                <div className="pro-table-scroll">
                  <table className="pro-data-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSortAbcCol('Material')} style={{ cursor: 'pointer' }}>
                          Material {abcSort.key === 'Material' ? (abcSort.dir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortAbcCol('Description')} style={{ cursor: 'pointer' }}>
                          Description (รายการอะไหล่)
                        </th>
                        <th onClick={() => handleSortAbcCol('Status')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                          Status
                        </th>
                        <th onClick={() => handleSortAbcCol('StorageBin')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                          Storage bin
                        </th>
                        <th style={{ textAlign: 'center' }}>ABC / Moving</th>
                        <th onClick={() => handleSortAbcCol('Navanakorn')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                          นวนคร {abcSort.key === 'Navanakorn' ? (abcSort.dir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortAbcCol('Unrestricted')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                          คงเหลือ {abcSort.key === 'Unrestricted' ? (abcSort.dir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortAbcCol('AvgMonthly')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                          เฉลี่ย/เดือน {abcSort.key === 'AvgMonthly' ? (abcSort.dir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortAbcCol('DOS')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                          DOS (วัน) {abcSort.key === 'DOS' ? (abcSort.dir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortAbcCol('RecommendedOrder')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                          แนะนำสั่ง {abcSort.key === 'RecommendedOrder' ? (abcSort.dir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortAbcCol('OrderValue')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                          มูลค่าสั่ง / สต็อก {abcSort.key === 'OrderValue' ? (abcSort.dir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {abcState.loading && !abcLists ? (
                        <tr>
                          <td colSpan={11} className="pro-table-empty">
                            กำลังประมวลผลตาราง ABC Analysis...
                          </td>
                        </tr>
                      ) : paginatedAbcRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="pro-table-empty">
                            ไม่มีรายการในหมวดนี้
                          </td>
                        </tr>
                      ) : (
                        paginatedAbcRows.map((row) => {
                          const isInvalidBin =
                            !row.StorageBin ||
                            String(row.StorageBin).trim() === '' ||
                            String(row.StorageBin).trim().toUpperCase() === 'A00-0-0';
                          const dosDisplay = row.DOS > 9999 ? 'มาก' : Number(row.DOS || 0).toFixed(1);
                          const isLowDos = Number(row.DOS || 0) < 7;
                          const isOverstockTab = activeAbcTab === 'overstockReturn';
                          const recOrder = Math.round(row.RecommendedOrder || 0);
                          const returnQty = Math.round(row.ReturnQty || 0);
                          const displayMoney = isOverstockTab
                            ? row.ReturnValue
                            : recOrder > 0
                            ? row.OrderValue
                            : row.Value;

                          return (
                            <tr
                              key={`${row.Plant}-${row.Material}`}
                              onClick={() => handleOpenAbcWithPreset(activeAbcTab, row.Material)}
                              title={`คลิกเพื่อเปิด ${row.Material} ในหน้า ABC Analysis`}
                            >
                              <td className="pro-td-mono">{row.Material}</td>
                              <td className="pro-td-desc">{row.Description || '—'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="pro-table-status-badge">{row.Status || '-'}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`pro-bin-tag${isInvalidBin ? ' is-invalid' : ''}`}>
                                  {row.StorageBin || '(ว่าง)'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`pro-abc-badge is-${(row.ABCValue || 'c').toLowerCase()}`}>
                                  {row.ABCValue || '-'}
                                </span>{' '}
                                <span className="pro-moving-tag">{row.Moving || '-'}</span>
                              </td>
                              <td style={{ textAlign: 'right' }} className={row.Navanakorn > 0 ? 'pro-num-accent' : 'pro-num-muted'}>
                                {formatNumber(row.Navanakorn || 0)}
                              </td>
                              <td style={{ textAlign: 'right' }} className={row.Unrestricted === 0 ? 'pro-num-danger' : 'pro-num-strong'}>
                                {formatNumber(row.Unrestricted || 0)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {formatNumber(row.AvgMonthly || 0, 1)}
                              </td>
                              <td style={{ textAlign: 'right' }} className={isLowDos ? 'pro-num-danger' : ''}>
                                {dosDisplay}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {isOverstockTab ? (
                                  <span className="pro-rec-order-pill">
                                    คืน {formatNumber(returnQty)} {row.Unit || ''}
                                  </span>
                                ) : recOrder > 0 ? (
                                  <span className="pro-rec-order-pill">
                                    +{formatNumber(recOrder)} {row.Unit || ''}
                                  </span>
                                ) : (
                                  <span className="pro-num-muted">0</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }} className="pro-td-money">
                                {formatFullMoney(displayMoney || 0)} ฿
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="pro-table-footer">
                  <span className="pro-table-count">
                    แสดง {paginatedAbcRows.length} จากทั้งหมด {formatNumber(activeAbcList.length)} รายการในหมวดนี้
                  </span>
                  <div className="pro-pagination">
                    <button
                      type="button"
                      disabled={abcPage <= 1}
                      onClick={() => setAbcPage(1)}
                    >
                      «
                    </button>
                    <button
                      type="button"
                      disabled={abcPage <= 1}
                      onClick={() => setAbcPage((p) => Math.max(1, p - 1))}
                    >
                      ‹ ก่อนหน้า
                    </button>
                    <span className="pro-page-indicator">
                      หน้า {abcPage} / {abcTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={abcPage >= abcTotalPages}
                      onClick={() => setAbcPage((p) => Math.min(abcTotalPages, p + 1))}
                    >
                      ถัดไป ›
                    </button>
                    <button
                      type="button"
                      disabled={abcPage >= abcTotalPages}
                      onClick={() => setAbcPage(abcTotalPages)}
                    >
                      »
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </article>

        {/* ====================================================================
            ZONE 4: 5. CUSTOMER RETURN & CLAIM COMMAND CENTER (ครบทั้ง 6 เมนูย่อย)
            ==================================================================== */}
        <article className="pro-bento-panel pro-panel-cyan">
          <div className="pro-panel-header">
            <div className="pro-panel-title-wrap">
              <span className="pro-panel-icon is-cyan">
                <i className="fas fa-rotate-left"></i>
              </span>
              <div>
                <div className="pro-panel-title-row">
                  <h2>
                    5. Customer Return &amp; Claim Command Center (รายงานการเก็บเครื่องคืนลูกค้า 6 เมนูย่อย)
                  </h2>
                  <span className="pro-badge-pill is-cyan">
                    {custReturnScope === 'plant'
                      ? `เฉพาะคลัง: ${custReturnState.data?.matchedPlantCall || plantInfo.callPendingUnit}`
                      : 'ภาพรวมทั่วประเทศ'}
                  </span>
                </div>
                <p className="pro-panel-sub">
                  ติดตามสถานะการรับคืนอะไหล่และส่งเคลมครบทั้ง 6 หมวด (TSC, TSC ร้านปิด/Renovate, Sunmi, เคลม Bluetap รุ่นใหม่, เคลม Adapter Pos Nss และ True WiFi)
                </p>
              </div>
            </div>

            <div className="pro-panel-actions">
              <div className="pro-segmented-ctrl" title="สลับมุมมองระหว่าง เฉพาะคลังของฉัน กับ ภาพรวมทั่วประเทศ">
                <button
                  type="button"
                  className={custReturnScope === 'plant' ? 'active' : ''}
                  onClick={() => setCustReturnScope('plant')}
                >
                  <i className="fas fa-warehouse"></i> เฉพาะคลังของฉัน (
                  {formatNumber(custReturnState.data?.plantScope?.masterOverview?.totalQty || 0)})
                </button>
                <button
                  type="button"
                  className={custReturnScope === 'nationwide' ? 'active' : ''}
                  onClick={() => setCustReturnScope('nationwide')}
                >
                  <i className="fas fa-globe"></i> ทั่วประเทศ (
                  {formatNumber(custReturnState.data?.nationwideScope?.masterOverview?.totalQty || 0)})
                </button>
              </div>

              <button
                type="button"
                className="pro-open-app-btn is-cyan"
                onClick={() => handleOpenCustReturnWithPreset(activeCustReturnTab)}
              >
                <span>เปิดรายงานเมนูนี้</span>
                <i className="fas fa-arrow-up-right-from-square"></i>
              </button>
            </div>
          </div>

          {/* Master Overview Strip across all 6 submenus */}
          <div className="pro-cust-master-strip">
            <div className="pro-cust-master-kpi is-cyan">
              <div className="pro-cmk-icon">
                <i className="fas fa-boxes-packing"></i>
              </div>
              <div className="pro-cmk-info">
                <span>ยอดรับคืนรวม (5 หมวดอะไหล่)</span>
                <strong>
                  {custReturnState.loading && !custMaster ? '...' : formatNumber(custMaster?.totalQty || 0)}{' '}
                  <small>ชิ้น</small>
                </strong>
                <span className="pro-cmk-sub">
                  จากทั้งหมด {formatNumber(custMaster?.totalWorkOrders || 0)} ใบงาน (WorkOrder)
                </span>
              </div>
            </div>

            <div className="pro-cust-master-kpi is-amber">
              <div className="pro-cmk-icon">
                <i className="fas fa-truck-ramp-box"></i>
              </div>
              <div className="pro-cmk-info">
                <span>กำลังดำเนินการ (ยังไม่ส่งลูกค้า/เคลม)</span>
                <strong>
                  {custReturnState.loading && !custMaster
                    ? '...'
                    : formatNumber(custMaster?.totalProcessingQty || 0)}{' '}
                  <small>ชิ้น</small>
                </strong>
                <span className="pro-cmk-sub">
                  ส่งสำเร็จแล้ว {formatNumber(custMaster?.totalCompletedQty || 0)} ชิ้น
                </span>
              </div>
            </div>

            <div
              className="pro-cust-master-kpi is-emerald"
              onClick={() => handleSelectCustReturnCard('tsc-store')}
              style={{ cursor: 'pointer' }}
            >
              <div className="pro-cmk-icon">
                <i className="fas fa-store-slash"></i>
              </div>
              <div className="pro-cmk-info">
                <span>TSC ร้านปิด/Renovate ค้างเก็บคืน</span>
                <strong>
                  {custReturnState.loading && !custMaster
                    ? '...'
                    : formatNumber(custMaster?.storePendingBranches || 0)}{' '}
                  <small>สาขา</small>
                </strong>
                <span className="pro-cmk-sub">
                  รวมเครื่อง POS ค้างเก็บ {formatNumber(custMaster?.storePendingPos || 0)} เครื่อง (ทั่วประเทศ)
                </span>
              </div>
            </div>

            <div className="pro-cust-master-kpi is-rose">
              <div className="pro-cmk-icon">
                <i className="fas fa-triangle-exclamation"></i>
              </div>
              <div className="pro-cmk-info">
                <span>แจ้งเตือนความเสี่ยง &amp; ตรวจสอบ</span>
                <div className="pro-cmk-badges">
                  <span className="pro-alert-pill is-rose" title="ช่างระบุไม่คืนซาก">
                    ไม่คืนซาก: {formatNumber(custMaster?.totalNotReturnCount || 0)} งาน
                  </span>
                  <span className="pro-alert-pill is-amber" title="WorkOrder รหัส 30066406 ไม่ตรงตารางอนุมัติเคลม">
                    CheckOrder: {formatNumber(custMaster?.totalCheckOrder || 0)}
                  </span>
                  <span className="pro-alert-pill is-violet" title="จำนวน Serial คืนไม่ตรงกับจำนวน Qty">
                    Serial ผิด: {formatNumber(custMaster?.totalErrorMismatch || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 6-Card Pro Bento Grid for Each Customer Return Submenu */}
          <div className="pro-cust-bento-grid">
            {/* SUBMENU 1: เก็บเครื่อง TSC คืนลูกค้า (view=tsc) */}
            {(() => {
              const m = custSubmenus?.tsc;
              const st = m?.statusCounts || {};
              const sPlant = st['คลังพื้นที่'] || 0;
              const sTransit = st['ระหว่างขนส่ง'] || 0;
              const sCenter = st['คลังกลาง'] || 0;
              const sDone = (st['ส่งลูกค้าแล้ว'] || 0) + (st['สำเร็จ'] || 0);
              return (
                <div
                  className={`pro-cust-card is-tsc${activeCustReturnTab === 'tsc' ? ' is-active-card' : ''}`}
                  onClick={() => handleSelectCustReturnCard('tsc')}
                >
                  <div className="pro-cc-header">
                    <div className="pro-cc-title-group">
                      <span className="pro-cc-badge is-blue">เมนูย่อย 1 • TSC Dummy</span>
                      <h3>เก็บเครื่อง TSC คืนลูกค้า</h3>
                    </div>
                    <button
                      type="button"
                      className="pro-cc-launch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc');
                      }}
                      title="เปิดหน้า เก็บเครื่อง TSC คืนลูกค้า แบบเต็มจอ"
                    >
                      <span>เปิดหน้าเต็ม</span>
                      <i className="fas fa-arrow-up-right-from-square"></i>
                    </button>
                  </div>

                  <div className="pro-cc-hero-row">
                    <div className="pro-cc-hero-stat">
                      <span>กำลังดำเนินการ</span>
                      <strong className="is-amber-text">{formatNumber(m?.processingQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>ยอดรับคืนรวม</span>
                      <strong>{formatNumber(m?.totalQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>จำนวนใบงาน</span>
                      <strong>{formatNumber(m?.workOrderCount || 0)} <small>งาน</small></strong>
                    </div>
                  </div>

                  {/* 4-Stage Pipeline Bar */}
                  <div className="pro-cc-pipeline">
                    <div
                      className="pro-cc-pipe-step is-plant"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc', { status: 'คลังพื้นที่' });
                      }}
                      title="คลิกเพื่อดูรายการค้างที่คลังพื้นที่"
                    >
                      <span>คลังพื้นที่</span>
                      <strong>{formatNumber(sPlant)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-transit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc', { status: 'ระหว่างขนส่ง' });
                      }}
                    >
                      <span>ระหว่างขนส่ง</span>
                      <strong>{formatNumber(sTransit)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc', { status: 'คลังกลาง' });
                      }}
                    >
                      <span>คลังกลาง</span>
                      <strong>{formatNumber(sCenter)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-done"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc', { status: 'ส่งลูกค้าแล้ว' });
                      }}
                    >
                      <span>ส่งลูกค้าแล้ว</span>
                      <strong>{formatNumber(sDone)}</strong>
                    </div>
                  </div>

                  {/* Equipment Breakdown Pills (7 Main TSC Items) */}
                  <div className="pro-cc-desc-pills">
                    {(m?.descBreakdown || []).slice(0, 7).map((d) => (
                      <span
                        key={d.desc}
                        className="pro-cc-desc-pill"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustReturnWithPreset('tsc', { descFilter: d.desc });
                        }}
                        title={`คลิกเพื่อกรองเฉพาะ ${d.displayName}`}
                      >
                        {d.displayName}: <strong>{formatNumber(d.qty)}</strong>
                      </span>
                    ))}
                  </div>

                  <div className="pro-cc-footer">
                    <span>
                      <i className="fas fa-calendar-check"></i> รอบส่งล่าสุด: <strong>{m?.latestDeliveryDate || '-'}</strong>{' '}
                      {m?.latestDeliveryQty > 0 ? `(${formatNumber(m.latestDeliveryQty)} ชิ้น)` : ''}
                    </span>
                    {m?.errorMismatchCount > 0 && (
                      <span
                        className="pro-cc-alert-tag is-rose"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustReturnWithPreset('tsc', { errorOnly: true });
                        }}
                      >
                        ⚠ Serial ผิด {m.errorMismatchCount} งาน
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* SUBMENU 2: TSC ร้านปิด / ยกเลิก / Renovate (view=tsc-store) */}
            {(() => {
              const s = custSubmenus?.['tsc-store'];
              const mat = s?.statusMatrix;
              return (
                <div
                  className={`pro-cust-card is-tsc-store${
                    activeCustReturnTab === 'tsc-store' ? ' is-active-card' : ''
                  }`}
                  onClick={() => handleSelectCustReturnCard('tsc-store')}
                >
                  <div className="pro-cc-header">
                    <div className="pro-cc-title-group">
                      <span className="pro-cc-badge is-emerald">เมนูย่อย 2 • ร้านปิด/Renovate (ทั่วประเทศ)</span>
                      <h3>TSC ร้านปิด / ยกเลิก / Renovate</h3>
                    </div>
                    <button
                      type="button"
                      className="pro-cc-launch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc-store');
                      }}
                      title="เปิดหน้า TSC ร้านปิด / ยกเลิก / Renovate แบบเต็มจอ"
                    >
                      <span>เปิดหน้าเต็ม</span>
                      <i className="fas fa-arrow-up-right-from-square"></i>
                    </button>
                  </div>

                  <div className="pro-cc-hero-row">
                    <div className="pro-cc-hero-stat">
                      <span>สาขาทั้งหมด</span>
                      <strong>{formatNumber(s?.totalBranches || 0)} <small>สาขา</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>เครื่อง POS รวม</span>
                      <strong>{formatNumber(s?.totalPos || 0)} <small>เครื่อง</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>เก็บคืนครบแล้ว</span>
                      <strong className="is-emerald-text">{s?.completionPct || 0}%</strong>
                    </div>
                  </div>

                  {/* 4-Status Dual Metric Matrix (สาขา / เครื่อง) */}
                  <div className="pro-cc-store-matrix">
                    <div
                      className="pro-store-cell is-pending"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc-store', { status: 'รอจัดเก็บ' });
                      }}
                    >
                      <span className="pro-sc-lbl">🔴 รอจัดเก็บ</span>
                      <strong>{formatNumber(mat?.pending?.branches || 0)} สาขา</strong>
                      <small>{formatNumber(mat?.pending?.pos || 0)} เครื่อง</small>
                    </div>
                    <div
                      className="pro-store-cell is-waiting"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc-store', { status: 'รอส่งคลัง' });
                      }}
                    >
                      <span className="pro-sc-lbl">🟡 รอส่งคลัง</span>
                      <strong>{formatNumber(mat?.waiting?.branches || 0)} สาขา</strong>
                      <small>{formatNumber(mat?.waiting?.pos || 0)} เครื่อง</small>
                    </div>
                    <div
                      className="pro-store-cell is-incomplete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc-store', { status: 'ไม่ครบ' });
                      }}
                    >
                      <span className="pro-sc-lbl">🟠 ส่งคืนไม่ครบ</span>
                      <strong>{formatNumber(mat?.incomplete?.branches || 0)} สาขา</strong>
                      <small>ขาด {formatNumber(mat?.incomplete?.pos || 0)} เครื่อง</small>
                    </div>
                    <div
                      className="pro-store-cell is-complete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('tsc-store', { status: 'ครบ' });
                      }}
                    >
                      <span className="pro-sc-lbl">🟢 เก็บคืนครบ</span>
                      <strong>{formatNumber(mat?.complete?.branches || 0)} สาขา</strong>
                      <small>{formatNumber(mat?.complete?.pos || 0)} เครื่อง</small>
                    </div>
                  </div>

                  <div className="pro-cc-footer">
                    <span>
                      <i className="fas fa-clock-rotate-left"></i> ติดตามระดับสาขาและเลข TID / PosNo
                    </span>
                    {s?.over14DaysCount > 0 && (
                      <span className="pro-cc-alert-tag is-amber">
                        ⏳ ค้างเกิน 14 วัน: {formatNumber(s.over14DaysCount)} สาขา
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* SUBMENU 3: เก็บเครื่อง Sunmi คืนลูกค้า (view=bluetap) */}
            {(() => {
              const m = custSubmenus?.bluetap;
              const st = m?.statusCounts || {};
              const sPlant = st['คลังพื้นที่'] || 0;
              const sTransit = st['ระหว่างขนส่ง'] || 0;
              const sClaim = st['รอส่งเคลม'] || 0;
              const sDone = (st['ส่งลูกค้าแล้ว'] || 0) + (st['สำเร็จ'] || 0);
              return (
                <div
                  className={`pro-cust-card is-sunmi${activeCustReturnTab === 'bluetap' ? ' is-active-card' : ''}`}
                  onClick={() => handleSelectCustReturnCard('bluetap')}
                >
                  <div className="pro-cc-header">
                    <div className="pro-cc-title-group">
                      <span className="pro-cc-badge is-amber">เมนูย่อย 3 • Bluetap (SUNMI)</span>
                      <h3>เก็บเครื่อง Sunmi คืนลูกค้า</h3>
                    </div>
                    <button
                      type="button"
                      className="pro-cc-launch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap');
                      }}
                    >
                      <span>เปิดหน้าเต็ม</span>
                      <i className="fas fa-arrow-up-right-from-square"></i>
                    </button>
                  </div>

                  <div className="pro-cc-hero-row">
                    <div className="pro-cc-hero-stat">
                      <span>กำลังดำเนินการ</span>
                      <strong className="is-amber-text">{formatNumber(m?.processingQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>ยอดรับคืนรวม</span>
                      <strong>{formatNumber(m?.totalQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>จำนวนใบงาน</span>
                      <strong>{formatNumber(m?.workOrderCount || 0)} <small>งาน</small></strong>
                    </div>
                  </div>

                  <div className="pro-cc-pipeline">
                    <div
                      className="pro-cc-pipe-step is-plant"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap', { status: 'คลังพื้นที่' });
                      }}
                    >
                      <span>คลังพื้นที่</span>
                      <strong>{formatNumber(sPlant)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-transit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap', { status: 'ระหว่างขนส่ง' });
                      }}
                    >
                      <span>ระหว่างขนส่ง</span>
                      <strong>{formatNumber(sTransit)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap', { status: 'รอส่งเคลม' });
                      }}
                    >
                      <span>รอส่งเคลม</span>
                      <strong>{formatNumber(sClaim)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-done"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap', { status: 'สำเร็จ' });
                      }}
                    >
                      <span>สำเร็จ/ส่งแล้ว</span>
                      <strong>{formatNumber(sDone)}</strong>
                    </div>
                  </div>

                  <div className="pro-cc-footer">
                    <span
                      className={`pro-cc-alert-tag ${m?.notReturnCount > 0 ? 'is-rose' : 'is-muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap', { notReturnOnly: true });
                      }}
                      title="คลิกเพื่อเปิดรายการที่ช่างระบุ ไม่คืนซาก"
                    >
                      <i className="fas fa-ban"></i> ไม่คืนซาก: <strong>{formatNumber(m?.notReturnCount || 0)} งาน</strong> ({formatNumber(m?.notReturnQty || 0)} ชิ้น)
                    </span>
                    {m?.errorMismatchCount > 0 && (
                      <span
                        className="pro-cc-alert-tag is-amber"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustReturnWithPreset('bluetap', { errorOnly: true });
                        }}
                      >
                        ⚠ Serial ผิด {m.errorMismatchCount} งาน
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* SUBMENU 4: เคลมเครื่อง Bluetap รุ่นใหม่ (view=bluetap-claim, Code 30066406) */}
            {(() => {
              const m = custSubmenus?.['bluetap-claim'];
              const st = m?.statusCounts || {};
              const sWaitReturn = (st['รอคืนคลัง'] || 0) + (st['รอส่งคลัง'] || 0);
              const sWaitClaim = st['รอส่งเคลม'] || 0;
              const sDone = (st['ส่งลูกค้าแล้ว'] || 0) + (st['สำเร็จ'] || 0);
              const sOther = Math.max(0, (m?.totalQty || 0) - sWaitReturn - sWaitClaim - sDone);
              return (
                <div
                  className={`pro-cust-card is-bluetap-claim${
                    activeCustReturnTab === 'bluetap-claim' ? ' is-active-card' : ''
                  }`}
                  onClick={() => handleSelectCustReturnCard('bluetap-claim')}
                >
                  <div className="pro-cc-header">
                    <div className="pro-cc-title-group">
                      <span className="pro-cc-badge is-violet">เมนูย่อย 4 • รหัส 30066406</span>
                      <h3>เคลมเครื่อง Bluetap รุ่นใหม่</h3>
                    </div>
                    <button
                      type="button"
                      className="pro-cc-launch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap-claim');
                      }}
                    >
                      <span>เปิดหน้าเต็ม</span>
                      <i className="fas fa-arrow-up-right-from-square"></i>
                    </button>
                  </div>

                  <div className="pro-cc-hero-row">
                    <div className="pro-cc-hero-stat">
                      <span>อยู่ระหว่างเคลม/รอคืน</span>
                      <strong className="is-amber-text">{formatNumber(m?.processingQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>ยอดส่งเคลมรวม</span>
                      <strong>{formatNumber(m?.totalQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>จำนวนใบงาน</span>
                      <strong>{formatNumber(m?.workOrderCount || 0)} <small>งาน</small></strong>
                    </div>
                  </div>

                  <div className="pro-cc-pipeline">
                    <div
                      className="pro-cc-pipe-step is-plant"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap-claim', { status: 'รอคืนคลัง' });
                      }}
                    >
                      <span>รอคืนคลัง</span>
                      <strong>{formatNumber(sWaitReturn)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap-claim', { status: 'รอส่งเคลม' });
                      }}
                    >
                      <span>รอส่งเคลม</span>
                      <strong>{formatNumber(sWaitClaim)}</strong>
                    </div>
                    <div className="pro-cc-pipe-step is-transit">
                      <span>คลังพื้นที่/อื่นๆ</span>
                      <strong>{formatNumber(sOther)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-done"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap-claim', { status: 'สำเร็จ' });
                      }}
                    >
                      <span>เคลมสำเร็จ</span>
                      <strong>{formatNumber(sDone)}</strong>
                    </div>
                  </div>

                  <div className="pro-cc-footer">
                    <span
                      className={`pro-cc-alert-tag ${m?.checkOrderCount > 0 ? 'is-amber' : 'is-muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('bluetap-claim', { search: 'CheckOrder' });
                      }}
                      title="รายการที่มีการรับคืนรหัส 30066406 แต่ไม่พบเลข WorkOrder ในตารางอนุมัติเคลม"
                    >
                      <i className="fas fa-magnifying-glass-chart"></i> ต้องตรวจสอบ CheckOrder:{' '}
                      <strong>{formatNumber(m?.checkOrderCount || 0)} รายการ</strong>
                    </span>
                    {m?.notReturnCount > 0 && (
                      <span
                        className="pro-cc-alert-tag is-rose"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustReturnWithPreset('bluetap-claim', { notReturnOnly: true });
                        }}
                      >
                        ไม่คืนซาก {m.notReturnCount} งาน
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* SUBMENU 5: เคลม Adapter Pos Nss (view=adapter-claim, Code 30066303) */}
            {(() => {
              const m = custSubmenus?.['adapter-claim'];
              const st = m?.statusCounts || {};
              const sPlant = st['คลังพื้นที่'] || 0;
              const sTransit = st['ระหว่างขนส่ง'] || 0;
              const sClaim = st['รอส่งเคลม'] || 0;
              const sDone = (st['ส่งลูกค้าแล้ว'] || 0) + (st['สำเร็จ'] || 0);
              return (
                <div
                  className={`pro-cust-card is-adapter-claim${
                    activeCustReturnTab === 'adapter-claim' ? ' is-active-card' : ''
                  }`}
                  onClick={() => handleSelectCustReturnCard('adapter-claim')}
                >
                  <div className="pro-cc-header">
                    <div className="pro-cc-title-group">
                      <span className="pro-cc-badge is-teal">เมนูย่อย 5 • รหัส 30066303</span>
                      <h3>เคลม Adapter Pos Nss</h3>
                    </div>
                    <button
                      type="button"
                      className="pro-cc-launch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('adapter-claim');
                      }}
                    >
                      <span>เปิดหน้าเต็ม</span>
                      <i className="fas fa-arrow-up-right-from-square"></i>
                    </button>
                  </div>

                  <div className="pro-cc-hero-row">
                    <div className="pro-cc-hero-stat">
                      <span>กำลังดำเนินการ</span>
                      <strong className="is-amber-text">{formatNumber(m?.processingQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>ยอดรวม Adapter</span>
                      <strong>{formatNumber(m?.totalQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>อัตราเคลมสำเร็จ</span>
                      <strong className="is-emerald-text">{m?.completionPct || 0}%</strong>
                    </div>
                  </div>

                  <div className="pro-cc-pipeline">
                    <div
                      className="pro-cc-pipe-step is-plant"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('adapter-claim', { status: 'คลังพื้นที่' });
                      }}
                    >
                      <span>คลังพื้นที่</span>
                      <strong>{formatNumber(sPlant)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-transit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('adapter-claim', { status: 'ระหว่างขนส่ง' });
                      }}
                    >
                      <span>ระหว่างขนส่ง</span>
                      <strong>{formatNumber(sTransit)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('adapter-claim', { status: 'รอส่งเคลม' });
                      }}
                    >
                      <span>รอส่งเคลม</span>
                      <strong>{formatNumber(sClaim)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-done"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('adapter-claim', { status: 'สำเร็จ' });
                      }}
                    >
                      <span>สำเร็จ/ส่งแล้ว</span>
                      <strong>{formatNumber(sDone)}</strong>
                    </div>
                  </div>

                  <div className="pro-cc-footer">
                    <span>
                      <i className="fas fa-plug-circle-check"></i> ใบงานทั้งหมด: <strong>{formatNumber(m?.workOrderCount || 0)} งาน</strong>
                    </span>
                    <span
                      className={`pro-cc-alert-tag ${m?.notReturnCount > 0 ? 'is-rose' : 'is-muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('adapter-claim', { notReturnOnly: true });
                      }}
                    >
                      ไม่คืนซาก: {formatNumber(m?.notReturnCount || 0)} งาน
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* SUBMENU 6: เก็บอะไหล่คืน True WiFi (view=truewifi, Access Point) */}
            {(() => {
              const m = custSubmenus?.truewifi;
              const st = m?.statusCounts || {};
              const sPlant = st['คลังพื้นที่'] || 0;
              const sTransit = st['ระหว่างขนส่ง'] || 0;
              const sCenter = st['คลังกลาง'] || 0;
              const sDone = (st['ส่งลูกค้าแล้ว'] || 0) + (st['สำเร็จ'] || 0) + (st['ส่งTSCแล้ว'] || 0);
              return (
                <div
                  className={`pro-cust-card is-truewifi${
                    activeCustReturnTab === 'truewifi' ? ' is-active-card' : ''
                  }`}
                  onClick={() => handleSelectCustReturnCard('truewifi')}
                >
                  <div className="pro-cc-header">
                    <div className="pro-cc-title-group">
                      <span className="pro-cc-badge is-cyan">เมนูย่อย 6 • Access Point (MAC)</span>
                      <h3>เก็บอะไหล่คืน True WiFi</h3>
                    </div>
                    <button
                      type="button"
                      className="pro-cc-launch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('truewifi');
                      }}
                    >
                      <span>เปิดหน้าเต็ม</span>
                      <i className="fas fa-arrow-up-right-from-square"></i>
                    </button>
                  </div>

                  <div className="pro-cc-hero-row">
                    <div className="pro-cc-hero-stat">
                      <span>กำลังดำเนินการ</span>
                      <strong className="is-amber-text">{formatNumber(m?.processingQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>ยอดรวม Access Point</span>
                      <strong>{formatNumber(m?.totalQty || 0)} <small>ชิ้น</small></strong>
                    </div>
                    <div className="pro-cc-hero-stat">
                      <span>จำนวนใบงาน</span>
                      <strong>{formatNumber(m?.workOrderCount || 0)} <small>งาน</small></strong>
                    </div>
                  </div>

                  <div className="pro-cc-pipeline">
                    <div
                      className="pro-cc-pipe-step is-plant"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('truewifi', { status: 'คลังพื้นที่' });
                      }}
                    >
                      <span>คลังพื้นที่</span>
                      <strong>{formatNumber(sPlant)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-transit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('truewifi', { status: 'ระหว่างขนส่ง' });
                      }}
                    >
                      <span>ระหว่างขนส่ง</span>
                      <strong>{formatNumber(sTransit)}</strong>
                    </div>
                    <div
                      className="pro-cc-pipe-step is-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCustReturnWithPreset('truewifi', { status: 'คลังกลาง' });
                      }}
                    >
                      <span>คลังกลาง</span>
                      <strong>{formatNumber(sCenter)}</strong>
                    </div>
                    <div className="pro-cc-pipe-step is-done">
                      <span>ส่งคืนแล้ว</span>
                      <strong>{formatNumber(sDone)}</strong>
                    </div>
                  </div>

                  {/* Top Access Point Models Strip */}
                  {(m?.descBreakdown || []).length > 0 && (
                    <div className="pro-cc-desc-pills">
                      {(m?.descBreakdown || []).slice(0, 4).map((d) => (
                        <span
                          key={d.desc}
                          className="pro-cc-desc-pill"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCustReturnWithPreset('truewifi', { descFilter: d.desc });
                          }}
                        >
                          {d.displayName}: <strong>{formatNumber(d.qty)}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pro-cc-footer">
                    <span>
                      <i className="fas fa-wifi"></i> รอบส่งล่าสุด: <strong>{m?.latestDeliveryDate || '-'}</strong>
                    </span>
                    {m?.errorMismatchCount > 0 && (
                      <span
                        className="pro-cc-alert-tag is-rose"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustReturnWithPreset('truewifi', { errorOnly: true });
                        }}
                      >
                        ⚠ MAC/Serial ผิด {m.errorMismatchCount} งาน
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ================================================================
              INTERACTIVE SUBMENU QUICK PREVIEW TABLE
              ================================================================ */}
          <div ref={custReturnTableRef} className="pro-abc-table-panel pro-cust-preview-panel">
            <div className="pro-abc-table-toolbar">
              <div className="pro-abc-tabs" role="tablist">
                {[
                  { key: 'tsc', label: '1. เก็บเครื่อง TSC', count: custSubmenus?.tsc?.totalQty || 0, tone: 'sky' },
                  {
                    key: 'tsc-store',
                    label: '2. TSC ร้านปิด/Renovate',
                    count: custSubmenus?.['tsc-store']?.totalBranches || 0,
                    unit: 'สาขา',
                    tone: 'emerald',
                  },
                  { key: 'bluetap', label: '3. เก็บเครื่อง Sunmi', count: custSubmenus?.bluetap?.totalQty || 0, tone: 'amber' },
                  {
                    key: 'bluetap-claim',
                    label: '4. เคลม Bluetap รุ่นใหม่',
                    count: custSubmenus?.['bluetap-claim']?.totalQty || 0,
                    tone: 'violet',
                  },
                  {
                    key: 'adapter-claim',
                    label: '5. เคลม Adapter Pos Nss',
                    count: custSubmenus?.['adapter-claim']?.totalQty || 0,
                    tone: 'cyan',
                  },
                  { key: 'truewifi', label: '6. เก็บคืน True WiFi', count: custSubmenus?.truewifi?.totalQty || 0, tone: 'rose' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`pro-abc-tab is-${tab.tone}${activeCustReturnTab === tab.key ? ' active' : ''}`}
                    onClick={() => {
                      setActiveCustReturnTab(tab.key);
                      setCustReturnSearch('');
                    }}
                  >
                    <span>{tab.label}</span>
                    <strong>
                      {formatNumber(tab.count)} {tab.unit || 'ชิ้น'}
                    </strong>
                  </button>
                ))}
              </div>

              <div className="pro-abc-toolbar-right">
                <div className="pro-abc-search-box">
                  <i className="fas fa-magnifying-glass"></i>
                  <input
                    type="text"
                    placeholder="ค้นหา WorkOrder, รหัสร้าน, ชื่อสาขา, Serial..."
                    value={custReturnSearch}
                    onChange={(e) => setCustReturnSearch(e.target.value)}
                  />
                  {custReturnSearch && (
                    <button
                      type="button"
                      className="pro-clear-search"
                      onClick={() => setCustReturnSearch('')}
                      aria-label="ล้างคำค้นหา"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="pro-open-app-btn is-cyan"
                  onClick={() =>
                    handleOpenCustReturnWithPreset(activeCustReturnTab, {
                      search: custReturnSearch,
                    })
                  }
                >
                  <span>ดูตารางเต็มในเมนูย่อย</span>
                  <i className="fas fa-arrow-up-right-from-square"></i>
                </button>
              </div>
            </div>

            <div className="pro-table-scroll">
              {activeCustReturnTab === 'tsc-store' ? (
                <table className="pro-data-table">
                  <thead>
                    <tr>
                      <th>สถานะ</th>
                      <th>รหัสสาขา</th>
                      <th>ชื่อสาขา</th>
                      <th>จังหวัด</th>
                      <th style={{ textAlign: 'right' }}>เครื่องทั้งหมด</th>
                      <th style={{ textAlign: 'right' }}>ส่งคืนแล้ว</th>
                      <th>ผู้ส่งคืน</th>
                      <th style={{ textAlign: 'right' }}>ผ่านมา (วัน)</th>
                      <th>สถานะร้าน</th>
                      <th>วันที่ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custReturnState.loading && !custSubmenus ? (
                      <tr>
                        <td colSpan={10} className="pro-table-empty">
                          กำลังโหลดข้อมูล TSC ร้านปิด / Renovate...
                        </td>
                      </tr>
                    ) : activeCustPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="pro-table-empty">
                          ไม่พบรายการสาขาที่ตรงกับเงื่อนไข
                        </td>
                      </tr>
                    ) : (
                      activeCustPreviewRows.map((row, idx) => (
                        <tr
                          key={`${row.StoreCode}-${idx}`}
                          onClick={() =>
                            handleOpenCustReturnWithPreset('tsc-store', { search: row.StoreCode })
                          }
                          title={`คลิกเพื่อเปิดสาขา ${row.StoreCode} ในหน้า TSC ร้านปิด`}
                        >
                          <td>
                            <span
                              className={`pro-cust-status-pill is-${
                                row.Status === 'ครบ'
                                  ? 'done'
                                  : row.Status === 'ไม่ครบ'
                                  ? 'warn'
                                  : row.Status === 'รอส่งคลัง'
                                  ? 'transit'
                                  : 'alert'
                              }`}
                            >
                              {row.Status}
                            </span>
                          </td>
                          <td className="pro-td-mono">{row.StoreCode}</td>
                          <td className="pro-td-desc">{row.StoreName}</td>
                          <td>{row.Province}</td>
                          <td style={{ textAlign: 'right' }} className="pro-num-strong">
                            {formatNumber(row.PosQty)}
                          </td>
                          <td style={{ textAlign: 'right' }} className="pro-num-accent">
                            {formatNumber(row.ReturnedQty)}
                          </td>
                          <td>{row.UserKeep}</td>
                          <td
                            style={{ textAlign: 'right' }}
                            className={row.AgingDays > 14 && row.Status !== 'ครบ' ? 'pro-num-danger' : ''}
                          >
                            {row.AgingDays} วัน
                          </td>
                          <td>{row.StoreRemark}</td>
                          <td>{row.DateCall}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="pro-data-table">
                  <thead>
                    <tr>
                      <th>สถานะ</th>
                      {activeCustReturnTab === 'bluetap-claim' && <th style={{ textAlign: 'center' }}>OrderChk</th>}
                      <th>วันที่รับ</th>
                      <th>WorkOrder</th>
                      <th>รหัสอะไหล่</th>
                      <th>รายการอะไหล่ (Description)</th>
                      <th style={{ textAlign: 'right' }}>จำนวน (Qty)</th>
                      <th>รหัสร้าน / ชื่อร้าน</th>
                      <th>คลังพื้นที่ (PlantCall)</th>
                      <th>การคืนซาก / Serial คืน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custReturnState.loading && !custSubmenus ? (
                      <tr>
                        <td colSpan={10} className="pro-table-empty">
                          กำลังโหลดข้อมูลรายการรับคืนลูกค้า...
                        </td>
                      </tr>
                    ) : activeCustPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="pro-table-empty">
                          ไม่มีรายการค้างในคลังนี้ (สามารถกดสลับปุ่ม &ldquo;ทั่วประเทศ&rdquo; ด้านบนเพื่อดูข้อมูลทุกคลัง)
                        </td>
                      </tr>
                    ) : (
                      activeCustPreviewRows.map((row, idx) => {
                        const isDone = row.Status === 'ส่งลูกค้าแล้ว' || row.Status === 'สำเร็จ';
                        const isNotReturn = String(row.ReturnStatus || '').includes('ไม่คืน');
                        return (
                          <tr
                            key={`${row.WorkOrder}-${row.SparePartCode}-${idx}`}
                            onClick={() =>
                              handleOpenCustReturnWithPreset(activeCustReturnTab, {
                                search: row.WorkOrder !== '-' ? row.WorkOrder : row.StoreCode,
                              })
                            }
                            title={`คลิกเพื่อเปิด WorkOrder ${row.WorkOrder} ในหน้าเต็ม`}
                          >
                            <td>
                              <span
                                className={`pro-cust-status-pill is-${
                                  isDone
                                    ? 'done'
                                    : row.Status === 'ระหว่างขนส่ง'
                                    ? 'transit'
                                    : row.Status.includes('รอ')
                                    ? 'alert'
                                    : 'plant'
                                }`}
                              >
                                {row.Status}
                              </span>
                            </td>
                            {activeCustReturnTab === 'bluetap-claim' && (
                              <td style={{ textAlign: 'center' }}>
                                {row.OrderChk === 'CheckOrder' ? (
                                  <span className="pro-alert-pill is-amber">⚠ CheckOrder</span>
                                ) : (
                                  <span className="pro-num-muted">-</span>
                                )}
                              </td>
                            )}
                            <td>{row.DateKeep}</td>
                            <td className="pro-td-mono">{row.WorkOrder}</td>
                            <td className="pro-td-mono">{row.SparePartCode}</td>
                            <td className="pro-td-desc">{row.SparePartName}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span className={row.hasSerialMismatch ? 'pro-alert-pill is-rose' : 'pro-num-strong'}>
                                {formatNumber(row.Qty)} {row.hasSerialMismatch ? '⚠' : ''}
                              </span>
                            </td>
                            <td className="pro-td-desc">
                              {row.StoreCode !== '-' ? `[${row.StoreCode}] ` : ''}
                              {row.StoreName}
                            </td>
                            <td>{row.PlantCall}</td>
                            <td>
                              {isNotReturn ? (
                                <span className="pro-alert-pill is-rose">{row.ReturnStatus}</span>
                              ) : (
                                <span className="pro-td-mono">{row.SerialKeep !== '-' ? row.SerialKeep : row.ReturnStatus}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
