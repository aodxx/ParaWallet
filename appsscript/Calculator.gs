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
