export type ReceiptType = "weigh_ticket" | "rubber_form" | "unknown";
export type ReceiptDocumentClass = "rubber_receipt" | "blank_template" | "promotional_example" | "not_receipt" | "unreadable";

export type OcrFields = Record<string, unknown>;

export type NormalizedOcrFields = OcrFields & {
  documentClass: ReceiptDocumentClass;
  receiptType: ReceiptType;
  saleDate: string;
  buyerName: string;
  ticketNumber: string;
  productType: string;
  freshWeightKg: string;
  drc: string;
  dryWeightKg: string;
  grossWeightKg: string;
  tareWeightKg: string;
  netWeightKg: string;
  weightKg: string;
  unitPrice: string;
  grossSale: string;
  buyerDeductions: string;
  weightEntriesKg: number[];
  uncertainFields: string[];
  warnings: string[];
  needsReview: boolean;
  ocrError: string;
};

const thaiDigits = (value: string) => value.replace(/[๐-๙]/g, (digit) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)));

export function numericText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const normalized = thaiDigits(String(value)).replace(/,/g, "").replace(/บาท|กก\.|กิโลกรัม|%/g, "").trim();
  const number = Number(normalized);
  return Number.isFinite(number) ? String(number) : "";
}

const text = (value: unknown) => value === undefined || value === null ? "" : String(value).trim();
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function normalizeReceiptDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const local = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  const parts = iso ? [iso[3], iso[2], iso[1]] : local?.slice(1);
  if (!parts) return "";
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  let year = Number(parts[2]);
  if (year >= 2400) year -= 543;
  else if (year < 100) year = year >= 40 ? year + 1957 : year + 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function numericArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(numericText).filter(Boolean).map(Number).filter((item) => Number.isFinite(item) && item > 0);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

export function normalizeOcrFields(input: OcrFields): NormalizedOcrFields {
  const weightEntriesKg = numericArray(input.weightEntriesKg ?? input.weightRows);
  const entryTotal = weightEntriesKg.length ? round2(weightEntriesKg.reduce((sum, value) => sum + value, 0)) : 0;
  const grossWeightKg = numericText(input.grossWeightKg ?? input.grossWeight) || (entryTotal > 0 ? String(entryTotal) : "");
  const tareWeightKg = numericText(input.tareWeightKg ?? input.tareWeight ?? input.basketTareWeightKg);
  const derivedNet = Number(grossWeightKg) > 0 ? round2(Number(grossWeightKg) - Number(tareWeightKg || 0)) : 0;
  const netWeightKg = numericText(input.netWeightKg ?? input.netWeight) || (derivedNet > 0 ? String(derivedNet) : "");
  const freshWeightKg = numericText(input.freshWeightKg);
  const drc = numericText(input.drc ?? input.dryRubberPercent);
  const dryWeightKg = numericText(input.dryWeightKg ?? input.dryRubberWeightKg);
  const explicitType = input.receiptType === "weigh_ticket" || input.receiptType === "rubber_form" ? input.receiptType : "";
  const inferredType = dryWeightKg || drc ? "rubber_form" : (grossWeightKg || netWeightKg || freshWeightKg ? "weigh_ticket" : "unknown");
  const receiptType = (explicitType || inferredType) as ReceiptType;
  const weightKg = numericText(input.weightKg) || (receiptType === "rubber_form" ? dryWeightKg : netWeightKg) || freshWeightKg;
  const unitPrice = numericText(input.unitPrice ?? input.pricePerKg ?? input.price);
  const grossSale = numericText(input.grossSale ?? input.totalAmount ?? input.amount);
  const explicitClass = ["rubber_receipt", "blank_template", "promotional_example", "not_receipt", "unreadable"].includes(String(input.documentClass || "")) ? String(input.documentClass) as ReceiptDocumentClass : "";
  const documentClass = explicitClass || (weightKg || unitPrice || grossSale ? "rubber_receipt" : "unreadable");
  return {
    ...input,
    documentClass,
    receiptType,
    saleDate: normalizeReceiptDate(input.saleDate),
    buyerName: text(input.buyerName ?? input.buyer),
    ticketNumber: text(input.ticketNumber ?? input.receiptNumber),
    productType: text(input.productType),
    freshWeightKg,
    drc,
    dryWeightKg,
    grossWeightKg,
    tareWeightKg,
    netWeightKg,
    weightKg,
    unitPrice,
    grossSale,
    buyerDeductions: numericText(input.buyerDeductions ?? input.deductions ?? 0) || "0",
    weightEntriesKg,
    uncertainFields: stringArray(input.uncertainFields),
    warnings: stringArray(input.warnings),
    needsReview: input.needsReview !== false,
    ocrError: text(input.ocrError)
  };
}

export function receiptTypeLabel(type: ReceiptType): string {
  if (type === "weigh_ticket") return "ใบชั่งน้ำหนัก / บิลเงินสด";
  if (type === "rubber_form") return "แบบฟอร์มน้ำยาง–เปอร์เซ็นต์–ยางแห้ง";
  return "ยังไม่ทราบรูปแบบใบเสร็จ";
}

export type ReceiptMathValidation = {
  weightConsistent: boolean | null;
  entrySumConsistent: boolean | null;
  netWeightConsistent: boolean | null;
  amountConsistent: boolean | null;
};

export function validateReceiptMath(fields: Pick<NormalizedOcrFields, "receiptType" | "freshWeightKg" | "drc" | "dryWeightKg" | "grossWeightKg" | "tareWeightKg" | "netWeightKg" | "weightEntriesKg" | "weightKg" | "unitPrice" | "grossSale" | "buyerDeductions">): ReceiptMathValidation {
  const fresh = Number(fields.freshWeightKg);
  const drc = Number(fields.drc);
  const dry = Number(fields.dryWeightKg);
  const grossWeight = Number(fields.grossWeightKg);
  const tareWeight = Number(fields.tareWeightKg || 0);
  const netWeight = Number(fields.netWeightKg);
  const weight = Number(fields.weightKg);
  const price = Number(fields.unitPrice);
  const amount = Number(fields.grossSale);
  const deductions = Number(fields.buyerDeductions || 0);
  const weightConsistent = fields.receiptType === "rubber_form" && fresh > 0 && drc > 0 && dry > 0 ? Math.abs(fresh * drc / 100 - dry) <= 0.5 : null;
  const entryTotal = fields.weightEntriesKg.length ? round2(fields.weightEntriesKg.reduce((sum, value) => sum + value, 0)) : 0;
  const entrySumConsistent = entryTotal > 0 && grossWeight > 0 ? Math.abs(entryTotal - grossWeight) <= 0.02 : null;
  const netWeightConsistent = grossWeight > 0 && netWeight > 0 ? Math.abs(grossWeight - tareWeight - netWeight) <= 0.02 : null;
  const amountConsistent = weight > 0 && price > 0 && amount > 0 ? Math.abs(round2(weight * price) - deductions - amount) <= 1.01 : null;
  return { weightConsistent, entrySumConsistent, netWeightConsistent, amountConsistent };
}

export function receiptReviewGate(fields: NormalizedOcrFields, humanReviewed: boolean): { canSubmit: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (fields.documentClass !== "rubber_receipt") reasons.push("ภาพนี้ไม่ใช่บิลขายที่กรอกข้อมูลแล้วหรืออ่านหลักฐานไม่ชัดเจน");
  if (fields.receiptType === "unknown") reasons.push("กรุณาเลือกรูปแบบใบเสร็จ");
  if (!fields.saleDate) reasons.push("กรุณาตรวจและระบุวันที่ขาย");
  if (!fields.buyerName) reasons.push("กรุณาตรวจและระบุร้านรับซื้อ");
  if (!fields.productType) reasons.push("กรุณาเลือกประเภทสินค้า");
  if (!(Number(fields.weightKg) > 0)) reasons.push("กรุณาตรวจน้ำหนักสุทธิ");
  if (!(Number(fields.unitPrice) > 0)) reasons.push("กรุณาตรวจราคาต่อกิโลกรัม");
  if (!(Number(fields.grossSale) > 0)) reasons.push("กรุณาตรวจยอดเงินในบิล");
  const math = validateReceiptMath(fields);
  if (math.weightConsistent === false) reasons.push("น้ำหนักยางสด เปอร์เซ็นต์ และน้ำหนักยางแห้งไม่สัมพันธ์กัน");
  if (math.entrySumConsistent === false) reasons.push("ผลรวมน้ำหนักรายแถวไม่ตรงกับน้ำหนักรวม");
  if (math.netWeightConsistent === false) reasons.push("น้ำหนักรวม หักตะกร้า และน้ำหนักสุทธิไม่สัมพันธ์กัน");
  if (math.amountConsistent === false) reasons.push("น้ำหนักคูณราคาไม่ตรงกับยอดเงินในบิล");
  if (!humanReviewed) reasons.push("กรุณายืนยันว่าได้ตรวจตัวเลขกับภาพบิลแล้ว");
  return { canSubmit: reasons.length === 0, reasons };
}
