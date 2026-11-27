export const MENU_ITEMS = [
  {
    id: 'spareparts-request',
    type: 'none',
    title: 'ค้นหาอะไหล่',
    subtitle: 'Spare Parts Search & Request',
    color1: '#f59e0b',
    color2: '#ea580c',
    glow: 'rgba(245, 158, 11, 0.42)',
    tint: 'rgba(245, 158, 11, 0.16)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  },
  {
    id: 'abc-analysis',
    type: 'embedded',
    embedUrl: '/apps/abc-analysis/index.html',
    title: 'ABC Analasis',
    subtitle: 'Inventory Classification & Analytics',
    color1: '#8b5cf6',
    color2: '#6366f1',
    glow: 'rgba(139, 92, 246, 0.42)',
    tint: 'rgba(139, 92, 246, 0.16)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
  },
  {
    id: 'call-sparepart',
    type: 'internal',
    moduleId: 'call-sparepart',
    title: 'Call',
    subtitle: 'แจ้งเรียกอะไหล่ / Call Sparepart',
    color1: '#10b981',
    color2: '#059669',
    glow: 'rgba(16, 185, 129, 0.42)',
    tint: 'rgba(16, 185, 129, 0.16)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  },
  {
    id: 'dashboard-tsc',
    type: 'group',
    title: 'Customer Returns',
    subtitle: 'รายงานการเก็บเครื่องคืนลูกค้า (6 รายการ)',
    color1: '#06b6d4',
    color2: '#2563eb',
    glow: 'rgba(6, 182, 212, 0.42)',
    tint: 'rgba(6, 182, 212, 0.16)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`,
    children: [
      {
        id: 'dashboard-tsc-dummy',
        type: 'embedded',
        embedUrl: '/apps/dashboard-tsc/index.html?view=tsc',
        title: 'เก็บเครื่อง TSC คืนลูกค้า',
        subtitle: 'รายการอะไหล่รับคืน TSC Dummy',
        color1: '#3b82f6',
        color2: '#2563eb',
        glow: 'rgba(59, 130, 246, 0.42)',
        tint: 'rgba(59, 130, 246, 0.16)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
      },
      {
        id: 'dashboard-tsc-store',
        type: 'embedded',
        embedUrl: '/apps/dashboard-tsc/index.html?view=tsc-store',
        title: 'TSC ร้านปิด / ยกเลิก / Renovate',
        subtitle: 'คืนคลังสินค้าทั่วประเทศ',
        color1: '#10b981',
        color2: '#059669',
        glow: 'rgba(16, 185, 129, 0.42)',
        tint: 'rgba(16, 185, 129, 0.16)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`,
      },
      {
        id: 'dashboard-tsc-sunmi',
        type: 'embedded',
        embedUrl: '/apps/dashboard-tsc/index.html?view=bluetap',
        title: 'เก็บเครื่อง Sunmi คืนลูกค้า',
        subtitle: 'รายการอะไหล่รับคืน Bluetap',
        color1: '#f59e0b',
        color2: '#d97706',
        glow: 'rgba(245, 158, 11, 0.42)',
        tint: 'rgba(245, 158, 11, 0.16)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
      },
      {
        id: 'dashboard-tsc-bluetap-claim',
        type: 'embedded',
        embedUrl: '/apps/dashboard-tsc/index.html?view=bluetap-claim',
        title: 'เคลมเครื่อง Bluetap รุ่นใหม่',
        subtitle: 'ข้อมูลการส่งคืนและสถานะ',
        color1: '#8b5cf6',
        color2: '#6d28d9',
        glow: 'rgba(139, 92, 246, 0.42)',
        tint: 'rgba(139, 92, 246, 0.16)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
      },
      {
        id: 'dashboard-tsc-adapter-claim',
        type: 'embedded',
        embedUrl: '/apps/dashboard-tsc/index.html?view=adapter-claim',
        title: 'เคลม Adapter Pos Nss',
        subtitle: 'รายการอะไหล่รับคืน Adapter',
        color1: '#14b8a6',
        color2: '#0d9488',
        glow: 'rgba(20, 184, 166, 0.42)',
        tint: 'rgba(20, 184, 166, 0.16)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>`,
      },
      {
        id: 'dashboard-tsc-truewifi',
        type: 'embedded',
        embedUrl: '/apps/dashboard-tsc/index.html?view=truewifi',
        title: 'เก็บอะไหล่คืน True WiFi',
        subtitle: 'ข้อมูล Access Point และสถานะ',
        color1: '#06b6d4',
        color2: '#0284c7',
        glow: 'rgba(6, 182, 212, 0.42)',
        tint: 'rgba(6, 182, 212, 0.16)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>`,
      },
    ],
  },
  {
    id: 'barcode-nawanakorn',
    type: 'embedded',
    embedUrl: '/apps/barcode/index.html',
    title: 'Barcode',
    subtitle: 'สแกนและจัดการบาร์โค้ด',
    color1: '#ec4899',
    color2: '#a855f7',
    glow: 'rgba(236, 72, 153, 0.42)',
    tint: 'rgba(236, 72, 153, 0.16)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 7v10"/><path d="M12 7v10"/><path d="M16 7v10"/></svg>`,
  },
  {
    id: 'stockday',
    type: 'embedded',
    embedUrl: '/apps/stockday/index.html',
    title: 'StockDay',
    subtitle: 'ติดตามวันคงเหลือสต็อกสินค้า',
    color1: '#3b82f6',
    color2: '#1d4ed8',
    glow: 'rgba(59, 130, 246, 0.42)',
    tint: 'rgba(59, 130, 246, 0.16)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  },
  {
    id: 'tank-recharge',
    type: 'embedded',
    embedUrl: '/apps/tank-recharge/index.html',
    title: 'รับส่งถังบรรจุก๊าซ',
    subtitle: 'Gas Cylinder Recharge & Logistics',
    color1: '#f43f5e',
    color2: '#e11d48',
    glow: 'rgba(244, 63, 94, 0.42)',
    tint: 'rgba(244, 63, 94, 0.16)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  },
];

export const DEFAULT_HUB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>`;

export const USER_AVATAR_SVG = `
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
