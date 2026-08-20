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
 */

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
    Idempotency.put(request.requestId, response);
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
  var user = Auth.requireUser(request.authToken);
  switch (request.action) {
    case "dashboard.get": return Services.dashboard(user);
    case "gardens.list": return Repositories.gardensForUser(user.id);
    case "sales.create": return Services.createSale(user, request.payload);
    case "payments.create": return Services.createPayment(user, request.payload);
    case "payments.confirm": return Services.confirmPayment(user, request.payload);
    case "receipts.extract": return Services.extractReceipt(user, request.payload);
    default: throw new Error("UNKNOWN_ACTION:" + request.action);
  }
}

function healthCheck_() { return { service: "parawallet-appsscript", status: "ok", timestamp: new Date().toISOString() }; }
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
  allowedOrigins: function () { return this.get("ALLOWED_ORIGINS", false).split(",").filter(Boolean); }
};

var Auth = {
  requireUser: function (token) {
    var email = token || Session.getActiveUser().getEmail();
    if (!email) throw new Error("AUTH_REQUIRED");
    var user = Repositories.findUserByEmail(email);
    if (!user) throw new Error("USER_NOT_REGISTERED");
    return user;
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
    return cache ? JSON.parse(cache) : null;
  },
  put: function (requestId, response) {
    CacheService.getScriptCache().put("request:" + requestId, JSON.stringify(response), 21600);
  }
};

// =====================================================
// 4. GOOGLE SHEETS SCHEMA & REPOSITORIES
// =====================================================

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
  bootstrap: function () {
    var book = SpreadsheetApp.openById(Config.spreadsheetId());
    SHEETS.forEach(function (name) {
      var sheet = book.getSheetByName(name) || book.insertSheet(name);
      if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS[name]);
    });
    return { sheets: SHEETS };
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
