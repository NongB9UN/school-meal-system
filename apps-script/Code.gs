const SHEET_NAMES = {
  KINDER: 'อนุบาล',
  PRIMARY: 'ประถม',
};

const HEADERS = [
  'วันที่',
  'เวลา',
  'เทอม',
  'สัปดาห์ที่',
  'ระดับชั้น',
  'ห้อง',
  'จำนวนกิน',
  'รถ',
  'แพ้อาหาร',
  'ชื่อครู',
  'สถานะ',
  'หมายเหตุ',
];

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  Object.values(SHEET_NAMES).forEach((sheetName) => {
    const sheet = ensureSheet_(ss, sheetName);
    result[sheetName] = readSheet_(sheet);
  });

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = parsePayload_(e);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const level = data.level || data['ระดับชั้น'] || SHEET_NAMES.KINDER;
  const sheetName = level === SHEET_NAMES.PRIMARY ? SHEET_NAMES.PRIMARY : SHEET_NAMES.KINDER;
  const sheet = ensureSheet_(ss, sheetName);
  const status = data.status || data['สถานะ'] || 'รับอาหาร';
  const isNoMeal = status === 'ไม่รับอาหาร';

  sheet.appendRow([
    data.date || data['วันที่'] || thaiDate_(new Date()),
    data.time || data['เวลา'] || thaiTime_(new Date()),
    data.term || data['เทอม'] || '',
    data.week || data['สัปดาห์ที่'] || '',
    level,
    data.classroom || data['ห้อง'] || '',
    isNoMeal ? 0 : Number(data.total || data['จำนวนกิน'] || 0),
    isNoMeal ? '' : (data.truck || data['รถ'] || ''),
    isNoMeal ? '' : (data.allergies || data['แพ้อาหาร'] || ''),
    data.teacherName || data['ชื่อครู'] || '',
    status,
    data.note || data['หมายเหตุ'] || '',
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeader = firstRow.every((value) => value === '');
  if (needsHeader) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
  HEADERS.forEach((header, index) => {
    if (!existingHeaders[index]) sheet.getRange(1, index + 1).setValue(header);
  });
  return sheet;
}

function readSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  return values
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        if (header) item[header] = normalizeValue_(row[index]);
      });
      return item;
    });
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function normalizeValue_(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function thaiDate_(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'd/M/yyyy');
}

function thaiTime_(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'HH:mm');
}
