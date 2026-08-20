function doGet(e) {
  return jsonResponse_(healthCheck_());
}

function doPost(e) {
  var request = parseRequest_(e);
  if (!request.requestId) return jsonResponse_(errorResponse_("REQUEST_ID_REQUIRED", "requestId is required", "unknown"));
  try {
    var cached = Idempotency.get(request.requestId);
    if (cached) return jsonResponse_(cached);
    var result = routeAction_(request);
    var response = okResponse_(request.requestId, result);
    Idempotency.put(request.requestId, response);
    return jsonResponse_(response);
  } catch (error) {
    return jsonResponse_(errorResponse_("API_ERROR", error.message || String(error), request.requestId));
  }
}

function parseRequest_(e) {
  var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  var parsed = JSON.parse(raw);
  return { action: String(parsed.action || ""), requestId: String(parsed.requestId || ""), payload: parsed.payload || {}, authToken: parsed.authToken || "" };
}

function routeAction_(request) {
  var user = Auth.requireUser(request.authToken);
  switch (request.action) {
    case "health.get": return healthCheck_();
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
