/**
 * ParaWallet Google Apps Script Web App
 * Single-file deployment source.
 *
 * Required Script Properties:
 * SHEET_ID
 * DRIVE_ROOT_FOLDER_ID
 * GEMINI_API_KEY (optional)
 * GOOGLE_CLOUD_VISION_API_KEY (optional)
 * ALLOWED_ORIGINS (optional)
 * GOOGLE_OAUTH_CLIENT_ID (required for Google Sign-In)
 */

// =====================================================
// 0. ADMIN SETUP ENTRYPOINTS
// =====================================================
// Run setupParaWalletSheets() once from the Apps Script editor.
// The executing account must have Editor access to SHEET_ID.
function setupParaWalletSheets() {
  return Repositories.bootstrap();
}

// Run validateParaWalletSheets() to inspect schema without changing data.
function validateParaWalletSheets() {
  return Repositories.validateSchema();
}

// =====================================================
// 1. WEB APP ENTRYPOINTS, REQUEST ROUTER & RESPONSES
// =====================================================

function doGet(e) {
  return jsonResponse_(okResponse_("health-" + new Date().getTime(), healthCheck_()));
}

function doPost(e) {
  var request;
  try {
    request = parseRequest_(e);
    if (!request.requestId) return jsonResponse_(errorResponse_("REQUEST_ID_REQUIRED", "requestId is required", "unknown"));
    var cached = Idempotency.get(request.requestId);
    if (cached) return jsonResponse_(cached);
    var result = routeAction_(request);
    var response = okResponse_(request.requestId, result);
    Idempotency.put(request.requestId, response, request.action);
    return jsonResponse_(response);
  } catch (error) {
    return jsonResponse_(errorResponse_("API_ERROR", error && error.message ? error.message : String(error), request && request.requestId ? request.requestId : "unknown"));
  }
}

function parseRequest_(e) {
  var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  var parsed = JSON.parse(raw);
  return { action: String(parsed.action || ""), requestId: String(parsed.requestId || ""), payload: parsed.payload || {}, authToken: parsed.authToken || "" };
}

function routeAction_(request) {
  if (request.action === "health.get") return healthCheck_();
  if (request.action === "diagnostics.get") return diagnosticsCheck_();
  var user = Auth.requireUser(request.authToken);
  switch (request.action) {
    case "dashboard.get": return Services.dashboard(user);
    case "gardens.list": return Repositories.gardensForUser(user.id);
    case "gardens.create": return Services.createGarden(user, request.payload);
    case "gardens.update": return Services.updateGarden(user, request.payload);
    case "plots.list": return Services.listPlots(user, request.payload);
    case "plots.create": return Services.createPlot(user, request.payload);
    case "members.list": return Services.listMembers(user, request.payload);
    case "agreements.list": return Services.listAgreements(user, request.payload);
    case "agreements.create": return Services.createAgreement(user, request.payload);
    case "products.list": return Services.listProducts(user);
    case "buyers.list": return Services.listBuyers(user, request.payload);
    case "sales.create": return Services.createSale(user, request.payload);
    case "sales.list": return Services.listSales(user, request.payload);
    case "sales.duplicateCheck": return Services.duplicateCheck(user, request.payload);
    case "sales.confirm": return Services.confirmSale(user, request.payload);
    case "sales.dispute": return Services.disputeSale(user, request.payload);
    case "wallets.me": return Services.wallet(user, request.payload);
    case "settlements.list": return Services.listSettlements(user, request.payload);
    case "settlements.create": return Services.createSettlement(user, request.payload);
    case "settlements.confirm": return Services.confirmSettlement(user, request.payload);
    case "payments.create": return Services.createPayment(user, request.payload);
    case "payments.confirm": return Services.confirmPayment(user, request.payload);
    case "notifications.list": return Services.listNotifications(user);
    case "notifications.read": return Services.readNotification(user, request.payload);
    case "reports.summary": return Services.report(user, request.payload);
    case "receipts.extract": return Services.extractReceipt(user, request.payload);
    default: throw new Error("UNKNOWN_ACTION:" + request.action);
  }
}

function healthCheck_() { return { service: "parawallet-appsscript", status: "ok", timestamp: new Date().toISOString() }; }
function diagnosticsCheck_() {
  var result = { service: "parawallet-appsscript", status: "ok", timestamp: new Date().toISOString(), sheetIdConfigured: false, sheetAccessible: false, missingSheets: [], registeredUsers: 0 };
  try {
    result.sheetIdConfigured = Boolean(Config.get("SHEET_ID", false));
    if (!result.sheetIdConfigured) { result.status = "error"; result.error = "MISSING_SCRIPT_PROPERTY:SHEET_ID"; return result; }
    var book = SpreadsheetApp.openById(Config.spreadsheetId());
    result.sheetAccessible = Boolean(book && book.getId());
    result.missingSheets = SHEETS.filter(function (name) { return !book.getSheetByName(name); });
    var usersSheet = book.getSheetByName("Users");
    if (usersSheet && usersSheet.getLastRow() > 1) result.registeredUsers = usersSheet.getLastRow() - 1;
    if (result.missingSheets.length) { result.status = "warning"; result.error = "SHEETS_NOT_INITIALIZED"; }
  } catch (error) {
    result.status = "error";
    result.error = error && error.message ? error.message : String(error);
  }
  return result;
}
function okResponse_(requestId, data) { return { status: "ok", requestId: requestId, data: data }; }
function errorResponse_(code, message, requestId) { return { status: "error", requestId: requestId, error: { code: code, message: message } }; }
function jsonResponse_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }

// =====================================================
// 2. SCRIPT PROPERTIES & AUTHENTICATION BOUNDARY
// =====================================================

var Config = {
  get: function (key, required) {
    var value = PropertiesService.getScriptProperties().getProperty(key);
    if (required && !value) throw new Error("MISSING_SCRIPT_PROPERTY:" + key);
    return value || "";
  },
  spreadsheetId: function () { return this.get("SHEET_ID", true); },
  driveRootId: function () { return this.get("DRIVE_ROOT_FOLDER_ID", true); },
  geminiKey: function () { return this.get("GEMINI_API_KEY", false); },
  visionKey: function () { return this.get("GOOGLE_CLOUD_VISION_API_KEY", false); },
  allowedOrigins: function () { return this.get("ALLOWED_ORIGINS", false).split(",").filter(Boolean); },
  googleClientId: function () { return this.get("GOOGLE_OAUTH_CLIENT_ID", true); }
};

var Auth = {
  requireUser: function (token) {
    var claims = this.verifyGoogleIdToken_(token);
    var user = Repositories.findUserByEmail(claims.email);
    if (!user) throw new Error("USER_NOT_REGISTERED:" + claims.email);
    user.googleSubject = claims.sub;
    return user;
  },
  verifyGoogleIdToken_: function (token) {
    var raw = String(token || "").trim();
    if (!raw) throw new Error("AUTH_REQUIRED: sign in with Google first");
    var response = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(raw), { method: "get", muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error("INVALID_GOOGLE_ID_TOKEN");
    var claims;
    try { claims = JSON.parse(response.getContentText()); } catch (error) { throw new Error("INVALID_GOOGLE_ID_TOKEN"); }
    var issuerOk = claims.iss === "accounts.google.com" || claims.iss === "https://accounts.google.com";
    var audienceOk = claims.aud === Config.googleClientId();
    var expiresAt = Number(claims.exp || 0);
    var email = String(claims.email || "").trim().toLowerCase();
    if (!issuerOk || !audienceOk || !claims.sub || !email || String(claims.email_verified) !== "true" || expiresAt <= Math.floor(new Date().getTime() / 1000)) throw new Error("INVALID_GOOGLE_ID_TOKEN");
    return { sub: String(claims.sub), email: email };
  }
};

// =====================================================
// 3. LOCKSERVICE & REQUEST ID IDEMPOTENCY
// =====================================================

var Locking = {
  run: function (key, callback) {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error("TRANSACTION_BUSY:" + key);
    try { return callback(); } finally { lock.releaseLock(); }
  }
};

var Idempotency = {
  get: function (requestId) {
    var cache = CacheService.getScriptCache().get("request:" + requestId);
    if (cache) return JSON.parse(cache);
    try {
      var row = rows_("Requests").filter(function (item) { return id_(item.requestId) === id_(requestId); })[0];
      if (row && row.responseJson) return JSON.parse(row.responseJson);
    } catch (error) {
      // Requests may not exist before the administrator runs setupParaWalletSheets().
    }
    return null;
  },
  put: function (requestId, response, action) {
    var encoded = JSON.stringify(response);
    CacheService.getScriptCache().put("request:" + requestId, encoded, 21600);
    try {
      Locking.run("request:" + requestId, function () {
        var exists = rows_("Requests").some(function (item) { return id_(item.requestId) === id_(requestId); });
        if (!exists) Repositories.append("Requests", { requestId: requestId, action: action || "", status: response.status, responseJson: encoded, createdAt: nowIso_() });
      });
    } catch (error) {
      // Cache remains available when setup has not yet created the Requests tab.
    }
  }
};

// =====================================================
// 4. GOOGLE SHEETS SCHEMA & REPOSITORIES
// =====================================================

var SHEETS = ["Users", "Gardens", "Plots", "GardenMembers", "Agreements", "ProductTypes", "Buyers", "Receipts", "Sales", "SaleDeductions", "Payments", "WalletTransactions", "WalletEntries", "Settlements", "SettlementAllocations", "Disputes", "Adjustments", "Notifications", "AuditLogs", "Requests", "OcrRecords", "Files"];
var HEADERS = {
  Users: ["id","email","name","role","status","createdAt"],
  Gardens: ["id","ownerId","name","locationText","province","district","areaRai","treeCount","status","createdAt","updatedAt"],
  Plots: ["id","gardenId","name","notes","status","createdAt","updatedAt"],
  GardenMembers: ["id","gardenId","userId","role","status","createdAt"],
  Agreements: ["id","gardenId","ownerId","tapperId","version","ownerPercentage","tapperPercentage","sharedExpenseRulesJson","ownerExpenseRulesJson","tapperExpenseRulesJson","advanceRuleJson","effectiveFrom","effectiveTo","expenseRules","status","createdAt"],
  ProductTypes: ["id","name","unit","calculationType","configJson","active","createdAt"],
  Buyers: ["id","name","branch","contact","notes","status","createdAt"],
  Receipts: ["id","fileId","fileUrl","imageHash","ocrRawJson","ocrConfidenceJson","createdBy","manualNetAmount","createdAt"],
  Sales: ["id","gardenId","plotId","agreementId","tapperId","receiptId","buyerId","saleDate","ticketNumber","productTypeId","buyerName","productType","grossWeight","tareWeight","netWeight","drc","weightKg","unitPrice","pricePerUnit","grossSale","buyerDeductions","sharedExpenses","splitBase","ownerShare","tapperShare","netReceived","status","manualEntry","receiptFileId","ocrConfidence","createdAt","updatedAt"],
  SaleDeductions: ["id","saleId","deductionType","description","amount","responsibility","createdAt"],
  Payments: ["id","gardenId","saleId","fromUserId","toUserId","amount","method","reference","proofFileId","status","paidAt","createdAt"],
  WalletTransactions: ["id","gardenId","userId","type","amount","sourceType","sourceId","requestId","createdAt"],
  WalletEntries: ["id","walletOwnerUserId","saleId","settlementId","entryType","direction","amount","status","createdAt"],
  Settlements: ["id","gardenId","tapperId","ownerId","method","amount","transferDate","bank","referenceNo","slipFileId","location","note","status","createdAt"],
  SettlementAllocations: ["id","settlementId","saleId","amount","createdAt"],
  Disputes: ["id","saleId","openedBy","reason","note","evidenceFileId","status","resolvedAt","createdAt"],
  Adjustments: ["id","saleId","userId","adjustmentType","amount","reason","status","createdAt"],
  Notifications: ["id","userId","type","title","body","readAt","createdAt"],
  AuditLogs: ["id","actorId","entityType","entityId","action","beforeJson","afterJson","requestId","createdAt"],
  Requests: ["requestId","action","status","responseJson","createdAt"],
  OcrRecords: ["id","fileId","provider","status","confidence","rawJson","reviewedBy","createdAt"],
  Files: ["id","driveFileId","folderType","mimeType","name","ownerId","createdAt"]
};

var Repositories = {
  sheet_: function (name) { return SpreadsheetApp.openById(Config.spreadsheetId()).getSheetByName(name); },
  bootstrap: function () {
    var book = SpreadsheetApp.openById(Config.spreadsheetId());
    var created = [];
    var initialized = [];
    var validated = [];
    SHEETS.forEach(function (name) {
      var sheet = book.getSheetByName(name);
      if (!sheet) {
        sheet = book.insertSheet(name);
        created.push(name);
      }
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
        sheet.setFrozenRows(1);
        initialized.push(name);
      } else {
        assertHeaders_(sheet, name);
        validated.push(name);
      }
    });
    return { sheets: SHEETS, created: created, initialized: initialized, validated: validated };
  },
  validateSchema: function () {
    var book = SpreadsheetApp.openById(Config.spreadsheetId());
    return SHEETS.map(function (name) {
      var sheet = book.getSheetByName(name);
      if (!sheet) return { name: name, status: "missing", expected: HEADERS[name] };
      if (sheet.getLastRow() === 0) return { name: name, status: "empty", expected: HEADERS[name] };
      var actual = readHeaders_(sheet);
      return { name: name, status: headersEqual_(actual, HEADERS[name]) ? "ok" : "mismatch", expected: HEADERS[name], actual: actual };
    });
  },
  rows_: function (name) {
    var sheet = this.sheet_(name);
    var values = sheet.getDataRange().getValues();
    var headers = values.shift() || [];
    return values.filter(function (row) { return row.some(function (cell) { return cell !== ""; }); }).map(function (row) {
      var item = {};
      headers.forEach(function (header, index) { item[header] = row[index]; });
      return item;
    });
  },
  findUserByEmail: function (email) {
    return this.rows_("Users").filter(function (row) { return String(row.email).toLowerCase() === String(email).toLowerCase() && row.status !== "disabled"; })[0] || null;
  },
  gardensForUser: function (userId) {
    var gardens = this.rows_("Gardens");
    var members = this.rows_("GardenMembers").filter(function (row) { return String(row.userId) === String(userId) && row.status === "active"; });
    var ids = members.map(function (row) { return String(row.gardenId); });
    return gardens.filter(function (garden) { return String(garden.ownerId) === String(userId) || ids.indexOf(String(garden.id)) >= 0; });
  },
  append: function (name, values) {
    var sheet = this.sheet_(name);
    sheet.appendRow(HEADERS[name].map(function (key) { return values[key] === undefined ? "" : values[key]; }));
  }
};

// =====================================================
// 5. SERVER-SIDE DUAL WALLET CALCULATOR
// =====================================================

var Calculator = {
  sale: function (input) {
    var gross = round_(Number(input.weightKg) * Number(input.unitPrice));
    var deductions = round_(Number(input.buyerDeductions || 0) + Number(input.sharedExpenses || 0));
    var splitBase = round_(gross - deductions);
    if (splitBase < 0) throw new Error("SPLIT_BASE_NEGATIVE");
    var ownerPct = Number(input.ownerPercentage);
    var tapperPct = Number(input.tapperPercentage);
    if (round_(ownerPct + tapperPct) !== 100) throw new Error("PERCENTAGES_MUST_SUM_TO_100");
    var ownerShare = round_(splitBase * ownerPct / 100);
    return { grossSale: gross, deductions: deductions, splitBase: splitBase, ownerShare: ownerShare, tapperShare: round_(splitBase - ownerShare), ownerPercentage: ownerPct, tapperPercentage: tapperPct };
  }
};
function round_(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function readHeaders_(sheet) { return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (value) { return String(value); }); }
function headersEqual_(actual, expected) { return actual.length === expected.length && expected.every(function (header, index) { return actual[index] === header; }); }
function assertHeaders_(sheet, name) { var actual = readHeaders_(sheet); if (!headersEqual_(actual, HEADERS[name])) throw new Error("SCHEMA_MISMATCH:" + name + ": expected [" + HEADERS[name].join(",") + "] but found [" + actual.join(",") + "]"); }

// =====================================================
// 6. GOOGLE DRIVE STORAGE & OCR ADAPTERS
// =====================================================

var DriveStorage = {
  save: function (base64, mimeType, filename, folderType, ownerId) {
    var root = DriveApp.getFolderById(Config.driveRootId());
    var folders = root.getFoldersByName(folderType);
    var folder = folders.hasNext() ? folders.next() : root.createFolder(folderType);
    var bytes = Utilities.base64Decode(String(base64).split(",").pop());
    var file = folder.createFile(Utilities.newBlob(bytes, mimeType || "application/octet-stream", filename || "evidence"));
    Repositories.append("Files", { id: Utilities.getUuid(), driveFileId: file.getId(), folderType: folderType, mimeType: mimeType, name: file.getName(), ownerId: ownerId, createdAt: new Date().toISOString() });
    return { fileId: file.getId(), name: file.getName() };
  }
};

var OCR = {
  extract: function (fileBase64, mimeType) {
    var prompt = "Extract rubber sale receipt fields as JSON: saleDate, buyerName, productType, weightKg, unitPrice, grossSale, buyerDeductions. Return only JSON.";
    if (Config.geminiKey()) return this.gemini_(fileBase64, mimeType, prompt);
    if (Config.visionKey()) return this.vision_(fileBase64, mimeType);
    return { provider: "none", confidence: 0, needsReview: true, fields: {} };
  },
  gemini_: function (base64, mimeType, prompt) {
    var response = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(Config.geminiKey()), { method: "post", contentType: "application/json", payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }] }), muteHttpExceptions: true });
    var body = JSON.parse(response.getContentText());
    var text = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text || "{}";
    return { provider: "gemini", confidence: 0.75, needsReview: true, fields: JSON.parse(text.replace(/```json|```/g, "").trim()) };
  },
  vision_: function (base64, mimeType) {
    var response = UrlFetchApp.fetch("https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(Config.visionKey()), { method: "post", contentType: "application/json", payload: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }), muteHttpExceptions: true });
    return { provider: "vision", confidence: 0.55, needsReview: true, fields: { rawText: JSON.parse(response.getContentText()) } };
  }
};

// =====================================================
// 7. DOMAIN SERVICES
// =====================================================

var Services = {
  dashboard: function (user) {
    var gardens = Repositories.gardensForUser(user.id);
    return { role: user.role, garden: gardens[0] || null, wallet: { owner: 0, tapper: 0, outstanding: 0, currency: "THB" }, pendingReviews: 0, monthlySales: 0 };
  },
  createSale: function (user, payload) {
    return Locking.run("sale:" + payload.gardenId, function () {
      var calc = Calculator.sale(payload);
      var id = Utilities.getUuid();
      Repositories.append("Sales", { id: id, gardenId: payload.gardenId, agreementId: payload.agreementId, tapperId: user.id, saleDate: payload.saleDate, buyerName: payload.buyerName, productType: payload.productType, weightKg: payload.weightKg, unitPrice: payload.unitPrice, grossSale: calc.grossSale, buyerDeductions: payload.buyerDeductions || 0, sharedExpenses: payload.sharedExpenses || 0, splitBase: calc.splitBase, ownerShare: calc.ownerShare, tapperShare: calc.tapperShare, status: "pending_owner_review", createdAt: new Date().toISOString() });
      return { id: id, calculation: calc, status: "pending_owner_review" };
    });
  },
  createPayment: function (user, payload) {
    return Locking.run("payment:" + payload.gardenId, function () {
      var id = Utilities.getUuid();
      Repositories.append("Payments", { id: id, gardenId: payload.gardenId, saleId: payload.saleId, fromUserId: user.id, toUserId: payload.toUserId, amount: payload.amount, method: payload.method, reference: payload.reference, status: "pending", paidAt: payload.paidAt, createdAt: new Date().toISOString() });
      return { id: id, status: "pending" };
    });
  },
  confirmPayment: function (user, payload) {
    return Locking.run("payment-confirm:" + payload.id, function () {
      Repositories.append("AuditLogs", { id: Utilities.getUuid(), actorId: user.id, entityType: "payment", entityId: payload.id, action: "confirm", requestId: payload.requestId, createdAt: new Date().toISOString() });
      return { success: true };
    });
  },
  extractReceipt: function (user, payload) {
    var file = DriveStorage.save(payload.data, payload.mimeType, payload.filename, "receipts", user.id);
    var result = OCR.extract(payload.data, payload.mimeType);
    Repositories.append("OcrRecords", { id: Utilities.getUuid(), fileId: file.fileId, provider: result.provider, status: result.needsReview ? "needs_review" : "ready", confidence: result.confidence, rawJson: JSON.stringify(result.fields), createdAt: new Date().toISOString() });
    return { file: file, ocr: result };
  }
};


// =====================================================
// 8. PRD WORKFLOW SERVICES
// =====================================================

function nowIso_() { return new Date().toISOString(); }
function jsonOrEmpty_(value) { return value ? JSON.stringify(value) : ""; }
function parseJson_(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch (error) { return fallback; } }
function rows_(name) { return Repositories.rows_(name); }
function id_(value) { return String(value || ""); }
function findById_(name, value) { return rows_(name).filter(function (row) { return id_(row.id) === id_(value); })[0] || null; }
function requireGarden_(user, gardenId) {
  var garden = findById_("Gardens", gardenId);
  if (!garden) throw new Error("GARDEN_NOT_FOUND");
  var isOwner = id_(garden.ownerId) === id_(user.id);
  var member = rows_("GardenMembers").filter(function (row) { return id_(row.gardenId) === id_(gardenId) && id_(row.userId) === id_(user.id) && row.status === "active"; })[0];
  if (!isOwner && !member) throw new Error("GARDEN_ACCESS_DENIED");
  return { garden: garden, isOwner: isOwner, member: member || null };
}
function requireOwner_(user, gardenId) { var access = requireGarden_(user, gardenId); if (!access.isOwner && user.role !== "admin") throw new Error("OWNER_PERMISSION_REQUIRED"); return access; }
function requireTapper_(user, gardenId) { var access = requireGarden_(user, gardenId); if (access.isOwner || (access.member && access.member.role !== "tapper")) throw new Error("TAPPER_PERMISSION_REQUIRED"); return access; }
function writeAudit_(actor, action, entityType, entityId, beforeValue, afterValue, requestId) {
  Repositories.append("AuditLogs", { id: Utilities.getUuid(), actorId: actor.id, entityType: entityType, entityId: entityId, action: action, beforeJson: jsonOrEmpty_(beforeValue), afterJson: jsonOrEmpty_(afterValue), requestId: requestId || "", createdAt: nowIso_() });
}
function notifyUser_(userId, type, title, body) {
  if (!userId) return;
  Repositories.append("Notifications", { id: Utilities.getUuid(), userId: userId, type: type, title: title, body: body, readAt: "", createdAt: nowIso_() });
}
function updateRowById_(name, recordId, patch) {
  var sheet = Repositories.sheet_(name);
  var values = sheet.getDataRange().getValues();
  var headers = values.shift() || [];
  var idIndex = headers.indexOf("id");
  if (idIndex < 0) throw new Error("ID_COLUMN_MISSING:" + name);
  for (var i = 0; i < values.length; i++) {
    if (id_(values[i][idIndex]) === id_(recordId)) {
      Object.keys(patch).forEach(function (key) { var index = headers.indexOf(key); if (index >= 0) values[i][index] = patch[key]; });
      sheet.getRange(i + 2, 1, 1, headers.length).setValues([values[i]]);
      return true;
    }
  }
  return false;
}
function filterByDate_(items, from, to, dateKey) {
  var start = from ? new Date(from).getTime() : -Infinity;
  var end = to ? new Date(to).getTime() + 86400000 - 1 : Infinity;
  return items.filter(function (item) { var time = new Date(item[dateKey] || item.createdAt).getTime(); return isNaN(time) || (time >= start && time <= end); });
}
function numeric_(value) { var number = Number(value); return isNaN(number) ? 0 : number; }

Services.createGarden = function (user, payload) {
  if (user.role !== "owner" && user.role !== "admin") throw new Error("OWNER_PERMISSION_REQUIRED");
  return Locking.run("garden:create:" + user.id, function () {
    var gardenId = Utilities.getUuid();
    Repositories.append("Gardens", { id: gardenId, ownerId: user.id, name: payload.name, locationText: payload.locationText || "", province: payload.province || "", district: payload.district || "", areaRai: payload.areaRai || 0, treeCount: payload.treeCount || 0, status: "active", createdAt: nowIso_(), updatedAt: nowIso_() });
    Repositories.append("GardenMembers", { id: Utilities.getUuid(), gardenId: gardenId, userId: user.id, role: "owner", status: "active", createdAt: nowIso_() });
    writeAudit_(user, "garden_created", "garden", gardenId, null, payload, payload.requestId);
    return findById_("Gardens", gardenId);
  });
};

Services.updateGarden = function (user, payload) {
  requireOwner_(user, payload.gardenId);
  var before = findById_("Gardens", payload.gardenId);
  if (!before) throw new Error("GARDEN_NOT_FOUND");
  var patch = { name: payload.name, locationText: payload.locationText, province: payload.province, district: payload.district, areaRai: payload.areaRai, treeCount: payload.treeCount, status: payload.status, updatedAt: nowIso_() };
  updateRowById_("Gardens", payload.gardenId, patch);
  writeAudit_(user, "garden_updated", "garden", payload.gardenId, before, patch, payload.requestId);
  return findById_("Gardens", payload.gardenId);
};

Services.listPlots = function (user, payload) { requireGarden_(user, payload.gardenId); return rows_("Plots").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId) && row.status !== "archived"; }); };
Services.createPlot = function (user, payload) {
  requireOwner_(user, payload.gardenId);
  var plotId = Utilities.getUuid();
  Repositories.append("Plots", { id: plotId, gardenId: payload.gardenId, name: payload.name, notes: payload.notes || "", status: "active", createdAt: nowIso_(), updatedAt: nowIso_() });
  return findById_("Plots", plotId);
};
Services.listMembers = function (user, payload) { requireGarden_(user, payload.gardenId); return rows_("GardenMembers").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId) && row.status === "active"; }); };

Services.listAgreements = function (user, payload) { requireGarden_(user, payload.gardenId); return rows_("Agreements").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId); }).sort(function (a, b) { return numeric_(b.version) - numeric_(a.version); }); };
Services.createAgreement = function (user, payload) {
  requireOwner_(user, payload.gardenId);
  var existing = Services.listAgreements(user, payload);
  var ownerPercentage = numeric_(payload.ownerPercentage);
  var tapperPercentage = numeric_(payload.tapperPercentage);
  if (round_(ownerPercentage + tapperPercentage) !== 100) throw new Error("PERCENTAGES_MUST_SUM_TO_100");
  var agreementId = Utilities.getUuid();
  var version = existing.length ? numeric_(existing[0].version) + 1 : 1;
  Repositories.append("Agreements", { id: agreementId, gardenId: payload.gardenId, ownerId: user.id, tapperId: payload.tapperId, version: version, ownerPercentage: ownerPercentage, tapperPercentage: tapperPercentage, sharedExpenseRulesJson: jsonOrEmpty_(payload.sharedExpenseRules), ownerExpenseRulesJson: jsonOrEmpty_(payload.ownerExpenseRules), tapperExpenseRulesJson: jsonOrEmpty_(payload.tapperExpenseRules), advanceRuleJson: jsonOrEmpty_(payload.advanceRule), effectiveFrom: payload.effectiveFrom, effectiveTo: payload.effectiveTo || "", expenseRules: jsonOrEmpty_(payload.expenseRules), status: "active", createdAt: nowIso_() });
  writeAudit_(user, "agreement_created", "agreement", agreementId, null, payload, payload.requestId);
  if (payload.tapperId) notifyUser_(payload.tapperId, "agreement_created", "มีข้อตกลงใหม่", "เจ้าของสวนสร้างข้อตกลงเวอร์ชัน " + version);
  return findById_("Agreements", agreementId);
};
Services.listProducts = function () { return rows_("ProductTypes").filter(function (row) { return row.active !== false && row.active !== "false"; }); };
Services.listBuyers = function (user, payload) { requireGarden_(user, payload.gardenId); return rows_("Buyers").filter(function (row) { return row.status !== "archived"; }); };

function activeAgreement_(gardenId, agreementId) {
  var agreement = agreementId ? findById_("Agreements", agreementId) : rows_("Agreements").filter(function (row) { return id_(row.gardenId) === id_(gardenId) && row.status === "active"; }).sort(function (a, b) { return numeric_(b.version) - numeric_(a.version); })[0];
  if (!agreement) throw new Error("AGREEMENT_NOT_FOUND");
  if (id_(agreement.gardenId) !== id_(gardenId)) throw new Error("AGREEMENT_GARDEN_MISMATCH");
  return agreement;
}

Services.createSale = function (user, payload) {
  requireTapper_(user, payload.gardenId);
  return Locking.run("sale:" + payload.gardenId, function () {
    var agreement = activeAgreement_(payload.gardenId, payload.agreementId);
    var weight = payload.netWeight || payload.weightKg || 0;
    var gross = payload.grossSale !== undefined ? numeric_(payload.grossSale) : numeric_(weight) * numeric_(payload.pricePerUnit || payload.unitPrice);
    var calc = Calculator.sale({ weightKg: weight, unitPrice: payload.pricePerUnit || payload.unitPrice, buyerDeductions: payload.buyerDeductions, sharedExpenses: payload.sharedExpenses, ownerPercentage: agreement.ownerPercentage, tapperPercentage: agreement.tapperPercentage });
    if (payload.netReceived !== undefined && numeric_(payload.netReceived) !== calc.splitBase) throw new Error("NET_RECEIVED_MISMATCH");
    var saleId = Utilities.getUuid();
    Repositories.append("Sales", { id: saleId, gardenId: payload.gardenId, plotId: payload.plotId || "", agreementId: agreement.id, tapperId: user.id, receiptId: payload.receiptId || "", buyerId: payload.buyerId || "", saleDate: payload.saleDate, ticketNumber: payload.ticketNumber || "", productTypeId: payload.productTypeId || "", buyerName: payload.buyerName || "", productType: payload.productType || "", grossWeight: payload.grossWeight || weight, tareWeight: payload.tareWeight || 0, netWeight: weight, drc: payload.drc || "", weightKg: weight, unitPrice: payload.unitPrice || payload.pricePerUnit, pricePerUnit: payload.pricePerUnit || payload.unitPrice, grossSale: gross || calc.grossSale, buyerDeductions: payload.buyerDeductions || 0, sharedExpenses: payload.sharedExpenses || 0, splitBase: calc.splitBase, ownerShare: calc.ownerShare, tapperShare: calc.tapperShare, netReceived: payload.netReceived || calc.splitBase, status: "pending_owner_review", manualEntry: payload.manualEntry === true, receiptFileId: payload.receiptFileId || "", ocrConfidence: payload.ocrConfidence || "", createdAt: nowIso_(), updatedAt: nowIso_() });
    Repositories.append("WalletEntries", { id: Utilities.getUuid(), walletOwnerUserId: agreement.ownerId, saleId: saleId, settlementId: "", entryType: "sale_entitlement", direction: "credit", amount: calc.ownerShare, status: "pending", createdAt: nowIso_() });
    Repositories.append("WalletEntries", { id: Utilities.getUuid(), walletOwnerUserId: user.id, saleId: saleId, settlementId: "", entryType: "tapper_income", direction: "credit", amount: calc.tapperShare, status: "pending", createdAt: nowIso_() });
    notifyUser_(agreement.ownerId, "sale_pending_review", "มีรายการขายใหม่รอตรวจ", "รายการขาย " + saleId + " รอการยืนยัน");
    writeAudit_(user, "sale_created", "sale", saleId, null, { payload: payload, agreementSnapshot: agreement, calculation: calc }, payload.requestId);
    return { id: saleId, agreementSnapshot: agreement, calculation: calc, status: "pending_owner_review" };
  });
};

Services.listSales = function (user, payload) {
  requireGarden_(user, payload.gardenId);
  var sales = rows_("Sales").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId); });
  sales = filterByDate_(sales, payload.from, payload.to, "saleDate");
  if (payload.status) sales = sales.filter(function (row) { return row.status === payload.status; });
  if (payload.productTypeId) sales = sales.filter(function (row) { return id_(row.productTypeId) === id_(payload.productTypeId); });
  sales.sort(function (a, b) { return new Date(b.saleDate || b.createdAt).getTime() - new Date(a.saleDate || a.createdAt).getTime(); });
  return sales;
};

Services.duplicateCheck = function (user, payload) {
  requireGarden_(user, payload.gardenId);
  var targetDate = payload.saleDate ? new Date(payload.saleDate).getTime() : NaN;
  var amount = numeric_(payload.grossSale || payload.netReceived);
  var weight = numeric_(payload.netWeight || payload.weightKg);
  var matches = rows_("Sales").filter(function (row) {
    if (id_(row.gardenId) !== id_(payload.gardenId)) return false;
    var sameDate = targetDate && new Date(row.saleDate).getTime() === targetDate;
    var sameBuyer = payload.buyerName && String(row.buyerName || "").trim().toLowerCase() === String(payload.buyerName).trim().toLowerCase();
    var sameAmount = amount > 0 && Math.abs(numeric_(row.grossSale) - amount) < 0.01;
    var sameWeight = weight > 0 && Math.abs(numeric_(row.netWeight || row.weightKg) - weight) < 0.01;
    var sameTicket = payload.ticketNumber && id_(row.ticketNumber) === id_(payload.ticketNumber);
    return sameTicket || (sameDate && sameBuyer && (sameAmount || sameWeight));
  });
  return { possibleDuplicate: matches.length > 0, matches: matches.slice(0, 5) };
};

Services.confirmSale = function (user, payload) {
  var sale = findById_("Sales", payload.saleId);
  if (!sale) throw new Error("SALE_NOT_FOUND");
  requireOwner_(user, sale.gardenId);
  if (sale.status !== "pending_owner_review" && sale.status !== "ocr_review") throw new Error("SALE_NOT_REVIEWABLE");
  if (numeric_(sale.grossSale) < numeric_(sale.buyerDeductions) + numeric_(sale.sharedExpenses) + numeric_(sale.ownerShare) + numeric_(sale.tapperShare)) throw new Error("LEDGER_IMBALANCE");
  updateRowById_("Sales", sale.id, { status: "confirmed", updatedAt: nowIso_() });
  rows_("WalletEntries").filter(function (row) { return id_(row.saleId) === id_(sale.id); }).forEach(function (entry) { updateRowById_("WalletEntries", entry.id, { status: "confirmed" }); });
  writeAudit_(user, "sale_confirmed", "sale", sale.id, sale, { status: "confirmed" }, payload.requestId);
  notifyUser_(sale.tapperId, "sale_confirmed", "เจ้าของยืนยันรายการขาย", "รายการขาย " + sale.id + " ได้รับการยืนยันแล้ว");
  return findById_("Sales", sale.id);
};

Services.disputeSale = function (user, payload) {
  var sale = findById_("Sales", payload.saleId);
  if (!sale) throw new Error("SALE_NOT_FOUND");
  requireGarden_(user, sale.gardenId);
  if (!payload.reason) throw new Error("DISPUTE_REASON_REQUIRED");
  var disputeId = Utilities.getUuid();
  Repositories.append("Disputes", { id: disputeId, saleId: sale.id, openedBy: user.id, reason: payload.reason, note: payload.note || "", evidenceFileId: payload.evidenceFileId || "", status: "open", resolvedAt: "", createdAt: nowIso_() });
  updateRowById_("Sales", sale.id, { status: "disputed", updatedAt: nowIso_() });
  var recipient = id_(user.id) === id_(sale.tapperId) ? findById_("Agreements", sale.agreementId).ownerId : sale.tapperId;
  notifyUser_(recipient, "sale_disputed", "มีรายการขายถูกคัดค้าน", payload.reason);
  writeAudit_(user, "sale_disputed", "sale", sale.id, sale, { status: "disputed", disputeId: disputeId, reason: payload.reason }, payload.requestId);
  return { disputeId: disputeId, saleId: sale.id, status: "disputed" };
};

function settlementOutstanding_(gardenId, ownerId) {
  var sales = rows_("Sales").filter(function (row) { return id_(row.gardenId) === id_(gardenId) && row.status === "confirmed"; });
  var total = sales.reduce(function (sum, sale) { return sum + numeric_(sale.ownerShare); }, 0);
  var settlements = rows_("Settlements").filter(function (row) { return id_(row.gardenId) === id_(gardenId) && id_(row.ownerId) === id_(ownerId) && row.status === "confirmed"; });
  var paid = settlements.reduce(function (sum, item) { return sum + numeric_(item.amount); }, 0);
  return { entitlement: round_(total), received: round_(paid), outstanding: round_(Math.max(0, total - paid)) };
}

Services.wallet = function (user, payload) {
  var access = requireGarden_(user, payload.gardenId);
  var garden = access.garden;
  var agreementRows = rows_("Agreements").filter(function (row) { return id_(row.gardenId) === id_(garden.id); });
  var ownerId = garden.ownerId;
  var sales = rows_("Sales").filter(function (row) { return id_(row.gardenId) === id_(garden.id); });
  var confirmed = sales.filter(function (row) { return row.status === "confirmed"; });
  var pending = sales.filter(function (row) { return row.status === "pending_owner_review" || row.status === "ocr_review"; });
  var disputed = sales.filter(function (row) { return row.status === "disputed"; });
  var tapperId = access.member && access.member.role === "tapper" ? user.id : (payload.tapperId || "");
  var ownerEntitlement = confirmed.reduce(function (sum, row) { return sum + numeric_(row.ownerShare); }, 0);
  var tapperIncome = confirmed.filter(function (row) { return !tapperId || id_(row.tapperId) === id_(tapperId); }).reduce(function (sum, row) { return sum + numeric_(row.tapperShare); }, 0);
  var settlement = settlementOutstanding_(garden.id, ownerId);
  return { gardenId: garden.id, role: user.role, agreementCount: agreementRows.length, owner: { totalEntitlement: round_(ownerEntitlement), totalReceived: settlement.received, outstanding: settlement.outstanding, pending: pending.reduce(function (sum, row) { return sum + numeric_(row.ownerShare); }, 0), disputed: disputed.reduce(function (sum, row) { return sum + numeric_(row.ownerShare); }, 0) }, tapper: { totalIncome: round_(tapperIncome), ownerMoneyHeld: settlement.outstanding, ownerMoneyTransferred: settlement.received, pendingReviews: pending.length } };
};

Services.createSettlement = function (user, payload) {
  requireGarden_(user, payload.gardenId);
  var access = requireGarden_(user, payload.gardenId);
  var isOwner = access.isOwner;
  if (!isOwner && user.role !== "tapper") throw new Error("SETTLEMENT_PERMISSION_DENIED");
  if (numeric_(payload.amount) <= 0) throw new Error("SETTLEMENT_AMOUNT_INVALID");
  var outstanding = settlementOutstanding_(payload.gardenId, access.garden.ownerId).outstanding;
  if (numeric_(payload.amount) > outstanding) throw new Error("SETTLEMENT_EXCEEDS_OUTSTANDING");
  var settlementId = Utilities.getUuid();
  Repositories.append("Settlements", { id: settlementId, gardenId: payload.gardenId, tapperId: payload.tapperId || user.id, ownerId: payload.ownerId || access.garden.ownerId, method: payload.method, amount: payload.amount, transferDate: payload.transferDate || nowIso_(), bank: payload.bank || "", referenceNo: payload.referenceNo || payload.reference || "", slipFileId: payload.slipFileId || "", location: payload.location || "", note: payload.note || "", status: "pending_owner_confirmation", createdAt: nowIso_() });
  var remaining = numeric_(payload.amount);
  rows_("Sales").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId) && row.status === "confirmed"; }).sort(function (a, b) { return new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime(); }).forEach(function (sale) {
    if (remaining <= 0) return;
    var allocated = Math.min(remaining, numeric_(sale.ownerShare));
    var already = rows_("SettlementAllocations").filter(function (row) { return id_(row.saleId) === id_(sale.id); }).reduce(function (sum, row) { return sum + numeric_(row.amount); }, 0);
    allocated = Math.min(allocated, Math.max(0, numeric_(sale.ownerShare) - already));
    if (allocated > 0) { Repositories.append("SettlementAllocations", { id: Utilities.getUuid(), settlementId: settlementId, saleId: sale.id, amount: allocated, createdAt: nowIso_() }); remaining = round_(remaining - allocated); }
  });
  notifyUser_(access.garden.ownerId, "settlement_pending", "มีรายการส่งเงินรอยืนยัน", "ยอด " + payload.amount);
  writeAudit_(user, "settlement_created", "settlement", settlementId, null, payload, payload.requestId);
  return findById_("Settlements", settlementId);
};

Services.listSettlements = function (user, payload) { requireGarden_(user, payload.gardenId); return rows_("Settlements").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId); }).sort(function (a, b) { return new Date(b.transferDate || b.createdAt).getTime() - new Date(a.transferDate || a.createdAt).getTime(); }); };

Services.confirmSettlement = function (user, payload) {
  var settlement = findById_("Settlements", payload.settlementId);
  if (!settlement) throw new Error("SETTLEMENT_NOT_FOUND");
  requireOwner_(user, settlement.gardenId);
  updateRowById_("Settlements", settlement.id, { status: "confirmed" });
  writeAudit_(user, "settlement_confirmed", "settlement", settlement.id, settlement, { status: "confirmed" }, payload.requestId);
  notifyUser_(settlement.tapperId, "settlement_confirmed", "เจ้าของยืนยันการรับเงิน", "ยอด " + settlement.amount);
  return findById_("Settlements", settlement.id);
};

Services.listNotifications = function (user) { return rows_("Notifications").filter(function (row) { return id_(row.userId) === id_(user.id); }).sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); }); };
Services.readNotification = function (user, payload) { var notification = rows_("Notifications").filter(function (row) { return id_(row.id) === id_(payload.notificationId) && id_(row.userId) === id_(user.id); })[0]; if (!notification) throw new Error("NOTIFICATION_NOT_FOUND"); updateRowById_("Notifications", notification.id, { readAt: nowIso_() }); return findById_("Notifications", notification.id); };

Services.report = function (user, payload) {
  requireGarden_(user, payload.gardenId);
  var sales = filterByDate_(rows_("Sales").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId); }), payload.from, payload.to, "saleDate");
  var settlements = filterByDate_(rows_("Settlements").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId); }), payload.from, payload.to, "transferDate");
  var confirmed = sales.filter(function (row) { return row.status === "confirmed"; });
  var summary = { from: payload.from || "", to: payload.to || "", salesCount: sales.length, confirmedSales: confirmed.length, grossSales: round_(sales.reduce(function (sum, row) { return sum + numeric_(row.grossSale); }, 0)), ownerShare: round_(confirmed.reduce(function (sum, row) { return sum + numeric_(row.ownerShare); }, 0)), tapperShare: round_(confirmed.reduce(function (sum, row) { return sum + numeric_(row.tapperShare); }, 0)), deductions: round_(sales.reduce(function (sum, row) { return sum + numeric_(row.buyerDeductions) + numeric_(row.sharedExpenses); }, 0)), settlements: round_(settlements.filter(function (row) { return row.status === "confirmed"; }).reduce(function (sum, row) { return sum + numeric_(row.amount); }, 0)), outstanding: settlementOutstanding_(payload.gardenId, requireGarden_(user, payload.gardenId).garden.ownerId).outstanding };
  return { summary: summary, rows: sales };
};


Services.extractReceipt = function (user, payload) {
  requireTapper_(user, payload.gardenId);
  var file = DriveStorage.save(payload.data, payload.mimeType, payload.filename, "receipts", user.id);
  var result = OCR.extract(payload.data, payload.mimeType);
  var receiptId = Utilities.getUuid();
  Repositories.append("Receipts", { id: receiptId, fileId: file.fileId, fileUrl: "", imageHash: payload.imageHash || "", ocrRawJson: JSON.stringify(result.fields || {}), ocrConfidenceJson: JSON.stringify({ confidence: result.confidence, needsReview: result.needsReview }), createdBy: user.id, manualNetAmount: false, createdAt: nowIso_() });
  Repositories.append("OcrRecords", { id: Utilities.getUuid(), fileId: file.fileId, provider: result.provider, status: result.needsReview ? "needs_review" : "ready", confidence: result.confidence, rawJson: JSON.stringify(result.fields || {}), reviewedBy: "", createdAt: nowIso_() });
  writeAudit_(user, "receipt_ocr_extracted", "receipt", receiptId, null, { provider: result.provider, confidence: result.confidence }, payload.requestId);
  return { receiptId: receiptId, file: file, ocr: result, status: result.needsReview ? "ocr_review" : "ready" };
};
