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
