var DriveStorage = {
  save: function (base64, mimeType, filename, folderType, ownerId) {
    var root = DriveApp.getFolderById(Config.driveRootId());
    var folders = root.getFoldersByName(folderType); var folder = folders.hasNext() ? folders.next() : root.createFolder(folderType);
    var bytes = Utilities.base64Decode(String(base64).split(",").pop()); var file = folder.createFile(Utilities.newBlob(bytes, mimeType || "application/octet-stream", filename || "evidence"));
    Repositories.append("Files", { id: Utilities.getUuid(), driveFileId: file.getId(), folderType: folderType, mimeType: mimeType, name: file.getName(), ownerId: ownerId, createdAt: new Date().toISOString() }); return { fileId: file.getId(), name: file.getName() };
  }
};

var OCR = {
  extract: function (fileBase64, mimeType) {
    var prompt = "Extract rubber sale receipt fields as JSON: saleDate, buyerName, productType, weightKg, unitPrice, grossSale, buyerDeductions. Return only JSON.";
    if (Config.geminiKey()) return this.gemini_(fileBase64, mimeType, prompt);
    if (Config.visionKey()) return this.vision_(fileBase64, mimeType);
    return { provider: "none", confidence: 0, needsReview: true, fields: {} };
  },
  gemini_: function (base64, mimeType, prompt) { var response = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(Config.geminiKey()), { method: "post", contentType: "application/json", payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }] }), muteHttpExceptions: true }); var body = JSON.parse(response.getContentText()); var text = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text || "{}"; return { provider: "gemini", confidence: 0.75, needsReview: true, fields: JSON.parse(text.replace(/```json|```/g, "").trim()) }; },
  vision_: function (base64, mimeType) { var response = UrlFetchApp.fetch("https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(Config.visionKey()), { method: "post", contentType: "application/json", payload: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }), muteHttpExceptions: true }); return { provider: "vision", confidence: 0.55, needsReview: true, fields: { rawText: JSON.parse(response.getContentText()) } }; }
};

var Services = {
  dashboard: function (user) { var gardens = Repositories.gardensForUser(user.id); return { role: user.role, garden: gardens[0] || null, wallet: { owner: 0, tapper: 0, outstanding: 0, currency: "THB" }, pendingReviews: 0, monthlySales: 0 }; },
  createSale: function (user, payload) { return Locking.run("sale:" + payload.gardenId, function () { var calc = Calculator.sale(payload); var id = Utilities.getUuid(); Repositories.append("Sales", { id: id, gardenId: payload.gardenId, agreementId: payload.agreementId, tapperId: user.id, saleDate: payload.saleDate, buyerName: payload.buyerName, productType: payload.productType, weightKg: payload.weightKg, unitPrice: payload.unitPrice, grossSale: calc.grossSale, buyerDeductions: payload.buyerDeductions || 0, sharedExpenses: payload.sharedExpenses || 0, splitBase: calc.splitBase, ownerShare: calc.ownerShare, tapperShare: calc.tapperShare, status: "pending_owner_review", createdAt: new Date().toISOString() }); return { id: id, calculation: calc, status: "pending_owner_review" }; }); },
  createPayment: function (user, payload) { return Locking.run("payment:" + payload.gardenId, function () { var id = Utilities.getUuid(); Repositories.append("Payments", { id: id, gardenId: payload.gardenId, saleId: payload.saleId, fromUserId: user.id, toUserId: payload.toUserId, amount: payload.amount, method: payload.method, reference: payload.reference, status: "pending", paidAt: payload.paidAt, createdAt: new Date().toISOString() }); return { id: id, status: "pending" }; }); },
  confirmPayment: function (user, payload) { return Locking.run("payment-confirm:" + payload.id, function () { Repositories.append("AuditLogs", { id: Utilities.getUuid(), actorId: user.id, entityType: "payment", entityId: payload.id, action: "confirm", requestId: payload.requestId, createdAt: new Date().toISOString() }); return { success: true }; }); },
  extractReceipt: function (user, payload) { var file = DriveStorage.save(payload.data, payload.mimeType, payload.filename, "receipts", user.id); var result = OCR.extract(payload.data, payload.mimeType); Repositories.append("OcrRecords", { id: Utilities.getUuid(), fileId: file.fileId, provider: result.provider, status: result.needsReview ? "needs_review" : "ready", confidence: result.confidence, rawJson: JSON.stringify(result.fields), createdAt: new Date().toISOString() }); return { file: file, ocr: result }; }
};
