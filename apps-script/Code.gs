const SPREADSHEET_ID = "1cwSCry96yblNUtGgpo_LYVqyxyeh5bHv6RtblnCnab0";
const RSVP_SHEET_NAME = "RSVP";
const RSVP_HEADERS = ["Thời gian", "Tên", "Tham dự", "Số khách", "Lời nhắn"];
const WISHES_SHEET_NAME = "Lời chúc";
const WISHES_HEADERS = ["Thời gian", "Tên", "Lời chúc"];
const GUESTS_SHEET_NAME = "Khách mời";
const GUESTS_HEADERS = ["Mã mời", "Lời xưng hô", "Tên khách", "Link cá nhân"];
const WEDDING_WEBSITE_URL = "https://phanvu26.github.io/wedding/";
const STATS_SHEET_NAME = "Thống kê";
const STATS_HEADERS = ["Chỉ số", "Giá trị"];

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents);
    if (String(payload.website || "").trim()) return jsonResponse({ ok: true });

    const type = String(payload.type || "rsvp");
    if (type !== "rsvp" && type !== "wish") throw new Error("Loại biểu mẫu không hợp lệ.");
    if (SPREADSHEET_ID === "PASTE_SPREADSHEET_ID_HERE") throw new Error("Chưa cấu hình ID bảng tính.");

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (type === "wish") {
      const name = cleanText(payload.name, 80);
      const message = cleanText(payload.message, 500);
      if (name.length < 2) throw new Error("Tên không hợp lệ.");
      if (message.length < 5) throw new Error("Lời chúc quá ngắn.");

      const sheet = getOrCreateSheet(spreadsheet, WISHES_SHEET_NAME, WISHES_HEADERS);
      sheet.appendRow([new Date(), safeCell(name), safeCell(message)]);
      return jsonResponse({ ok: true });
    }

    const name = cleanText(payload.name, 80);
    const attendance = String(payload.attendance || "");
    const message = cleanText(payload.message, 400);
    const guestCount = Number(payload.guestCount);

    if (name.length < 2) throw new Error("Tên không hợp lệ.");
    if (attendance !== "yes" && attendance !== "no") throw new Error("Lựa chọn tham dự không hợp lệ.");
    if (attendance === "yes" && (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 4)) {
      throw new Error("Số khách không hợp lệ.");
    }
    const sheet = getOrCreateSheet(spreadsheet, RSVP_SHEET_NAME, RSVP_HEADERS);

    sheet.appendRow([
      new Date(),
      safeCell(name),
      attendance === "yes" ? "Sẽ tham dự" : "Không thể tham dự",
      attendance === "yes" ? guestCount : "",
      safeCell(message),
    ]);

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  }
}

function getOrCreateSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function cleanText(value, maxLength) {
  return String(value == null ? "" : value).trim().slice(0, maxLength);
}

function safeCell(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(event) {
  try {
    const action = String((event && event.parameter && event.parameter.action) || "");
    if (SPREADSHEET_ID === "PASTE_SPREADSHEET_ID_HERE") throw new Error("Chưa cấu hình ID bảng tính.");

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    getOrCreateSheet(spreadsheet, GUESTS_SHEET_NAME, GUESTS_HEADERS);
    if (action === "view") {
      return jsonResponse({ ok: true, views: incrementViewCount(spreadsheet) });
    }
    if (action === "guest") {
      return jsonResponse({ ok: true, guest: findGuest(spreadsheet, event.parameter.code) });
    }
    if (action !== "wishes") throw new Error("Yêu cầu không hợp lệ.");

    const sheet = spreadsheet.getSheetByName(WISHES_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ ok: true, wishes: [] });

    const lastRow = sheet.getLastRow();
    const firstRow = Math.max(2, lastRow - 39);
    const rows = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, 3).getValues();
    const wishes = rows
      .filter((row) => String(row[1] || "").trim() && String(row[2] || "").trim())
      .map((row) => ({
        name: String(row[1]).trim(),
        message: String(row[2]).trim(),
        createdAt: row[0] instanceof Date
          ? Utilities.formatDate(row[0], "Etc/UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'")
          : String(row[0] || ""),
      }));

    return jsonResponse({ ok: true, wishes: wishes });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error), wishes: [] });
  }
}

function setupGuestSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  getOrCreateSheet(spreadsheet, GUESTS_SHEET_NAME, GUESTS_HEADERS);
}

function createGuestInviteLinks() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(spreadsheet, GUESTS_SHEET_NAME, GUESTS_HEADERS);
  if (sheet.getLastRow() < 2) return;

  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4);
  const rows = range.getValues().map((row) => {
    const code = String(row[0] || "").trim() || Utilities.getUuid().replace(/-/g, "").slice(0, 12);
    return [code, row[1], row[2], `${WEDDING_WEBSITE_URL}?guest=${encodeURIComponent(code)}`];
  });
  range.setValues(rows);
}

function incrementViewCount(spreadsheet) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getOrCreateSheet(spreadsheet, STATS_SHEET_NAME, STATS_HEADERS);
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 2).getValues() : [];
    const rowIndex = rows.findIndex((row) => String(row[0]).trim() === "Lượt xem");
    if (rowIndex === -1) {
      sheet.appendRow(["Lượt xem", 1]);
      return 1;
    }

    const countCell = sheet.getRange(rowIndex + 2, 2);
    const views = (Number(countCell.getValue()) || 0) + 1;
    countCell.setValue(views);
    return views;
  } finally {
    lock.releaseLock();
  }
}

function findGuest(spreadsheet, code) {
  const guestCode = cleanText(code, 100);
  const sheet = spreadsheet.getSheetByName(GUESTS_SHEET_NAME);
  if (!guestCode || !sheet || sheet.getLastRow() < 2) return null;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getDisplayValues();
  const guest = rows.find((row) => row[0].trim() === guestCode);
  if (!guest) return null;

  return {
    salutation: guest[1].trim() || "TRÂN TRỌNG KÍNH MỜI",
    name: guest[2].trim() || "Quý Khách",
  };
}
