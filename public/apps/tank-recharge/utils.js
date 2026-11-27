/**
 * UTILS.JS
 * Utility functions for formatting, escaping, and general helpers.
 */

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escAttr(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]/g, c => '_' + c.charCodeAt(0) + '_');
}

function parseDateStr(str) {
  if (!str) return '';
  str = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const gvizMatch = str.match(/Date\((\d+),(\d+),(\d+)/);
  if (gvizMatch) {
    const y = gvizMatch[1];
    const m = String(Number(gvizMatch[2]) + 1).padStart(2, '0');
    const d = String(gvizMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Check for "M/D/YYYY H:mm:ss" (Google Sheets US datetime format from Opensheet)
  const usDateTimeMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{1,2}:\d{2}/);
  if (usDateTimeMatch) {
    let p1 = Number(usDateTimeMatch[1]);
    let p2 = Number(usDateTimeMatch[2]);
    const year = usDateTimeMatch[3];
    // US format is M/D/YYYY; if first part > 12, it must be D/M/YYYY
    let month = p1, day = p2;
    if (p1 > 12 && p2 <= 12) { day = p1; month = p2; }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  let datePart = str.split(',')[0].split(' ')[0].trim();
  let parts = datePart.split('/');
  if (parts.length === 3 && /^\d{4}$/.test(parts[2])) {
    let p1 = Number(parts[0]);
    let p2 = Number(parts[1]);
    let year = parts[2];
    // Default D/M/YYYY; if second part > 12, it must be M/D/YYYY
    let day = p1, month = p2;
    if (p2 > 12 && p1 <= 12) { month = p1; day = p2; }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return str;
}

function formatDisplayDate(str) {
  if (!str) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return str;
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function labelToKey(label) {
  for (const [k, v] of Object.entries(PRODUCT_LABEL_MAP)) {
    if (v === label) return k;
  }
  return null;
}

function badgeClass(p) {
  if (!p) return '';
  if (p.includes('ไนโตรเจน')) return 'badge-n2';
  if (p.includes('0.5'))       return 'badge-o2s';
  if (p.includes('ออกซิเจน')) return 'badge-o2';
  return '';
}

function fixGDriveUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();
  if (url.startsWith('data:image')) return url;
  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
  }
  return url;
}

function parseImageUrls(imageField) {
  if (!imageField) return [];
  if (Array.isArray(imageField)) {
    return imageField.map(u => fixGDriveUrl(String(u || ''))).filter(Boolean);
  }
  const str = String(imageField).trim();
  if (!str) return [];
  if (str.startsWith('data:image')) return [str];
  return str
    .split(',')
    .map(part => fixGDriveUrl(part.trim()))
    .filter(Boolean);
}
