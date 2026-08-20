var SHEETS = ["Users", "Gardens", "GardenMembers", "Agreements", "Sales", "Payments", "WalletTransactions", "Notifications", "AuditLogs", "Requests", "OcrRecords", "Files"];
var HEADERS = {
  Users: ["id","email","name","role","status","createdAt"],
  Gardens: ["id","ownerId","name","province","district","areaRai","treeCount","status","createdAt","updatedAt"],
  GardenMembers: ["id","gardenId","userId","role","status","createdAt"],
  Agreements: ["id","gardenId","ownerId","tapperId","version","ownerPercentage","tapperPercentage","effectiveFrom","effectiveTo","expenseRules","status","createdAt"],
  Sales: ["id","gardenId","agreementId","tapperId","saleDate","buyerName","productType","weightKg","unitPrice","grossSale","buyerDeductions","sharedExpenses","splitBase","ownerShare","tapperShare","status","receiptFileId","ocrConfidence","createdAt"],
  Payments: ["id","gardenId","saleId","fromUserId","toUserId","amount","method","reference","proofFileId","status","paidAt","createdAt"],
  WalletTransactions: ["id","gardenId","userId","type","amount","sourceType","sourceId","requestId","createdAt"],
  Notifications: ["id","userId","type","title","body","readAt","createdAt"],
  AuditLogs: ["id","actorId","entityType","entityId","action","beforeJson","afterJson","requestId","createdAt"],
  Requests: ["requestId","action","status","responseJson","createdAt"],
  OcrRecords: ["id","fileId","provider","status","confidence","rawJson","reviewedBy","createdAt"],
  Files: ["id","driveFileId","folderType","mimeType","name","ownerId","createdAt"]
};

var Repositories = {
  sheet_: function (name) { return SpreadsheetApp.openById(Config.spreadsheetId()).getSheetByName(name); },
  bootstrap: function () { var book = SpreadsheetApp.openById(Config.spreadsheetId()); SHEETS.forEach(function (name) { var sheet = book.getSheetByName(name) || book.insertSheet(name); if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS[name]); }); return { sheets: SHEETS }; },
  rows_: function (name) { var sheet = this.sheet_(name); var values = sheet.getDataRange().getValues(); var headers = values.shift() || []; return values.filter(function (row) { return row.some(function (cell) { return cell !== ""; }); }).map(function (row) { var item = {}; headers.forEach(function (header, index) { item[header] = row[index]; }); return item; }); },
  findUserByEmail: function (email) { return this.rows_("Users").filter(function (row) { return String(row.email).toLowerCase() === String(email).toLowerCase() && row.status !== "disabled"; })[0] || null; },
  gardensForUser: function (userId) { var gardens = this.rows_("Gardens"); var members = this.rows_("GardenMembers").filter(function (row) { return String(row.userId) === String(userId) && row.status === "active"; }); var ids = members.map(function (row) { return String(row.gardenId); }); return gardens.filter(function (garden) { return String(garden.ownerId) === String(userId) || ids.indexOf(String(garden.id)) >= 0; }); },
  append: function (name, values) { var sheet = this.sheet_(name); sheet.appendRow(HEADERS[name].map(function (key) { return values[key] === undefined ? "" : values[key]; })); }
};
