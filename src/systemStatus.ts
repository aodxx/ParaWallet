export type SystemStatusKind = "idle" | "working" | "success" | "partial" | "empty" | "offline" | "auth_error" | "api_error";

export type SystemStatusScope = "authentication" | "connection" | "action";

export type SystemStatus = {
  kind: SystemStatusKind;
  scope: SystemStatusScope;
  title: string;
  detail: string;
  nextAction: string;
  retryable: boolean;
  dismissible: boolean;
  updatedAt: string;
};

export function createSystemStatus(
  scope: SystemStatusScope,
  kind: SystemStatusKind,
  title: string,
  detail: string,
  options: Partial<Pick<SystemStatus, "nextAction" | "retryable" | "dismissible" | "updatedAt">> = {},
): SystemStatus {
  return {
    kind,
    scope,
    title,
    detail,
    nextAction: options.nextAction || "",
    retryable: options.retryable === true,
    dismissible: options.dismissible === true,
    updatedAt: options.updatedAt || "",
  };
}

export const idleSystemStatus = (scope: SystemStatusScope) => createSystemStatus(scope, "idle", "พร้อมใช้งาน", "", { dismissible: true });

export const isErrorStatus = (status: SystemStatus) => ["offline", "auth_error", "api_error"].includes(status.kind);

export const shouldShowStatus = (status: SystemStatus) => status.kind !== "idle" && status.kind !== "empty";
