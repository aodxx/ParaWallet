import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const code = readFileSync(new URL("../appsscript/Code.gs", import.meta.url), "utf8");
const expectedAgreementHeaders = [
  "id",
  "gardenId",
  "ownerId",
  "tapperId",
  "version",
  "ownerPercentage",
  "tapperPercentage",
  "sharedExpenseRulesJson",
  "ownerExpenseRulesJson",
  "tapperExpenseRulesJson",
  "advanceRuleJson",
  "effectiveFrom",
  "effectiveTo",
  "expenseRules",
  "status",
  "createdAt",
  "dataMode",
];
const legacyAgreementHeaders = expectedAgreementHeaders.slice(0, 7).concat(["effectiveFrom", "effectiveTo", "expenseRules", "status", "createdAt"]);

function isKnownLegacyHeader(actual: string[]) {
  const prefix = actual.slice(0, legacyAgreementHeaders.length);
  const trailing = actual.slice(legacyAgreementHeaders.length);
  return JSON.stringify(prefix) === JSON.stringify(legacyAgreementHeaders) && trailing.every((value) => value === "");
}

describe("Apps Script schema safety contract", () => {
  it("recognizes the observed legacy 12-column header plus four blank cells", () => {
    expect(isKnownLegacyHeader([...legacyAgreementHeaders, "", "", "", ""])).toBe(true);
  });

  it("rejects a legacy header with an unexpected non-blank trailing cell", () => {
    expect(isKnownLegacyHeader([...legacyAgreementHeaders, "unexpected", "", "", ""])).toBe(false);
  });

  it("contains read-only schema diagnostics", () => {
    expect(code).toContain("result.schema = Repositories.validateSchema();");
    expect(code).toContain("result.schemaMismatches");
    expect(code).toContain("result.financialSchemaReady");
    expect(code).toContain('var PARAWALLET_RELEASE = "2026.09.01-financial-clarity-v11";');
    expect(code).toContain("automaticReadingReady: Boolean(Config.geminiKey())");
    expect(code).toContain('var PARAWALLET_SCHEMA_VERSION = "2026-09-financial-clarity-v4";');
    expect(code).toContain("release: PARAWALLET_RELEASE");
    expect(code).toContain("schemaVersion: PARAWALLET_SCHEMA_VERSION");
    expect(code).toContain('if (request.action === "health.get") return healthCheck_();');
    expect(code).toContain('if (request.action === "diagnostics.get") {');
    expect(code.indexOf("var user = Auth.requireUser(request.authToken)")).toBeLessThan(code.indexOf('if (request.action === "diagnostics.get") {'));
    expect(code).toContain('if (user.role !== "owner" && user.role !== "admin") throw new Error("OWNER_PERMISSION_REQUIRED")');
  });

  it("replays the same mutation request instead of writing a duplicate record", () => {
    expect(code).toContain("var cached = Idempotency.get(request.requestId)");
    expect(code).toContain("if (cached) return cached");
    expect(code).toContain("Idempotency.put(request.requestId, freshResponse, request.action)");
    expect(code).toContain('Locking.run("request:" + request.requestId');
  });

  it("caches sheet rows only within one Apps Script request and invalidates writes", () => {
    expect(code).toContain("rowsCache_: {}");
    expect(code).toContain("this.book_ = null; this.rowsCache_ = {};");
    expect(code).toContain("Object.prototype.hasOwnProperty.call(this.rowsCache_, name)");
    expect(code).toContain("delete this.rowsCache_[name]");
    expect(code).toContain("delete Repositories.rowsCache_[name]");
  });

  it("uses the canonical stateless Gemini Interactions adapter with Vision evidence", () => {
    expect(code).toContain('var PINNED_GEMINI_MODEL = "gemini-3.7-flash";');
    expect(code).toContain('configured === PINNED_GEMINI_MODEL ? configured : PINNED_GEMINI_MODEL');
    expect(code).toContain('modelPropertyStatus: modelPropertyStatus');
    expect(code).toContain('GEMINI_MODEL_PROPERTY_INVALID_IGNORED');
    expect(code).not.toContain("gemini-1.5-flash");
    expect(code).toContain("response.getResponseCode()");
    expect(code).toContain('"https://generativelanguage.googleapis.com/v1beta/interactions"');
    expect(code).not.toContain('"https://generativelanguage.googleapis.com/v1/interactions"');
    expect(code).toContain('store: false');
    expect(code).toContain('response_format: { type: "text", mime_type: "application/json", schema: this.responseSchema_() }');
    expect(code).toContain('if (!this.responseShapeValid_(fields)) throw new Error("OCR_PROVIDER_SCHEMA_MISMATCH")');
    expect(code).toContain('headers: { "x-goog-api-key": Config.geminiKey() }');
    expect(code).toContain('DOCUMENT_TEXT_DETECTION');
    expect(code).toContain('untrusted transcript');
    expect(code).toContain('visionOcrUsed');
    expect(code).toContain('fetchJsonWithRetry_');
    expect(code).toContain('"GEMINI"');
    expect(code).toContain('"VISION"');
    expect(code).toContain('"_HTTP_" + lastCode');
    expect(code).toContain('vision = { ok: false, text: "", errorCode: visionError }');
  });

  it("provides a private pre-deployment Gemini self-test without a web route or persistent writes", () => {
    expect(code).toContain("function testGeminiProviderConnection()");
    expect(code).toContain("return OCR.providerConnectionTest_();");
    expect(code).toContain('code: "GEMINI_SELF_TEST_FAILED"');
    expect(code).toContain('result.code = "GEMINI_NOT_CONFIGURED"');
    expect(code).toContain('result.code = result.ok ? "GEMINI_CONNECTION_OK" : "GEMINI_STRUCTURED_OUTPUT_INVALID"');
    expect(code).toContain('var extracted = this.gemini_(syntheticPng, "image/png", this.providerTestPrompt_()');
    expect(code).not.toContain('case "testGeminiProviderConnection"');
    expect(code).not.toContain('case "ocr.providerTest"');
    const selfTest = code.match(/providerConnectionTest_: function \(\) \{[\s\S]*?\n  \},\n  providerTestPrompt_/)?.[0] || "";
    expect(selfTest).not.toContain("DriveStorage");
    expect(selfTest).not.toContain("Repositories");
    expect(selfTest).not.toContain("getContentText");
  });

  it("does not score empty OCR fields as a successful extraction", () => {
    expect(code).toContain('if (fields.documentClass !== "rubber_receipt") return 0;');
    expect(code).toContain('["OCR_PROVIDER_UNAVAILABLE"]');
  });

  it("reports unavailable OCR before storing an orphan receipt image", () => {
    expect(code).toContain('? "not_configured" : "provider_error"');
    expect(code).toContain('if (!Config.geminiKey()) throw new Error("OCR_NOT_CONFIGURED")');
    expect(code.indexOf('throw new Error("OCR_NOT_CONFIGURED")')).toBeLessThan(code.indexOf('DriveStorage.save(contentBase64, mimeType, payload.filename, "receipts"'));
  });

  it("stores settlement evidence in Drive without writing base64 into AuditLogs", () => {
    expect(code).toContain('throw new Error("SETTLEMENT_SLIP_REQUIRED")');
    expect(code).toContain('throw new Error("SETTLEMENT_SLIP_TYPE_INVALID")');
    expect(code).toContain('DriveStorage.save(payload.slipData');
    expect(code).toContain('"settlements", user.id');
    expect(code).toContain('slipFileId: slipFileId');
    expect(code).toContain('throw new Error("CASH_LOCATION_REQUIRED")');
    expect(code).not.toContain('writeAudit_(user, "settlement_created", "settlement", settlementId, null, payload');
  });

  it("serves settlement evidence only through the authorized settlement relationship", () => {
    expect(code).toContain('case "settlements.evidence": return Services.settlementEvidence');
    expect(code).toContain('"settlements.evidence"');
    const service = code.match(/Services\.settlementEvidence = function[\s\S]*?\n};/)?.[0] || "";
    expect(service).toContain('findById_("Settlements", payload.settlementId)');
    expect(service).toContain("requireGarden_(user, settlement.gardenId)");
    expect(service).toContain('row.folderType === "settlements"');
    expect(service).toContain('id_(row.ownerId) === id_(settlement.tapperId)');
    expect(service).toContain("DriveApp.getFileById(settlement.slipFileId)");
    expect(service).toContain('dataUrl: "data:" + mimeType + ";base64,"');
  });

  it("keeps concurrent read models outside the global mutation lock", () => {
    expect(code).toContain("if (isReadOnlyAction_(request.action))");
    expect(code).toContain('"dashboard.get"');
    expect(code).toContain('"sales.list"');
    expect(code).toContain('"wallets.me"');
    expect(code).toContain('"notifications.list"');
    expect(code).toContain("var wallet = Services.wallet(user, { gardenId: garden.id });");
    expect(code).toContain("monthlySales: round_(monthlySales.reduce");
    expect(code).toContain("monthlySalesSeries: monthlySalesSeries.map(round_)");
  });

  it("counts every role-scoped pending task and unread notification on the dashboard", () => {
    const dashboard = code.match(/dashboard: function \(user\)[\s\S]*?\n  },\n  createSale/)?.[0] || "";
    expect(dashboard).toContain('row.status === "pending_owner_review" || row.status === "ocr_review"');
    expect(dashboard).toContain('row.status !== "pending_owner_confirmation"');
    expect(dashboard).toContain('pendingReviews: pendingSales + pendingSettlements');
    expect(dashboard).toContain('pendingSales: pendingSales');
    expect(dashboard).toContain('pendingSettlements: pendingSettlements');
    expect(dashboard).toContain('unreadNotifications: unreadNotifications');
    expect(dashboard).toContain('walletDetails: wallet');
  });

  it("returns actionable notification targets and makes read idempotent", () => {
    expect(code).toContain("function notificationTarget_(type)");
    expect(code).toContain("function notificationBody_(body, entityType, entityId)");
    expect(code).toContain("function notificationView_(row)");
    expect(code).toContain("_notificationPayload: 1");
    expect(code).toContain('view.entityId = String(payload.entityId || "")');
    expect(code).toContain('if (value.indexOf("settlement_") === 0) return "settlements"');
    expect(code).toContain('if (value.indexOf("sale_") === 0 || value.indexOf("dispute_") === 0) return "sales"');
    expect(code).toContain('targetScreen: notificationTarget_(row.type)');
    expect(code).toContain('if (notification.readAt) return notificationView_(notification)');
    expect(code).toContain('"sale", saleId');
    expect(code).toContain('"settlement", settlementId');
  });

  it("enforces owner-controlled, auditable garden membership", () => {
    expect(code).toContain('case "members.add": return Services.addMember');
    expect(code).toContain('case "members.deactivate": return Services.deactivateMember');
    expect(code).toContain("request.payload.requestId = request.requestId");
    expect(code).toMatch(/Services\.listMembers[\s\S]*?requireOwner_\(user, payload\.gardenId\)/);
    expect(code).toMatch(/Services\.addMember[\s\S]*?requireOwner_\(user, payload\.gardenId\)/);
    expect(code).toContain('throw new Error("TAPPER_USER_NOT_REGISTERED")');
    expect(code).toContain('throw new Error("MEMBER_ROLE_INVALID")');
    expect(code).toContain('"garden_member_added"');
    expect(code).toContain('"garden_member_deactivated"');
  });

  it("does not deactivate a Tapper while financial rights remain open", () => {
    expect(code).toContain('throw new Error("MEMBER_HAS_ACTIVE_AGREEMENT")');
    expect(code).toContain('throw new Error("MEMBER_HAS_OPEN_ITEMS")');
    expect(code).toContain('throw new Error("MEMBER_HAS_OUTSTANDING_BALANCE")');
    expect(code).toContain("function memberOwnerMoneyHeld_");
    expect(code).toContain('updateRowById_("GardenMembers", membership.id, { status: "inactive" })');
  });

  it("scopes Tapper wallet and settlement allocation to the same Tapper", () => {
    expect(code).toContain("function settlementOutstanding_(gardenId, ownerId, tapperId, dataMode)");
    expect(code).toContain("id_(row.tapperId) === id_(tapperId)");
    expect(code).toContain("settlementOutstanding_(payload.gardenId, access.garden.ownerId, tapperId, dataMode)");
    expect(code).toContain("settlementOutstanding_(settlement.gardenId, settlement.ownerId, settlement.tapperId, settlementMode)");
    expect(code).toContain('id_(row.tapperId) === id_(settlement.tapperId) && String(row.dataMode || "") === settlementMode && row.status === "confirmed"');
    expect(code).toContain("var tapperSettlement = tapperId ? settlementOutstanding_(garden.id, ownerId, tapperId) : settlement");
  });

  it("keeps settlement confirmation reads bounded as sale history grows", () => {
    expect(code).toContain("Repositories.resetRequestContext_();");
    expect(code).toContain("workbook_: function ()");
    expect(code).toContain('var existingAllocations = rows_("SettlementAllocations");');
    expect(code).toContain('var confirmedAdjustments = rows_("Adjustments")');
    const service = code.match(/Services\.confirmSettlement = function[\s\S]*?\n};/)?.[0] || "";
    const saleLoop = service.match(/rows_\("Sales"\)[\s\S]*?if \(remaining !== 0\)/)?.[0] || "";
    expect(saleLoop).not.toContain('rows_("SettlementAllocations")');
    expect(saleLoop).not.toContain("ownerAdjustmentForSale_");
    expect(service).toContain('return settlementView_(Object.assign({}, settlement, { status: "confirmed" }));');
  });

  it("binds scanned receipt evidence to the authenticated Tapper and Sale", () => {
    expect(code).toContain('case "sales.receipt": return Services.saleReceipt');
    expect(code).toContain('"sales.receipt"');
    expect(code).toContain("requireTapper_(user, payload.gardenId)");
    expect(code).toContain('throw new Error("SALE_RECEIPT_REQUIRED")');
    expect(code).toContain('throw new Error("SALE_RECEIPT_ACCESS_DENIED")');
    expect(code).toContain('throw new Error("SALE_RECEIPT_MISMATCH")');
    expect(code).toContain('receiptId: receipt ? receipt.id : ""');
    expect(code).toContain("var receiptFileId = receipt ? receipt.fileId : \"\"");
  });

  it("serves only the receipt referenced by an authorized garden Sale", () => {
    const service = code.match(/Services\.saleReceipt = function[\s\S]*?\n};/)?.[0] || "";
    expect(service).toContain('findById_("Sales", payload.saleId)');
    expect(service).toContain("requireGarden_(user, sale.gardenId)");
    expect(service).toContain("DriveApp.getFileById(fileId)");
    expect(service).toContain('String(mimeType).indexOf("image/")');
    expect(service).toContain('dataUrl: "data:" + mimeType + ";base64,"');
  });

  it("normalizes and limits receipt image data before OCR and Drive writes", () => {
    expect(code).toContain('var contentBase64 = String(fileBase64 || "").split(",").pop()');
    expect(code).toContain('throw new Error("RECEIPT_IMAGE_TYPE_INVALID")');
    expect(code).toContain('throw new Error("RECEIPT_IMAGE_TOO_LARGE")');
    expect(code).toContain('OCR.extract(contentBase64, mimeType)');
  });

  it("extracts layout-independent receipt data with a pinned current model and structured schema", () => {
    expect(code).toContain('geminiModel: function ()');
    expect(code).toContain('"gemini-3.7-flash"');
    expect(code).toContain('response_format');
    expect(code).toContain('schema: this.responseSchema_()');
    expect(code).toContain('weightEntriesKg');
    expect(code).toContain('tareWeightKg');
    expect(code).toContain('documentClass');
    expect(code).toContain('never depend on fixed x/y coordinates');
    expect(code).toContain('fetchJsonWithRetry_');
    expect(code).toContain('String(provider || "OCR_PROVIDER") + "_HTTP_" + lastCode');
  });

  it("blocks unsafe scanned sales and reconciles normal shop rounding", () => {
    const service = code.match(/Services\.createSale = function[\s\S]*?\n};/)?.[0] || "";
    expect(service).toContain('throw new Error("OCR_HUMAN_VERIFICATION_REQUIRED")');
    expect(service).toContain('throw new Error("RECEIPT_NOT_FILLED_SALE")');
    expect(service).toContain('throw new Error("RECEIPT_GARDEN_MISMATCH")');
    expect(service).toContain('throw new Error("RECEIPT_TYPE_REQUIRED")');
    expect(service).toContain('throw new Error("RECEIPT_WEIGHT_ROWS_MISMATCH")');
    expect(service).toContain('throw new Error("RECEIPT_NET_WEIGHT_MISMATCH")');
    expect(service).toContain('throw new Error("RECEIPT_DRC_FIELDS_REQUIRED")');
    expect(service).toContain('throw new Error("RECEIPT_DRC_MISMATCH")');
    expect(service).toContain('throw new Error("RECEIPT_MATH_MISMATCH")');
    expect(service).toContain('roundingDifference > 0');
    expect(service).toContain('buyerDeductions = round_(buyerDeductions + roundingDifference)');
    expect(code).toContain('result.fields.sourceGardenId = payload.gardenId');
  });

  it("migrates legacy Agreement values into the current 17-column positions", () => {
    const source = code.match(/function mapLegacyAgreementRow_\(row\) \{[\s\S]*?\n\}/)?.[0];
    expect(source).toBeTruthy();
    const mapper = new Function(`${source}; return mapLegacyAgreementRow_;`)() as (row: unknown[]) => unknown[];
    const legacyRow = ["a1", "g1", "o1", "t1", 2, 60, 40, "2026-08-21", "", "{}", "active", "2026-08-21T00:00:00Z"];
    expect(mapper(legacyRow)).toEqual([
      "a1", "g1", "o1", "t1", 2, 60, 40,
      "", "", "", "",
      "2026-08-21", "", "{}", "active", "2026-08-21T00:00:00Z", "production",
    ]);
  });

  it("semantically migrates the observed legacy Garden row", () => {
    const source = code.match(/function mapLegacyGardenRow_\(row\) \{[\s\S]*?\n\}/)?.[0];
    expect(source).toBeTruthy();
    const mapper = new Function(`${source}; return mapLegacyGardenRow_;`)() as (row: unknown[]) => unknown[];
    expect(mapper(["g1", "o1", "สวน", "พัทลุง", "ป่าพะยอม", 10, 1000, "active", "created", "updated"])).toEqual([
      "g1", "o1", "สวน", "", "พัทลุง", "ป่าพะยอม", 10, 1000, "active", "created", "updated",
    ]);
  });

  it("semantically expands the observed legacy Sale row to 33 columns", () => {
    const source = code.match(/function mapLegacySaleRow_\(row\) \{[\s\S]*?\n\}/)?.[0];
    expect(source).toBeTruthy();
    const mapper = new Function(`${source}; return mapLegacySaleRow_;`)() as (row: unknown[]) => unknown[];
    const migrated = mapper(["s1", "g1", "a1", "t1", "2026-08-21", "buyer", "rubber", 100, 60, 6000, 100, 50, 5850, 3510, 2340, "confirmed", "file1", 0.95, "created"]);
    expect(migrated).toHaveLength(33);
    expect(migrated[3]).toBe("a1");
    expect(migrated[7]).toBe("2026-08-21");
    expect(migrated[12]).toBe(100);
    expect(migrated[14]).toBe(100);
    expect(migrated[16]).toBe(100);
    expect(migrated[19]).toBe(6000);
    expect(migrated[25]).toBe(5850);
    expect(migrated[26]).toBe("confirmed");
    expect(migrated[30]).toBe("created");
    expect(migrated[32]).toBe("production");
  });

  it("backs up every changed legacy sheet and flushes writes before releasing the script lock", () => {
    expect(code).toContain("sheet.copyTo(book).setName(backupName)");
    expect(code).toContain("var migratedRows = legacyRows.map(plan.mapper);");
    expect(code).toContain("function repairParaWalletProductionSchema()");
    expect(code).toContain('name: "Gardens"');
    expect(code).toContain('name: "Buyers"');
    expect(code).toContain('name: "Sales"');
    expect(code).toContain('name: "Settlements"');
    expect(code).toContain("try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }");
  });

  it("separates audited test fixtures from production balances without deleting rows", () => {
    expect(code).toContain("function migrateFinancialClarityV11()");
    expect(code).toContain("previewFinancialClarityV11Migration");
    expect(code).toContain("sheet.copyTo(book).setName(backupName)");
    expect(code).toContain("row.concat([DATA_MODE_TEST])");
    expect(code).toContain('function productionRows_(name)');
    expect(code).toContain('testDataCount: testDataCount');
    expect(code).toContain('dataMode: dataMode');
    expect(code).toContain("delete request.payload._dataMode");
  });

  it("normalizes date-only financial fields in Bangkok before returning them", () => {
    expect(code).toContain('var PARAWALLET_TIME_ZONE = "Asia/Bangkok"');
    expect(code).toContain('function dateOnly_(value)');
    expect(code).toContain('Utilities.formatDate(value, PARAWALLET_TIME_ZONE, "yyyy-MM-dd")');
    expect(code).toContain('dateOnlyView_(row, "saleDate")');
    expect(code).toContain('dateOnlyView_(row, "effectiveFrom")');
    expect(code).toContain('dateOnlyView_(settlement, "transferDate")');
  });

  it("guards all critical financial mutations before row writes", () => {
    expect(code.match(/assertFinancialSchemaReady_\(\);/g)?.length).toBeGreaterThanOrEqual(10);
    expect(code).toContain("E2E_PRODUCTION_SCHEMA_REPAIR_REQUIRED");
    expect(code).toContain("assertFinancialSchemaReady_();");
    expect(code).toContain("function repairParaWalletAgreementSchema()");
  });

  it("requires exact rounded ledger equality before Sale confirmation", () => {
    expect(code).toContain("var ledgerExpected = round_(numeric_(sale.buyerDeductions) + numeric_(sale.sharedExpenses) + numeric_(sale.ownerShare) + numeric_(sale.tapperShare));");
    expect(code).toContain("if (round_(numeric_(sale.grossSale)) !== ledgerExpected) throw new Error(\"LEDGER_IMBALANCE\")");
  });
});
