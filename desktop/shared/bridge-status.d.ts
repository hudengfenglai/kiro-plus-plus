export type DesktopBridgeStatus = {
  available: boolean;
  complete: boolean;
  missingMethods: string[];
  presentMethodCount: number;
  totalMethodCount: number;
  summary: string;
  detail: string;
  tone: "success" | "warning" | "error";
};

export function getRequiredBridgeMethods(): string[];
export function inspectDesktopBridge(bridge: unknown): DesktopBridgeStatus;
