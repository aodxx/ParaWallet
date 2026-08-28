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
    expect(code).toContain('var PARAWALLET_RELEASE = "2026.08.28-hybrid-ocr-v3";');
    expect(code).toContain('var PARAWALLET_SCHEMA_VERSION = "2026-08-production-v3";');
    expect(code).toContain("release: PARAWALLET_RELEASE");
    expect(code).toContain("schemaVersion: PARAWALLET_SCHEMA_VERSION");
  });

  it("caches sheet rows only within one Apps Script request and invalidates writes", () => {
    expect(code).toContain("rowsCache_: {}");
    expect(code).toContain("this.book_ = null; this.rowsCache_ = {};");
    expect(code).toContain("Object.prototype.hasOwnProperty.call(this.rowsCache_, name)");
    expect(code).toContain("delete this.rowsCache_[name]");
    expect(code).toContain("delete Repositories.rowsCache_[name]");
  });

  it("uses a current configurable Gemini model and protects OCR provider failures", () => {
    expect(code).toContain('geminiModel: function () { return this.get("GEMINI_MODEL", false) || "gemini-3.7-flash"; }');
    expect(code).not.toContain("gemini-1.5-flash");
    expect(code).toContain("response.getResponseCode()");
    expect(code).toContain('PROVIDER_HTTP_');
    expect(code).toContain('PROVIDER_NO_CANDIDATE');
    expect(code).toContain('PROVIDER_INVALID_JSON');
    expect(code).toContain('responseMimeType: "application/json"');
    expect(code).toContain('responseSchema: schema');
    expect(code).toContain('tableRows');
    expect(code).toContain('var vision = Config.visionKey() ? this.vision_');
    expect(code).toContain('Reference text from a second OCR engine');
    expect(code).toContain('visionAgreement');
    expect(code).toContain('VISION_HTTP_');
  });

  it("does not score empty OCR fields as a successful extraction", () => {
    expect(code).toContain('fields.buyerDeductions !== undefined && fields.buyerDeductions !== null && fields.buyerDeductions !== ""');
    expect(code).toContain('fields: { ocrError: code }');
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
    expect(code).toContain('if (value.indexOf("settlement_") === 0) return "settlements"');
    expect(code).toContain('if (value.indexOf("sale_") === 0 || value.indexOf("dispute_") === 0) return "sales"');
    expect(code).toContain('targetScreen: notificationTarget_(row.type)');
    expect(code).toContain('if (notification.readAt) return Object.assign');
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
    expect(code).toContain("function settlementOutstanding_(gardenId, ownerId, tapperId)");
    expect(code).toContain("id_(row.tapperId) === id_(tapperId)");
    expect(code).toContain("settlementOutstanding_(payload.gardenId, access.garden.ownerId, tapperId)");
    expect(code).toContain("settlementOutstanding_(settlement.gardenId, settlement.ownerId, settlement.tapperId)");
    expect(code).toContain('id_(row.tapperId) === id_(settlement.tapperId) && row.status === "confirmed"');
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
    expect(service).toContain('return Object.assign({}, settlement, { status: "confirmed" });');
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

  it("migrates legacy Agreement values into the correct 16-column positions", () => {
    const source = code.match(/function mapLegacyAgreementRow_\(row\) \{[\s\S]*?\n\}/)?.[0];
    expect(source).toBeTruthy();
    const mapper = new Function(`${source}; return mapLegacyAgreementRow_;`)() as (row: unknown[]) => unknown[];
    const legacyRow = ["a1", "g1", "o1", "t1", 2, 60, 40, "2026-08-21", "", "{}", "active", "2026-08-21T00:00:00Z"];
    expect(mapper(legacyRow)).toEqual([
      "a1", "g1", "o1", "t1", 2, 60, 40,
      "", "", "", "",
      "2026-08-21", "", "{}", "active", "2026-08-21T00:00:00Z",
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

  it("semantically expands the observed legacy Sale row to 32 columns", () => {
    const source = code.match(/function mapLegacySaleRow_\(row\) \{[\s\S]*?\n\}/)?.[0];
    expect(source).toBeTruthy();
    const mapper = new Function(`${source}; return mapLegacySaleRow_;`)() as (row: unknown[]) => unknown[];
    const migrated = mapper(["s1", "g1", "a1", "t1", "2026-08-21", "buyer", "rubber", 100, 60, 6000, 100, 50, 5850, 3510, 2340, "confirmed", "file1", 0.95, "created"]);
    expect(migrated).toHaveLength(32);
    expect(migrated[3]).toBe("a1");
    expect(migrated[7]).toBe("2026-08-21");
    expect(migrated[12]).toBe(100);
    expect(migrated[14]).toBe(100);
    expect(migrated[16]).toBe(100);
    expect(migrated[19]).toBe(6000);
    expect(migrated[25]).toBe(5850);
    expect(migrated[26]).toBe("confirmed");
    expect(migrated[30]).toBe("created");
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
