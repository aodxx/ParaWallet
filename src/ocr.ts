export type ReceiptType = "weigh_ticket" | "rubber_form" | "unknown";

export type OcrFields = Record<string, unknown>;

export type NormalizedOcrFields = OcrFields & {
  receiptType: ReceiptType;
  saleDate: string;
  buyerName: string;
  ticketNumber: string;
  productType: string;
  freshWeightKg: string;
  drc: string;
  dryWeightKg: string;
  weightKg: string;
  unitPrice: string;
  grossSale: string;
  buyerDeductions: string;
  needsReview: boolean;
};

const thaiDigits = (value: string) => value.replace(/[๐-๙]/g, (digit) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)));

export function numericText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const normalized = thaiDigits(String(value)).replace(/,/g, "").replace(/บาท|กก\.|กิโลกรัม|%/g, "").trim();
  const number = Number(normalized);
  return Number.isFinite(number) ? String(number) : "";
}

const text = (value: unknown) => value === undefined || value === null ? "" : String(value).trim();

export function normalizeOcrFields(input: OcrFields): NormalizedOcrFields {
  const freshWeightKg = numericText(input.freshWeightKg ?? input.grossWeight);
  const drc = numericText(input.drc ?? input.dryRubberPercent);
  const dryWeightKg = numericText(input.dryWeightKg ?? input.dryRubberWeightKg);
  const weightKg = numericText(input.weightKg ?? input.netWeight) || dryWeightKg || freshWeightKg;
  const unitPrice = numericText(input.unitPrice ?? input.pricePerKg ?? input.price);
  const grossSale = numericText(input.grossSale ?? input.totalAmount ?? input.amount);
  const receiptType = input.receiptType === "weigh_ticket" || input.receiptType === "rubber_form" ? input.receiptType : "unknown";
  return {
    ...input,
    receiptType,
    saleDate: text(input.saleDate),
    buyerName: text(input.buyerName ?? input.buyer),
    ticketNumber: text(input.ticketNumber ?? input.receiptNumber),
    productType: text(input.productType ?? (receiptType === "rubber_form" ? "น้ำยาง/ยางแห้ง" : "")),
    freshWeightKg,
    drc,
    dryWeightKg,
    weightKg,
    unitPrice,
    grossSale,
    buyerDeductions: numericText(input.buyerDeductions ?? input.deductions ?? 0) || "0",
    needsReview: input.needsReview !== false
  };
}

export function receiptTypeLabel(type: ReceiptType): string {
  if (type === "weigh_ticket") return "ใบชั่งน้ำหนัก / บิลเงินสด";
  if (type === "rubber_form") return "แบบฟอร์มน้ำยาง–เปอร์เซ็นต์–ยางแห้ง";
  return "ยังไม่ทราบรูปแบบใบเสร็จ";
}

export function validateReceiptMath(fields: Pick<NormalizedOcrFields, "receiptType" | "freshWeightKg" | "drc" | "dryWeightKg" | "weightKg" | "unitPrice" | "grossSale">): { weightConsistent: boolean | null; amountConsistent: boolean | null } {
  const fresh = Number(fields.freshWeightKg);
  const drc = Number(fields.drc);
  const dry = Number(fields.dryWeightKg);
  const weight = Number(fields.weightKg);
  const price = Number(fields.unitPrice);
  const amount = Number(fields.grossSale);
  const weightConsistent = fields.receiptType === "rubber_form" && fresh > 0 && drc > 0 && dry > 0 ? Math.abs(fresh * drc / 100 - dry) <= 0.5 : null;
  const amountConsistent = weight > 0 && price >= 0 && amount > 0 ? Math.abs(weight * price - amount) <= Math.max(1, amount * 0.01) : null;
  return { weightConsistent, amountConsistent };
}
