/**
 * CONFIG.JS
 * Constants, API URLs, and Product Maps.
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbwCk5lfJTp2wJr-XdLy6Pi3Nx4mIJTNA5-fftxpiWqxRg0QPsDawpMWi59fcjeCMi8j/exec';
const SHEET_ID = '17P5h9MaiRrJpklQb7osAtvHdzrJ1xkqaf8T63kUkOeE';
const OPENSHEET_URL = `https://opensheet.elk.sh/${SHEET_ID}`;

// ฐานข้อมูลสต็อกคงเหลือ (Unrestricted Stock from SAP / Sheet1 via Opensheet)
const STOCK_SPREADSHEET_ID = '1gtZLR5Tm574o5xRbdrRm9yFzRukGx_UAzUnoah36cxQ';
const STOCK_SHEET_ID       = STOCK_SPREADSHEET_ID;
const STOCK_SHEET_NAME     = 'Sheet1';
const STOCK_OPENSHEET_URL  = `https://opensheet.elk.sh/${STOCK_SPREADSHEET_ID}/${STOCK_SHEET_NAME}`;

// Mapping Material ID สำหรับดึงค่า Unrestricted
const STOCK_MATERIAL_MAP = {
  'N2':  '30011061', // ถังไนโตรเจนพร้อมฝา 1.5 คิว (เฉพาะถัง)
  'O2L': '30011063', // ถังอ๊อกซิเจนพร้อมฝา 1.5 คิว (เฉพาะถัง)
  'O2S': '30014237'  // ถังอ๊อกซิเจนขนาดท่อ 0.5 คิว(เฉพาะถัง)
};

const PRODUCT_LABEL_MAP = {
  'N2':  'ไนโตรเจน 1.5 Q',
  'O2L': 'ออกซิเจน 1.5 Q',
  'O2S': 'ออกซิเจน 0.5 Q',
};

// วันที่เริ่มต้นที่แสดงในตารางไทม์ไลน์ (ซ่อนข้อมูลที่เก่ากว่าวันนี้เฉพาะการแสดงผล แต่ยังคำนวณยอดค้างสะสมจากประวัติทั้งหมด)
const MIN_DISPLAY_DATE = '2026-11-24';
