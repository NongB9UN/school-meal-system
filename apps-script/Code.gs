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

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  [SHEET_NAMES.KINDER, SHEET_NAMES.PRIMARY].forEach((sheetName) => {
    const sheet = ensureSheet_(ss, sheetName, HEADERS);
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

  const existingRow = findExistingRow_(sheet, row[0], level, row[5]);
  const action = existingRow ? 'update' : 'insert';

  if (existingRow) {
    sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  const savedRow = existingRow || sheet.getLastRow();
  logSheet.appendRow([
    ...row,
    Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
    action,
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, action, row: savedRow }))
    .setMimeType(ContentService.MimeType.JSON);
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

  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headerList.length)).getValues()[0];
  headerList.forEach((header, index) => {
    if (!existingHeaders[index]) sheet.getRange(1, index + 1).setValue(header);
  });
  return sheet;
}

function findExistingRow_(sheet, date, level, classroom) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !date || !level || !classroom) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    if (
      dateKey_(row[0]) === dateKey_(date) &&
      String(row[4]).trim() === String(level).trim() &&
      String(row[5]).trim() === String(classroom).trim()
    ) {
      return index + 2;
    }
  }
  return null;
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
  if (value instanceof Date) return thaiDate_(value);

  const text = String(value).trim();
  const thaiDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thaiDate) {
    return `${Number(thaiDate[1])}/${Number(thaiDate[2])}/${Number(thaiDate[3])}`;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (iso) {
    const year = Number(iso[1]);
    const normalizedYear = year > 2400 ? year - 543 : year;
    const suffix = iso[4] || 'T00:00:00.000Z';
    const parsed = new Date(`${normalizedYear}-${iso[2]}-${iso[3]}${suffix}`);
    if (!Number.isNaN(parsed.getTime())) return thaiDate_(parsed);
  }

  return text;
}

function thaiDate_(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'd/M/yyyy');
}

function thaiTime_(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'HH:mm');
}
