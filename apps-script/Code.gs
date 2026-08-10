const SHEET_NAMES = {
  KINDER: 'อนุบาล',
  PRIMARY: 'ประถม',
  LOGS: 'Logs',
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

const LOG_HEADERS = [
  ...HEADERS,
  'เวลาบันทึกระบบ',
  'การทำงาน',
];

const APP_VERSION = '2026-08-10-upsert-room-date-v2';

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = { version: APP_VERSION };
  [SHEET_NAMES.KINDER, SHEET_NAMES.PRIMARY].forEach((sheetName) => {
    const sheet = ensureSheet_(ss, sheetName, HEADERS);
    result[sheetName] = readSheet_(sheet);
  });

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = parsePayload_(e);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const level = data.level || data['ระดับชั้น'] || SHEET_NAMES.KINDER;
    const sheetName = level === SHEET_NAMES.PRIMARY ? SHEET_NAMES.PRIMARY : SHEET_NAMES.KINDER;
    const sheet = ensureSheet_(ss, sheetName, HEADERS);
    const logSheet = ensureSheet_(ss, SHEET_NAMES.LOGS, LOG_HEADERS);
    const status = data.status || data['สถานะ'] || 'รับอาหาร';
    const isNoMeal = status === 'ไม่รับอาหาร';

    const row = [
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
    ];

    const existingRow = findExistingRow_(sheet, row[0], row[5]);
    const action = existingRow ? 'update' : 'insert';

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    const savedRow = existingRow || sheet.getLastRow();
    removeDuplicateRows_(sheet, row[0], row[5], savedRow);

    logSheet.appendRow([
      ...row,
      Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
      action,
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, action, row: savedRow, version: APP_VERSION }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function ensureSheet_(ss, sheetName, headers) {
  const headerList = headers || HEADERS;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const firstRow = sheet.getRange(1, 1, 1, headerList.length).getValues()[0];
  const needsHeader = firstRow.every((value) => value === '');
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headerList.length).setValues([headerList]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  sheet.getRange(1, 1, 1, headerList.length).setValues([headerList]);
  return sheet;
}

function findExistingRow_(sheet, date, classroom) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !date || !classroom) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    if (
      dateKey_(row[0]) === dateKey_(date) &&
      String(row[5]).trim() === String(classroom).trim()
    ) {
      return index + 2;
    }
  }
  return null;
}

function removeDuplicateRows_(sheet, date, classroom, keepRow) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !date || !classroom || !keepRow) return;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const rowNumber = index + 2;
    if (rowNumber === keepRow) continue;

    const row = values[index];
    const isSameRecord =
      dateKey_(row[0]) === dateKey_(date) &&
      String(row[5]).trim() === String(classroom).trim();

    if (isSameRecord) {
      sheet.deleteRow(rowNumber);
    }
  }
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

function dateKey_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Bangkok', 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  const thaiDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thaiDate) {
    const year = Number(thaiDate[3]);
    const normalizedYear = year > 2400 ? year - 543 : year;
    return [
      normalizedYear,
      String(Number(thaiDate[2])).padStart(2, '0'),
      String(Number(thaiDate[1])).padStart(2, '0'),
    ].join('-');
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (iso) {
    const year = Number(iso[1]);
    const normalizedYear = year > 2400 ? year - 543 : year;
    const suffix = iso[4] || 'T00:00:00.000Z';
    const parsed = new Date(`${normalizedYear}-${iso[2]}-${iso[3]}${suffix}`);
    if (!Number.isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, 'Asia/Bangkok', 'yyyy-MM-dd');
    }
  }

  return text;
}

function thaiDate_(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'd/M/yyyy');
}

function thaiTime_(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'HH:mm');
}
