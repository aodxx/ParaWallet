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

// Bump this identifier every time Code.gs is prepared for a production deploy.
// health.get and diagnostics.get expose it so operators can prove which backend
// revision is actually serving traffic without exposing source or credentials.
var PARAWALLET_RELEASE = "2026.08.24-phase-d3";
var PARAWALLET_SCHEMA_VERSION = "2026-08-production-v3";

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
    // Read-only actions must not take the global ScriptLock. The PWA loads several
    // independent read models in parallel; serialising those reads made all but
    // one request time out with TRANSACTION_BUSY.
    if (isReadOnlyAction_(request.action)) {
      return jsonResponse_(okResponse_(request.requestId, routeAction_(request)));
    }
    var response = Locking.run("request:" + request.requestId, function () {
      var cached = Idempotency.get(request.requestId);
      if (cached) return cached;
      var result = routeAction_(request);
      var freshResponse = okResponse_(request.requestId, result);
      Idempotency.put(request.requestId, freshResponse, request.action);
      return freshResponse;
    });
    return jsonResponse_(response);
  } catch (error) {
    var rawMessage = error && error.message ? error.message : String(error);
    var codeMatch = rawMessage.match(/^([A-Z][A-Z0-9_]+)(?=:|$)/);
    var code = codeMatch ? codeMatch[1] : "API_ERROR";
    return jsonResponse_(errorResponse_(code, rawMessage, request && request.requestId ? request.requestId : "unknown"));
  }
}

var READ_ONLY_ACTIONS_ = [
  "health.get", "diagnostics.get", "dashboard.get", "gardens.list", "plots.list",
  "members.list", "agreements.list", "products.list", "buyers.list", "sales.list",
  "sales.duplicateCheck", "wallets.me", "settlements.list", "notifications.list",
  "reports.summary"
];
function isReadOnlyAction_(action) { return READ_ONLY_ACTIONS_.indexOf(String(action || "")) >= 0; }

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
    case "settlements.reject": return Services.rejectSettlement(user, request.payload);
    case "settlements.cancel": return Services.cancelSettlement(user, request.payload);
    case "disputes.resolve": return Services.resolveDispute(user, request.payload);
    case "adjustments.create": return Services.createAdjustment(user, request.payload);
    case "payments.create": return Services.createPayment(user, request.payload);
    case "payments.confirm": return Services.confirmPayment(user, request.payload);
    case "notifications.list": return Services.listNotifications(user);
    case "notifications.read": return Services.readNotification(user, request.payload);
    case "reports.summary": return Services.report(user, request.payload);
    case "receipts.extract": return Services.extractReceipt(user, request.payload);
    default: throw new Error("UNKNOWN_ACTION:" + request.action);
  }
}

function healthCheck_() { return { service: "parawallet-appsscript", status: "ok", release: PARAWALLET_RELEASE, schemaVersion: PARAWALLET_SCHEMA_VERSION, timestamp: new Date().toISOString() }; }
function diagnosticsCheck_() {
  var result = { service: "parawallet-appsscript", status: "ok", release: PARAWALLET_RELEASE, schemaVersion: PARAWALLET_SCHEMA_VERSION, timestamp: new Date().toISOString(), sheetIdConfigured: false, sheetAccessible: false, missingSheets: [], registeredUsers: 0 };
  try {
    result.sheetIdConfigured = Boolean(Config.get("SHEET_ID", false));
    if (!result.sheetIdConfigured) { result.status = "error"; result.error = "MISSING_SCRIPT_PROPERTY:SHEET_ID"; return result; }
    var book = SpreadsheetApp.openById(Config.spreadsheetId());
    result.sheetAccessible = Boolean(book && book.getId());
    result.missingSheets = SHEETS.filter(function (name) { return !book.getSheetByName(name); });
    result.schema = Repositories.validateSchema();
    result.schemaMismatches = result.schema.filter(function (item) { return item.status !== "ok"; });
    result.financialSchemaReady = result.missingSheets.length === 0 && result.schemaMismatches.length === 0;
    var usersSheet = book.getSheetByName("Users");
    if (usersSheet && usersSheet.getLastRow() > 1) result.registeredUsers = usersSheet.getLastRow() - 1;
    if (result.missingSheets.length) { result.status = "warning"; result.error = "SHEETS_NOT_INITIALIZED"; }
    else if (result.schemaMismatches.length) { result.status = "warning"; result.error = "SCHEMA_MISMATCH"; }
  } catch (error) {
    result.status = "error";
    result.error = error && error.message ? error.message : String(error);
  }
  return result;
}
function okResponse_(requestId, data) { return { status: "ok", requestId: requestId, data: data }; }
function errorResponse_(code, message, requestId) { var retryable = ["TRANSACTION_BUSY", "API_ERROR", "AUTH_REQUIRED"].indexOf(code) >= 0; return { status: "error", requestId: requestId, error: { code: code, message: message, retryable: retryable } }; }
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
  // OAuth client IDs are public configuration. The Script Property can override this
  // value, but a missing property must not block the MVP after deployment.
  googleClientId: function () { return this.get("GOOGLE_OAUTH_CLIENT_ID", false) || "1056693340258-61rj2pms6mpvn9iqmaoc2vfrfbh6lg19.apps.googleusercontent.com"; }
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
    try { return callback(); } finally {
      // Commit pending Spreadsheet writes while the script still owns the lock.
      try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
    }
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
      var exists = rows_("Requests").some(function (item) { return id_(item.requestId) === id_(requestId); });
      if (!exists) Repositories.append("Requests", { requestId: requestId, action: action || "", status: response.status, responseJson: encoded, createdAt: nowIso_() });
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
function assertFinancialSchemaReady_() {
  ["Users", "Gardens", "GardenMembers", "Agreements", "Sales", "WalletEntries", "Settlements", "SettlementAllocations", "Notifications", "AuditLogs", "Requests"].forEach(function (name) {
    var sheet = Repositories.sheet_(name);
    if (!sheet) throw new Error("SHEET_MISSING:" + name);
    assertHeaders_(sheet, name);
  });
}

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
    return { provider: "none", confidence: 0, score: 0, needsReview: true, reviewLevel: "mandatory", fields: {} };
  },
  score_: function (fields) {
    var score = 0;
    if (fields.saleDate) score += 10;
    if (fields.buyerName) score += 10;
    if (fields.productType) score += 10;
    if (numeric_(fields.weightKg) > 0) score += 15;
    if (numeric_(fields.unitPrice) > 0) score += 15;
    if (numeric_(fields.grossSale) > 0) score += 15;
    if (numeric_(fields.weightKg) > 0 && numeric_(fields.unitPrice) > 0 && numeric_(fields.grossSale) > 0 && Math.abs(numeric_(fields.weightKg) * numeric_(fields.unitPrice) - numeric_(fields.grossSale)) <= 0.02) score += 20;
    if (numeric_(fields.buyerDeductions) >= 0) score += 5;
    return score;
  },
  scored_: function (provider, fields) {
    var score = this.score_(fields || {});
    return { provider: provider, confidence: score / 100, score: score, needsReview: score < 90, reviewLevel: score >= 90 ? "high" : (score >= 80 ? "recommended" : "mandatory"), fields: fields || {} };
  },
  gemini_: function (base64, mimeType, prompt) {
    var response = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(Config.geminiKey()), { method: "post", contentType: "application/json", payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }] }), muteHttpExceptions: true });
    var body = JSON.parse(response.getContentText());
    var text = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text || "{}";
    var fields = JSON.parse(text.replace(/```json|```/g, "").trim());
    return this.scored_("gemini", fields);
  },
  vision_: function (base64, mimeType) {
    var response = UrlFetchApp.fetch("https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(Config.visionKey()), { method: "post", contentType: "application/json", payload: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }), muteHttpExceptions: true });
    return this.scored_("vision", { rawText: JSON.parse(response.getContentText()) });
  }
};

// =====================================================
// 7. DOMAIN SERVICES
// =====================================================

var Services = {
  dashboard: function (user) {
    var gardens = Repositories.gardensForUser(user.id);
    var garden = gardens[0] || null;
    if (!garden) return { role: user.role, garden: null, wallet: { owner: 0, tapper: 0, outstanding: 0, currency: "THB" }, pendingReviews: 0, monthlySales: 0 };
    var wallet = Services.wallet(user, { gardenId: garden.id });
    var monthStart = new Date().toISOString().slice(0, 7) + "-01";
    var monthlySales = filterByDate_(rows_("Sales").filter(function (row) {
      if (id_(row.gardenId) !== id_(garden.id) || row.status !== "confirmed") return false;
      return user.role !== "tapper" || id_(row.tapperId) === id_(user.id);
    }), monthStart, "", "saleDate");
    return {
      role: user.role,
      garden: garden,
      wallet: {
        owner: wallet.owner.totalEntitlement,
        tapper: wallet.tapper.totalIncome,
        outstanding: wallet.owner.outstanding,
        currency: "THB"
      },
      pendingReviews: wallet.tapper.pendingReviews,
      monthlySales: round_(monthlySales.reduce(function (sum, row) { return sum + numeric_(row.grossSale); }, 0))
    };
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
    assertFinancialSchemaReady_();
    return Locking.run("payment:" + payload.gardenId, function () {
      var id = Utilities.getUuid();
      Repositories.append("Payments", { id: id, gardenId: payload.gardenId, saleId: payload.saleId, fromUserId: user.id, toUserId: payload.toUserId, amount: payload.amount, method: payload.method, reference: payload.reference, status: "pending", paidAt: payload.paidAt, createdAt: new Date().toISOString() });
      return { id: id, status: "pending" };
    });
  },
  confirmPayment: function (user, payload) {
    assertFinancialSchemaReady_();
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
  var gardenId = Utilities.getUuid();
  Repositories.append("Gardens", { id: gardenId, ownerId: user.id, name: payload.name, locationText: payload.locationText || "", province: payload.province || "", district: payload.district || "", areaRai: payload.areaRai || 0, treeCount: payload.treeCount || 0, status: "active", createdAt: nowIso_(), updatedAt: nowIso_() });
  Repositories.append("GardenMembers", { id: Utilities.getUuid(), gardenId: gardenId, userId: user.id, role: "owner", status: "active", createdAt: nowIso_() });
  writeAudit_(user, "garden_created", "garden", gardenId, null, payload, payload.requestId);
  return findById_("Gardens", gardenId);
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
  assertFinancialSchemaReady_();
  requireOwner_(user, payload.gardenId);
  var existing = Services.listAgreements(user, payload);
  if (!payload.effectiveFrom || isNaN(new Date(payload.effectiveFrom).getTime())) throw new Error("AGREEMENT_EFFECTIVE_FROM_REQUIRED");
  var ownerPercentage = numeric_(payload.ownerPercentage);
  var tapperPercentage = numeric_(payload.tapperPercentage);
  if (round_(ownerPercentage + tapperPercentage) !== 100) throw new Error("PERCENTAGES_MUST_SUM_TO_100");
  if (!payload.tapperId) throw new Error("TAPPER_REQUIRED");
  var tapperMember = rows_("GardenMembers").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId) && id_(row.userId) === id_(payload.tapperId) && row.role === "tapper" && row.status === "active"; })[0];
  if (!tapperMember) throw new Error("TAPPER_NOT_ACTIVE_MEMBER");
  var agreementId = Utilities.getUuid();
  var version = existing.length ? numeric_(existing[0].version) + 1 : 1;
  existing.filter(function (row) { return row.status === "active"; }).forEach(function (row) { updateRowById_("Agreements", row.id, { status: "superseded", effectiveTo: payload.effectiveFrom || nowIso_() }); });
  Repositories.append("Agreements", { id: agreementId, gardenId: payload.gardenId, ownerId: user.id, tapperId: payload.tapperId, version: version, ownerPercentage: ownerPercentage, tapperPercentage: tapperPercentage, sharedExpenseRulesJson: jsonOrEmpty_(payload.sharedExpenseRules), ownerExpenseRulesJson: jsonOrEmpty_(payload.ownerExpenseRules), tapperExpenseRulesJson: jsonOrEmpty_(payload.tapperExpenseRules), advanceRuleJson: jsonOrEmpty_(payload.advanceRule), effectiveFrom: payload.effectiveFrom, effectiveTo: payload.effectiveTo || "", expenseRules: jsonOrEmpty_(payload.expenseRules), status: "active", createdAt: nowIso_() });
  writeAudit_(user, "agreement_created", "agreement", agreementId, null, payload, payload.requestId);
  if (payload.tapperId) notifyUser_(payload.tapperId, "agreement_created", "มีข้อตกลงใหม่", "เจ้าของสวนสร้างข้อตกลงเวอร์ชัน " + version);
  return findById_("Agreements", agreementId);
};
Services.listProducts = function () { return rows_("ProductTypes").filter(function (row) { return row.active !== false && row.active !== "false"; }); };
Services.listBuyers = function (user, payload) { requireGarden_(user, payload.gardenId); return rows_("Buyers").filter(function (row) { return row.status !== "archived"; }); };

function activeAgreement_(gardenId, agreementId, saleDate) {
  var agreement = agreementId ? findById_("Agreements", agreementId) : rows_("Agreements").filter(function (row) { return id_(row.gardenId) === id_(gardenId) && row.status === "active"; }).sort(function (a, b) { return numeric_(b.version) - numeric_(a.version); })[0];
  if (!agreement) throw new Error("AGREEMENT_NOT_FOUND");
  if (id_(agreement.gardenId) !== id_(gardenId)) throw new Error("AGREEMENT_GARDEN_MISMATCH");
  if (agreement.status !== "active") throw new Error("AGREEMENT_NOT_ACTIVE");
  var dateValue = new Date(saleDate || nowIso_()).getTime();
  var from = agreement.effectiveFrom ? new Date(agreement.effectiveFrom).getTime() : -Infinity;
  var to = agreement.effectiveTo ? new Date(agreement.effectiveTo).getTime() : Infinity;
  if (isNaN(dateValue) || dateValue < from || dateValue > to) throw new Error("AGREEMENT_DATE_OUT_OF_RANGE");
  return agreement;
}

Services.createSale = function (user, payload) {
  assertFinancialSchemaReady_();
  var access = requireTapper_(user, payload.gardenId);
  var agreement = activeAgreement_(payload.gardenId, payload.agreementId, payload.saleDate);
  if (id_(agreement.tapperId) !== id_(user.id)) throw new Error("AGREEMENT_TAPPER_MISMATCH");
  var weight = numeric_(payload.netWeight || payload.weightKg);
  var unitPrice = numeric_(payload.pricePerUnit || payload.unitPrice);
  if (weight <= 0 || unitPrice < 0) throw new Error("SALE_INPUT_INVALID");
  if (numeric_(payload.buyerDeductions) < 0 || numeric_(payload.sharedExpenses) < 0) throw new Error("DEDUCTION_INVALID");
  var calc = Calculator.sale({ weightKg: weight, unitPrice: unitPrice, buyerDeductions: payload.buyerDeductions, sharedExpenses: payload.sharedExpenses, ownerPercentage: agreement.ownerPercentage, tapperPercentage: agreement.tapperPercentage });
    var saleId = Utilities.getUuid();
    Repositories.append("Sales", { id: saleId, gardenId: payload.gardenId, plotId: payload.plotId || "", agreementId: agreement.id, tapperId: user.id, receiptId: payload.receiptId || "", buyerId: payload.buyerId || "", saleDate: payload.saleDate, ticketNumber: payload.ticketNumber || "", productTypeId: payload.productTypeId || "", buyerName: payload.buyerName || "", productType: payload.productType || "", grossWeight: payload.grossWeight || weight, tareWeight: payload.tareWeight || 0, netWeight: weight, drc: payload.drc || "", weightKg: weight, unitPrice: unitPrice, pricePerUnit: unitPrice, grossSale: calc.grossSale, buyerDeductions: numeric_(payload.buyerDeductions), sharedExpenses: numeric_(payload.sharedExpenses), splitBase: calc.splitBase, ownerShare: calc.ownerShare, tapperShare: calc.tapperShare, netReceived: calc.splitBase, status: "pending_owner_review", manualEntry: payload.manualEntry === true, receiptFileId: payload.receiptFileId || "", ocrConfidence: payload.ocrConfidence || "", createdAt: nowIso_(), updatedAt: nowIso_() });
    Repositories.append("WalletEntries", { id: Utilities.getUuid(), walletOwnerUserId: agreement.ownerId, saleId: saleId, settlementId: "", entryType: "sale_entitlement", direction: "credit", amount: calc.ownerShare, status: "pending", createdAt: nowIso_() });
    Repositories.append("WalletEntries", { id: Utilities.getUuid(), walletOwnerUserId: user.id, saleId: saleId, settlementId: "", entryType: "tapper_income", direction: "credit", amount: calc.tapperShare, status: "pending", createdAt: nowIso_() });
    notifyUser_(agreement.ownerId, "sale_pending_review", "มีรายการขายใหม่รอตรวจ", "รายการขาย " + saleId + " รอการยืนยัน");
    writeAudit_(user, "sale_created", "sale", saleId, null, { payload: payload, agreementSnapshot: agreement, calculation: calc }, payload.requestId);
  return { id: saleId, agreementSnapshot: agreement, calculation: calc, status: "pending_owner_review" };
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
  assertFinancialSchemaReady_();
  var sale = findById_("Sales", payload.saleId);
  if (!sale) throw new Error("SALE_NOT_FOUND");
  requireOwner_(user, sale.gardenId);
  if (sale.status !== "pending_owner_review" && sale.status !== "ocr_review") throw new Error("SALE_NOT_REVIEWABLE");
  var ledgerExpected = round_(numeric_(sale.buyerDeductions) + numeric_(sale.sharedExpenses) + numeric_(sale.ownerShare) + numeric_(sale.tapperShare));
  if (round_(numeric_(sale.grossSale)) !== ledgerExpected) throw new Error("LEDGER_IMBALANCE");
  updateRowById_("Sales", sale.id, { status: "confirmed", updatedAt: nowIso_() });
  rows_("WalletEntries").filter(function (row) { return id_(row.saleId) === id_(sale.id); }).forEach(function (entry) { updateRowById_("WalletEntries", entry.id, { status: "confirmed" }); });
  writeAudit_(user, "sale_confirmed", "sale", sale.id, sale, { status: "confirmed" }, payload.requestId);
  notifyUser_(sale.tapperId, "sale_confirmed", "เจ้าของยืนยันรายการขาย", "รายการขาย " + sale.id + " ได้รับการยืนยันแล้ว");
  return findById_("Sales", sale.id);
};

Services.disputeSale = function (user, payload) {
  assertFinancialSchemaReady_();
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

function ownerAdjustmentForSale_(saleId) {
  return round_(rows_("Adjustments").filter(function (row) { return id_(row.saleId) === id_(saleId) && row.status === "confirmed"; }).reduce(function (sum, row) { return sum + (row.adjustmentType === "owner_credit" ? numeric_(row.amount) : row.adjustmentType === "owner_debit" ? -numeric_(row.amount) : 0); }, 0));
}

function settlementOutstanding_(gardenId, ownerId) {
  var sales = rows_("Sales").filter(function (row) { return id_(row.gardenId) === id_(gardenId) && row.status === "confirmed"; });
  var total = sales.reduce(function (sum, sale) { return sum + numeric_(sale.ownerShare); }, 0);
  var saleIds = sales.reduce(function (map, sale) { map[id_(sale.id)] = true; return map; }, {});
  var adjustments = rows_("Adjustments").filter(function (row) { return row.status === "confirmed" && saleIds[id_(row.saleId)]; });
  var ownerAdjustment = adjustments.reduce(function (sum, row) { return sum + (row.adjustmentType === "owner_credit" ? numeric_(row.amount) : row.adjustmentType === "owner_debit" ? -numeric_(row.amount) : 0); }, 0);
  var settlements = rows_("Settlements").filter(function (row) { return id_(row.gardenId) === id_(gardenId) && id_(row.ownerId) === id_(ownerId) && row.status === "confirmed"; });
  var paid = settlements.reduce(function (sum, item) { return sum + numeric_(item.amount); }, 0);
  var entitlement = round_(total + ownerAdjustment);
  return { entitlement: entitlement, received: round_(paid), outstanding: round_(Math.max(0, entitlement - paid)) };
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
  var confirmedIds = confirmed.reduce(function (map, row) { map[id_(row.id)] = true; return map; }, {});
  var adjustments = rows_("Adjustments").filter(function (row) { return row.status === "confirmed" && confirmedIds[id_(row.saleId)]; });
  var ownerEntitlement = confirmed.reduce(function (sum, row) { return sum + numeric_(row.ownerShare); }, 0) + adjustments.reduce(function (sum, row) { return sum + (row.adjustmentType === "owner_credit" ? numeric_(row.amount) : row.adjustmentType === "owner_debit" ? -numeric_(row.amount) : 0); }, 0);
  var tapperIncome = confirmed.filter(function (row) { return !tapperId || id_(row.tapperId) === id_(tapperId); }).reduce(function (sum, row) { return sum + numeric_(row.tapperShare); }, 0) + adjustments.filter(function (row) { var sale = findById_("Sales", row.saleId); return sale && (!tapperId || id_(sale.tapperId) === id_(tapperId)); }).reduce(function (sum, row) { return sum + (row.adjustmentType === "tapper_credit" ? numeric_(row.amount) : row.adjustmentType === "tapper_debit" ? -numeric_(row.amount) : 0); }, 0);
  var settlement = settlementOutstanding_(garden.id, ownerId);
  return { gardenId: garden.id, role: user.role, agreementCount: agreementRows.length, owner: { totalEntitlement: round_(ownerEntitlement), totalReceived: settlement.received, outstanding: settlement.outstanding, pending: pending.reduce(function (sum, row) { return sum + numeric_(row.ownerShare); }, 0), disputed: disputed.reduce(function (sum, row) { return sum + numeric_(row.ownerShare); }, 0) }, tapper: { totalIncome: round_(tapperIncome), ownerMoneyHeld: settlement.outstanding, ownerMoneyTransferred: settlement.received, pendingReviews: pending.length } };
};

Services.createSettlement = function (user, payload) {
  assertFinancialSchemaReady_();
  var access = requireGarden_(user, payload.gardenId);
  var isOwner = access.isOwner;
  if (!isOwner && user.role !== "tapper") throw new Error("SETTLEMENT_PERMISSION_DENIED");
  var tapperId = payload.tapperId || user.id;
  if (!isOwner && id_(tapperId) !== id_(user.id)) throw new Error("SETTLEMENT_TAPPER_MISMATCH");
  var tapperMember = rows_("GardenMembers").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId) && id_(row.userId) === id_(tapperId) && row.role === "tapper" && row.status === "active"; })[0];
  if (!tapperMember) throw new Error("TAPPER_NOT_ACTIVE_MEMBER");
  if (isOwner) throw new Error("TAPPER_SETTLEMENT_REQUIRED");
  if (numeric_(payload.amount) <= 0) throw new Error("SETTLEMENT_AMOUNT_INVALID");
  var outstanding = settlementOutstanding_(payload.gardenId, access.garden.ownerId).outstanding;
  if (numeric_(payload.amount) > outstanding) throw new Error("SETTLEMENT_EXCEEDS_OUTSTANDING");
  var settlementId = Utilities.getUuid();
  Repositories.append("Settlements", { id: settlementId, gardenId: payload.gardenId, tapperId: tapperId, ownerId: access.garden.ownerId, method: payload.method, amount: round_(numeric_(payload.amount)), transferDate: payload.transferDate || nowIso_(), bank: payload.bank || "", referenceNo: payload.referenceNo || payload.reference || "", slipFileId: payload.slipFileId || "", location: payload.location || "", note: payload.note || "", status: "pending_owner_confirmation", createdAt: nowIso_() });
  notifyUser_(access.garden.ownerId, "settlement_pending", "มีรายการส่งเงินรอยืนยัน", "ยอด " + payload.amount);
  writeAudit_(user, "settlement_created", "settlement", settlementId, null, payload, payload.requestId);
  return findById_("Settlements", settlementId);
};

Services.listSettlements = function (user, payload) { requireGarden_(user, payload.gardenId); return rows_("Settlements").filter(function (row) { return id_(row.gardenId) === id_(payload.gardenId); }).sort(function (a, b) { return new Date(b.transferDate || b.createdAt).getTime() - new Date(a.transferDate || a.createdAt).getTime(); }); };

Services.confirmSettlement = function (user, payload) {
  assertFinancialSchemaReady_();
  var settlement = findById_("Settlements", payload.settlementId);
  if (!settlement) throw new Error("SETTLEMENT_NOT_FOUND");
  requireOwner_(user, settlement.gardenId);
    if (settlement.status !== "pending_owner_confirmation") throw new Error("SETTLEMENT_NOT_CONFIRMABLE");
    var amount = numeric_(settlement.amount);
    if (amount <= 0) throw new Error("SETTLEMENT_AMOUNT_INVALID");
    var outstanding = settlementOutstanding_(settlement.gardenId, settlement.ownerId).outstanding;
    if (amount > outstanding) throw new Error("SETTLEMENT_EXCEEDS_OUTSTANDING");
    var remaining = amount;
    var allocations = [];
    rows_("Sales").filter(function (row) { return id_(row.gardenId) === id_(settlement.gardenId) && row.status === "confirmed"; }).sort(function (a, b) { return new Date(a.saleDate || a.createdAt).getTime() - new Date(b.saleDate || b.createdAt).getTime(); }).forEach(function (sale) {
      if (remaining <= 0) return;
      var already = rows_("SettlementAllocations").filter(function (row) { return id_(row.saleId) === id_(sale.id) && row.settlementId !== settlement.id && row.status !== "rejected" && row.status !== "cancelled"; }).reduce(function (sum, row) { return sum + numeric_(row.amount); }, 0);
      var allocated = Math.min(remaining, Math.max(0, numeric_(sale.ownerShare) + ownerAdjustmentForSale_(sale.id) - already));
      if (allocated > 0) { allocations.push({ saleId: sale.id, amount: round_(allocated) }); remaining = round_(remaining - allocated); }
    });
    if (remaining !== 0) throw new Error("SETTLEMENT_ALLOCATION_MISMATCH");
    allocations.forEach(function (item) { Repositories.append("SettlementAllocations", { id: Utilities.getUuid(), settlementId: settlement.id, saleId: item.saleId, amount: item.amount, createdAt: nowIso_() }); });
    Repositories.append("WalletEntries", { id: Utilities.getUuid(), walletOwnerUserId: settlement.ownerId, saleId: "", settlementId: settlement.id, entryType: "settlement_owner_received", direction: "debit", amount: amount, status: "confirmed", createdAt: nowIso_() });
    updateRowById_("Settlements", settlement.id, { status: "confirmed" });
    writeAudit_(user, "settlement_confirmed", "settlement", settlement.id, settlement, { status: "confirmed", allocations: allocations }, payload.requestId);
    notifyUser_(settlement.tapperId, "settlement_confirmed", "เจ้าของยืนยันการรับเงิน", "ยอด " + settlement.amount);
  return findById_("Settlements", settlement.id);
};

Services.rejectSettlement = function (user, payload) {
  assertFinancialSchemaReady_();
  var settlement = findById_("Settlements", payload.settlementId);
  if (!settlement) throw new Error("SETTLEMENT_NOT_FOUND");
  requireOwner_(user, settlement.gardenId);
  if (settlement.status !== "pending_owner_confirmation") throw new Error("SETTLEMENT_NOT_REJECTABLE");
  if (!payload.reason) throw new Error("SETTLEMENT_REJECTION_REASON_REQUIRED");
  updateRowById_("Settlements", settlement.id, { status: "rejected", note: (settlement.note || "") + "\nเหตุผล: " + payload.reason });
  writeAudit_(user, "settlement_rejected", "settlement", settlement.id, settlement, { status: "rejected", reason: payload.reason }, payload.requestId);
  notifyUser_(settlement.tapperId, "settlement_rejected", "เจ้าของปฏิเสธรายการส่งเงิน", payload.reason);
  return findById_("Settlements", settlement.id);
};

Services.cancelSettlement = function (user, payload) {
  assertFinancialSchemaReady_();
  var settlement = findById_("Settlements", payload.settlementId);
  if (!settlement) throw new Error("SETTLEMENT_NOT_FOUND");
  requireGarden_(user, settlement.gardenId);
  if (id_(settlement.tapperId) !== id_(user.id) || user.role !== "tapper") throw new Error("TAPPER_PERMISSION_REQUIRED");
  if (settlement.status !== "pending_owner_confirmation") throw new Error("SETTLEMENT_NOT_CANCELLABLE");
  updateRowById_("Settlements", settlement.id, { status: "cancelled", note: (settlement.note || "") + "\nยกเลิกโดย: " + user.id });
  writeAudit_(user, "settlement_cancelled", "settlement", settlement.id, settlement, { status: "cancelled" }, payload.requestId);
  notifyUser_(settlement.ownerId, "settlement_cancelled", "คนกรีดยกเลิกรายการส่งเงิน", "รายการ " + settlement.id);
  return findById_("Settlements", settlement.id);
};

Services.resolveDispute = function (user, payload) {
  assertFinancialSchemaReady_();
  var dispute = payload.disputeId ? findById_("Disputes", payload.disputeId) : null;
  if (!dispute && payload.saleId) dispute = rows_("Disputes").filter(function (row) { return id_(row.saleId) === id_(payload.saleId) && ["open", "under_review"].indexOf(row.status) >= 0; }).sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); })[0];
  if (!dispute) throw new Error("DISPUTE_NOT_FOUND");
  var sale = findById_("Sales", dispute.saleId);
  if (!sale) throw new Error("SALE_NOT_FOUND");
  requireOwner_(user, sale.gardenId);
  if (["open", "under_review"].indexOf(dispute.status) < 0) throw new Error("DISPUTE_NOT_RESOLVABLE");
  var decision = String(payload.decision || "").toLowerCase();
  if (["resolved", "rejected"].indexOf(decision) < 0) throw new Error("DISPUTE_DECISION_INVALID");
  var resolution = { decision: decision, note: payload.resolution || "", resolvedBy: user.id, resolvedAt: nowIso_() };
  updateRowById_("Disputes", dispute.id, { status: decision, note: JSON.stringify(resolution), resolvedAt: resolution.resolvedAt });
  if (decision === "rejected" && sale.status === "disputed") updateRowById_("Sales", sale.id, { status: "confirmed", updatedAt: nowIso_() });
  writeAudit_(user, "dispute_resolved", "dispute", dispute.id, dispute, resolution, payload.requestId);
  notifyUser_(id_(user.id) === id_(sale.tapperId) ? findById_("Agreements", sale.agreementId).ownerId : sale.tapperId, "dispute_resolved", "มีการสรุปข้อพิพาท", resolution.note || decision);
  return { disputeId: dispute.id, saleId: sale.id, status: decision, resolution: resolution };
};

Services.createAdjustment = function (user, payload) {
  assertFinancialSchemaReady_();
  var sale = findById_("Sales", payload.saleId);
  if (!sale) throw new Error("SALE_NOT_FOUND");
  requireOwner_(user, sale.gardenId);
  if (sale.status !== "confirmed") throw new Error("SALE_NOT_ADJUSTABLE");
  var amount = round_(numeric_(payload.amount));
  if (amount <= 0) throw new Error("ADJUSTMENT_AMOUNT_INVALID");
  var types = ["owner_credit", "owner_debit", "tapper_credit", "tapper_debit"];
  if (types.indexOf(payload.adjustmentType) < 0) throw new Error("ADJUSTMENT_TYPE_INVALID");
  if (!payload.reason) throw new Error("ADJUSTMENT_REASON_REQUIRED");
  var adjustmentId = Utilities.getUuid();
  Repositories.append("Adjustments", { id: adjustmentId, saleId: sale.id, userId: user.id, adjustmentType: payload.adjustmentType, amount: amount, reason: payload.reason, status: "confirmed", createdAt: nowIso_() });
  var walletOwnerUserId = ["owner_credit", "owner_debit"].indexOf(payload.adjustmentType) >= 0 ? findById_("Agreements", sale.agreementId).ownerId : sale.tapperId;
  var direction = ["owner_credit", "tapper_credit"].indexOf(payload.adjustmentType) >= 0 ? "credit" : "debit";
  Repositories.append("WalletEntries", { id: Utilities.getUuid(), walletOwnerUserId: walletOwnerUserId, saleId: sale.id, settlementId: "", entryType: "adjustment_" + direction, direction: direction, amount: amount, status: "confirmed", createdAt: nowIso_() });
  writeAudit_(user, "adjustment_created", "adjustment", adjustmentId, null, { saleId: sale.id, type: payload.adjustmentType, amount: amount, reason: payload.reason }, payload.requestId);
  return findById_("Adjustments", adjustmentId);
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


// =====================================================
// 10. CONTROLLED ONE-TIME E2E TEST RUNNER
// =====================================================
// Run manually from the Apps Script editor only. This function is intentionally
// not exposed through doPost and is restricted to the approved test garden and
// registered Owner/Tapper IDs. It is resumable after a partial failure and
// permanently blocks itself after a successful completion.
function runAuthorizedE2ETestOnce() {
  return Locking.run("e2e:pahpayom:once", function () {
    var props = PropertiesService.getScriptProperties();
    var stateKey = "PARAWALLET_E2E_PAHPAYOM_STATUS";
    if (props.getProperty(stateKey) === "completed") throw new Error("E2E_ALREADY_COMPLETED");

    var gardenId = "garden-pahpayom-001";
    var ownerId = "user-owner-001";
    try {
      assertFinancialSchemaReady_();
    } catch (schemaError) {
      throw new Error("E2E_PRODUCTION_SCHEMA_REPAIR_REQUIRED:" + (schemaError && schemaError.message ? schemaError.message : String(schemaError)));
    }
    var tapperId = "user-tapper-001";
    var runTag = "E2E-PAHPAYOM-001";
    var saleRequestId = runTag + "-SALE";
    var settlementRequestId = runTag + "-SETTLEMENT";
    var owner = findById_("Users", ownerId);
    var tapper = findById_("Users", tapperId);
    var garden = findById_("Gardens", gardenId);
    if (!owner || owner.status !== "active" || owner.role !== "owner") throw new Error("E2E_OWNER_FIXTURE_INVALID");
    if (!tapper || tapper.status !== "active" || tapper.role !== "tapper") throw new Error("E2E_TAPPER_FIXTURE_INVALID");
    if (!garden || id_(garden.ownerId) !== ownerId || garden.status !== "active") throw new Error("E2E_GARDEN_FIXTURE_INVALID");
    var membership = rows_("GardenMembers").filter(function (row) { return id_(row.gardenId) === gardenId && id_(row.userId) === tapperId && row.role === "tapper" && row.status === "active"; })[0];
    if (!membership) throw new Error("E2E_TAPPER_MEMBERSHIP_INVALID");

    var agreement = rows_("Agreements").filter(function (row) { return id_(row.gardenId) === gardenId && id_(row.tapperId) === tapperId && row.status === "active"; }).sort(function (a, b) { return numeric_(b.version) - numeric_(a.version); })[0];
    if (!agreement) {
      agreement = Services.createAgreement(owner, {
        gardenId: gardenId,
        tapperId: tapperId,
        ownerPercentage: 60,
        tapperPercentage: 40,
        effectiveFrom: "2026-08-21T00:00:00+12:00",
        expenseRules: { testFixture: true, label: runTag },
        requestId: runTag + "-AGREEMENT"
      });
    }
    if (numeric_(agreement.ownerPercentage) !== 60 || numeric_(agreement.tapperPercentage) !== 40) throw new Error("E2E_AGREEMENT_SPLIT_INVALID");

    var sale = rows_("Sales").filter(function (row) { return id_(row.gardenId) === gardenId && String(row.ticketNumber || "") === runTag; })[0];
    if (!sale) {
      sale = Services.createSale(tapper, {
        gardenId: gardenId,
        agreementId: agreement.id,
        saleDate: "2026-08-21",
        ticketNumber: runTag,
        buyerName: "ผู้ซื้อทดสอบ E2E",
        productType: "ยางก้อนถ้วย (ทดสอบ)",
        grossWeight: 100,
        tareWeight: 0,
        netWeight: 100,
        weightKg: 100,
        unitPrice: 60,
        buyerDeductions: 100,
        sharedExpenses: 50,
        manualEntry: true,
        requestId: saleRequestId
      });
      sale = findById_("Sales", sale.id);
    }
    if (!sale) throw new Error("E2E_SALE_NOT_CREATED");
    if (sale.status === "pending_owner_review" || sale.status === "ocr_review") {
      sale = Services.confirmSale(owner, { saleId: sale.id, requestId: saleRequestId + "-CONFIRM" });
    }
    if (sale.status !== "confirmed") throw new Error("E2E_SALE_NOT_CONFIRMED");
    if (round_(numeric_(sale.grossSale)) !== 6000 || round_(numeric_(sale.buyerDeductions) + numeric_(sale.sharedExpenses)) !== 150 || round_(numeric_(sale.splitBase)) !== 5850 || round_(numeric_(sale.ownerShare)) !== 3510 || round_(numeric_(sale.tapperShare)) !== 2340) throw new Error("E2E_SALE_CALCULATION_INVALID");

    var settlement = rows_("Settlements").filter(function (row) { return id_(row.gardenId) === gardenId && String(row.referenceNo || "") === runTag; })[0];
    if (!settlement) {
      settlement = Services.createSettlement(tapper, {
        gardenId: gardenId,
        tapperId: tapperId,
        method: "cash",
        amount: 2000,
        transferDate: "2026-08-21",
        referenceNo: runTag,
        note: "รายการทดสอบ E2E: ส่งเงินบางส่วน",
        requestId: settlementRequestId
      });
    }
    if (!settlement) throw new Error("E2E_SETTLEMENT_NOT_CREATED");
    if (settlement.status === "pending_owner_confirmation") settlement = Services.confirmSettlement(owner, { settlementId: settlement.id, requestId: settlementRequestId + "-CONFIRM" });
    if (settlement.status !== "confirmed") throw new Error("E2E_SETTLEMENT_NOT_CONFIRMED");

    var saleRows = rows_("Sales").filter(function (row) { return id_(row.id) === id_(sale.id); });
    var allocationRows = rows_("SettlementAllocations").filter(function (row) { return id_(row.settlementId) === id_(settlement.id) && id_(row.saleId) === id_(sale.id); });
    var allocationTotal = round_(allocationRows.reduce(function (sum, row) { return sum + numeric_(row.amount); }, 0));
    var saleWalletRows = rows_("WalletEntries").filter(function (row) { return id_(row.saleId) === id_(sale.id); });
    var settlementWalletRows = rows_("WalletEntries").filter(function (row) { return id_(row.settlementId) === id_(settlement.id); });
    var auditRows = rows_("AuditLogs").filter(function (row) { return id_(row.entityId) === id_(sale.id) || id_(row.entityId) === id_(settlement.id) || id_(row.entityId) === id_(agreement.id); });
    var hasSaleCreated = auditRows.some(function (row) { return row.action === "sale_created"; });
    var hasSaleConfirmed = auditRows.some(function (row) { return row.action === "sale_confirmed"; });
    var hasSettlementCreated = auditRows.some(function (row) { return row.action === "settlement_created"; });
    var hasSettlementConfirmed = auditRows.some(function (row) { return row.action === "settlement_confirmed"; });
    if (saleRows.length !== 1 || allocationTotal !== 2000 || saleWalletRows.length !== 2 || settlementWalletRows.length !== 1 || !hasSaleCreated || !hasSaleConfirmed || !hasSettlementCreated || !hasSettlementConfirmed) throw new Error("E2E_EVIDENCE_ASSERTION_FAILED");

    var result = { status: "completed", testTag: runTag, gardenId: gardenId, agreementId: agreement.id, saleId: sale.id, settlementId: settlement.id, expected: { grossSale: 6000, deductions: 150, splitBase: 5850, ownerShare: 3510, tapperShare: 2340, settlementAmount: 2000 }, evidence: { saleStatus: sale.status, settlementStatus: settlement.status, allocationTotal: allocationTotal, saleWalletEntries: saleWalletRows.length, settlementWalletEntries: settlementWalletRows.length, auditEvents: auditRows.length }, completedAt: nowIso_() };
    props.setProperty(stateKey, "completed");
    props.setProperty("PARAWALLET_E2E_PAHPAYOM_RESULT", JSON.stringify(result));
    return result;
  });
}

function previewAuthorizedE2ETest() {
  var gardenId = "garden-pahpayom-001";
  var runTag = "E2E-PAHPAYOM-001";
  return { garden: findById_("Gardens", gardenId), agreement: rows_("Agreements").filter(function (row) { return id_(row.gardenId) === gardenId && row.status === "active"; }), existingSale: rows_("Sales").filter(function (row) { return id_(row.gardenId) === gardenId && String(row.ticketNumber || "") === runTag; }), existingSettlement: rows_("Settlements").filter(function (row) { return id_(row.gardenId) === gardenId && String(row.referenceNo || "") === runTag; }), expected: { grossSale: 6000, deductions: 150, splitBase: 5850, ownerShare: 3510, tapperShare: 2340, settlementAmount: 2000 } };
}

function getAuthorizedE2ETestResult() {
  return PropertiesService.getScriptProperties().getProperty("PARAWALLET_E2E_PAHPAYOM_RESULT") || "NOT_COMPLETED";
}


function mapLegacyAgreementRow_(row) {
  return [
    row[0], row[1], row[2], row[3], row[4], row[5], row[6],
    "", "", "", "",
    row[7], row[8], row[9], row[10], row[11]
  ];
}

function mapLegacyGardenRow_(row) {
  return [row[0], row[1], row[2], "", row[3], row[4], row[5], row[6], row[7], row[8], row[9]];
}

function mapLegacyBuyerRow_(row) {
  return [row[0], row[1], row[2], row[3], row[4], row[5], ""];
}

function mapLegacySaleRow_(row) {
  return [
    row[0], row[1], "", row[2], row[3], "", "", row[4], "", "",
    row[5], row[6], row[7], 0, row[7], "", row[7], row[8], row[8], row[9],
    row[10], row[11], row[12], row[13], row[14], row[12], row[15], true,
    row[16], row[17], row[18], ""
  ];
}

function mapLegacySettlementRow_(row) {
  return [row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12], ""];
}

function productionSchemaMigrationPlans_() {
  return [
    { name: "Agreements", legacy: ["id", "gardenId", "ownerId", "tapperId", "version", "ownerPercentage", "tapperPercentage", "effectiveFrom", "effectiveTo", "expenseRules", "status", "createdAt"], mapper: mapLegacyAgreementRow_ },
    { name: "Gardens", legacy: ["id", "ownerId", "name", "province", "district", "areaRai", "treeCount", "status", "createdAt", "updatedAt"], mapper: mapLegacyGardenRow_ },
    { name: "Buyers", legacy: ["id", "name", "branch", "contact", "notes", "status"], mapper: mapLegacyBuyerRow_ },
    { name: "Sales", legacy: ["id", "gardenId", "agreementId", "tapperId", "saleDate", "buyerName", "productType", "weightKg", "unitPrice", "grossSale", "buyerDeductions", "sharedExpenses", "splitBase", "ownerShare", "tapperShare", "status", "receiptFileId", "ocrConfidence", "createdAt"], mapper: mapLegacySaleRow_ },
    { name: "Settlements", legacy: ["id", "gardenId", "tapperId", "ownerId", "method", "amount", "transferDate", "bank", "referenceNo", "slipFileId", "location", "note", "status"], mapper: mapLegacySettlementRow_ }
  ];
}

function classifyKnownSchema_(actual, expected, legacy) {
  if (headersEqual_(actual, expected)) return "correct";
  var legacyPrefix = actual.slice(0, legacy.length);
  var trailingBlank = actual.slice(legacy.length).every(function (value) { return String(value || "") === ""; });
  return legacyPrefix.length === legacy.length && headersEqual_(legacyPrefix, legacy) && trailingBlank ? "known_legacy" : "unexpected";
}

function ensureSheetColumnCapacity_(sheet, columnCount) {
  var current = sheet.getMaxColumns();
  if (current < columnCount) sheet.insertColumnsAfter(current, columnCount - current);
}

function migrateKnownLegacySheet_(book, plan, suffix) {
  var sheet = book.getSheetByName(plan.name);
  if (!sheet) throw new Error("SHEET_MISSING:" + plan.name);
  var expected = HEADERS[plan.name];
  var actual = readHeaders_(sheet);
  var classification = classifyKnownSchema_(actual, expected, plan.legacy);
  if (classification === "correct") return { name: plan.name, status: "already_correct", headers: actual };
  if (classification !== "known_legacy") throw new Error("SCHEMA_MIGRATION_UNEXPECTED:" + plan.name + ":" + actual.join(","));

  var backupName = plan.name + "_Backup_" + suffix;
  if (book.getSheetByName(backupName)) backupName += "_" + Utilities.getUuid().slice(0, 6);
  var backup = sheet.copyTo(book).setName(backupName);
  backup.setFrozenRows(1);

  var lastRow = sheet.getLastRow();
  var sourceWidth = Math.max(actual.length, plan.legacy.length);
  var legacyRows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, sourceWidth).getValues() : [];
  var migratedRows = legacyRows.map(plan.mapper);
  ensureSheetColumnCapacity_(sheet, expected.length);
  var clearWidth = Math.max(sheet.getLastColumn(), expected.length);
  sheet.getRange(1, 1, Math.max(lastRow, 1), clearWidth).clearContent();
  sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  if (migratedRows.length) sheet.getRange(2, 1, migratedRows.length, expected.length).setValues(migratedRows);
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
  assertHeaders_(sheet, plan.name);
  return { name: plan.name, status: "migrated", backupSheet: backupName, migratedRows: migratedRows.length, previousHeaders: actual, headers: expected };
}

// Read-only preview. Run this before repairParaWalletProductionSchema().
function previewParaWalletProductionSchemaRepair() {
  var book = SpreadsheetApp.openById(Config.spreadsheetId());
  return productionSchemaMigrationPlans_().map(function (plan) {
    var sheet = book.getSheetByName(plan.name);
    if (!sheet) return { name: plan.name, status: "missing" };
    var actual = readHeaders_(sheet);
    return { name: plan.name, status: classifyKnownSchema_(actual, HEADERS[plan.name], plan.legacy), actual: actual, expected: HEADERS[plan.name], dataRows: Math.max(sheet.getLastRow() - 1, 0) };
  });
}

// Repairs every known production legacy schema in one Script Lock. Each changed
// sheet is copied to a timestamped backup before values are semantically mapped.
function repairParaWalletProductionSchema() {
  return Locking.run("admin:repair-production-schema", function () {
    var book = SpreadsheetApp.openById(Config.spreadsheetId());
    var suffix = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Etc/UTC", "yyyyMMdd_HHmmss");
    var results = productionSchemaMigrationPlans_().map(function (plan) { return migrateKnownLegacySheet_(book, plan, suffix); });
    SpreadsheetApp.flush();
    var schema = Repositories.validateSchema();
    var mismatches = schema.filter(function (item) { return item.status !== "ok"; });
    return { status: mismatches.length ? "incomplete" : "ready", release: PARAWALLET_RELEASE, schemaVersion: PARAWALLET_SCHEMA_VERSION, financialSchemaReady: mismatches.length === 0, results: results, mismatches: mismatches };
  });
}

// Migrates only the known legacy Agreements schema created before the current
// 16-column Data Model. It makes a full backup copy first, preserves the
// meaning of effective dates/status/createdAt, and refuses unexpected schemas.
function repairParaWalletAgreementSchema() {
  return Locking.run("admin:repair-agreements-schema", function () {
    var book = SpreadsheetApp.openById(Config.spreadsheetId());
    var suffix = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Etc/UTC", "yyyyMMdd_HHmmss");
    var plan = productionSchemaMigrationPlans_().filter(function (item) { return item.name === "Agreements"; })[0];
    var result = migrateKnownLegacySheet_(book, plan, suffix);
    SpreadsheetApp.flush();
    result.schemaVersion = PARAWALLET_SCHEMA_VERSION;
    return result;
  });
}
