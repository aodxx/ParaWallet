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
    expect(code).toContain('var PARAWALLET_RELEASE = "2026.08.24-phase-d6";');
    expect(code).toContain('var PARAWALLET_SCHEMA_VERSION = "2026-08-production-v3";');
    expect(code).toContain("release: PARAWALLET_RELEASE");
    expect(code).toContain("schemaVersion: PARAWALLET_SCHEMA_VERSION");
  });

  it("stores settlement evidence in Drive without writing base64 into AuditLogs", () => {
    expect(code).toContain('throw new Error("SETTLEMENT_SLIP_REQUIRED")');
    expect(code).toContain('DriveStorage.save(payload.slipData');
    expect(code).toContain('"settlements", user.id');
    expect(code).toContain('slipFileId: slipFileId');
    expect(code).toContain('throw new Error("CASH_LOCATION_REQUIRED")');
    expect(code).not.toContain('writeAudit_(user, "settlement_created", "settlement", settlementId, null, payload');
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
