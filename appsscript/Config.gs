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
  allowedOrigins: function () { return this.get("ALLOWED_ORIGINS", false).split(",").filter(Boolean); }
};

var Auth = {
  requireUser: function (token) {
    var email = token || Session.getActiveUser().getEmail();
    if (!email) throw new Error("AUTH_REQUIRED");
    var user = Repositories.findUserByEmail(email);
    if (!user) throw new Error("USER_NOT_REGISTERED");
    return user;
  }
};
